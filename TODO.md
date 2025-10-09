# TODO: PR #32 Review Feedback - Pre-Merge Improvements

**Status**: In Progress
**Estimated Effort**: 45 minutes
**Context**: Address blocking and in-scope feedback from Claude's automated code review
**PR Reference**: https://github.com/phrazzld/scry/pull/32#issuecomment-3386367273

---

## Critical (Merge-Blocking)

### 🚨 Fix Incomplete FSRS Decoupling

**Issue**: `convex/spacedRepetition.ts:42` still imports `getRetrievability` directly from `fsrs.ts`, breaking the scheduling abstraction.

**Why this matters**: If we want to swap FSRS for SM-2, we'd need to modify both `scheduling.ts` AND `spacedRepetition.ts`. The abstraction should hide ALL algorithm details.

**Implementation Steps**:

- [ ] **Update `convex/scheduling.ts` interface** (10min)
  ```typescript
  // Add to IScheduler interface (line ~30)
  export interface IScheduler {
    initializeCard(): Partial<Doc<'questions'>>;
    scheduleNextReview(question: Doc<'questions'>, isCorrect: boolean, now: Date): SchedulingResult;
    getRetrievability(question: Doc<'questions'>, now: Date): number; // NEW
  }

  // Implement in FsrsScheduler class (line ~120)
  getRetrievability(question: Doc<'questions'>, now: Date): number {
    return getRetrievability(this.convertToFsrsCard(question), now);
  }
  ```

- [ ] **Update `convex/spacedRepetition.ts` imports** (5min)
  ```typescript
  // OLD (line 42):
  import { getRetrievability } from './fsrs';

  // NEW:
  // Remove direct import, use scheduler instead
  ```

- [ ] **Update `convex/spacedRepetition.ts` usage** (10min)
  ```typescript
  // In getNextReview query (around line 118):
  // OLD:
  const retrievability = getRetrievability(fsrsCard, now);

  // NEW:
  const scheduler = getScheduler();
  const retrievability = scheduler.getRetrievability(question, now);
  ```

- [ ] **Test changes** (5min)
  ```bash
  pnpm test  # All 358 tests should still pass
  pnpm build # TypeScript compilation should succeed
  grep "import.*getRetrievability.*from.*fsrs" convex/spacedRepetition.ts  # Should return nothing
  ```

**Success Criteria**:
- Zero direct `fsrs.ts` imports in `spacedRepetition.ts`
- All tests passing (358/358)
- `spacedRepetition.ts` is 100% algorithm-agnostic

**Estimated Time**: 30 minutes

---

## In-Scope Improvements

### ✅ Add Type Safety Enhancement

**Issue**: `convex/questionsInteractions.ts:71-78` uses type spread that might lose type safety.

**Implementation**:

- [ ] **Add explicit type assertion** (5min)
  ```typescript
  // File: convex/questionsInteractions.ts
  // Line: 74-78

  // OLD:
  const result = scheduler.scheduleNextReview(
    { ...question, ...initialDbFields },
    args.isCorrect,
    now
  );

  // NEW:
  const result = scheduler.scheduleNextReview(
    { ...question, ...initialDbFields } as Doc<'questions'>,
    args.isCorrect,
    now
  );
  ```

**Success Criteria**: TypeScript inference explicit, prevents future type issues

**Estimated Time**: 5 minutes

---

### ✅ Standardize Error Messages

**Issue**: Error messages inconsistent across modules (some include questionId, some don't).

**Implementation**:

- [ ] **Standardize `questionsCrud.ts` errors** (3min)
  ```typescript
  // File: convex/questionsCrud.ts
  // Line: 140, 171

  // OLD:
  throw new Error('Question not found or unauthorized');

  // NEW:
  throw new Error(`Question not found or unauthorized: ${args.questionId}`);
  ```

- [ ] **Standardize `questionsInteractions.ts` errors** (3min)
  ```typescript
  // File: convex/questionsInteractions.ts
  // Line: 39

  // OLD:
  throw new Error('Question not found or unauthorized');

  // NEW:
  throw new Error(`Question not found or unauthorized: ${args.questionId}`);
  ```

- [ ] **Verify consistency** (4min)
  ```bash
  # All error messages should include context (ID, operation, etc)
  grep -n "throw new Error" convex/questions*.ts
  ```

**Success Criteria**: All error messages include question ID for debugging

**Estimated Time**: 10 minutes

---

## Validation Checklist

Before marking PR ready for merge:

- [ ] All critical tasks complete (FSRS decoupling)
- [ ] All in-scope improvements applied (type safety, error messages)
- [ ] Tests passing: `pnpm test` (358/358)
- [ ] Build successful: `pnpm build`
- [ ] Lint clean: `pnpm lint`
- [ ] Zero direct `fsrs.ts` imports: `grep -r "from.*fsrs" convex/questions*.ts convex/spacedRepetition.ts`

---

## Notes

- Follow-up work (unit tests, documentation, deprecation timelines) tracked in `BACKLOG.md`
- All feedback from Claude's review acknowledged and categorized
- Estimated total effort: 45 minutes for pre-merge improvements
