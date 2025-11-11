Below is a product‑first → system‑level PRD for moving Scry to a Concepts‑with‑Phrasings model, plus a concrete, codebase‑grounded implementation plan (Convex/Next.js 15, Google Gemini + text‑embedding‑004, Pino logging, FSRS), a migration path, cron/agent design, and a prioritized backlog. I’ve tied specific details to your current repo where relevant.

⸻

PRD — Scry “Concepts & Phrasings” (C&P) + Intelligent Reclustering

0) Problem & philosophy
	•	Problem: An explosion of near‑duplicate cards makes review queues unmanageable. We’ve intentionally refused daily limits or “comfort caps,” keeping Scry faithful to memory science and “pure FSRS,” but our current question‑centric model multiplies due counts when generation yields many paraphrases of the same underlying idea.  ￼  ￼
	•	Non‑negotiables:
	•	Keep no daily limits / no comfort features; be honest about debt.  ￼
	•	Keep pure FSRS; don’t nerf scheduling to feel nicer.  ￼
	•	Leverage existing Convex, Next.js 15 App Router, Vercel AI SDK + Google Gemini, Pino logs.  ￼  ￼
	•	Use our embeddings module (text‑embedding‑004, 768‑dim) and vector index already present.  ￼  ￼

1) Vision: Memory OS, concept‑first
	•	Concept as the atomic unit of knowledge. A concept owns the learning state; phrasings (what we used to call “questions”) are alternate prompts/angles to probe the same concept.
	•	Reviews are concept‑scheduled. A concept becomes due; the system serves one phrasing (or a short rotating set) to test it. This removes the combinatorial spam from near‑duplicates without adding daily limits.
	•	Intelligent Quality Control (IQC): Always‑on agents/cronjobs propose reclustering:
	•	Consolidate duplicate concepts, split overloaded concepts, assign orphaned phrasings, backfill thin concepts with new high‑quality phrasings, and retire low‑signal phrasings.
	•	Generation v2 (concept‑first): Input → learning objectives → atomic concepts → sanity check → write concepts → enqueue per‑concept phrasing generation + validation. (Uses your “phase” runner pattern: query / compute / llm.)  ￼

2) Primary user outcomes
	•	Smaller, truer due counts (one per concept at a time) without “limits.”
	•	Higher question quality via concept‑aware generation & validation.
	•	Review efficiency: variation by phrasing without more debt.
	•	Actionable housekeeping: a unified “Action Inbox” (confirm merges, splits, assignments, fill‑outs).

3) Non‑goals (for this tranche)
	•	No Postpone/Snooze in this branch (design later).
	•	No change to core FSRS math; we refactor where it runs.
	•	Free response is out of scope until C&P is stable (but we keep schema headroom).

⸻

System Design (grounded in today’s code)

4) Data model (Convex)

Current state:
	•	questions holds items with FSRS fields, text, optional type, and a 768‑dim embedding; full‑text & vector indexes exist.  ￼  ￼
	•	interactions holds answer attempts.  ￼
	•	Embedding service exists (generateEmbedding), with planned hybrid search & backfill.  ￼

4.1 New tables

// convex/schema.ts (new)
concepts: defineTable({
  userId: v.id('users'),
  title: v.string(),               // concise, user-facing
  description: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),

  // FSRS state LIVES HERE going forward
  fsrs: v.object({
    stability: v.number(),
    difficulty: v.number(),
    lastReview: v.optional(v.number()),
    nextReview: v.number(),
    elapsedDays: v.optional(v.number()),
    retrievability: v.optional(v.number()),
  }),

  // Signals for IQC
  phrasingCount: v.number(),
  conflictScore: v.optional(v.number()), // heuristic for “overloaded”
  thinScore: v.optional(v.number()),     // heuristic for “needs more”
  qualityScore: v.optional(v.number()),

  // Embedding of canonical concept text (title + desc)
  embedding: v.optional(v.array(v.float64())),
  embeddingGeneratedAt: v.optional(v.number()),
})
  .index('by_user', ['userId', 'createdAt'])
  .index('by_user_next_review', ['userId', 'fsrs.nextReview'])
  .vectorIndex('by_embedding', {
    vectorField: 'embedding',
    dimensions: 768,
    filterFields: ['userId'],
  }),

