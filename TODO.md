# TODO.md

## CRITICAL: Fix Review Flow "Next" Button Stuck After Incorrect Answer

### Root Cause Investigation
- [x] Identify that "Next" button doesn't work after incorrect answer
- [x] Trace REVIEW_COMPLETE action dispatch in logs
- [x] Discover same question returns immediately due to FSRS scheduling
- [x] Confirm useDataHash prevents update when same question ID returns
- [x] Locate incomplete state reset in REVIEW_COMPLETE reducer case (line 72-73 in use-review-flow.ts)

### Fix Implementation: Reset State on REVIEW_COMPLETE
- [x] Open `hooks/use-review-flow.ts` and navigate to line 71 (`case 'REVIEW_COMPLETE':`)
- [x] Replace current implementation that only clears `lockId` with full state reset:
  ```typescript
  case 'REVIEW_COMPLETE':
    return {
      ...state,
      phase: 'loading',
      question: null,
      questionId: null,
      interactions: [],
      lockId: null
    };
  ```
  * This ensures clean transition even when same question returns
  * Loading state provides visual feedback during transition
  * Prevents UI from staying stuck in feedback mode

### Update lastQuestionIdRef Logic
- [x] Review lines 194-195 where `lastQuestionIdRef.current` is set
- [x] Add comment explaining why we reset state even for same question:
  ```typescript
  // Update last question ID even if it's the same (immediate re-review case)
  // This ensures UI resets properly when incorrect answers trigger immediate review
  ```
- [x] Verify `lastQuestionIdRef` doesn't prevent same-question reload after REVIEW_COMPLETE

### Fix useDataHash Behavior for Transitions
- [x] Check if `dataHasChanged` check on line 127 needs special handling after REVIEW_COMPLETE
- [x] Consider adding condition: `if (!dataHasChanged && state.phase !== 'loading')`
  * Allows data processing when transitioning from loading state
  * Prevents ignoring legitimate same-question reloads after reset

### Testing Protocol
- [x] Start dev server with `pnpm dev` and navigate to http://localhost:3000
- [x] Answer a question incorrectly (e.g., select "Snake" for NATO letter 'S')
- [x] Click "Next" button and verify:
  * Brief loading state appears
  * Same question loads fresh without feedback shown
  * Selected answer is cleared
  * Question interaction count increments
- [x] Answer the same question correctly and verify it advances to different question
- [x] Test rapid clicking of "Next" button doesn't cause race conditions

### Edge Cases to Verify
- [ ] Test when only one question exists in the system (continuous loop)
- [ ] Test when network is slow (loading state should remain visible)
- [ ] Test when Convex backend returns null (no more questions)
- [ ] Test when user clicks "Next" multiple times quickly
- [ ] Verify error boundary catches any state transition errors

### Performance Impact Check
- [ ] Monitor render count in development console
- [ ] Verify no memory leaks from incomplete state cleanup
- [ ] Check that polling continues working after multiple transitions
- [ ] Confirm loading state duration is acceptable (<500ms typical)

### Code Cleanup
- [x] Remove or update misleading comment on lines 213-214 about "prevents loading state flash"
- [x] Add JSDoc comment to REVIEW_COMPLETE case explaining immediate re-review scenario
- [x] Update ReviewFlow component comment if it references the old behavior

### Documentation
- [x] Update `docs/review-render-flow.md` section on state transitions
- [x] Add note about FSRS immediate re-review behavior for incorrect answers
- [x] Document that loading state is intentional UX for question transitions

## Future Improvements

### Optimize Same-Question Transition UX
- [ ] Consider adding subtle animation for same-question reload
- [ ] Add "Try Again" message when same question returns after incorrect answer
- [ ] Implement crossfade transition instead of loading state for same question
- [ ] Add audio/haptic feedback for incorrect answers that trigger immediate review

### Enhanced Error Recovery
- [ ] Add timeout to loading state (fallback after 5 seconds)
- [ ] Implement retry mechanism if question fetch fails
- [ ] Add user-facing error message if stuck in loading state
- [ ] Log transition failures to error tracking service

### Testing Infrastructure
- [x] Write unit test for REVIEW_COMPLETE reducer case
- [x] Add E2E test for incorrect answer → Next button flow
- [ ] Create performance benchmark for question transitions
- [ ] Add regression test to prevent future locking issues