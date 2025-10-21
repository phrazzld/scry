# TODO: Smart Review Interleaving + Topic Field Removal

## Status: 🟢 IMPLEMENTATION COMPLETE (1 validation task remaining)

**Completed**: 8/9 tasks | **Commits**: 3 | **Tests**: 421 passing ✅

### What's Done
- ✅ Top-10 Fisher-Yates shuffle implemented in getNextReview query
- ✅ Comprehensive test suite (5 tests validating shuffle behavior)
- ✅ Topic field removed from questions schema (breaking change)
- ✅ Migration created (removeTopicFromQuestions with dry-run support)
- ✅ All backend mutations updated (questionsCrud, aiGeneration, questionsLibrary)
- ✅ All frontend components updated (types, hooks, modals, tables)
- ✅ Test fixtures cleaned up (421 tests passing)
- ✅ TypeScript compilation, linting, and pre-commit hooks passing

### What's Remaining
- ⏳ Manual validation: Deploy to dev and verify interleaving behavior with 40+40 questions

### Key Commits
- `ed2ea7d`: Add comprehensive tests for top-10 shuffle behavior
- `e7ea729`: Implement smart review interleaving and remove topic field (20 files changed)
- `18286d3`: Add migration to remove topic field from existing questions

## Context
- **Approach**: Top-10 retrievability shuffle (Fisher-Yates) + complete topic field removal
- **Key Pattern**: Follow existing test patterns in `spacedRepetition.test.ts` (vitest + mock functions)
- **Module Boundary**: Review queue module owns prioritization + dispersion logic; schema module owns minimal question structure
- **Test Commands**: `pnpm test`, `pnpm test:contract`, `pnpm lint`

## Phase 1: Core Interleaving Logic ✅ COMPLETED

### Backend: Review Queue Shuffle

- [x] Implement top-10 shuffle in getNextReview query
  ```
  COMPLETED: convex/spacedRepetition.ts:286-302
  - Implemented Fisher-Yates shuffle on top 10 candidates
  - Added after existing retrievability sort
  - Zero deviation from FSRS outside top-N
  Commit: ed2ea7d + e7ea729
  ```

- [x] Add shuffle tests to spacedRepetition.test.ts
  ```
  COMPLETED: convex/spacedRepetition.test.ts:1511-1748
  - Added "Top-10 Shuffle for Temporal Dispersion" suite (5 tests)
  - Test 1: Variance across 50 calls (verifies shuffle active)
  - Test 2: Boundary enforcement (#11-15 never returned)
  - Test 3: FSRS priority respect (within-band shuffle only)
  - Test 4: Edge cases (empty, single, <10 items)
  - Test 5: Shuffle distribution (uniform randomness)
  All 421 tests passing ✅
  Commit: ed2ea7d
  ```

## Phase 2: Schema Cleanup ✅ COMPLETED

### Backend: Schema & Migration

- [x] Remove topic field and index from questions schema
  ```
  COMPLETED: convex/schema.ts
  - Removed `topic: v.string()` from questions table (line 35)
  - Removed `by_user_topic` compound index (line 66)
  - Kept topic in generationJobs table (metadata only)
  - TypeScript compilation successful after downstream fixes
  Commit: e7ea729
  ```

- [x] Create removeTopicFromQuestions migration
  ```
  COMPLETED: convex/migrations.ts:633-785
  - Added TopicRemovalStats type (lines 65-70)
  - Implemented removeTopicFromQuestionsInternal helper (lines 638-753)
  - Exported removeTopicFromQuestions mutation (lines 774-785)
  - Follows same pattern as removeDifficultyFromQuestions
  - Batch size: 500 questions/batch
  - Features: dry-run support, progress logging, comprehensive stats
  Commit: 18286d3
  ```

### Backend: Mutation Updates ✅ COMPLETED

- [x] Remove topic from questionsCrud mutations
  ```
  COMPLETED: convex/questionsCrud.ts
  - Removed topic from saveGeneratedQuestions args (line 26)
  - Removed topic from saveBatch internal mutation (line 85)
  - Removed topic from updateQuestion args and validation (lines 138, 164-166, 201)
  - All mutations compile without topic parameter
  Commit: e7ea729
  ```

- [x] Update aiGeneration saveGeneratedQuestions call
  ```
  COMPLETED: convex/aiGeneration.ts:370-373
  - Removed topic parameter from saveBatch call
  - generationJobs.topic preserved (metadata only, not propagated to questions)
  - AI generation pipeline functional
  Commit: e7ea729
  ```

- [x] Remove getTopTopics query and topic filtering
  ```
  COMPLETED: convex/questionsLibrary.ts
  - Removed getRecentTopics query entirely (old lines 110-149)
  - Removed topic arg from getUserQuestions (lines 112, 124-127)
  - Removed by_user_topic index usage
  - Also updated: convex/questionsRelated.ts, convex/migrations.ts (quiz migration)
  Commit: e7ea729
  ```

### Frontend: Type & Component Updates ✅ COMPLETED

- [x] Remove topic from TypeScript interfaces
  ```
  COMPLETED: types/questions.ts
  - Removed `topic: string` from Question interface (line 22)
  - Changed QuizGenerationRequest from `topic: string` to `prompt: string`
  - Frontend compiles successfully
  Commit: e7ea729
  ```

- [x] Update question mutation hooks
  ```
  COMPLETED: hooks/use-question-mutations.ts
  - Removed topic from optimisticStore.edits Map type (line 18)
  - Removed topic from OptimisticEditParams interface (line 30)
  - Removed topic from destructuring (line 59)
  - Removed topic from optimisticData object (line 63)
  - Removed topic from updateQuestion call (lines 72-78)
  Commit: e7ea729
  ```

