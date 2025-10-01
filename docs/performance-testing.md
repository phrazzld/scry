# Performance Testing Guide

## React DevTools Profiler Testing

### Objective
Verify that the removal of Card components from quiz flow states doesn't trigger unnecessary re-renders or performance regressions.

### Prerequisites
1. Install React Developer Tools browser extension
2. Run development server: `pnpm dev`
3. Open Chrome/Firefox DevTools → React Profiler tab

### Test Scenarios

#### Scenario 1: Quiz State Transitions
Test that state transitions don't cause parent component re-renders.

**Steps:**
1. Navigate to `/quiz-mode` or `/review-mode`
2. Start React Profiler recording
3. Transition through states:
   - Ready → Generating (start quiz)
   - Generating → Active (questions loaded)
   - Active → Complete (finish quiz)
4. Stop recording

**Expected Results:**
- QuizSessionManager should only render on state changes
- Child components should not re-render unless their props change
- No cascading re-renders from parent to unaffected siblings

#### Scenario 2: Question Navigation
Test that answering questions doesn't re-render unrelated UI.

**Steps:**
1. Start a quiz with 5+ questions
2. Begin profiler recording
3. Answer questions rapidly (click through 3-4 questions)
4. Stop recording

**Expected Results:**
- Only the active question component should re-render
- Progress bar updates shouldn't trigger full component tree re-render
- Previous question components should remain unchanged

#### Scenario 3: Component Mount Performance
Compare mounting performance before/after Card removal.

**Steps:**
1. Clear browser cache
2. Start profiler recording
3. Navigate directly to `/quiz-mode`
4. Wait for initial render
5. Stop recording

**Expected Results:**
- Initial mount time should be ≤ previous Card-based implementation
- Fewer DOM nodes created (check Elements tab)
- Reduced component tree depth

### Key Metrics to Measure

#### Render Frequency
- **Target:** Components render only when necessary
- **Anti-pattern:** Components rendering on every parent update
- **Tool:** Profiler "Highlight updates" setting

#### Render Duration
- **Target:** < 16ms for smooth 60fps
- **Warning:** > 50ms indicates potential lag
- **Critical:** > 100ms causes noticeable jank

#### Component Tree Depth
- **Before Card Removal:** ~8-10 levels deep
- **After Card Removal:** ~5-7 levels deep
- **Impact:** Shallower trees = faster reconciliation

### Performance Benchmarks

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Initial Mount | < 100ms | TBD | ⏳ |
| State Transition | < 50ms | TBD | ⏳ |
| Question Navigation | < 30ms | TBD | ⏳ |
| Memory Usage | < 50MB | TBD | ⏳ |

### Common Performance Issues

#### 1. Inline Function Props
**Problem:** Creating new functions in render causes child re-renders
```tsx
// ❌ Bad
<Button onClick={() => handleClick(id)} />

// ✅ Good
const handleClick = useCallback((id) => {...}, [deps])
<Button onClick={handleClick} />
```

#### 2. Unstable Object/Array Props
**Problem:** Creating new objects/arrays in render
```tsx
// ❌ Bad
<Component style={{ margin: 10 }} />

// ✅ Good
const styles = useMemo(() => ({ margin: 10 }), [])
<Component style={styles} />
```

#### 3. Missing React.memo
**Problem:** Pure components re-rendering unnecessarily
```tsx
// ✅ Wrap pure components
export default React.memo(QuizOption)
```

### Verification Checklist

- [ ] No unnecessary re-renders during state transitions
- [ ] Render durations consistently under 16ms
- [ ] Memory usage stable (no leaks) during long sessions
- [ ] Component tree depth reduced compared to Card version
- [ ] No performance warnings in React DevTools
- [ ] Smooth animations without jank (60fps maintained)

### Recording Performance Profile

1. Open React DevTools Profiler
2. Click "Start Profiling" (record button)
3. Perform user interactions
4. Click "Stop Profiling"
5. Analyze flame graph and ranked chart
6. Look for:
   - Gray components (didn't render) = good
   - Yellow/Orange components (slow renders) = investigate
   - Frequent renders of same component = potential issue

### Reporting Results

After testing, update this document with actual measurements:

```markdown
## Test Results - [DATE]

### Environment
- Browser: Chrome 120.0.6099.129
- React: 19.0.0
- Device: MacBook Pro M2

### Measurements
- Initial Mount: 85ms ✅
- State Transition: 42ms ✅
- Question Navigation: 28ms ✅
- Memory Usage: 45MB ✅

### Notes
- No unnecessary re-renders detected
- Card removal reduced component depth by 3 levels
- 15% improvement in initial mount time
```

---

*Last Updated: 2025-09-24*