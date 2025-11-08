# TODO — Concepts & Phrasings Launch

## Phase 0 — Schema & Data Safety

- [x] Boot concepts/phrasings schema + typegen
  ```
  Work Log:
  - Added 4 new tables to schema: concepts, phrasings, reclusterJobs, actionCards
  - Added optional conceptId field to questions table (Phase 1 migration strategy)
  - Created types/concepts.ts with ConceptDoc, PhrasingDoc, FsrsState, IqcScores
  - Updated types/questions.ts to include conceptId and re-export concept types
  - Bumped schema version 2.2.0 → 2.3.0 in both schemaVersion.ts and deployment-check.ts
  - Regenerated Convex types successfully (9 new indexes added)
  - All tests pass (499/499), lint clean, no conceptId leakage beyond intended locations
  - Commits: f6aadd8 (feat), d47c286 (prettier formatting)

  Files: convex/schema.ts:34-200, convex/schemaVersion.ts:1-33, lib/deployment-check.ts:20-85, types/questions.ts:1-55, types/concepts.ts (new), convex/_generated/api.ts (auto), convex/_generated/dataModel.d.ts (auto)
  Pattern: Mirror the questions defineTable signature + vector/search indexes in convex/schema.ts:34-86 and the schema version sync pattern used last in SCHEMA_VERSION/lib/deployment-check.ts.

  Approach:
  1. Update convex/schema.ts
     - Add `conceptId: v.optional(v.id('concepts'))` to questions table near other denormalized fields so existing indexes remain unchanged.
     - Append new tables exactly as specified in TASK.md §4.1: `concepts`, `phrasings`, `reclusterJobs`, `actionCards`. Reuse question table conventions:
       * FSRS object matches fields listed in spec (stability, difficulty, lastReview, nextReview, elapsedDays, retrievability) inside a `v.object`.
       * Indexes: `.index('by_user', ['userId', 'createdAt'])` and `.index('by_user_next_review', ['userId', 'fsrs.nextReview'])` on concepts; `.vectorIndex('by_embedding', { vectorField: 'embedding', dimensions: 768, filterFields: ['userId'] })`.
       * Phrasings table keeps `question`, `type`, `options`, `correctAnswer`, attempt stats, soft-delete fields, and both `.index('by_user_concept', ['userId','conceptId','createdAt'])`, `.index('by_user_active', ['userId','deletedAt','archivedAt','createdAt'])`, `.searchIndex('search_phrasings', ...)`, `.vectorIndex('by_embedding', ...)`.
       * `reclusterJobs` and `actionCards` tables follow the status/payload shapes from TASK.md; ensure actionCards has `.index('by_user_open', ['userId','resolvedAt','createdAt'])`.
     - Keep comments emphasizing migration phases per Project Guidelines.
  2. Bump schema version
     - Set `SCHEMA_VERSION` in convex/schemaVersion.ts to `2.3.0` (next minor) and mirror the same string in `lib/deployment-check.ts`’s `FRONTEND_VERSION`.
  3. Add TypeScript surface
     - Create `types/concepts.ts` defining `ConceptDoc` and `PhrasingDoc` interfaces keyed by `Id<'concepts'>`/`Id<'phrasings'>` (see `types/questions.ts` style) and export helper types (FSRS state, IQC scores).
     - In `types/questions.ts`, add optional `conceptId?: Id<'concepts'>;` to `Question` plus re-export Concept types if UI layers need them.
  4. Regenerate Convex types
     - From repo root run `pnpm convex dev --once schema` to emit the updated `convex/_generated/api.ts` and `dataModel.d.ts`. Commit the generated files.
  5. Sanity-check compilation
     - Run `pnpm lint convex/schema.ts` to ensure schema formatting/comments pass, and `pnpm test convex/migrations.test.ts` to confirm snapshot helpers reflect new tables.

  Success criteria:
  - Convex codegen produces Doc/Id types for `concepts`, `phrasings`, `reclusterJobs`, `actionCards`, and adds `questions.conceptId` without TS errors.
  - `pnpm lint` + `pnpm test convex/migrations.test.ts` pass locally with no skipped tests.
  - Running `rg "conceptId"` in repo only shows the newly added optional field and future TODO references (no accidental required usage).

  Edge cases:
  - Ensure vector/search indexes include `deletedAt`/`archivedAt` filter fields on phrasings so existing library filters stay performant.
  - Keep new optional fields out of existing interfaces until migrations populate them; do not make FSRS object optional at root (whole object required).

  Dependencies: none
  Estimate: 1.5h
  ```

