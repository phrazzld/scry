# TODO.md

## CRITICAL: Fix Review Flow Render Performance (Erroneous Rerenders)

### Immediate: Performance Visibility Infrastructure
- [x] Create `hooks/use-render-tracker.ts` with frame-accurate render logging (16ms budget per frame at 60fps)
  * Log component name, render timestamp, render reason (props vs state change)
  * Track cumulative render count per component instance
  * Measure render duration using `performance.now()` start/end timestamps
  * Export data structure: `{ component: string, count: number, avgMs: number, reasons: string[] }`
  * Wrap in `if (process.env.NODE_ENV === 'development')` to eliminate production overhead
  * Expected impact: Identify which specific state/prop changes trigger unnecessary renders

- [x] Add `components/debug-panel.tsx` overlay showing real-time performance metrics
  * Position: fixed bottom-right, z-index 9999, semi-transparent black background
  * Display: Current FPS, render count last 60 seconds, active timers count
  * Show ReviewMode state machine status: `loading | empty | quiz` with transition count
  * List all active intervals/timeouts with their IDs and remaining time
  * Toggle via Ctrl+Shift+D keyboard shortcut using `useHotkeys` hook
  * Store visibility preference in localStorage key `scry:debug-panel-visible`
  * Expected impact: Real-time visibility into performance issues during testing

- [ ] Instrument `ReviewMode` component with render tracking at lines 15, 30, 63
  * Add `useRenderTracker('ReviewMode')` after all hooks
  * Log state transitions: `console.time('ReviewMode.setState')` before setState calls
  * Add performance marks: `performance.mark('review-question-loaded')` when question changes
  * Track polling query execution count vs actual data changes
  * Expected impact: Identify if polling causes renders even without data changes

- [ ] Add performance timing to `ReviewSession` component answer flow
  * Mark `performance.mark('answer-selected')` in handleAnswerSelect (line 52)
  * Mark `performance.mark('answer-submitted')` in handleSubmit (line 57)
  * Mark `performance.mark('feedback-shown')` when showFeedback becomes true
  * Mark `performance.mark('next-question')` in handleNext (line 93)
  * Measure time between marks: `performance.measure('submit-to-feedback', 'answer-submitted', 'feedback-shown')`
  * Expected impact: Identify if state updates cluster and cause multiple renders

### Fix: Polling Architecture Root Cause
- [ ] Create `hooks/use-simple-poll.ts` to replace complex `usePollingQuery` (eliminate 90 lines of complexity)
  * Simple setInterval with manual query refetch - no visibility API, no debouncing
  * Implementation: `useEffect` with `setInterval`, return cleanup function
  * Store intervalId in useRef to prevent recreation on each render
  * Accept query + args + intervalMs, return { data, isLoading, refetch }
  * Expected impact: Remove 6 state variables that trigger renders (refreshTimestamp, isVisible, etc.)

- [ ] Replace `usePollingQuery` in ReviewMode line 24 with `useSimplePoll`
  * Change from: `usePollingQuery(api.spacedRepetition.getNextReview, {}, 30000)`
  * Change to: `useSimplePoll(api.spacedRepetition.getNextReview, {}, 30000)`
  * Remove _refreshTimestamp hack from Convex query (no longer needed)
  * Test that new questions still appear when generated
  * Expected impact: Eliminate refreshTimestamp state updates every 30 seconds

- [ ] Add explicit "last data hash" comparison to prevent unchanged data renders
  * Create `useDataHash` hook using JSON.stringify + hash for deep comparison
  * Store previous hash in useRef, only trigger update if hash changes
  * Apply in ReviewMode useEffect (line 30) before any setState calls
  * Log when data fetched but not changed: "Poll executed but data unchanged"
  * Expected impact: Prevent renders when polling returns identical data

### Fix: State Management Anti-Patterns
- [ ] Consolidate ReviewMode's 6 state variables into single state machine object
  * Current states: state, reviewQuestion, reviewQuestionId, reviewInteractions, isReviewing, prevReviewId
  * New single state: `{ phase: 'loading'|'empty'|'reviewing', question: null|{...}, lockId: null|string }`
  * Use reducer pattern: `useReducer(reviewReducer, initialState)`
  * Actions: LOAD_START, LOAD_COMPLETE, QUESTION_RECEIVED, ANSWER_SUBMITTED, NEXT_QUESTION
  * Expected impact: Single state update instead of 6 separate setState calls

- [ ] Remove "isReviewing" lock pattern (lines 20, 32, 59, 67) - replace with lockId comparison
  * Problem: Boolean lock doesn't prevent race conditions with multiple in-flight requests
  * Solution: Generate unique lockId per question, ignore updates from old locks
  * Implementation: `const lockId = useRef(null)`, set new ID when starting review
  * Check in data receive: `if (lockId.current !== incomingLockId) return`
  * Expected impact: Prevent delayed poll responses from overwriting current question

- [ ] Extract ReviewMode business logic to `hooks/use-review-flow.ts` custom hook
  * Move all state management, data fetching, event handling to hook
  * Return stable object: `{ question, state, handlers: { onAnswer, onNext } }`
  * Wrap handlers in useCallback with proper dependencies
  * Keep ReviewMode as pure presentation component
  * Expected impact: Separate concerns, enable memoization of child components

