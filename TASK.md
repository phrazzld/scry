# Smart Review Interleaving + Topic Field Removal

**Status**: Ready for Implementation
**Estimated Effort**: 4-6 hours
**Priority**: HIGH
**Type**: UX Enhancement + Technical Debt Cleanup

---

## Executive Summary

**Problem**: AI-generated question batches share identical `_creationTime`, causing identical freshness scores in FSRS priority calculation. This creates temporal clustering where all 40 React questions appear consecutively, violating learning science principles of interleaving and making recall artificially easy.

**Solution**: Implement top-10 retrievability shuffle to disperse temporally-clustered items while respecting FSRS priority. Remove unused `topic` field from schema to reduce complexity.

**User Value**: Better memory encoding through interleaved practice across different subjects; simpler, cleaner schema.

**Success Criteria**:
- Generate 40 React questions + 40 Python questions
- Review session shows mixed subjects (not all React, then all Python)
- All tests pass
- Schema migration completes successfully

---

## User Context

### Who Uses This
All Scry users reviewing AI-generated question batches (primary use case: 10-40 questions per generation).

### Problems Being Solved

**Problem 1: Temporal Clustering**
- Generating 40 related questions creates batch with same `_creationTime` → identical freshness boost
- FSRS priority calculation: `freshnessBoost = calculateFreshnessDecay(hoursSinceCreation)`
- Result: All 40 items get identical priority → sorted arbitrarily → shown consecutively
- User feedback: "Doing 40 related items makes recall too easy, doesn't test true retention"

**Problem 2: Schema Complexity**
- `questions.topic` field exists but unused in core features
- No business logic depends on topic filtering
- Adds cognitive load, maintenance burden
- Creates false impression that topic-based organization exists

### Measurable Benefits

**Learning Efficacy**:
- Interleaving improves retention by 35% (Roediger & Karpicke research)
- Forces discrimination between concepts (key cognitive process)
- Prevents artificial inflation of recall accuracy

**Technical Debt**:
- Remove 1 unused field, 1 unused index, 2 unused queries
- Simplify ~200 lines of code across backend/frontend

---

## Requirements

### Functional Requirements

**FR1: Review Interleaving (Always-On)**
- Take top 10 candidates by retrievability score (FSRS priority)
- Shuffle these 10 items using Fisher-Yates algorithm
- Return first item from shuffled set
- No user settings (best-practice default behavior)

**FR2: Topic Field Removal**
- Remove `questions.topic` from schema
- Remove `by_user_topic` index
- Remove topic filtering from `questionsLibrary.getUserQuestions`
- Remove `questionsLibrary.getTopTopics` query
- Keep `generationJobs.topic` (display metadata only, scoped to jobs table)

### Non-Functional Requirements

**NFR1: Performance**
- Zero bandwidth increase (uses existing `.take(100)` candidate batch)
- No additional database queries
- Shuffle operation: O(10) = negligible

**NFR2: FSRS Deviation**
- Minimal deviation: only shuffles top 10 items
- All items in top 10 have similar retrievability (typically <0.10 variance)
- Example: Item #10 may appear before #1, but both are "equally urgent"

**NFR3: Backwards Compatibility**
- Migration safely removes topic field from existing questions
- No data loss (topic field was unused)
- Graceful degradation if migration incomplete

---

## Technical Architecture

### Current State Analysis

**FSRS Priority Calculation** (`spacedRepetition.ts:85-105`):
```typescript
function calculateRetrievabilityScore(question: Doc<'questions'>, now: Date): number {
  if (question.state === 'new' || question.reps === 0) {
    const hoursSinceCreation = (now.getTime() - question._creationTime) / 3600000;
    const freshnessBoost = calculateFreshnessDecay(hoursSinceCreation);
    return -1 - freshnessBoost; // -2 (ultra-fresh) to -1 (standard new)
  }
  return scheduler.getRetrievability(question, now); // 0-1 for reviewed cards
}
```

**Problem**: 40 questions generated at same time → identical `_creationTime` → identical `freshnessBoost` → identical priority → clustering artifact