- [x] Seed v0 concepts + phrasings from legacy questions
  ```
  Work Log:
  - Implemented seedConceptsFromQuestions internalMutation
  - Creates 1:1:1 mapping (question → concept → phrasing) preserving FSRS state
  - Added checkConceptsSeedingStatus diagnostic query for migration progress
  - Batched processing (500 questions/batch) with cursor-based pagination
  - Idempotent: runtime property checks skip already-linked questions
  - Test coverage: 11 new tests (dry-run, idempotency, batching, errors, edge cases)
  - All 510 tests pass, lint clean
  - Commits: 8132ee7 (feat), 0eab779 (prettier)

  Files: convex/migrations.ts, convex/migrations.test.ts, convex/questionsBulk.ts, scripts/run-migration.sh
  Goal: Allocate concept per question, copy FSRS fields to concept.fsrs, write phrasing rows, backfill questions.conceptId via chunked migration with diagnostics.
  Acceptance:
    - Dry-run diagnostic prints matching counts (questions == phrasings == concepts) before commit; runtime property checks guard optional fields.
    - Production run writes batches ≤500 docs, logs summary, rerunnable without duplicates.
  Tests:
    - pnpm test convex/migrations.test.ts (new fixtures verifying counts, chunking, diag output)
  Dependencies: Boot concepts/phrasings schema + typegen
  Estimate: 2h
  ```

## Phase 1 — FSRS & Review Core

- [ ] Extract FSRS engine into deep modules
  ```
  Files: convex/spacedRepetition.ts, convex/fsrs/engine.ts, convex/fsrs/conceptScheduler.ts, convex/fsrs/selectionPolicy.ts, convex/fsrs.test.ts
  Goal: Move pure math into fsrs/engine, conceptScheduler orchestrates FSRS state on concepts, selectionPolicy encapsulates phrasing weighting (least-seen/random/canonical).
  Acceptance:
    - spacedRepetition.ts thin wrapper around conceptScheduler; no question-level FSRS writes remain.
    - engine + scheduler covered by deterministic tests for Good/Again paths and stability/difficulty transitions.
  Tests:
    - pnpm test convex/fsrs.test.ts (extend to cover conceptScheduler + selectionPolicy)
    - pnpm test convex/spacedRepetition.test.ts
  Dependencies: Seed v0 concepts + phrasings from legacy questions
  Estimate: 1.5h
  ```

- [ ] Ship concept queue Convex surface
  ```
  Files: convex/concepts.ts (new), convex/questionsInteractions.ts, convex/interactions.ts, convex/_generated/api.ts, convex/scheduling.ts
  Goal: Implement concepts:getDue, concepts:selectPhrasing, concepts:recordInteraction; interactions capture conceptId + phrasingId; concept.fsrs + phrasing stats update atomically.
  Acceptance:
    - concepts:getDue orders by fsrs.nextReview index, respects lock semantics, returns phrasing candidate payload.
    - concepts:recordInteraction writes interaction, increments phrasing attempt/correct counters, updates concept.fsrs via conceptScheduler, bumps userStats.due counts.
  Tests:
    - pnpm test convex/spacedRepetition.test.ts (wire through concept state)
    - pnpm test convex/questionsInteractions.test.ts (add concept coverage)
  Dependencies: Extract FSRS engine into deep modules
  Estimate: 1.75h
  ```

- [ ] Convert review flow UI to concept-first
  ```
  Files: hooks/use-review-flow.ts, hooks/use-quiz-interactions.ts, components/review-flow.tsx, components/review-question-display.tsx, contexts/current-question-context.tsx, types/questions.ts
  Goal: Fetch concepts via concepts:getDue, render chosen phrasing, submit answers through concepts:recordInteraction, keep optimistic UI + keyboard shortcuts intact.
  Acceptance:
    - ReviewFlow shows concept title, phrasing text, due counter reflects concepts not questions.
    - trackAnswer stores conceptId + phrasingId and continues to surface nextReview feedback in UI.
  Tests:
    - pnpm test hooks/use-review-flow.test.ts (update fixtures + polling expectations)
    - pnpm test components/review-flow.test.tsx (snapshot/primitives)
  Dependencies: Ship concept queue Convex surface
  Estimate: 1.75h
  ```

## Phase 2 — Generation & Embeddings

