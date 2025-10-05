# Concept-Based Knowledge Graph Design

**Status:** Design Phase
**Created:** 2025-10-04
**Last Updated:** 2025-10-04
**Authors:** System Architecture Team

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Core Insights](#core-insights)
3. [Rejected Approaches](#rejected-approaches)
4. [Chosen Architecture](#chosen-architecture)
5. [Sequential Content Handling](#sequential-content-handling)
6. [Implementation Phases](#implementation-phases)
7. [Technical Specifications](#technical-specifications)
8. [Open Questions](#open-questions)
9. [Research References](#research-references)

---

## Problem Statement

### The Core UX Issue: Item Overload

Spaced repetition systems face a fundamental scaling problem: **as users generate more content, review burden becomes unsustainable**.

This is especially acute in Scry because:
- **Automated generation** makes it trivial to create 50+ questions at once
- **Pure FSRS** shows users ALL due items (no daily limits)
- **Similar questions** cause interference and feel repetitive
- **Review load** grows faster than users can sustain

### Traditional SRS "Solutions" (All Rejected)

❌ **Daily limits** - Undermines FSRS science, creates artificial constraints
❌ **Manual curation** - Doesn't scale, defeats purpose of automation
❌ **Postponing/Load balancing** - Kicks can down road, doesn't reduce burden
❌ **Random noise in scheduling** - Anti-science, unprincipled

### What We Actually Need

A system that:
1. **Recognizes conceptual overlap** between questions
2. **Propagates learning** from one question to related questions
3. **Reduces effective review load** without compromising retention
4. **Respects memory science** (no artificial limits or scheduling hacks)
5. **Scales naturally** to thousands of questions per user

---

## Core Insights

### Insight 1: Questions are Observations, Concepts are Atoms

**Traditional SRS thinking:**
```
Question ←→ Question (similarity)
```

**Our breakthrough:**
```
Question → Concepts ← Question
              ↓
         Mastery State
```

Questions don't "know about" each other. They're just observations of underlying concept mastery.

### Insight 2: Similarity Detection is the Wrong Abstraction

We initially explored:
- Raw text embeddings (OpenAI, Gemini, Voyage AI)
- Answer-based embeddings
- Composite embeddings (question + answer + explanation)
- Two-stage pipelines (embeddings + LLM judge)
- Fine-tuned embeddings

**The realization:** Direct question-to-question similarity is fundamentally flawed because:

```typescript
// FALSE POSITIVE - High text similarity, DIFFERENT concepts
Q1: "What React hook manages state?"
Q2: "What React hook manages side effects?"
→ Text similarity: 0.92
→ But testing useState vs useEffect - DIFFERENT knowledge!

// FALSE NEGATIVE - Low text similarity, SAME concept
Q1: "Which hook returns a stateful value and updater function?"
Q2: "How preserve data between renders in function components?"
→ Text similarity: 0.45
→ But BOTH testing useState knowledge!
```

### Insight 3: Semantic Similarity's True Role

Embeddings aren't for question-to-question comparison. They're for:

1. **Concept consolidation** - Detecting "useEffect hooks" ≈ "useEffect in React"
2. **Concept search** - User searches "hooks" → find all hook concepts
3. **Concept clustering** - Visualizing related concepts in graph
4. **Quality control** - Detecting anomalous concept names

### Insight 4: Transfer vs. No-Transfer Learning

Not all knowledge transfers the same way:

**Conceptual knowledge** (transfers):
- Understanding useState → Understanding useState with objects ✅
- Pythagorean theorem → Similar triangle problems ✅

**Sequential knowledge** (doesn't transfer):
- Line 1→2 of poem → Line 8→9 of poem ❌
- First verse of prayer → Last verse of prayer ❌

This requires different propagation rules for different content types.

### Insight 5: Atomicity Through LLM + Hygiene Jobs

The ideal concept granularity:
- ❌ "React" - Too broad, unhelpful
- ❌ "The useState hook in React functional components for managing component-level state" - Too specific
- ✅ "useState hook" - Atomic, testable, specific enough

Achieving this through:
1. **LLM extraction** with atomicity-focused prompts
2. **Background consolidation** to merge similar concepts
3. **Background splitting** to break up overly broad concepts
4. **Natural selection** - useful concepts survive, vague ones get cleaned

---

## Rejected Approaches

### Approach 1: Raw Text Embeddings

**What:** Embed question text with off-the-shelf models (Gemini, OpenAI, Voyage)

**Why rejected:**
- Too many false positives (similar wording ≠ same concept)
- Too many false negatives (different wording = same concept)
- Doesn't capture semantic meaning of what's being tested

**When useful:** Near-duplicate detection, broad topic clustering

### Approach 2: LLM-Based Pairwise Similarity

**What:** For each pair of questions, LLM judges if they test same concept

**Why rejected:**
- O(N²) complexity - doesn't scale to thousands of questions
- Expensive (LLM call per pair)
- Produces similarity scores, not explicit concepts (less interpretable)

**When useful:** Validation/labeling data for training embeddings

### Approach 3: Behavioral Similarity

**What:** Questions are similar if user performance correlates

**Why rejected:**
- Cold start problem - need 100+ interactions per question
- Slow to converge (weeks/months)
- Spurious correlations (easy vs hard questions)
- Doesn't work for new questions

**When useful:** Phase 3 validation of other approaches

### Approach 4: Fine-Tuned Embeddings

**What:** Train custom embedding model on educational Q&A similarity

**Why rejected (for MVP):**
- Need thousands of labeled pairs first
- Training expertise required
- Cold start problem
- Ongoing maintenance

**When useful:** Phase 3 after collecting labeled data from concept-based approach

---

## Chosen Architecture

### Overview: Concept-Based Knowledge Graph

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Questions → LLM Extraction → Concepts          │
│                                    ↓            │
│                               Mastery State     │
│                                    ↓            │
│                          Review Propagation     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Component 1: Concept Extraction

**When:** Question is generated/saved

**How:**
```typescript
const prompt = `Extract 2-5 atomic concepts this question tests.
Each concept should be:
- Specific enough to be useful ("useState hook" not "React")
- Complete enough to stand alone
- Testable (you could write other questions about it)

Question: "${question}"
Answer: "${correctAnswer}"
Explanation: "${explanation}"

Format: JSON array of { concept: string, type: string, weight: number }

Concept types:
- "conceptual": Understanding that transfers to other questions
- "skill": Transferable ability (e.g., "poetry memorization")
- "sequential-content": Position-specific content (e.g., "Sonnet 18 line 3")

Weight: 0-1, how central is this concept to the question?

Example:
[
  { concept: "useState hook", type: "conceptual", weight: 0.9 },
  { concept: "React state management", type: "conceptual", weight: 0.6 },
  { concept: "functional component patterns", type: "conceptual", weight: 0.4 }
]`;

const concepts = await llm.extract(prompt);
```

**Storage:**
```typescript
questionConcepts: defineTable({
  questionId: Id<"questions">,
  concept: string,              // Raw LLM output (normalized later)
  conceptType: "conceptual" | "skill" | "sequential-content",
  weight: number,               // 0-1: centrality to question
  sequenceId: string | null,    // If sequential, which sequence?
  extractedAt: number,
  extractionVersion: number,    // Track prompt versions
})
```

### Component 2: Concept Normalization

**When:** Daily cron job

**Process:**
1. Collect all unique concept strings
2. Generate embeddings for semantic clustering
3. Cluster similar concepts (threshold: 0.90 cosine similarity)
4. For each cluster, LLM chooses canonical form
5. Update all questionConcepts to use canonical form

**Example:**
```typescript
// Before normalization:
"useEffect for data fetching"
"fetching data with useEffect"
"data fetching in useEffect hooks"

// After normalization (canonical):
"data fetching with useEffect"
```

**Canonical concepts table:**
```typescript
concepts: defineTable({
  name: string,              // Canonical name
  aliases: string[],         // Known variations
  embedding: number[],       // For similarity search
  questionCount: number,     // How many questions test this
  createdAt: number,
  lastConsolidatedAt: number,
})
  .index('by_name', ['name'])
```

### Component 3: Mastery Tracking

**Per-concept mastery state:**
```typescript
conceptMastery: defineTable({
  userId: Id<"users">,
  concept: string,           // Canonical name
  correctCount: number,
  totalCount: number,
  lastReview: number,
  mastery: number,           // Smoothed: correctCount / (totalCount + k)
})
  .index('by_user_concept', ['userId', 'concept'])
```

**Update on review:**
```typescript
async function recordInteraction(questionId, isCorrect) {
  // 1. Update question's FSRS state (standard)
  await updateFSRS(questionId, isCorrect);

  // 2. Update concept mastery for each concept
  const concepts = await getQuestionConcepts(questionId);

  for (const qc of concepts) {
    await db.patch(conceptMastery[qc.concept], {
      correctCount: mastery.correctCount + (isCorrect ? 1 : 0),
      totalCount: mastery.totalCount + 1,
      lastReview: Date.now(),
      mastery: (correctCount + (isCorrect ? 1 : 0)) / (totalCount + 1)
    });
  }
}
```

### Component 4: Review Propagation

**The magic:** Answering question correctly gives partial credit to related questions

**Algorithm:**
```typescript
async function propagateReviewCredit(questionId, isCorrect) {
  if (!isCorrect) return; // Only propagate success

  const sourceConcepts = await getQuestionConcepts(questionId);
  const sourceSeq = await getSequence(questionId);

  for (const concept of sourceConcepts) {
    // RULE 1: Skip sequential-content concepts (no transfer)
    if (concept.type === "sequential-content") continue;

    // RULE 2: Find other questions with this concept
    const relatedQuestions = await findQuestionsByConcept(concept.concept);

    for (const targetQ of relatedQuestions) {
      if (targetQ.id === questionId) continue; // Skip self

      const targetSeq = await getSequence(targetQ.id);

      // RULE 3: Don't propagate within same sequence
      if (sourceSeq && targetSeq && sourceSeq.sequenceId === targetSeq.sequenceId) {
        continue; // No propagation for sequential content
      }

      // RULE 4: Apply partial credit
      const boostAmount = concept.type === "skill" ? 0.05 : 0.10;
      await applyPartialCredit(targetQ.id, {
        stabilityBoost: boostAmount,
        reason: `concept:${concept.concept}`
      });
    }
  }
}

function applyPartialCredit(questionId, { stabilityBoost }) {
  const question = await db.get(questionId);

  // Increase FSRS stability slightly
  const newStability = question.stability * (1 + stabilityBoost);

  // Extend next review time proportionally
  const dayExtension = (newStability - question.stability) * 0.5;
  const newNextReview = question.nextReview + (dayExtension * 86400000);

  await db.patch(questionId, {
    stability: newStability,
    nextReview: newNextReview,
  });
}
```

### Component 5: Concept Hygiene (Background Jobs)

**Weekly job: Quality Control**

1. **Split overly broad concepts**
   - Detect: Concept has 50+ questions
   - Action: LLM splits into subconcepts, reassign questions

2. **Merge duplicate concepts**
   - Detect: High embedding similarity (>0.92)
   - Action: Choose canonical, update references

3. **Delete orphaned concepts**
   - Detect: questionCount === 0
   - Action: Archive concept

4. **Generate missing concepts**
   - Detect: Questions with <2 concepts
   - Action: Re-extract with updated prompt

**Preserve user mastery during cleanup:**
```typescript
async function mergeConcepts(oldConcept, newConcept) {
  // 1. Merge mastery stats
  for (const userId of affectedUsers) {
    const oldMastery = await getMastery(userId, oldConcept);
    const newMastery = await getMastery(userId, newConcept);

    await db.patch(newMastery, {
      correctCount: oldMastery.correctCount + newMastery.correctCount,
      totalCount: oldMastery.totalCount + newMastery.totalCount,
      mastery: (correctCount + newCorrect) / (totalCount + newTotal)
    });
  }

  // 2. Update question references
  await updateQuestionConcepts(oldConcept, newConcept);

  // 3. Archive old concept
  await archiveConcept(oldConcept);
}
```

---

## Sequential Content Handling

### The Problem

Poetry, prayers, and long passages require **positional/sequential memorization**:

```typescript
// All extract the same concepts:
Q1: "What comes after 'Shall I compare thee'?"
  → ["Shakespeare Sonnet 18", "poetry memorization"]

Q14: "What comes after 'So long lives this'?"
  → ["Shakespeare Sonnet 18", "poetry memorization"]

// But answering Q1 tells us NOTHING about Q14!
```

If we propagate normally, user memorizes first 2 lines, system boosts ALL lines → fails to learn the full piece.

### The Solution: Sequence Detection + Typed Concepts

**1. Detect sequences during generation**

```typescript
async function detectSequentialQuestions(questions) {
  const prompt = `Are these questions testing sequential/positional memorization?

Examples of sequential: poem lines, prayer verses, speech paragraphs, song lyrics
Examples of non-sequential: React concepts, historical facts, math formulas

Questions:
${questions.map((q, i) => `${i+1}. ${q.question}`).join('\n')}

Return JSON:
{
  isSequential: boolean,
  sequenceType: "poem" | "prayer" | "speech" | "lyrics" | "chronology" | "none",
  sequenceName: string
}`;

  return await llm.analyze(prompt);
}
```

**2. Tag questions with sequence membership**

```typescript
questionSequences: defineTable({
  sequenceId: string,           // "sonnet-18-full"
  questionId: Id<"questions">,
  position: number,             // Order in sequence
  sequenceName: string,         // "Shakespeare's Sonnet 18"
  sequenceType: string,         // "poem"
})
  .index('by_sequence', ['sequenceId', 'position'])
```

**3. Extract typed concepts**

```typescript
// For sequential question:
[
  {
    concept: "Sonnet 18 line 2→3",
    type: "sequential-content",  // NO propagation
    weight: 0.8
  },
  {
    concept: "poetry memorization",
    type: "skill",               // YES propagation (to other poems)
    weight: 0.6
  },
  {
    concept: "Shakespearean sonnet structure",
    type: "conceptual",          // YES propagation
    weight: 0.4
  }
]
```

**4. Block intra-sequence propagation**

```typescript
// In propagation logic:
if (sourceSeq && targetSeq && sourceSeq.sequenceId === targetSeq.sequenceId) {
  continue; // Don't propagate within same sequence
}
```

### Example: Two Sonnets

```
User memorizes Sonnet 18 (lines 1-14)
Later memorizes Sonnet 29 (lines 1-14)

Review Sonnet 18, line 1→2:
  ✅ Propagates "poetry memorization" skill → Sonnet 29 questions (+5% boost)
  ✅ Propagates "Shakespearean sonnet structure" → Sonnet 29 questions (+10% boost)
  ❌ Does NOT propagate to other Sonnet 18 lines (same sequence)
```

---

## Implementation Phases

### Phase 1: MVP (THIS PR - 1-2 weeks)

**Goal:** Prove concept extraction + propagation reduces review burden

**Scope:**
1. ✅ Schema: `questionConcepts`, `conceptMastery`, `questionSequences`
2. ✅ LLM concept extraction on question creation
3. ✅ Mastery tracking on reviews
4. ✅ Naive propagation (10% boost for ANY shared concept)
5. ✅ Sequence detection + anti-propagation
6. ✅ Basic UI: Show concept mastery stats

**Out of scope:**
- Concept canonicalization (store raw LLM output)
- Embeddings (not needed yet)
- Weighted propagation (use fixed 10%)
- Graph visualization

**Success metrics:**
- 90%+ of questions get 2+ concepts extracted
- Concept mastery accurately reflects user knowledge
- Review load reduces by 10-20% after 2 weeks
- No user complaints about "forgot content I thought I knew"

### Phase 2: Refinement (2-3 weeks)

**Add:**
1. Concept canonicalization (daily cron job)
2. Embeddings for semantic clustering
3. Weighted propagation (by concept weight + mastery level)
4. Concept search/filtering in UI
5. Improved extraction prompts (few-shot examples)

**Metrics:**
- Concept count stabilizes (merging outpaces creation)
- 80%+ of similar concepts get merged within 7 days
- Review load reduces by 25-35%

### Phase 3: Advanced (4-6 weeks)

**Add:**
1. Concept graph visualization
2. Prerequisite relationships (concept X → concept Y)
3. Bayesian Knowledge Tracing per concept
4. Adaptive question generation (target weak concepts)
5. Concept splitting intelligence (break up broad concepts)
6. Behavioral similarity validation

**Metrics:**
- Knowledge graph reveals natural curriculum structure
- Users can navigate by concepts, not just questions
- Review load reduces by 40-50%
- 85%+ retention maintained

---

## Technical Specifications

### Database Schema

```typescript
// New table: Question-Concept associations
questionConcepts: defineTable({
  questionId: v.id('questions'),
  concept: v.string(),
  conceptType: v.union(
    v.literal('conceptual'),
    v.literal('skill'),
    v.literal('sequential-content')
  ),
  weight: v.number(),           // 0-1
  sequenceId: v.optional(v.string()),
  extractedAt: v.number(),
  extractionVersion: v.number(),
})
  .index('by_question', ['questionId'])
  .index('by_concept', ['concept', 'questionId'])

// New table: Concept mastery per user
conceptMastery: defineTable({
  userId: v.id('users'),
  concept: v.string(),
  correctCount: v.number(),
  totalCount: v.number(),
  lastReview: v.number(),
  mastery: v.number(),          // 0-1
})
  .index('by_user_concept', ['userId', 'concept'])
  .index('by_user_mastery', ['userId', 'mastery'])

// New table: Sequential content tracking
questionSequences: defineTable({
  sequenceId: v.string(),
  questionId: v.id('questions'),
  position: v.number(),
  sequenceName: v.string(),
  sequenceType: v.string(),
  createdAt: v.number(),
})
  .index('by_question', ['questionId'])
  .index('by_sequence', ['sequenceId', 'position'])

// Phase 2: Canonical concepts
concepts: defineTable({
  name: v.string(),
  aliases: v.array(v.string()),
  embedding: v.optional(v.array(v.float64())),
  questionCount: v.number(),
  createdAt: v.number(),
  lastConsolidatedAt: v.optional(v.number()),
})
  .index('by_name', ['name'])
```

### LLM Prompts

**Concept Extraction (Phase 1):**
```
Extract 2-5 atomic concepts this question tests.

Rules:
1. Specific enough to be useful ("useState hook" not "React")
2. Complete enough to stand alone
3. Testable - you could write other questions about it
4. Ordered by centrality/importance

Question: "${question}"
Answer: "${correctAnswer}"
Explanation: "${explanation}"

Return JSON array:
[
  {
    concept: string,
    type: "conceptual" | "skill" | "sequential-content",
    weight: number (0-1, how central to question)
  }
]

Concept types:
- conceptual: Understanding that transfers
- skill: Transferable ability
- sequential-content: Position-specific (poems, prayers)
```

**Sequence Detection:**
```
Are these questions testing sequential/positional memorization?

Sequential examples: poem lines, prayer verses, speech paragraphs
Non-sequential examples: React concepts, history facts, math formulas

Questions:
${questions.map((q, i) => `${i+1}. ${q.question}`).join('\n')}

Return JSON:
{
  isSequential: boolean,
  sequenceType: "poem" | "prayer" | "speech" | "lyrics" | "chronology" | "none",
  sequenceName: string
}
```

**Concept Canonicalization (Phase 2):**
```
These concept names refer to the same idea:
1. "useEffect for data fetching"
2. "fetching data with useEffect"
3. "data fetching in useEffect hooks"

Choose the BEST name that is:
- Most atomic/specific
- Most searchable
- Most consistent with terminology

Return ONLY the best name (or write improved version).
```

### Key Algorithms

**Propagation Algorithm:**
```typescript
function calculatePropagationBoost(
  concept: QuestionConcept,
  sourceQ: Question,
  targetQ: Question,
  mastery: ConceptMastery
): number {
  // Phase 1: Fixed boost
  if (concept.type === "skill") return 0.05;
  if (concept.type === "conceptual") return 0.10;
  return 0; // No boost for sequential-content

  // Phase 2: Weighted boost
  const baseBoost = concept.type === "skill" ? 0.05 : 0.10;
  const weightFactor = concept.weight; // 0-1
  const masteryFactor = 1 - mastery.mastery; // Higher mastery = less boost

  return baseBoost * weightFactor * masteryFactor;
}
```

**Semantic Clustering (Phase 2):**
```typescript
async function clusterConcepts(concepts: string[]): Promise<Cluster[]> {
  // 1. Generate embeddings
  const embeddings = await batchEmbed(concepts);

  // 2. Compute pairwise similarities
  const similarities = computeCosineSimilarity(embeddings);

  // 3. Cluster using threshold (0.90)
  const clusters: Cluster[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < concepts.length; i++) {
    if (visited.has(i)) continue;

    const cluster = [concepts[i]];
    visited.add(i);

    for (let j = i + 1; j < concepts.length; j++) {
      if (visited.has(j)) continue;
      if (similarities[i][j] >= 0.90) {
        cluster.push(concepts[j]);
        visited.add(j);
      }
    }

    if (cluster.length > 1) {
      clusters.push({ concepts: cluster });
    }
  }

  return clusters;
}
```

---

## Open Questions

### 1. Concept Extraction Quality

**Question:** Will LLM reliably extract atomic, useful concepts?

**Validation needed:**
- Run extraction on 100 existing questions
- Manually review: Are concepts specific enough? Too broad?
- Measure consistency: Same question → same concepts?

**Decision criteria:**
- If 80%+ are good quality → Proceed
- If 50-80% → Improve prompt, add few-shot examples
- If <50% → Reconsider approach

### 2. Propagation Discount Rate

**Question:** What's the optimal boost amount?

**Options:**
- Fixed: 5% for skills, 10% for concepts
- Weighted: Multiply by concept weight
- Adaptive: Adjust based on mastery level

**A/B test:**
- Control: No propagation
- Treatment A: Fixed 10%
- Treatment B: Fixed 5%
- Treatment C: Weighted by concept centrality

**Measure:** Review load, retention rate, user satisfaction

### 3. Concept Granularity

**Question:** How many concepts per question?

**Research:** Studies suggest 2-5 is optimal
- Too few (1): Poor granularity, limited transfer
- Too many (6+): Concept dilution, noise

**Validation:** Extract varying amounts, measure usefulness

### 4. Sequence Detection Reliability

**Question:** Can LLM reliably detect sequential content?

**Test cases:**
- Obvious: Poem lines, prayer verses
- Subtle: Chronological events, process steps
- Edge: Mixed sequential/conceptual

**Fallback:** Manual sequence tagging UI if auto-detection fails

### 5. Concept Name Stability

**Question:** How often do concept names change during consolidation?

**Concern:** Frequent changes confuse users

**Mitigation:**
- Keep aliases visible to users
- Gradual canonicalization (7-day delay)
- User opt-in for concept renames

### 6. Performance at Scale

**Question:** Will this scale to 10K+ questions per user?

**Critical paths:**
- Concept extraction: O(1) per question ✅
- Mastery updates: O(concepts per question) ✅
- Propagation: O(questions per concept) ⚠️
- Consolidation: O(unique concepts²) ⚠️

**Optimizations:**
- Index by concept for fast lookups
- Batch propagation updates
- Incremental consolidation (not全量)

### 7. Integration with FSRS

**Question:** Does stability boosting interfere with FSRS algorithm?

**Concerns:**
- Artificial stability inflation
- Retention rate drift
- Algorithm assumptions violated

**Mitigation:**
- Cap maximum boost per question (e.g., 25% total)
- Track propagation source in metadata
- Monitor retention rates closely

---

## Research References

### Academic Foundations

1. **Bayesian Knowledge Tracing**
   - Original HMM approach to skill mastery
   - Khan Academy's implementation
   - Limitations: Manually curated skills

2. **Knowledge Graphs in Education**
   - SGKT: Session Graph-based Knowledge Tracing
   - KGNN-KT: Knowledge graphs for programming education
   - Prerequisite relationships in adaptive learning

3. **Chunking in Cognitive Science**
   - Miller's 7±2 chunks in working memory
   - Atomic facts for knowledge representation
   - Graph Fact Synthesis (GFS) for RAG systems

4. **Entity Resolution for Knowledge Graphs**
   - Semantic consolidation with LLMs
   - Entity consistency in graph construction
   - Alias management and canonical forms

### Prior Art

**Khan Academy:**
- Manual skill curation (100s of skills per course)
- Prerequisite DAG structure
- Mastery levels: Attempted → Familiar → Proficient → Mastered
- Strength: Well-structured, proven at scale
- Weakness: Manual curation doesn't scale to user-generated content

**Duolingo:**
- Skills organized in learning tree
- Spaced repetition per word/phrase
- Strength: Clear progression, gamified
- Weakness: Pre-defined curriculum, not adaptive

**Anki/SuperMemo:**
- User-managed tags (manual)
- No automatic concept extraction
- No cross-question learning transfer
- Strength: Pure user control
- Weakness: Requires expert knowledge to organize

### Novel Contributions

Our approach combines:
1. **Automated concept extraction** (vs manual curation)
2. **LLM-based semantic understanding** (vs statistical clustering)
3. **Background hygiene jobs** (vs one-time extraction)
4. **Typed concepts** (sequential vs conceptual)
5. **FSRS integration** (vs separate mastery system)

This hasn't been done before in production SRS systems.

---

## Appendix: Example Walkthrough

### Scenario: User Learns React Hooks

**Day 1: User generates 20 React questions**

```
Generation:
Q1: "What is the useState hook?"
Q2: "When should you use useEffect?"
Q3: "How do you fetch data with useEffect?"
...
Q20: "What's the difference between useEffect and useLayoutEffect?"

Extraction (automatic):
Q1 → ["useState hook", "React state management", "functional components"]
Q2 → ["useEffect hook", "when to use useEffect", "side effects in React"]
Q3 → ["data fetching with useEffect", "useEffect hook", "async in useEffect"]
...
Q20 → ["useEffect vs useLayoutEffect", "timing of effects", "useEffect hook"]

Storage:
- 20 questions created
- ~50 unique concepts extracted (avg 2.5 per question)
- 0 mastery for all concepts (new user)
```

**Day 2: User reviews 5 questions**

```
Review Q1 (useState): CORRECT
  → Mastery["useState hook"] = 1/1 (100%)
  → Mastery["React state management"] = 1/1 (100%)
  → Mastery["functional components"] = 1/1 (100%)
  → Propagation: Find questions with these concepts
    - Q15 has "functional components" → +10% stability boost
    - Q7 has "React state management" → +10% stability boost

Review Q2 (useEffect when): CORRECT
  → Mastery["useEffect hook"] = 1/1 (100%)
  → Propagation:
    - Q3, Q20 have "useEffect hook" → +10% stability boost each

Review Q3 (useEffect data fetch): CORRECT
  → Already got boost from Q2!
  → Now: +10% from concept mastery
  → Feels easier to remember (stability is higher)

Review Q7 (state management): CORRECT
  → Already got boost from Q1!

Review Q15 (functional components): CORRECT
  → Already got boost from Q1!
```

**Effect after 2 days:**
```
Questions reviewed directly: 5
Questions boosted indirectly: 8
Effective reviews: 13

Concepts with mastery:
- "useState hook": 1/1 (100%)
- "useEffect hook": 2/2 (100%)
- "React state management": 2/2 (100%)
- "functional components": 2/2 (100%)
- "data fetching with useEffect": 1/1 (100%)
- "when to use useEffect": 1/1 (100%)
- "side effects in React": 1/1 (100%)
```

**Day 3: Background job runs**

```
Concept Consolidation:
Cluster 1:
  - "useEffect hook"
  - "useEffect hooks"
  - "the useEffect hook in React"
  → Canonical: "useEffect hook"

Cluster 2:
  - "data fetching with useEffect"
  - "fetching data using useEffect"
  → Canonical: "data fetching with useEffect"

Updates:
  - Merged mastery stats
  - Updated question references
  - Concept count: 50 → 42 (16% reduction)
```

**Week 1: User adds poems**

```
Generation: "Memorize Shakespeare's Sonnet 18" (14 questions)

Sequence Detection:
  → isSequential: true
  → sequenceType: "poem"
  → sequenceName: "Shakespeare's Sonnet 18"

Storage:
  - 14 questions created
  - All tagged with sequenceId: "sonnet-18"

Extraction:
Q1: "What comes after 'Shall I compare thee'?"
  → [
      { concept: "Sonnet 18 line 1→2", type: "sequential-content", weight: 0.9 },
      { concept: "poetry memorization", type: "skill", weight: 0.5 },
      { concept: "Shakespearean sonnets", type: "conceptual", weight: 0.3 }
    ]

Review Q1: CORRECT
  → Mastery["Sonnet 18 line 1→2"] = 1/1
  → Mastery["poetry memorization"] = 1/1
  → Mastery["Shakespearean sonnets"] = 1/1
  → Propagation:
    - Q2-Q14 (same sequence): NO boost ❌ (sequential-content)
    - Future poems with "poetry memorization": YES boost ✅ (skill transfer)
    - Other sonnet questions: YES boost ✅ (conceptual transfer)
```

**Week 2: Results**

```
User stats:
- Questions created: 34 (20 React + 14 Poem)
- Direct reviews: 25
- Indirect boosts: 42
- Effective review coverage: 67 questions worth

Concepts mastered (>80% accuracy):
- React: 18 concepts
- Poetry: 5 concepts
- Total unique concepts: 38 (after consolidation)

Review load reduction:
- Without propagation: 34 due over 2 weeks
- With propagation: 25 due over 2 weeks
- Reduction: 26%

Retention maintained: 88% (vs 87% baseline)
```

---

**End of Design Document**