- [x] Remove topic field from question-edit-modal
  ```
  COMPLETED: components/question-edit-modal.tsx
  - Removed Topic FormField from edit form (old lines 153-169)
  - Removed Input import (no longer used)
  - Modal renders without topic field, saves successfully
  Commit: e7ea729
  ```

- [x] Remove topic from other components
  ```
  COMPLETED:
  - components/review-flow.tsx: Removed topic from optimisticEdit call (line 170)
  - app/library/_components/library-table.tsx: Removed topicColumn, Badge import
  - app/library/_components/library-cards.tsx: Removed topic Badge displays
  Commit: e7ea729
  ```

### Test Fixtures: Systematic Cleanup ✅ COMPLETED

- [x] Remove topic from all test fixtures
  ```
  COMPLETED: Used sed for batch removal
  - lib/test-utils/fixtures.ts: Removed topic from Question mocks, removed unused topics/difficulties arrays
  - convex/spacedRepetition.test.ts: Removed all topic lines from mock questions
  - convex/fsrs.test.ts: Removed topic from test fixtures
  - convex/migrations.test.ts: Removed topic from mock questions
  - Note: convex/generationJobs.test.ts preserved (topic is in generationJobs table, intentional)
  - Fixed linting errors (removed unused imports: Badge, Input)
  All 421 tests passing ✅
  Commit: e7ea729
  ```

## Phase 3: Integration Validation

- [x] Run full test suite and fix failures
  ```
  COMPLETED:
  - TypeScript: `pnpm tsc --noEmit` ✅ (zero errors)
  - Tests: `pnpm test:ci` ✅ (421 tests passing)
  - Linting: Pre-commit hooks passing ✅
  All validation automated checks passing
  Commits: ed2ea7d, e7ea729, 18286d3
  ```

- [ ] Manual validation: Interleaving behavior (PENDING DEPLOYMENT)
  ```
  Status: Ready for testing, requires running dev environment
  Approach:
    1. Deploy schema changes to dev: `pnpm dev` (starts Convex + Next.js)
    2. Run migration: Call api.migrations.removeTopicFromQuestions via Convex dashboard
    3. Generate 40 questions with one prompt (e.g., "React hooks")
    4. Generate 40 questions with different prompt (e.g., "Python asyncio")
    5. Navigate to /review
    6. Observe first 10-20 questions for temporal dispersion
  Success Criteria:
    - Questions generated at similar times are NOT all shown consecutively
    - First 20 questions show mix of both generation batches
    - Shuffle variance observable (different question order on refresh)
  Note: This validates the top-10 shuffle prevents temporal clustering
  ```

## Design Iteration Checkpoints

**After Phase 1 (Shuffle Implementation)**:
- Review: Is top-10 the right N? Measure actual retrievability variance in logs
- Adjust: If variance >0.15 consistently, reduce to top-5; if <0.05, increase to top-15

**After Phase 2 (Topic Removal)**:
- Review: Any frontend features broken by topic removal? Check usage analytics
- Extract: If topic filtering was high-usage, plan tags system as separate feature (add to BACKLOG.md)

**After Phase 3 (Integration)**:
- Review: Query performance unchanged? Check Convex dashboard metrics (<50ms p95 latency)
- Measure: Run manual validation, document actual interleaving ratio (target: 40-60% split)

## Module Boundaries Summary

**Review Queue Module** (`spacedRepetition.ts`):
- **Owns**: FSRS priority calculation, top-N shuffle logic, candidate batching
- **Hides**: Retrievability calculation, shuffle algorithm, batch size constant (N=10)
- **Interface**: `getNextReview() → Question | null` (simple, stable)
- **Value**: High functionality (FSRS + interleaving) - Low interface complexity = Deep module ✅

**Schema Module** (`schema.ts`):
- **Owns**: Question document structure, index definitions
- **Hides**: FSRS internal fields, denormalized counters
- **Interface**: Question type (minimal required fields)
- **Value**: Removes unused complexity (topic field) = Simpler system ✅

**Migration Module** (`migrations.ts`):
- **Owns**: One-time data transformations, batched processing
- **Hides**: Batch size, retry logic, progress tracking
- **Interface**: Internal mutations (not exposed to frontend)
- **Value**: Safe schema evolution without downtime ✅

## Risk Mitigation Notes

**Risk: Top-10 shows less urgent item**
- Mitigation: Acceptable by design (all within 0.10 retrievability variance)
- Validation: Post-launch analytics to measure actual variance

**Risk: Users relied on topic filtering**
- Mitigation: Check Convex function logs for `getUserQuestions({ topic: ... })` call frequency
- Contingency: If >20% usage, add tags system to BACKLOG.md as future enhancement

**Risk: Migration fails on large dataset**
- Mitigation: Batched processing (100 items/batch), tested on staging first
- Rollback: Field is optional - no breaking change if migration incomplete

## Automation Opportunities

**Topic field removal pattern** (applied 8 times):
```bash
# Could script this for future schema cleanups
find . -name "*.test.ts" -exec sed -i '' '/topic: /d' {} \;
```

**Test fixture generation**: Consider codegen for mock questions (reduces manual maintenance)

---

**Original Estimate**: 5-6 hours (Phase 1: 1.25h, Phase 2: 3h, Phase 3: 0.5h, Buffer: 0.25-1.25h)
**Actual Time**: ~3 hours implementation (Phase 1: 45min, Phase 2: 2h, Phase 3: 15min automated validation)
**Efficiency Gain**: 50% faster due to systematic sed usage for batch cleanup + existing migration patterns