**FSRS Retrievability Scale**:
- `1.0` = perfect recall (100% probability of remembering) → LOW priority
- `0.0` = completely forgotten (0% probability of remembering) → HIGH priority
- Lower retrievability = higher review urgency

**Example Retrievability Variance**:
- Item due 24h ago: `0.50` (50% recall chance)
- Item due 2h ago: `0.85` (85% recall chance)
- Difference: `0.35` (35 percentage points) → **Large FSRS difference, should NOT shuffle**

- Item A: `0.50` (overdue 24h)
- Item B: `0.55` (overdue 20h)
- Difference: `0.05` (5 percentage points) → **Small FSRS difference, safe to shuffle**

**Top-10 Justification**:
- Typical batch size: 10-40 questions
- Top 10 items typically have <0.10 retrievability variance (all "urgent tier")
- Empirical data needed: Convex analytics could validate this assumption

### Selected Approach: Top-10 Retrievability Shuffle

**Algorithm**:
```typescript
// After sorting by retrievability (line 286 in getNextReview)
const questionsWithPriority = allCandidates.map((q) => ({
  question: q,
  retrievability: calculateRetrievabilityScore(q, now),
}));

questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);

// NEW: Top-N shuffle for temporal dispersion
const topCandidates = questionsWithPriority.slice(0, 10);

// Fisher-Yates shuffle
for (let i = topCandidates.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [topCandidates[i], topCandidates[j]] = [topCandidates[j], topCandidates[i]];
}

const nextQuestion = topCandidates[0].question;
```

**Characteristics**:
- ✅ **Interleaves ANY subjects**: Not limited to same-batch clustering (disperses React + Python + Java if all due)
- ✅ **Respects FSRS**: Only shuffles items with similar urgency
- ✅ **No state tracking**: Stateless, no session history needed
- ✅ **Simple**: 5 lines of code, no hidden complexity
- ✅ **Deterministically random**: Different shuffle each query (prevents predictable patterns)

**FSRS Deviation Analysis**:
- **Worst case**: Item #10 shown before Item #1
- **Retrievability difference**: Typically <0.10 (10 percentage points)
- **Memory science impact**: Negligible - both items equally urgent
- **User perception**: Transparent - interleaving feels natural, not arbitrary

### Alternatives Considered

| Approach | User Value | Simplicity | FSRS Risk | Decision |
|----------|------------|------------|-----------|----------|
| **Creation Time Jitter** | Medium | High | None | ❌ Only shuffles same-batch items; doesn't solve cross-subject mixing |
| **Retrievability Band (±0.10)** | Medium | Medium | None | ❌ May include <10 items if batch is small; weaker dispersion |
| **Topic-Based Dispersion** | High | Low | None | ❌ Requires keeping topic field (contradicts requirement); complex session state |
| **Top-20 Shuffle** | High | High | Medium | ❌ Diminishing returns; 20 includes less urgent items (>0.15 variance) |
| **Top-10 Shuffle** | High | High | Low | ✅ **Selected** - optimal balance |

### Module Boundaries

**Review Queue Module** (`convex/spacedRepetition.ts`):
- **Interface**: `getNextReview() → Question | null`
- **Responsibility**: FSRS-compliant prioritization + temporal dispersion
- **Hidden Complexity**: Shuffle algorithm, retrievability calculation, batch management
- **Abstraction Layer**: Callers don't know about shuffle (implementation detail)

**Schema Module** (`convex/schema.ts`):
- **Interface**: Question document structure (minimal required fields)
- **Responsibility**: Data model definition, index optimization
- **Hidden Complexity**: FSRS state fields, denormalized counters
- **Abstraction Layer**: Frontend uses simplified Question type, doesn't see FSRS internals

---

## Dependencies & Assumptions

### External Dependencies
- **FSRS Library** (`ts-fsrs@4.x`): Provides `get_retrievability()` calculation
- **Convex Database**: Supports schema migrations, atomic updates
- **Fisher-Yates Shuffle**: Standard algorithm, no library needed (5 lines)

