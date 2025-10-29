# TODO: PR #45 - Review Transition Flicker Fix

**Branch**: `claude/investigate-review-flicker-011CULtDhNRvJE5T4ZZjLpxr`
**PR**: [#45](https://github.com/phrazzld/scry/pull/45)
**Status**: Addressing critical review feedback from Codex bot

---

## Critical Fixes (Merge-Blocking)

### CB-1: Fix loading timeout during transitions [15min] - P0
**Location**: `hooks/use-review-flow.ts:134-159`
**Priority**: CRITICAL - Blocks merge

**Problem**:
The timeout effect only triggers when `phase === 'loading'`, but `REVIEW_COMPLETE` now keeps `phase: 'reviewing'`. If the next question fails to arrive (network issue, Convex outage), the UI stays in perpetual "Loading" state with no timeout recovery.

**Implementation**:
1. Update timeout useEffect to trigger on `isTransitioning` in addition to `phase === 'loading'`
2. Add `state.isTransitioning` to dependency array
3. Ensure timeout clears when transitioning completes

**Code Change**:
```typescript
// Line 134-159
useEffect(() => {
  if (state.phase === 'loading' || state.isTransitioning) {
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    // Set new timeout
    loadingTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'LOAD_TIMEOUT' });
    }, LOADING_TIMEOUT_MS);
  } else {
    // Clear timeout when not loading
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }

  return () => {
    // Cleanup on unmount
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  };
}, [state.phase, state.isTransitioning]); // Add isTransitioning dependency
```

**Testing**:
- Manual test: disconnect network, click Next, verify timeout fires after 5s
- Verify timeout shows error state instead of infinite loading

**Acceptance Criteria**:
- Network failure during transition shows error after 5 seconds
- Timeout message allows user to refresh/retry
- No infinite loading states

---

### CB-2: Reset UI state when same question re-queued [10min] - P0
**Location**: `components/review-flow.tsx:83-93`
**Priority**: CRITICAL - Breaks FSRS immediate re-review

**Problem**:
The reset effect depends on `questionId` changing. When FSRS immediately requeues the same question after an incorrect answer, `questionId` stays the same, so `selectedAnswer`, `feedbackState`, and timer aren't reset. User sees stale feedback and disabled "Next" button instead of being able to answer again.

**Implementation**:
1. Add `isTransitioning` to reset useEffect dependencies
2. Only reset when `questionId` exists AND not currently transitioning
3. This ensures reset happens when transition completes, even if ID unchanged

**Code Change**:
```typescript
// Reset state when question changes OR when transition completes
useEffect(() => {
  if (questionId && !isTransitioning) {
    setSelectedAnswer('');
    setFeedbackState({
      showFeedback: false,
      nextReviewInfo: null,
    });
    setQuestionStartTime(Date.now());
  }
}, [questionId, isTransitioning]); // Add isTransitioning dependency
```

**Testing**:
- E2E test: Answer question incorrectly (FSRS should re-queue immediately)
- Verify feedback clears and question becomes answerable again
- Verify timer resets

**Acceptance Criteria**:
- Same question can be answered multiple times in a row
- Feedback clears between attempts
- Timer resets for each attempt
- FSRS immediate re-review flow works correctly

---

## High Priority Improvements

### HP-1: Add test coverage for isTransitioning [30min] - P1
**Location**: `hooks/use-review-flow.test.ts`
**Priority**: HIGH - Prevent regression

**Implementation**:
Add 4 test cases covering all `isTransitioning` state transitions:

```typescript
describe('Optimistic UI transitions', () => {
  it('should set isTransitioning when REVIEW_COMPLETE dispatched', () => {
    const state = {
      ...reviewingState,
      isTransitioning: false
    };
    const newState = reviewReducer(state, { type: 'REVIEW_COMPLETE' });

    expect(newState.isTransitioning).toBe(true);
    expect(newState.phase).toBe('reviewing');
    expect(newState.lockId).toBeNull();
  });

  it('should clear isTransitioning when QUESTION_RECEIVED', () => {
    const state = {
      ...reviewingState,
      isTransitioning: true
    };
    const newState = reviewReducer(state, {
      type: 'QUESTION_RECEIVED',
      payload: mockPayload
    });

    expect(newState.isTransitioning).toBe(false);
    expect(newState.phase).toBe('reviewing');
  });

  it('should clear isTransitioning when LOAD_START', () => {
    const state = {
      ...reviewingState,
      isTransitioning: true
    };
    const newState = reviewReducer(state, { type: 'LOAD_START' });

    expect(newState.isTransitioning).toBe(false);
    expect(newState.phase).toBe('loading');
  });

  it('should clear isTransitioning when LOAD_EMPTY', () => {
    const state = {
      ...reviewingState,
      isTransitioning: true
    };
    const newState = reviewReducer(state, { type: 'LOAD_EMPTY' });

    expect(newState.isTransitioning).toBe(false);
    expect(newState.phase).toBe('empty');
  });
});
```

**Testing**:
Run `pnpm test` to verify all tests pass

**Acceptance Criteria**:
- All state machine transitions for `isTransitioning` have test coverage
- Tests pass in CI
- Code coverage for optimistic UI behavior >90%

---

## Medium Priority Improvements

### MP-1: Add aria-busy for accessibility [5min] - P2
**Location**: `components/review-flow.tsx:264`
**Priority**: MEDIUM - Accessibility compliance

**Implementation**:
1. Add `aria-busy={isTransitioning}` to Next button
2. Add `aria-hidden="true"` to Loader2 icon (decorative)

**Code Change**:
```typescript
<Button
  onClick={handleNext}
  disabled={isTransitioning}
  size="lg"
  aria-busy={isTransitioning}
>
  {isTransitioning ? (
    <>
      Loading
      <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" />
    </>
  ) : (
    <>
      Next
      <ArrowRight className="ml-2 h-4 w-4" />
    </>
  )}
</Button>
```

**Testing**:
- Test with screen reader (VoiceOver on macOS)
- Verify "busy" state announced when transitioning

**Acceptance Criteria**:
- Screen readers announce loading state
- WCAG 2.1 AA compliance for interactive elements

---

## Pre-Merge Checklist

**Critical Fixes**:
- [x] CB-1: Fix loading timeout during transitions
- [x] CB-2: Reset UI state for same-question re-review
- [x] HP-1: Add test coverage for isTransitioning

**Optional Improvements**:
- [x] MP-1: Add aria-busy for accessibility

**Testing**:
- [x] Run `pnpm test` - all tests pass
- [x] Run `pnpm tsc --noEmit` - no TypeScript errors
- [ ] Manual test: Network failure during transition shows timeout
- [ ] Manual test: Same question re-review works (answer incorrectly)
- [ ] Manual test: Screen reader announces loading state

**Verification**:
- [x] All Codex P1 issues addressed
- [ ] CI pipeline green
- [ ] Ready for merge

---

## Context & Notes

**Source**: Codex bot review on PR #45 (2 P1 issues identified)

**Key Issues**:
1. **Timeout regression**: Optimistic UI broke loading timeout by staying in `'reviewing'` phase
2. **Re-review UX bug**: Same questionId doesn't trigger reset, breaks FSRS immediate re-review

**Impact**:
- Without fixes: Users stuck on network failures, FSRS re-review broken
- With fixes: Robust error handling, smooth re-review experience

**Total Effort**: ~1 hour
**Blocking Issues**: 2 (will be 0 after fixes)