phrasings: defineTable({
  userId: v.id('users'),
  conceptId: v.id('concepts'),
  // Preserve compatibility with "question" semantics
  question: v.string(),
  explanation: v.optional(v.string()),
  type: v.optional(v.union(
    v.literal('multiple-choice'),
    v.literal('true-false'),
    v.literal('cloze'),
    v.literal('short-answer') // scaffold for later free-response
  )),
  options: v.optional(v.array(v.string())), // for MCQ, preserved
  correctAnswer: v.optional(v.string()),

  // local stats (not the scheduler of truth)
  attemptCount: v.optional(v.number()),
  correctCount: v.optional(v.number()),
  lastAttemptedAt: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  archivedAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),

  // Embedding per phrasing (as today)
  embedding: v.optional(v.array(v.float64())),
  embeddingGeneratedAt: v.optional(v.number()),
})
  .index('by_user_concept', ['userId', 'conceptId', 'createdAt'])
  .index('by_user_active', ['userId', 'deletedAt', 'archivedAt', 'createdAt'])
  .searchIndex('search_phrasings', { searchField: 'question', filterFields: ['userId', 'deletedAt', 'archivedAt'] })
  .vectorIndex('by_embedding', { vectorField: 'embedding', dimensions: 768, filterFields: ['userId', 'deletedAt', 'archivedAt'] }),

// “IQC” jobs and decisions
reclusterJobs: defineTable({
  userId: v.id('users'),
  status: v.union(v.literal('queued'), v.literal('running'), v.literal('done'), v.literal('failed')),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
  stats: v.optional(v.any()),
}),

actionCards: defineTable({
  userId: v.id('users'),
  kind: v.union(
    v.literal('MERGE_CONCEPTS'),
    v.literal('SPLIT_CONCEPT'),
    v.literal('ASSIGN_ORPHANS'),
    v.literal('FILL_OUT_CONCEPT'),
    v.literal('RENAME_CONCEPT')
  ),
  payload: v.any(),          // concrete proposal (IDs, reason strings)
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
  resolvedAt: v.optional(v.number()),
  resolution: v.optional(v.union(v.literal('accepted'), v.literal('rejected')))
})
  .index('by_user_open', ['userId', 'resolvedAt', 'createdAt'])

Notes
• We will keep the existing questions table temporarily as the long tail migrates; we’ll add a field conceptId to it and later rename/retire. Use the documented 3‑phase migration pattern, with runtime property checks and batching to avoid schema explosions.  ￼  ￼  ￼
• The vector indexes mirror your existing pattern (768‑dim text‑embedding‑004).  ￼

5) Scheduling: concept‑level FSRS, phrasing‑level variation
	•	Single source of truth = concept.fsrs (move FSRS fields off the question).
	•	Selection policy when a concept is due: choose a phrasing by a weighted policy (prefer least‑seen, prefer recently edited, occasionally surface the canonical phrasing).
	•	On answer: update concept.fsrs via your FSRS engine; update phrasing’s local counters for analytics; record the interaction referencing both conceptId and phrasingId. We refactor spacedRepetition.ts into fsrs/conceptScheduler.ts + fsrs/selectionPolicy.ts (you already identified the god‑object risk).  ￼  ￼

Why concept‑level FSRS?
	•	It eliminates duplicate scheduling pressure at the root (one due record per knowledge atom), consistent with Scry’s “no caps” stance.
	•	It preserves pure FSRS math; we’re just moving where it’s applied. (We keep today’s “automatic scheduling based on correctness”.)  ￼

6) Generation v2: concept‑first pipeline

Use your documented phase runner (query/compute/llm) to build a two‑stage flow.  ￼

Stage A — Concept synthesis
	1.	query: pull related library/performance (weak areas last 30 d).
	2.	compute: derive learning objectives from user input + history.
	3.	llm: propose multiple atomic concepts (not 1) with titles/descriptions.
	4.	compute: sanity‑check atomization (no multi‑topic globs; heuristics).
	5.	mutation: write concepts; enqueue Stage B per concept.

Stage B — Phrasing generation
	1.	llm: generate N diverse phrasings for one concept ( constrained by types you support now; free‑response later).
	2.	compute: sanity checks (no trivial rewordings; option quality; unique answer keys).
	3.	mutation: write phrasings; kick embedding generation in batch. (Use generateEmbedding and chunking helpers; you already have tested utilities e.g., chunkArray and merging patterns.)  ￼  ￼  ￼

Context: This is fully aligned with your AI integration stack (Vercel AI SDK + Google Gemini).  ￼

7) Intelligent Quality Control (IQC): dedup → reclustering → concept QA

We lean on vector neighbors + LLM adjudication, not just brittle heuristics.