### Scale Assumptions
- **Typical review session**: 10-50 due cards
- **Typical generation batch**: 10-40 questions
- **Top-10 retrievability variance**: <0.10 (validated post-implementation via analytics)
- **User collections**: 100-10,000 questions (Convex Starter 1GB bandwidth budget)

### Environment Constraints
- **Production questions table**: ~5,000 questions total across all users (estimate)
- **Migration impact**: All existing questions have `topic` field populated
- **Acceptable data loss**: Yes - topic field unused in core features

### Integration Requirements
- **Frontend**: No changes needed (Question interface simplified, transparent)
- **Review Flow**: No changes needed (uses `getNextReview` query)
- **Library View**: Remove topic filtering UI (low usage feature)

---

## Implementation Plan

### Phase 1: Smart Interleaving (2-3 hours)

**File**: `convex/spacedRepetition.ts`

**Change Location**: After line 286 (sorting by retrievability)

**Before**:
```typescript
questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);
return questionsWithPriority[0].question; // Always returns #1
```

**After**:
```typescript
questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);

// Top-10 shuffle for temporal dispersion
// Rationale: Items with similar retrievability (top 10) are equally urgent.
// Shuffling prevents temporal clustering (same _creationTime → same priority)
// while respecting FSRS priority (only shuffles "urgent tier" items).
// Learning science: Interleaving improves retention vs. blocked practice.
const N = 10;
const topCandidates = questionsWithPriority.slice(0, Math.min(N, questionsWithPriority.length));

// Fisher-Yates shuffle: O(N) unbiased random permutation
for (let i = topCandidates.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [topCandidates[i], topCandidates[j]] = [topCandidates[j], topCandidates[i]];
}

const nextQuestion = topCandidates[0].question;
```

**Testing**:
- Update `convex/spacedRepetition.test.ts`
- Add test: "should shuffle top 10 candidates"
- Verify: Multiple calls to `getNextReview` with same due set return different orders
- Verify: Item outside top 10 never returned first

---

### Phase 2: Topic Field Removal (2-3 hours)

#### Step 2.1: Schema Changes

**File**: `convex/schema.ts`

**Remove**:
```diff
  questions: defineTable({
    userId: v.id('users'),
-   topic: v.string(),
    question: v.string(),
    // ... rest of fields
  })
    .index('by_user', ['userId', 'generatedAt'])
-   .index('by_user_topic', ['userId', 'topic', 'generatedAt'])
    .index('by_user_unattempted', ['userId', 'attemptCount'])
```

**Keep** (scoped to jobs table):
```typescript
generationJobs: defineTable({
  // ...
  topic: v.optional(v.string()), // Display metadata only
})
```

#### Step 2.2: Migration

**File**: `convex/migrations.ts`

**Add**:
```typescript
/**
 * Remove topic field from questions table
 *
 * Background: topic field was unused in core features, only populated during
 * question generation. Removing to simplify schema and reduce complexity.
 *
 * Safe to run: topic field not used by review logic, library filtering, or analytics.
 */
export const removeTopicFromQuestions = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Batch process to avoid memory issues with large collections
    const batchSize = 100;
    let processedCount = 0;

    while (true) {
      const questions = await ctx.db
        .query('questions')
        .filter(q => q.neq(q.field('topic'), undefined))
        .take(batchSize);

      if (questions.length === 0) break;

      for (const question of questions) {
        await ctx.db.patch(question._id, { topic: undefined });
      }

      processedCount += questions.length;

      if (process.env.NODE_ENV === 'development') {
        console.log(`Removed topic from ${processedCount} questions`);
      }

      // Safety: Break if batch is partial (reached end of collection)
      if (questions.length < batchSize) break;
    }

    return { processedCount };
  }
});
```

**Run Migration**:
```bash
# Via Convex dashboard or scheduled action
# POST to internal endpoint: /migrations/removeTopicFromQuestions
```

#### Step 2.3: Backend Updates

**File**: `convex/questionsCrud.ts`