- [ ] Stage A concept synthesis pipeline
  ```
  Files: convex/aiGeneration.ts, convex/generationJobs.ts, convex/concepts.ts, lib/ai/prompt-templates.ts, types/concepts.ts
  Goal: Phase runner writes validated concept docs (title, description, fsrs init, phrasingCount=0), enqueues Stage B job per concept with metadata.
  Acceptance:
    - Generation job log shows Stage A status, created concepts reference userId + embedding placeholder, job progress stats updated.
    - Concept creation guarded by heuristics (atomization sanity) + rejects invalid payloads with actionable error.
  Tests:
    - pnpm test convex/aiGeneration.test.ts (add Stage A cases + failure path)
  Dependencies: Boot concepts/phrasings schema + typegen
  Estimate: 1.5h
  ```

- [ ] Stage B phrasing generation action
  ```
  Files: convex/aiGeneration.ts, convex/aiGeneration.test.ts, convex/embeddings.ts, convex/phrasings.ts (helper), convex/cron.ts
  Goal: Implement phrases:generateForConcept action that batches LLM phrasing proposals, validates options/answers, writes phrasings, kicks embeddings per chunkArray.
  Acceptance:
    - Action enqueues embeddings.generateEmbedding calls (batched) and increments concept.phrasingCount, thin/conflict scores recalculated.
    - Generation job record reflects Stage B success/failure counts per concept.
  Tests:
    - pnpm test convex/aiGeneration.test.ts (Stage B success + invalid prompt rejection)
    - pnpm test convex/embeddings.test.ts (embedding enqueue)
  Dependencies: Stage A concept synthesis pipeline
  Estimate: 1.5h
  ```

- [ ] Embeddings sync cron for concepts + phrasings
  ```
  Files: convex/embeddings.ts, convex/cron.ts, convex/lib/chunkArray.ts, convex/embeddings.test.ts
  Goal: Add embeddings:syncMissingEmbeddings action/cron to backfill concept + phrasing embeddings daily with per-user limits.
  Acceptance:
    - Cron job respects rate caps, logs counts via concepts logger, skips docs fresher than configurable TTL.
    - Missing embeddings drop below threshold after cron run (diagnostic query).
  Tests:
    - pnpm test convex/embeddings.test.ts (new cases for syncMissingEmbeddings)
  Dependencies: Stage B phrasing generation action
  Estimate: 1h
  ```

## Phase 3 — IQC & Action Workflow

- [ ] IQC candidate scan + proposal action
  ```
  Files: convex/iqc.ts (new), convex/cron.ts, convex/lib/vectorSearch.ts, convex/lib/hybridSearch.ts, convex/_generated/api.ts
  Goal: Implement iqc:scanAndPropose internal action/cron that clusters concept neighbors via vector + text merge, calls LLM adjudication, writes actionCards (MERGE only for P0).
  Acceptance:
    - Cron limited to N concepts/user or 30s CPU, logs stats, deduplicates outstanding cards.
    - actionCards payload stores involved conceptIds + preview diffs; duplicates suppressed via hash.
  Tests:
    - pnpm test convex/iqc.test.ts (mock neighbors + ensure MERGE proposal creation)
  Dependencies: Embeddings sync cron for concepts + phrasings
  Estimate: 1.5h
  ```

- [ ] IQC action execution mutation
  ```
  Files: convex/iqc.ts, convex/lib/fsrsReplay.ts (new), convex/interactions.ts, convex/concepts.ts, convex/cron.ts
  Goal: Implement iqc:applyActionCard mutation for MERGE_CONCEPTS (P0) that moves phrasings, replays last M interactions into target concept.fsrs, archives sources, logs events.
  Acceptance:
    - Mutation idempotent via actionCard status, ensures zero data loss (interaction counts match), updates concept.phrasingCount + userStats.
    - Pino logs include ai/database/concepts contexts with correlationId.
  Tests:
    - pnpm test convex/iqc.test.ts (merge replay + idempotency)
  Dependencies: IQC candidate scan + proposal action
  Estimate: 1.5h
  ```

## Phase 4 — App Surfaces

- [ ] Concepts Library + nav wiring
  ```
  Files: app/concepts/page.tsx, app/concepts/_components/concepts-client.tsx, components/navbar.tsx, components/sidebar-nav.tsx, lib/hooks/use-concepts-query.ts, components/concepts/concepts-table.tsx
  Goal: New left-nav Concepts tab listing concept cards with due badge, phrasing count chip, thin/conflict indicators, search + sort.
  Acceptance:
    - Data fetch via new convex query; list supports pagination + filter by due state.
    - Nav shows active state + keyboard shortcut consistent with rest of app.
  Tests:
    - pnpm test components/concepts/concepts-table.test.tsx
  Dependencies: Ship concept queue Convex surface
  Estimate: 1.5h
  ```

