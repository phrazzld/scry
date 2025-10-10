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

- [x] **Update `convex/scheduling.ts` interface** (10min)
  ```
  ✅ COMPLETED - commit f346665
  Added getRetrievability() method to IScheduler interface
  ```

- [x] **Update `convex/spacedRepetition.ts` imports** (5min)
  ```
  ✅ COMPLETED - commit f346665
  Removed direct getRetrievability import from fsrs.ts
  ```

- [x] **Update `convex/spacedRepetition.ts` usage** (10min)
  ```
  ✅ COMPLETED - commit f346665
  Updated calculateRetrievabilityScore to use scheduler.getRetrievability()
  ```

- [x] **Test changes** (5min)
  ```
  ✅ COMPLETED - All validation passed:
  - pnpm test: 358/358 tests passing ✓
  - pnpm build: TypeScript compilation successful ✓
  - Zero direct fsrs.ts imports in spacedRepetition.ts ✓
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

- [x] **Add explicit type assertion** (5min)
  ```
  ✅ COMPLETED - commit df49215
  - Added explicit 'as Doc<questions>' assertion
  - Added missing Doc import to questionsInteractions.ts
  - TypeScript compilation successful ✓
  ```

**Success Criteria**: TypeScript inference explicit, prevents future type issues ✅

**Estimated Time**: 5 minutes

---

### ✅ Standardize Error Messages

**Issue**: Error messages inconsistent across modules (some include questionId, some don't).

**Implementation**:

- [x] **Standardize `questionsCrud.ts` errors** (3min)
  ```
  ✅ COMPLETED - commit df49215
  Updated 3 error sites with questionId context
  ```

- [x] **Standardize `questionsInteractions.ts` errors** (3min)
  ```
  ✅ COMPLETED - commit df49215
  Updated 1 error site with questionId context
  ```

- [x] **Verify consistency** (4min)
  ```
  ✅ COMPLETED - All validation passed:
  - 4 error messages updated with questionId ✓
  - All 358 tests passing ✓
  - Improved debugging experience ✓
  ```

**Success Criteria**: All error messages include question ID for debugging ✅

**Estimated Time**: 10 minutes

---

## Validation Checklist

Before marking PR ready for merge:

- [x] All critical tasks complete (FSRS decoupling) ✅
- [x] All in-scope improvements applied (type safety, error messages) ✅
- [x] Tests passing: `pnpm test` (358/358) ✅
- [x] Build successful: `pnpm build` ✅
- [x] Lint clean: `pnpm lint` ✅
- [x] Zero direct `fsrs.ts` imports: `grep -r "from.*fsrs" convex/questions*.ts convex/spacedRepetition.ts` ✅

**Status**: ✅ READY FOR MERGE - All pre-merge requirements satisfied

---

## Notes

- Follow-up work (unit tests, documentation, deprecation timelines) tracked in `BACKLOG.md`
- All feedback from Claude's review acknowledged and categorized
- Estimated total effort: 45 minutes for pre-merge improvements