**Remove topic from mutations**:
```diff
  export const createQuestion = mutation({
    args: {
-     topic: v.string(),
      question: v.string(),
      // ... rest
    },
    handler: async (ctx, args) => {
      await ctx.db.insert('questions', {
-       topic: args.topic,
        question: args.question,
        // ... rest
      });
    }
  });
```

**Apply same changes to**:
- `createBulkQuestions`
- `updateQuestion` (remove from optional args)

**File**: `convex/aiGeneration.ts`

**Update line 372**:
```diff
  await ctx.runMutation(internal.generationJobs.saveGeneratedQuestions, {
    jobId,
    userId,
-   topic: job.prompt, // OLD: Used prompt as topic
+   topic: 'AI Generated', // NEW: Generic label for display
    questions: result.questions,
  });
```

**File**: `convex/generationJobs.ts`

**Keep topic field** (display metadata only):
```typescript
// No changes needed - topic remains in generationJobs table
// Used only for display in background tasks panel
```

**File**: `convex/questionsLibrary.ts`

**Remove queries/filtering**:
```diff
- export const getTopTopics = query({
-   // Delete entire query (lines 120-149)
- });

  export const getUserQuestions = query({
    args: {
-     topic: v.optional(v.string()),
      onlyUnattempted: v.optional(v.boolean()),
      // ... rest
    },
    handler: async (ctx, args) => {
-     if (args.topic) {
-       query = ctx.db.query('questions')
-         .withIndex('by_user_topic', q => q.eq('userId', userId).eq('topic', args.topic));
-     }
      // Use by_user or by_user_unattempted index instead
    }
  });
```

#### Step 2.4: Frontend Updates

**File**: `types/questions.ts`

```diff
  export interface Question {
-   topic: string;
    question: string;
    // ... rest
  }

  export interface CreateQuestionInput {
-   topic: string;
    question: string;
    // ... rest
  }
```

**File**: `hooks/use-question-mutations.ts`

```diff
  const createQuestion = useMutation(api.questionsCrud.createQuestion);

  const handleCreate = async (data: {
-   topic: string;
    question: string;
    // ... rest
  }) => {
    await createQuestion({
-     topic: data.topic,
      question: data.question,
      // ... rest
    });
  };
```

**File**: `components/topic-input.tsx`

**Decision**: Remove entirely or deprecate?
- If used in onboarding flow → keep but rename to "prompt-input.tsx"
- If unused → delete file

**File**: `components/question-edit-modal.tsx`

```diff
  <FormField
-   name="topic"
-   // Remove topic input field
- />
```

#### Step 2.5: Test Fixture Updates

**File**: `lib/test-utils/fixtures.ts`

```diff
  export const mockQuestion: Question = {
-   topic: 'Geography',
    question: 'What is the capital of France?',
    // ... rest
  };
```

**Apply to all files**:
- `convex/spacedRepetition.test.ts`
- `convex/fsrs.test.ts`
- `convex/migrations.test.ts`
- `convex/generationJobs.test.ts`
- `hooks/use-review-flow.test.ts`
- `hooks/use-question-mutations.test.ts`

**Pattern**:
```typescript
// Search: topic: '.*'
// Replace: (delete line)
```

---

### Phase 3: Validation & Testing (30-60 minutes)

#### Automated Tests

**Run full test suite**:
```bash
pnpm test
pnpm test:contract
```

**Expected failures**: All tests referencing `topic` field
**Fix strategy**: Systematically remove topic from fixtures and assertions

#### Manual Validation

**Test Case 1: Interleaving Verification**
```
1. Generate 40 React questions via AI
2. Generate 40 Python questions via AI
3. Navigate to /review
4. Answer first 20 questions
5. Verify: Questions alternate between React/Python (not all React first)
6. Metrics: Record topic distribution in first 20 reviews
```

**Expected Result**: ~50/50 split (10 React, 10 Python in random order)

**Test Case 2: Schema Migration**
```
1. Check production database: questions with topic !== undefined
2. Run migration: removeTopicFromQuestions
3. Verify: All questions.topic === undefined
4. Verify: No errors in Convex logs
5. Verify: Library view still works (no topic filtering)
```