- [ ] Concept detail + phrasing management
  ```
  Files: app/concepts/[conceptId]/page.tsx, components/concepts/concept-detail.tsx, components/concepts/phrasing-list.tsx, components/concepts/generate-phrasings-dialog.tsx, hooks/use-concept-actions.ts
  Goal: Detail view shows concept metadata, FSRS stats, list of phrasings with archive/set-canonical buttons, "Generate more phrasings" button hooking Stage B.
  Acceptance:
    - Canonical selector updates concept + UI immediately; archived phrasing hidden without reload.
    - Generate-more button enqueues action and toasts success/error.
  Tests:
    - pnpm test components/concepts/concept-detail.test.tsx
    - pnpm test hooks/use-concept-actions.test.ts
  Dependencies: Concepts Library + nav wiring, Stage B phrasing generation action
  Estimate: 1.75h
  ```

- [ ] Action Inbox UI + keyboard controls
  ```
  Files: app/action-inbox/page.tsx, components/action-inbox/action-inbox-client.tsx, components/action-inbox/action-card.tsx, hooks/use-action-cards.ts, components/navbar.tsx
  Goal: Inbox lists MERGE cards with diff preview (source vs target phrasings, FSRS deltas), supports Accept/Reject, keyboard J/K/Enter, optimistic updates.
  Acceptance:
    - Accept triggers iqc:applyActionCard, updates list + toasts; reject marks card resolved, logs feedback.
    - Empty state explains cron cadence; route gated to signed-in users.
  Tests:
    - pnpm test components/action-inbox/action-card.test.tsx
    - pnpm test hooks/use-action-cards.test.ts
  Dependencies: IQC action execution mutation
  Estimate: 1.75h
  ```

## Phase 5 — Observability & Guardrails

- [ ] Concepts logger + metrics wiring
  ```
  Files: lib/logger.ts, convex/lib/logger.ts, convex/aiGeneration.ts, convex/iqc.ts, convex/cron.ts, instrumentation.ts
  Goal: Add conceptsLogger child with ai/database contexts; emit structured logs for Stage A/B, iqc scan/apply, embedding sync, migration counters.
  Acceptance:
    - Logs include conceptId list + actionCardId; correlationId threads through cron + mutation flows.
    - Health dashboard fed via existing telemetry hooks (sentry/instrumentation) for failures.
  Tests:
    - pnpm test convex/aiGeneration.test.ts (assert logger invocations via test double)
    - pnpm test convex/iqc.test.ts (log metadata)
  Dependencies: IQC action execution mutation
  Estimate: 1h
  ```

- [ ] QA sweep `/prompts:qa-cycle`
  ```
  Files: docs/QA-notes.md (if needed), TODO.md
  Goal: Run scripted manual QA (review flow, concept library, action inbox, generation, cron dry-run) and log findings via /prompts:qa-cycle transcript.
  Acceptance:
    - QA log covers happy path + edge cases (merge, thin concept, generation failure); blocking issues captured as defects/backlog.
  Tests: n/a (manual)
  Dependencies: All feature work merged to branch
  Estimate: 1h
  ```

- [ ] PR readiness `/prompts:pr-ready`
  ```
  Files: CHANGELOG.md (if applicable), pull request body
  Goal: Summarize scope, migrations, test evidence, roll-back plan via /prompts:pr-ready before requesting review.
  Acceptance:
    - PR template filled with migration + cron notes, CI green, links to QA cycle + diagnostics attached.
  Tests: n/a
  Dependencies: QA sweep `/prompts:qa-cycle`
  Estimate: 0.5h
  ```

## Open Questions

- ? Canonical phrasing flag lives where—concepts table field `canonicalPhrasingId` or boolean on phrasing? Need decision before Concept detail UI.
- ? Conflict/thin/quality score calculation occurs server-side which job? Clarify whether Stage B or IQC updates them to avoid drift.
- ? MERGE replay depth (default 50) adjustable per user? Need config location (convex/lib/config.ts?) before iqc:applyActionCard tests.
- ? Action Inbox keyboard shortcuts (J/K/Enter) share existing shortcut manager? Confirm hook or new implementation to avoid collisions.
