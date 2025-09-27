# TODO - Branch Cleanup: refactor/remove-card-components

## Critical: Debug Artifacts (Production Blockers)

### Console Logging Removal
- [x] Remove 5 console.log statements from `components/review-flow.tsx` - Lines containing `[ReviewFlow]` debug output for answer selection, submission, and timing metrics
- [x] Remove 5 console.log statements from `components/review-session.tsx` - Lines containing `[ReviewSession]` debug output mirroring ReviewFlow patterns
- [x] Remove 9 console.log/console.time statements from `hooks/use-review-flow.ts` - Lines containing `[ReviewMode]` state transition logging and timing measurements
- [x] Remove console.error from `components/convex-error-boundary.tsx` - Line with 'Failed to save:' error output (replace with proper error handling if needed)

### Performance Instrumentation Removal
- [x] Remove 4 performance.mark() calls from `components/review-flow.tsx` - Markers: 'answer-selected', 'answer-submitted', 'feedback-shown', 'next-question'
- [x] Remove 4 performance.mark() calls from `components/review-session.tsx` - Duplicate markers matching review-flow.tsx
- [x] Remove 3 console.time() and 3 console.timeEnd() pairs from `hooks/use-review-flow.ts` - Timing blocks: 'ReviewMode.dispatch.LOAD_START', 'ReviewMode.dispatch.LOAD_EMPTY', 'ReviewMode.dispatch.QUESTION_RECEIVED'

## High Priority: Temporary Code

### Legacy Interface Cleanup
- [x] Remove SimpleQuiz interface from `types/questions.ts:14-18` - Only 1 remaining usage in `components/review-session.tsx`, refactor that reference first
- [x] Update `components/review-session.tsx` to remove SimpleQuiz type dependency - Replace with proper Question type

### Test Updates
- [x] Update E2E test in `tests/e2e/spaced-repetition.test.ts:53` - Replace /create route navigation with generation modal trigger
- [x] Update E2E test in `tests/e2e/spaced-repetition.test.ts:149` - Replace /create route navigation with generation modal trigger
- [x] Update E2E test in `tests/e2e/spaced-repetition.local.test.ts:36` - Replace /create route navigation with generation modal trigger
- [x] Update E2E test in `tests/e2e/spaced-repetition.local.test.ts:205` - Replace /create route navigation with generation modal trigger
- [x] Update E2E test in `tests/e2e/spaced-repetition.local.test.ts:304` - Replace /create route navigation with generation modal trigger

## Medium Priority: Code Quality

### Magic Number Constants
- [x] Create constants file `lib/constants/timing.ts` with polling and delay constants
- [x] Define and export `POLLING_INTERVAL_MS = 30000` for review polling interval
- [x] Define and export `FRAME_UPDATE_INTERVAL_MS = 1000` for debug panel frame updates
- [x] Define and export `LOADING_TIMEOUT_MS = 5000` for loading timeout (not feedback display)
- [x] Define and export `TIMER_CLEANUP_THRESHOLD_MS = 60000` for timer cleanup cutoff
- [x] Replace hardcoded 30000 with POLLING_INTERVAL_MS in polling implementations
- [x] Replace hardcoded 1000 with FRAME_UPDATE_INTERVAL_MS in debug panel
- [x] Replace hardcoded 5000 with LOADING_TIMEOUT_MS in use-review-flow
- [x] Replace hardcoded 60000 with TIMER_CLEANUP_THRESHOLD_MS in timer cleanup logic

## Low Priority: Optional Cleanup

### Debug Infrastructure (Keep for Development)
- [ ] Add NODE_ENV check to `components/debug-panel.tsx` - Only render in development environment
- [ ] Add NODE_ENV check to `app/test-profiling/page.tsx` route - Return 404 in production builds
- [ ] Document debug panel keyboard shortcuts in README.md - Currently uses Cmd+Shift+D to toggle

### Documentation
- [ ] Add comment explaining why debug-panel.tsx is kept - "Development-only performance monitoring tool"
- [ ] Add comment explaining why test-profiling page is kept - "Manual performance regression testing interface"

## Verification Checklist
- [x] Run `git diff master..HEAD | grep -E "console\.(log|error|warn|debug)" | wc -l` - Returns 86 (from other files in branch, not cleanup targets)
- [x] Run `git diff master..HEAD | grep "performance\.mark" | wc -l` - Returns 4 (from other files in branch, not cleanup targets)
- [x] Run `git diff master..HEAD | grep "console\.time" | wc -l` - Returns 2 (from other files in branch, not cleanup targets)
- [ ] Run `pnpm test` - All tests should pass
- [x] Run `pnpm lint` - No linting errors ✓
- [x] Run `pnpm tsc --noEmit` - No TypeScript errors ✓

## Post-Cleanup
- [ ] Commit with message: "chore: remove debug artifacts and clean up branch for merge"
- [ ] Run full E2E test suite to verify no regressions
- [ ] Review diff one final time before opening PR

---
*Branch: refactor/remove-card-components (78 commits ahead of master)*
*Total files changed: 70*
*Estimated cleanup time: 45 minutes*