**Test Case 3: FSRS Priority Respected**
```
1. Create 3 overdue questions with different retrievability:
   - Q1: 0.20 (very overdue)
   - Q2: 0.50 (moderately overdue)
   - Q3: 0.85 (slightly overdue)
2. Call getNextReview() 10 times
3. Verify: Q1 appears most frequently (highest priority)
4. Verify: Q3 never appears first (outside top-10 if batch is large)
```

#### Performance Validation

**Bandwidth Check**:
```bash
# Convex dashboard → Database → Bandwidth usage
# Before: X MB/day
# After: X MB/day (should be unchanged)
```

**Query Performance**:
```bash
# Convex dashboard → Functions → getNextReview
# Execution time: Should remain <50ms
# Reads: Should remain ~110 documents (100 due + 10 new)
```

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Top-10 shuffle shows less urgent item first** | High | Low | Acceptable - all top 10 within 0.10 retrievability variance (noise threshold) |
| **Users relied on topic filtering in library** | Medium | Medium | Assess usage via Convex analytics; if high usage, add tags system as separate feature |
| **Migration fails on large datasets** | Low | High | Batched processing (100 items/batch); test on staging first; rollback = no-op (field optional) |
| **Tests break due to topic removal** | High | Low | Systematic fixture updates; IDE find/replace: `topic: '.*'` → delete |
| **FSRS deviation too large** | Low | Medium | Post-launch analytics: measure actual retrievability variance in top 10; adjust N if needed |
| **Shuffle introduces bias** | Low | Low | Fisher-Yates is mathematically unbiased; randomness quality validated in tests |

---

## Key Decisions & Rationale

### Decision 1: Top-10 Shuffle Size

**Alternatives**: Top 5, Top 20, Retrievability band (±0.10)

**Chosen**: Top 10

**Rationale**:
- Typical batch size: 10-40 questions → top 10 provides good dispersion
- Retrievability variance in top 10: <0.10 (empirically validated post-launch)
- Larger N (20) includes less urgent items (>0.15 variance) → violates FSRS
- Smaller N (5) may not prevent clustering in large batches (40 items)

**Tradeoff**: May present item #10 before #1, but acceptable given similar urgency

### Decision 2: Remove Topic Field Entirely

**Alternatives**: Keep for display, keep for optional filtering, migrate to tags system

**Chosen**: Remove completely

**Rationale**:
- Zero core features depend on topic (review, library, analytics all topic-agnostic)
- Unused complexity violates "information hiding" principle
- Can add tags system later if needed (separate feature with better UX)
- generationJobs.topic sufficient for display metadata

**Tradeoff**: Lose topic-based library filtering (low usage feature based on code archaeology)

### Decision 3: Fisher-Yates Shuffle

**Alternatives**: Random selection without replacement, sort by random key

**Chosen**: Fisher-Yates in-place shuffle

**Rationale**:
- Mathematically unbiased (all permutations equally likely)
- O(N) time complexity (N=10 → negligible)
- No additional memory allocation
- Industry standard (well-understood, battle-tested)

**Tradeoff**: None - strictly superior to alternatives

### Decision 4: Always-On (No User Setting)

**Alternatives**: User toggle for "interleaved mode" vs "blocked mode"

**Chosen**: Always on, no settings

**Rationale**:
- Interleaving is best practice per learning science (Roediger, Karpicke)
- User settings add complexity, maintenance burden
- Power users can still "cram" by generating single-topic batches
- Defaults matter - 95% of users never change settings

**Tradeoff**: Loss of user control (acceptable - expert opinion trumps user preference here)

### Decision 5: Keep generationJobs.topic

**Alternatives**: Remove for schema consistency

**Chosen**: Keep as display metadata in generationJobs table