IQC daily cron (per user, bounded):
	1.	Candidate discovery
	•	Pull recent concepts; for each, vector search near neighbors by concept embedding; also semantic search over phrasings using your hybrid merge strategy (vector first, then text), which you already unit‑test.  ￼  ￼
	•	Flag clusters where intra‑cluster semantic distance < τ or surface area (topic drift) > δ.
	2.	LLM adjudication
	•	For each cluster, ask LLM: merge? split? reassign orphan phrasings? keep separate but rename? Provide examples + statistics (attempt counts, last seen, correctness, embeddings cosine).
	3.	Action Cards
	•	Persist proposals as actionCards (MERGE_CONCEPTS, SPLIT_CONCEPT, ASSIGN_ORPHANS, FILL_OUT_CONCEPT, RENAME_CONCEPT). Show in an Action Inbox for one‑tap “Accept / Reject”.
	•	On accept, run idempotent mutations: merge concept IDs, move phrasings, recompute concept.fsrs from rules below, delete empty shells.
	•	On reject, record feedback for the scorer.
	4.	Edge cases it must cover (your ask):
	•	Orphaned phrasings → assign to nearest concept (or create a new concept).
	•	Overloaded concepts → split by sub‑themes.
	•	Duplicate concepts → merge into a single canonical.
	•	Too‑thin concepts → generate more phrasings (FILL_OUT_CONCEPT).
	•	Low‑signal phrasing → archive with reason and undo.

Embeddings are already called out as the foundation for dedup, related search, knowledge graph, and more; we are simply operationalizing that here.  ￼

FSRS merge/split rules
	•	Merge: pick the most‑observed phrasing as “anchor,” initialize concept.fsrs from its FSRS, then replay recent interactions from the others in timestamp order, updating concept.fsrs (bounded by K events for perf). (Replaying to preserve memory state while avoiding math hacks.)
	•	Split: duplicate parent FSRS to each child concept, then down‑adjust stability by a small factor based on how much evidence remains with each child (so we do not over‑trust thin evidence). (Explicit parameters in acceptance tests.)
	•	Assign: unchanged FSRS of target concept; just increase phrasingCount.

All IQC steps log via Pino with the ai, database, and a new concepts context for observability.  ￼

8) API surface (Convex)

New/internal module stubs (names follow your patterns: internalAction, internalQuery, etc.).  ￼
	•	concepts:createMany (mutation) — write validated concepts; enqueue per‑concept phrasing generation.
	•	concepts:getDue (query) — return due concepts ordered by fsrs.nextReview.
	•	concepts:selectPhrasing (compute) — server helper to pick phrasing for a due concept.
	•	concepts:recordInteraction (mutation) — writes interactions with { conceptId, phrasingId }, updates concept.fsrs.
	•	phrases:generateForConcept (action) — runs Stage B; calls embeddings:generateEmbedding in batches.  ￼
	•	iqc:scanAndPropose (action/cron) — runs IQC step 1–3.
	•	iqc:applyActionCard (mutation) — idempotent merge/split/assign/fill.
	•	embeddings:syncMissingEmbeddings (action/cron) — daily backfill (you annotated this as a planned function).  ￼

9) UI / UX
	•	Concepts Library (new left‑nav tab): grid/list of concepts with chip for phrasing count, due state, and a small conflict/thin signal.
	•	Concept detail: shows concept title/desc; Phrasings sublist; “Generate more phrasings”; “Set canonical phrasing”; “Archive phrasing.”
	•	Action Inbox: system proposals with diff previews (merge list, split preview clusters, orphan assignments). Accept / Reject (keyboard friendly; we already rely on keyboard shortcuts heavily).  ￼
	•	Review: stays fast and minimal; when a concept is due we show one phrasing; your optimistic UI + logging patterns remain unchanged.  ￼

10) Instrumentation & success metrics
	•	Primary:
	•	Δ in median due items per day (concept‑deduped) at same generation volume.
	•	Acceptance rate of IQC action cards; false‑positive rate (rejects).
	•	Time‑to‑first‑answer per due concept; retention (FSRS retrievability).
	•	Safety: zero data loss across merges/splits; interaction count parity pre/post.
	•	Perf: cron bounded to N concepts/day/user; all reads via indexed queries; no O(N) scans (you’ve documented the anti‑pattern).  ￼

⸻

Engineering Plan