### Fix: Component Hierarchy Inefficiencies
- [ ] Flatten ReviewMode + ReviewSession into single `ReviewFlow` component
  * Problem: Data passes through 3 layers with transformations at each level
  * Merge ReviewMode state machine + ReviewSession UI into one component
  * Direct Convex query without intermediate SimpleQuiz wrapper format
  * Remove quiz.questions array wrapper - work with single question directly
  * Expected impact: Eliminate prop drilling and intermediate state

- [ ] Create memoized `ReviewQuestionDisplay` pure component for question rendering
  * Extract question display UI from ReviewSession (lines 113-237)
  * Props: `{ question, selectedAnswer, showFeedback, onAnswerSelect }`
  * Wrap in React.memo with custom comparison function
  * Compare only question.id, selectedAnswer, showFeedback for re-render decision
  * Expected impact: Question UI won't re-render during parent state changes

- [ ] Memoize QuestionHistory component with React.memo
  * Wrap existing component: `export default React.memo(QuestionHistory)`
  * Add custom comparison: only re-render if interactions array length changes
  * Or use deep comparison on interactions array if content changes matter
  * Expected impact: Prevent history re-render during answer selection

### Fix: Event System Overhead
- [ ] Replace DOM events with direct prop passing for question context
  * Remove `window.dispatchEvent('current-question-changed')` from ReviewSession line 47
  * Pass question directly to GenerationModal via ReviewMode props
  * Use React Context if truly needed for deep prop drilling
  * Expected impact: Eliminate DOM event overhead and indirection

- [ ] Batch state updates in ReviewSession handleSubmit (line 57-90)
  * Problem: Multiple setState calls trigger multiple renders
  * Use unstable_batchedUpdates or React 18 automatic batching
  * Group: setShowFeedback + setAnswers + setNextReviewInfo in single update
  * Expected impact: Single render instead of 3 renders per answer submission

### Performance Measurement Baseline
- [ ] Create `scripts/measure-review-performance.js` automated performance test
  * Use Puppeteer to navigate to review page
  * Answer 10 questions while collecting Performance API data
  * Measure: Time to first question, time between questions, total renders
  * Output JSON report: `{ avgRenderMs: X, totalRenders: Y, p95RenderMs: Z }`
  * Run before and after each optimization to track impact
  * Expected baseline: >50 renders per question, >100ms between questions

- [ ] Add React Profiler API integration to ReviewMode
  * Wrap in `<Profiler id="ReviewMode" onRender={logProfileData}>`
  * Log: actualDuration, baseDuration, startTime, commitTime
  * Store last 100 renders in circular buffer for analysis
  * Export data via window.__REVIEW_PERF_DATA for automated testing
  * Expected data: Identify which renders exceed 16ms frame budget

- [ ] Document render flow in `docs/review-render-flow.md`
  * Diagram component hierarchy with data flow arrows
  * List all state variables and what triggers their updates
  * Map user actions to resulting state changes and renders
  * Include timing diagram of typical question answer flow
  * Expected outcome: Clear mental model for future optimization

## UI Testing & Validation

### Visual Testing
- [ ] Screenshot test all states in both light/dark modes without cards
- [ ] Measure Cumulative Layout Shift (CLS) score - should improve without centered layout
- [ ] Cross-browser test - Safari, Firefox, Chrome, Edge for layout consistency

### Interaction Testing
- [ ] Verify keyboard navigation still works through all options - Tab order must be logical
- [ ] Test with screen reader - ensure heading hierarchy makes sense without Card structure
- [ ] Load test with 50+ questions - ensure layout performs without card virtualization

## Technical Debt
- [ ] Add error boundary around review components for graceful degradation
- [ ] Fix test failures: React import issues in `review-flow.test.tsx` (15 tests failing)
- [ ] Update test expectations after "quiz" → "question" terminology refactoring

## Performance Metrics
- [ ] Record current Lighthouse scores before further optimizations
- [ ] Measure initial bundle size with Card components removed
- [ ] Document current FCP, LCP, TTI metrics for comparison
- [ ] Profile memory usage during long review sessions

## Accessibility
- [ ] Ensure all interactive elements have proper ARIA labels
- [ ] Verify color contrast ratios meet WCAG AA standards
- [ ] Add skip links for screen reader users
- [ ] Implement proper focus management between questions

## Completed Work Archive

<details>
<summary>✅ Completed Phases (Click to expand)</summary>

### PHASE 1: DELETE QUIZ CONCEPT ✅
- Removed all quiz-specific components
- Made homepage pure review mode
- Renamed all files from quiz to review/questions

### PHASE 2: Fix Generation Modal Context ✅
- Unified event system for question context
- Modal now receives context from single event

### PHASE 3: Pure FSRS Implementation ✅
- Questions enter review queue as "new" cards
- Continuous review with no session boundaries
- Removed progress bars and score tracking

### PHASE 4: Database Cleanup ✅
- Stopped writing to deprecated quizResults table
- Deleted quiz.ts file
- Marked legacy tables as deprecated

### PHASE 5: UI Text Updates ✅
- "Generate Quiz" → "Generate Questions"
- "Quiz Complete" → "No More Reviews"
- "Start Quiz" → "Review"
- "Quiz Score" → "Success Rate"

### PHASE 6: Card Component Removal ✅
- Unified layout with max-w-3xl
- Added responsive padding
- Fixed touch targets (44px minimum)
- Added focus-visible styles
- Fixed color contrast for WCAG AA
- Added subtle animations

</details>

---
*Last Updated: 2025-09-26*