# TODO: Smart Review Interleaving + Topic Field Removal

## Context
- **Approach**: Top-10 retrievability shuffle (Fisher-Yates) + complete topic field removal
- **Key Pattern**: Follow existing test patterns in `spacedRepetition.test.ts` (vitest + mock functions)
- **Module Boundary**: Review queue module owns prioritization + dispersion logic; schema module owns minimal question structure
- **Test Commands**: `pnpm test`, `pnpm test:contract`, `pnpm lint`

## Phase 1: Core Interleaving Logic

### Backend: Review Queue Shuffle

- [x] Implement top-10 shuffle in getNextReview query
  ```
  Files: convex/spacedRepetition.ts:286-290
  Approach: After existing sort, slice top 10, Fisher-Yates shuffle, return first
  Success: Query returns different questions on consecutive calls with same due set
  Test: Unit test - create 15 items with same retrievability, verify top 10 shuffled, #11-15 never appear
  Module: Review queue hides shuffle complexity; callers only see "next question" interface
  Dependencies: None (pure logic, no schema changes)
  Time: 30min
  ```

- [~] Add shuffle tests to spacedRepetition.test.ts
  ```
  Files: convex/spacedRepetition.test.ts:~line 400 (new describe block)
  Approach: Follow pattern from existing "Review Queue Prioritization" tests (lines 7-39)
  Success:
    - Test 1: Multiple calls return different questions (run 20 times, collect results, verify variance)
    - Test 2: Items outside top-10 never returned first
    - Test 3: Shuffle respects FSRS priority (top-10 only, not full set)
  Test: Self-testing (unit tests for the shuffle logic)
  Module: Validates review queue module behavior
  Dependencies: Requires shuffle implementation complete
  Time: 45min
  ```

## Phase 2: Schema Cleanup

### Backend: Schema & Migration

- [ ] Remove topic field and index from questions schema
  ```
  Files: convex/schema.ts:35 (remove topic field), :66 (remove by_user_topic index)
  Approach: Delete lines, keep generationJobs.topic (scoped to jobs table)
  Success: Schema compiles, no TypeScript errors in convex/
  Test: Run `pnpm convex dev` - schema push succeeds without errors
  Module: Schema module simplification - removes unused field
  Dependencies: None (breaking change handled by migration)
  Time: 15min
  ```

- [ ] Create removeTopicFromQuestions migration
  ```
  Files: convex/migrations.ts:~line 250 (append new mutation)
  Approach: Follow batching pattern from existing migrations (see initializeUserStats:155-175)
  Success: Migration runs without errors, all questions.topic === undefined
  Test: Manual - run via Convex dashboard internal function, verify count
  Module: Migration module - one-time data cleanup
  Dependencies: Schema change must deploy first (Convex validates on push)
  Time: 30min
  ```

### Backend: Mutation Updates

- [ ] Remove topic from questionsCrud mutations
  ```
  Files:
    - convex/questionsCrud.ts:26-50 (createQuestion args)
    - convex/questionsCrud.ts:85-110 (createBulkQuestions args)
    - convex/questionsCrud.ts:142-205 (updateQuestion optional args)
  Approach: Remove topic from v.object() args, remove from insert/patch calls
  Success: TypeScript compiles, mutations accept calls without topic param
  Test: Contract tests still pass (tests/api-contract.test.ts)
  Module: CRUD module - simplified question creation interface
  Dependencies: Schema removal complete (or uses v.optional for transition)
  Time: 30min
  ```

- [ ] Update aiGeneration saveGeneratedQuestions call
  ```
  Files: convex/aiGeneration.ts:372 (topic parameter in runMutation call)
  Approach: Keep generationJobs.topic (metadata), remove from questions insert
  Success: AI generation completes without errors, jobs show topic label
  Test: Generate questions via UI, verify job displays topic but questions don't store it
  Module: AI generation module - decouples job metadata from question data
  Dependencies: questionsCrud mutations updated
  Time: 15min
  ```