11) Migration strategy (idempotent, verifiable, batched)
	1.	Add new tables (concepts, phrasings, reclusterJobs, actionCards).
	2.	Add conceptId to questions as optional; deploy (Phase 1 of 3‑phase).  ￼
	3.	Backfill v0 concepts:
	•	Seed a concept per existing question (1:1) to keep semantics while we bootstrap.
	•	Write phrasings from questions.
	•	Initialize concept.fsrs from the question’s FSRS fields verbatim.
	•	Mark questions.conceptId to keep references consistent.
	•	Use batch processing (chunkArray) and diagnostic queries to verify counts before/after.  ￼  ￼
	4.	Recluster pass:
	•	For each user, group candidate similar questions by vector neighbors (via by_embedding). Generate MERGE_CONCEPTS proposals where obvious. (Cron gated).  ￼
	5.	Once coverage is good, stop reading FSRS from questions in runtime; FSRS moves to concepts.
	6.	Retire/rename questions → phrases once traffic stabilizes; follow the 3‑phase removal pattern for any leftover fields.  ￼

Follow your migration playbook (dry‑run → approve → run → diagnostics), and avoid TypeScript property‑check pitfalls that get erased at compile time.  ￼  ￼

12) FSRS refactor (no change to math)
	•	Extract fsrs/ modules from spacedRepetition.ts:
	•	fsrs/engine.ts (pure functions),
	•	fsrs/conceptScheduler.ts (applies engine to concept.fsrs),
	•	fsrs/selectionPolicy.ts (choose phrasing).
	•	Keep automatic scheduling on correctness as today; just switch the state container.  ￼  ￼

13) Embeddings & search
	•	Use embeddings.generateEmbedding for concept titles/desc and phrasings (already in repo). Add syncMissingEmbeddings cron (you noted as “later phase”).  ￼
	•	For IQC candidate sets, combine vector + text search using your tested mergeSearchResults (vector first, dedup).  ￼

14) IQC cron & action workflow
	•	iqc:scanAndPropose (internal action)
	•	Take recent/changed concepts; find neighbors; coarse cluster; send top‑k clusters to LLM with stats to propose actions.
	•	Persist to actionCards.
	•	iqc:applyActionCard (internal mutation)
	•	MERGE: move all phrasing.conceptId to target; replay last M interactions from source concepts in chronological order to update target FSRS; mark source concepts deleted; log.
	•	SPLIT: create new concepts; distribute phrasing sets; copy fsrs with stability penalty; log.
	•	ASSIGN_ORPHANS: move phrasing; log.
	•	FILL_OUT_CONCEPT: enqueue phrasing generation Stage B.
	•	All with Pino domain loggers (ai, database, concepts) and your request correlation pattern.  ￼

15) API & UI changes
	•	Replace “Due Questions” query with concepts:getDue.
	•	Review page calls concepts:selectPhrasing then concepts:recordInteraction.
	•	New Concepts Library & Concept detail pages (App Router).
	•	Action Inbox page (accept/reject).
	•	Preserve your optimistic UI approach and perf envelopes.  ￼

16) Testing strategy (fits your current practice)
	•	Simulator tests for FSRS concept scheduler & selection policy; state machine tests for action application (merge/split/assign). Your testing guidance already emphasizes business‑logic simulators and permission/state transitions; reuse it.  ￼
	•	Embeddings utilities are already test‑hardened; extend them minimally.  ￼
	•	Migration diagnostics tests (counts match; no orphaned references). Use the dry‑run + diagnostic function pattern.  ￼

17) Observability & ops
	•	Add concepts logger context; monitor IQC action volumes, accept/reject, merge times. Pino structure & request correlation already in place.  ￼
	•	CI/CD stays GitHub → Vercel + Convex; production health checks unchanged.  ￼  ￼

⸻

Backlog & priorities

P0 — Foundations (ship behind a flag; target small cohorts)
	1.	Schema add: new tables + conceptId on questions. (Migrations 3‑phase scaffolding + diagnostics).  ￼
	2.	FSRS refactor to concept‑level (engine extraction + concept scheduler).  ￼
	3.	Minimal Review path: concepts:getDue → selectPhrasing → recordInteraction.
	4.	Generation v2 Stage A/B: concept synthesis + per‑concept phrasing generation using your phase runner.  ￼
	5.	Embeddings backfill cron for concepts & phrasings.  ￼
	6.	Action Inbox (MVP) + iqc:scanAndPropose for MERGE_CONCEPTS only (lowest risk, highest payoff).
	7.	Hybrid search helper for IQC candidate discovery (use mergeSearchResults).  ￼

