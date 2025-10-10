# TODO: PR #32 Review Feedback - Pre-Merge Critical Fix

**Status**: In Progress
**Estimated Effort**: 5 minutes
**Context**: Address NEW critical issue found by Codex automated review (broken internal mutation reference)
**PR Reference**: https://github.com/phrazzld/scry/pull/32

---

## 🚨 CRITICAL (Merge-Blocking) - NEW ISSUE

### Fix Broken Internal Mutation Reference

**Issue**: `convex/aiGeneration.ts:340` calls `internal.questions.saveBatch` but `questions.ts` was deleted in the refactor. This will cause runtime failure: "No such function: questions.saveBatch"

**Why this matters**: Breaks core feature (AI question generation). Users won't be able to generate new questions.

**Source**: Codex inline review comment (2025-10-10)

**Implementation Steps**:

- [ ] **Update mutation reference** (1min)
  ```
  File: convex/aiGeneration.ts:340
  Change: internal.questions.saveBatch → internal.questionsCrud.saveBatch
  ```

- [ ] **Verify TypeScript compilation** (1min)
  ```
  Run: pnpm build
  Expected: Successful compilation
  ```

- [ ] **Verify Convex API types** (1min)
  ```
  Check: convex/_generated/api.d.ts includes questionsCrud module
  Verify: internal.questionsCrud.saveBatch exists
  ```

- [ ] **Run test suite** (2min)
  ```
  Run: pnpm test
  Expected: 358/358 tests passing
  ```

- [ ] **Commit fix** (1min)
  ```
  Message: "fix: update saveBatch reference to questionsCrud module"
  ```

**Success Criteria**:
- TypeScript compilation successful
- All 358 tests passing
- AI question generation works end-to-end

**Estimated Time**: 5 minutes

---

## ✅ Previously Completed Tasks

### Fix Incomplete FSRS Decoupling (commit f346665)
- ✅ Added getRetrievability() to IScheduler interface
- ✅ Removed direct fsrs.ts import from spacedRepetition.ts
- ✅ Updated calculateRetrievabilityScore to use scheduler interface

### Add Type Safety Enhancement (commit df49215)
- ✅ Added explicit `as Doc<'questions'>` assertion
- ✅ Added missing Doc import to questionsInteractions.ts

### Standardize Error Messages (commit df49215)
- ✅ Updated 4 error sites to include questionId context
- ✅ Improved debugging experience across modules

---

## Validation Checklist

Before marking PR ready for merge:

- [x] All Claude review feedback addressed (FSRS decoupling, type safety, error messages) ✅
- [ ] Codex review feedback addressed (broken mutation reference)
- [ ] Tests passing: `pnpm test` (358/358)
- [ ] Build successful: `pnpm build`
- [ ] Lint clean: `pnpm lint`

**Status**: 🔄 IN PROGRESS - Addressing Codex critical feedback

---

## Notes

- Follow-up work (unit tests, documentation, deprecation timelines) tracked in `BACKLOG.md`
- All feedback from both Claude and Codex reviews acknowledged and categorized
- Previous effort: 45 minutes (Claude feedback) + 5 minutes (Codex feedback) = 50 minutes total