- [ ] Remove getTopTopics query and topic filtering
  ```
  Files:
    - convex/questionsLibrary.ts:120-149 (delete getTopTopics entirely)
    - convex/questionsLibrary.ts:159-179 (remove topic arg from getUserQuestions)
    - convex/questionsLibrary.ts:172-176 (remove topic-based index query branch)
  Approach: Delete query export, remove conditional logic for topic filtering
  Success: Library queries work without topic param, use by_user or by_user_unattempted index
  Test: Library view loads, pagination works, no TypeScript errors
  Module: Library module - simplified query interface (no topic filtering)
  Dependencies: Frontend must not call with topic param (or use v.optional transition)
  Time: 30min
  ```

### Frontend: Type & Component Updates

- [ ] Remove topic from TypeScript interfaces
  ```
  Files:
    - types/questions.ts:14 (Question interface)
    - types/questions.ts:22 (CreateQuestionInput interface)
    - convex/types.ts:32 (if present)
  Approach: Delete topic field lines, re-export interfaces
  Success: Frontend compiles without TypeScript errors
  Test: Run `pnpm build` - zero TypeScript errors
  Module: Type system - reflects simplified question model
  Dependencies: None (types can update before backend if made optional)
  Time: 15min
  ```

- [ ] Update question mutation hooks
  ```
  Files: hooks/use-question-mutations.ts:18-30 (remove topic from input type)
  Approach: Remove topic from CreateQuestionInput, remove from mutation call args
  Success: Hook compiles, create/update calls work without topic
  Test: Manual - edit question in UI, verify save works
  Module: Mutation hooks - simplified question creation interface
  Dependencies: Backend mutations updated, types updated
  Time: 15min
  ```

- [ ] Remove topic field from question-edit-modal
  ```
  Files: components/question-edit-modal.tsx:~lines with topic in schema/form/fields
  Approach: Remove from zodResolver schema, remove FormField component for topic
  Success: Edit modal renders without topic field, saves without topic
  Test: Manual - open edit modal, verify no topic input, save changes successfully
  Module: UI component - simplified edit form
  Dependencies: Mutation hooks updated
  Time: 20min
  ```

### Test Fixtures: Systematic Cleanup

- [ ] Remove topic from all test fixtures
  ```
  Files: (grep results)
    - lib/test-utils/fixtures.ts:36,97,121
    - convex/spacedRepetition.test.ts:20
    - convex/fsrs.test.ts:54,145,181,208,239,281,312,360
    - convex/migrations.test.ts:51
    - convex/generationJobs.test.ts:193,198,742
    - hooks/use-review-flow.test.ts:17,88
    - hooks/use-question-mutations.test.ts:61,75,88,102,116,135
  Approach: Search regex `topic: ['"][^'"]*['"]`, delete entire line
  Success: All tests pass after fixture cleanup
  Test: Run `pnpm test` - zero failures
  Module: Test infrastructure - reflects simplified question model
  Dependencies: All backend/frontend changes complete
  Time: 45min
  ```

## Phase 3: Integration Validation

- [ ] Run full test suite and fix failures
  ```
  Files: N/A (validation task)
  Approach: `pnpm test && pnpm test:contract && pnpm lint`
  Success: All tests pass, no lint errors, types compile
  Test: Self-testing (validates entire implementation)
  Module: Integration validation
  Dependencies: All implementation tasks complete
  Time: 30min
  ```

- [ ] Manual validation: Interleaving behavior
  ```
  Files: N/A (manual testing)
  Approach:
    1. Generate 40 React questions via UI
    2. Generate 40 Python questions via UI
    3. Navigate to /review
    4. Answer first 20 questions, record subject distribution
  Success: Questions interleave (not all React first), ~50/50 split observed
  Test: Manual user testing
  Module: End-to-end behavior validation
  Dependencies: All implementation complete, deployed to dev
  Time: 20min
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

**Total Estimate**: 5-6 hours (Phase 1: 1.25h, Phase 2: 3h, Phase 3: 0.5h, Buffer: 0.25-1.25h)
**Confidence**: High (straightforward changes, well-defined boundaries, existing patterns to follow)