P0 success gates
	•	Due count per heavy user drops (concept‑deduped) with no loss of retention.
	•	0 data loss across merges; 0 schema errors (health check clean).  ￼

P1 — Quality & coverage
	1.	IQC: SPLIT_CONCEPT and ASSIGN_ORPHANS; FILL_OUT_CONCEPT (auto‑generation when phrasingCount < N).
	2.	Concept detail UX polish; canonical phrasing; “Generate more” button.
	3.	Concept analytics panel: attempt distribution, retrievability trend. (Use existing analytics patterns.)  ￼
	4.	Performance hardening: bound cron work; add compound indexes where needed (you’ve flagged unbounded queries as a perf risk).  ￼

P2 — Expansion
	1.	Free‑response phrasing type (scoring & evaluation prompt set).
	2.	Postpone/Snooze as a concept‑level action (and optionally “this phrasing” vs “similar phrasings” once the groundwork is solid).
	3.	Export/import at concept granularity.

⸻

Key design choices (and why)
	•	Concept‑level FSRS vs phrasing‑level FSRS
	•	Chosen: concept‑level to prevent schedule amplification. Preserves “no caps” while removing duplicate debt. Phrasing stats remain for analytics/selection.
	•	LLM‑augmented IQC vs deterministic only
	•	Chosen: LLM‑first + embeddings with guardrails. Your own docs call embeddings “foundational,” and deterministic heuristics alone are brittle at scale.  ￼
	•	Phase runner for generation
	•	Chosen: aligns with your pipeline vision and keeps context flowing (query → compute → llm).  ￼
	•	Incremental migration
	•	Chosen: zero downtime, reversible, observable; consistent with your migration guide (dry‑run, diagnostics, batching, runtime checks).  ￼  ￼

⸻

Acceptance criteria (engineer‑ready)
	1.	With C&P enabled, review queue shows due concepts; serving one phrasing per due concept.
	2.	Answering a phrasing updates concept.fsrs and logs an interaction with both ids; phrasing counters increment. (No FSRS fields updated on the phrasing.)
	3.	Action Inbox displays MERGE_CONCEPTS proposals with previews. Accepting a merge moves phrasings, replays the last M interactions from the sources into the target concept’s FSRS, deletes sources, and logs.
	4.	Generation v2: Given a user input, Stage A writes ≥1 atomic concepts; Stage B writes ≥K validated phrasings per concept with embeddings generated asynchronously.
	5.	No unindexed scans; all cron/queries bounded; health checks clean after deployment.  ￼

⸻

Implementation scaffolding (file‑level pointers)
	•	Embeddings: keep generateEmbedding, add syncMissingEmbeddings() + batched enqueue per chunkArray (already tested).  ￼  ￼
	•	Search: reuse your hybrid merge behavior for IQC candidate pull.  ￼
	•	FSRS refactor: split spacedRepetition.ts per the “god object” note.  ￼
	•	Logging: new conceptsLogger child in lib/logger.ts; reuse contexts (ai, database, performance).  ￼
	•	DevOps: keep CI/CD to Vercel+Convex with the runbooks you have; production health check unchanged.  ￼  ￼

⸻

Why this solves your core pain (without betraying the ethos)
	•	The overload is emergent from modeling “question” as the scheduler primitive. By moving scheduling to concepts, we cut duplicate due items at the root—no band‑aid daily caps, no sledgehammer—staying aligned with Scry’s philosophy.  ￼
	•	Phrasing variation increases learning quality while not multiplying debt, and IQC maintains atomicity as libraries scale.
	•	The plan leans on your existing stack—Convex tables and indexes, embeddings service, FSRS, Pino logging—minimizing risk.  ￼  ￼  ￼

⸻

Open detail you may want to tune (defaults I would ship)
	•	Selection policy: 60% least‑seen phrasing, 30% random among remaining, 10% canonical phrasing.
	•	Recluster cadence: daily, cap 200 concepts/user or 30s CPU budget (whichever first).
	•	FSRS replay M: 50 recent interactions/source concept during merge (configurable).
	•	Thin concept threshold: phrasingCount < 3 ⇒ propose FILL_OUT_CONCEPT.
	•	Overloaded concept signal: bimodality in neighbor graph + low internal cosine similarity ⇒ propose SPLIT_CONCEPT.

If you want, I can draft the exact Convex internalAction/internalQuery signatures and the LLM prompts (concept atomization / phrasing generation / cluster adjudication) next; the above is sufficient for a senior engineer to implement straight away using your patterns and runbooks.