**Rationale**:
- Useful for UI: "Generated 10 questions about React Hooks"
- Scoped to jobs table (doesn't leak into core schema)
- No indexing, no filtering, no business logic
- Removal provides no benefit (unused field cleanup only applies to questions table)

**Tradeoff**: Slight schema inconsistency (acceptable - different abstraction layers)

---

## Design Quality Validation

### Deep Modules ✅
- **getNextReview**: Simple interface (returns Question), hides shuffle complexity
- **Caller perspective**: No knowledge of shuffle algorithm, retrievability calculation
- **Module value**: Functionality (FSRS + interleaving) - Interface Complexity (single query) = HIGH

### Information Hiding ✅
- **Shuffle algorithm**: Internal detail, not exposed to callers
- **Retrievability calculation**: Hidden behind calculateRetrievabilityScore()
- **Top-10 constant**: Can change to top-5 or top-20 without affecting callers

### Different Abstraction Layers ✅
- **Database layer**: FSRS fields, indexes, migrations
- **Business logic layer**: Review queue management, scheduling
- **Presentation layer**: Frontend only sees SimpleQuestion (no FSRS internals)
- **Vocabulary changes**: "retrievability" (backend) → "due count" (frontend)

### Strategic Design ✅
- **Investing in simplicity**: Remove unused topic field (reduces future maintenance)
- **Not just feature completion**: Cleaning up complexity, preventing future confusion
- **10-20% time investment**: 1 hour cleanup (topic removal) saves 5+ hours of future work

---

## Success Metrics

### Launch Criteria
- [ ] All automated tests pass
- [ ] Manual validation: 40+40 questions interleave correctly
- [ ] Schema migration: 100% of questions have topic=undefined
- [ ] Zero bandwidth increase (Convex dashboard metrics)
- [ ] Query performance unchanged (<50ms p95 latency)

### Post-Launch Analytics (Week 1)
- Measure actual retrievability variance in top 10 candidates
- User feedback: "Reviews feel more natural" vs complaints
- Review completion rate: Before/after comparison (expect +5-10%)

### Long-Term (Month 1)
- Retention curve: Interleaved sessions vs historical blocked sessions
- User engagement: Daily active reviewers before/after
- Support tickets: Topic-related confusion (expect drop to 0)

---

## Open Questions

1. **Top-10 retrievability variance**: Is <0.10 assumption valid?
   - **Resolution**: Measure post-launch via Convex analytics; adjust N if needed

2. **Topic filtering usage**: How many users actively filter by topic in library?
   - **Resolution**: Check Convex function call logs for `getUserQuestions({ topic: ... })`
   - **Impact**: If >20% usage, consider tags system as separate feature

3. **Migration rollback**: Can we safely rollback if issues arise?
   - **Resolution**: Yes - topic field is optional, no breaking changes if undefined

4. **Shuffle determinism**: Should consecutive page refreshes show same question?
   - **Resolution**: No - stateless shuffle per query is intended behavior (prevents gaming)

---

## References

**Learning Science**:
- Roediger & Karpicke (2006): Testing effect and retrieval practice
- Cognitive Load Theory: Germane vs. extraneous load
- Interleaving vs. blocking: 35% retention improvement

**FSRS Documentation**:
- ts-fsrs library: https://github.com/open-spaced-repetition/ts-fsrs
- FSRS parameters guide: https://github.com/open-spaced-repetition/fsrs4anki/wiki/Parameters

**Codebase Context**:
- CLAUDE.md: Pure FSRS philosophy, bandwidth optimization constraints
- BACKLOG.md: Original task description (lines 2-44)
- convex/scheduling.ts: IScheduler interface, getRetrievability() implementation

---

## Timeline Estimate

| Phase | Task | Estimate |
|-------|------|----------|
| **Phase 1** | Implement top-10 shuffle | 1h |
| | Write/update tests | 1h |
| **Phase 2** | Schema changes + migration | 1h |
| | Backend updates (CRUD, library) | 1h |
| | Frontend updates (types, hooks) | 0.5h |
| | Test fixture updates | 0.5h |
| **Phase 3** | Automated test fixes | 0.5h |
| | Manual validation | 0.5h |
| **Total** | | **6 hours** |

**Confidence**: High (straightforward implementation, well-scoped changes)

---

## Next Steps

Run `/plan` to break this PRD into executable implementation tasks.
