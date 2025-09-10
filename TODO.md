# Pure FSRS with Fresh Question Priority - Implementation TODO

Generated from TASK.md on 2025-01-09
Updated with Code Review Feedback on 2025-01-10

## Critical Path Items (Must complete in order)

### Core Queue Priority System
- [x] Implement FSRS-based retrievability scoring in spacedRepetition.ts
  - Success criteria: New questions return -2 (ultra-fresh) or -1 (new), reviewed questions return 0-1
  - Dependencies: None
  - Estimated complexity: MEDIUM
  - Files: convex/spacedRepetition.ts

- [x] Update getNextReview to prioritize by retrievability score
  - Success criteria: Fresh questions appear before reviews, no daily limits enforced
  - Dependencies: Retrievability scoring
  - Estimated complexity: MEDIUM
  - Files: convex/spacedRepetition.ts

- [x] Remove any daily limit logic from getDueCount
  - Success criteria: Returns actual count without limits, shows real learning debt
  - Dependencies: None
  - Estimated complexity: SIMPLE
  - Files: convex/spacedRepetition.ts

## Parallel Work Streams

### Stream A: Toast & Feedback Enhancements
- [x] Enhance success toast to show count and topic
  - Success criteria: Toast displays "✓ X questions generated" with topic description
  - Can start: Immediately
  - Estimated complexity: SIMPLE
  - Files: components/generation-modal.tsx:112

- [x] Add event dispatch on successful generation
  - Success criteria: 'questions-generated' event fired with count and topic
  - Can start: Immediately
  - Estimated complexity: SIMPLE
  - Files: components/generation-modal.tsx

### Stream B: Real-Time Updates
- [x] Implement dynamic polling intervals in review-flow.tsx
  - Success criteria: 1-second polling for 5 seconds after generation, then back to 30 seconds
  - Can start: Immediately
  - Estimated complexity: MEDIUM
  - Files: components/review-flow.tsx

- [x] Add event listener for generation events in review flow
  - Success criteria: Review flow responds to 'questions-generated' events
  - Dependencies: Event dispatch implementation
  - Estimated complexity: SIMPLE
  - Files: components/review-flow.tsx

- [x] Update usePollingQuery hook to support dynamic intervals
  - Success criteria: Polling interval can be changed dynamically
  - Can start: Immediately
  - Estimated complexity: MEDIUM
  - Files: hooks/use-polling-query.ts

### Stream C: Visual Indicators
- [x] Add "New" badge component for fresh questions
  - Success criteria: Badge shows for questions < 1 hour old
  - Can start: Immediately
  - Estimated complexity: SIMPLE
  - Files: components/review-flow.tsx, components/ui/badge.tsx

- [x] Update progress display to show honest totals
  - Success criteria: Shows real total due without limits, warning message for 100+ items
  - Can start: Immediately
  - Estimated complexity: SIMPLE
  - Files: components/review-flow.tsx:342-347

- [x] Add review button pulse animation after generation
  - Success criteria: Review button briefly pulses when new questions added
  - Dependencies: Event dispatch implementation
  - Estimated complexity: SIMPLE
  - Files: components/minimal-header.tsx

## Phase 2: Smart Scheduling (COMPLETE)

### Advanced Queue Management
- [x] Implement freshness decay algorithm
  - Success criteria: Exponential decay over 24 hours affects priority
  - Dependencies: Core queue priority system
  - Estimated complexity: MEDIUM
  - Files: convex/spacedRepetition.ts

- [x] ~~Add intelligent interleaving~~ REMOVED - Violates Pure FSRS
  - **Removed**: This was a comfort feature that corrupts the algorithm
  - FSRS already determines optimal order; artificial interleaving breaks memory science

- [x] Create progress bar segments for new vs due
  - Success criteria: Visual distinction between new and review items
  - Dependencies: Visual indicators
  - Estimated complexity: MEDIUM
  - Files: components/review-flow.tsx

## Testing & Validation

### Unit Tests
- [x] Test retrievability scoring function
  - Success criteria: Correct scores for new/fresh/reviewed questions
  - Dependencies: Core queue priority system
  - Estimated complexity: SIMPLE

- [x] Test freshness decay calculation
  - Success criteria: Exponential decay verified over 24-hour window
  - Dependencies: Freshness decay implementation
  - Estimated complexity: SIMPLE

- [x] ~~Test interleaving algorithm~~ REMOVED
  - **Removed**: No interleaving to test since we removed the feature

### Integration Tests
- [x] Test generation → queue update → UI flow
  - Success criteria: Generated questions appear in review within 2 seconds
  - Dependencies: All Stream A, B, C items
  - Estimated complexity: MEDIUM

- [x] Test polling interval changes
  - Success criteria: Aggressive polling activates and deactivates correctly
  - Dependencies: Dynamic polling implementation
  - Estimated complexity: SIMPLE

### End-to-End Tests
- [x] Complete generation and immediate review flow
  - Success criteria: User can generate and immediately review new questions
  - Dependencies: All Phase 1 items
  - Estimated complexity: MEDIUM

- [x] Verify no daily limits enforcement
  - Success criteria: 100+ due items all appear in queue
  - Dependencies: Core queue priority system
  - Estimated complexity: SIMPLE

## Documentation & Cleanup

- [x] Document FSRS priority algorithm in code comments
  - Success criteria: Clear explanation of retrievability scoring
  - Dependencies: Core implementation complete
  - Estimated complexity: SIMPLE

- [x] Update CLAUDE.md with new queue behavior
  - Success criteria: Spaced repetition section reflects pure FSRS approach
  - Dependencies: Implementation complete
  - Estimated complexity: SIMPLE

- [x] Add JSDoc comments to new/modified functions
  - Success criteria: All public functions documented
  - Dependencies: Implementation complete
  - Estimated complexity: SIMPLE

## Performance Optimization

- [ ] Profile polling overhead
  - Success criteria: < 1% CPU usage confirmed
  - Dependencies: Dynamic polling implementation
  - Estimated complexity: SIMPLE

- [ ] Optimize queue generation for 1000+ questions
  - Success criteria: Queue generates in < 100ms for 1000 questions
  - Dependencies: Core queue priority system
  - Estimated complexity: MEDIUM

## Future Enhancements (BACKLOG.md candidates)

- [ ] Machine learning for optimal new/review ratios
- [ ] Topic fatigue detection algorithm
- [ ] Predictive queue generation based on user patterns
- [ ] Performance-based interleaving adjustments
- [ ] WebSocket implementation for real-time updates
- [ ] Redis queue for 10k+ question scaling
- [ ] User-specific learning velocity tracking
- [ ] Adaptive freshness windows per user

## PR #16 Review Feedback Actions (UPDATED)

### Convex Real-Time Discovery
After investigation, we discovered that Convex ALREADY provides WebSocket-based real-time updates automatically!
- Removed unnecessary custom event system and aggressive polling
- Kept minimal polling (60s) only for time-based conditions (questions becoming due)
- New questions now appear instantly via Convex reactivity (truly < 1 second)

### Test Coverage Gaps (COMPLETED)
- [x] ~~Add comprehensive tests for calculateFreshnessDecay() function~~ DONE
  - Completed in convex/spacedRepetition.test.ts lines 583-650
  - Tests cover: 0 hours → 1.0, 24 hours → ~0.37, 48 hours → ~0.14, edge cases

- [x] ~~Add tests for fresh question priority range validation~~ DONE
  - Completed in convex/spacedRepetition.test.ts lines 742-797
  - Tests verify -2 to -1 priority range based on freshness

### Code Hardening (COMPLETED)
- [x] ~~Add input validation to calculateFreshnessDecay()~~ DONE
  - Now returns 1.0 for negative hours (graceful clock skew handling)
  - Implemented in convex/spacedRepetition.ts:53-56

- [x] ~~Namespace custom events for better isolation~~ N/A
  - Custom events were completely removed in favor of Convex's built-in reactivity
  - No events to namespace anymore

## Risk Mitigation

- [x] ~~Add fallback for event system failures~~ N/A
  - Event system removed; Convex handles real-time updates automatically

- [x] ~~Handle edge case of 0 questions in queue~~ DONE
  - Division by zero fixed in progress bar (components/review-flow.tsx:377-378)
  - Empty state handling implemented

- [x] ~~Prevent infinite polling loops~~ DONE
  - Removed aggressive polling; only minimal 60s polling for time-based updates

## Success Verification Checklist

- [ ] Generated questions appear within 2 seconds
- [ ] Toast shows count and topic
- [ ] "New" badges display correctly
- [ ] No artificial limits on review count
- [ ] Progress bar shows real totals
- [ ] Fresh questions prioritize correctly
- [ ] No mid-question interruptions
- [ ] Polling overhead < 1% CPU
- [ ] All tests passing
- [ ] Documentation updated

## Notes

- Prioritize Phase 1 items for immediate user value
- Stream A, B, C can be developed in parallel by different developers
- Phase 2 builds on Phase 1 but isn't blocking initial release
- Performance optimization can happen after functional implementation
- Risk mitigation should be addressed during implementation, not after

## Code Review Feedback - Remaining Items

### HIGH PRIORITY (COMPLETED)

- [x] **Optimize getDueCount query for scalability** DONE
  - Changed from `.collect()` to `.take(1000)` to prevent memory issues
  - Now caps at counting 1000 items (reasonable limit for UI display)
  - Prevents O(N) memory usage for users with massive collections

### MEDIUM PRIORITY (Can be follow-up PRs)

- [ ] **Fix "New" badge to use server time**
  - Location: `components/review-flow.tsx:455`
  - Issue: Badge logic compares server timestamp to client's `Date.now()`
  - Impact: Users with incorrect system clocks see wrong behavior
  - Fix: Have `getNextReview` return server's current time, use that for comparison
  - Estimated complexity: SIMPLE

- [ ] **Update E2E test for real-time validation**
  - Location: `tests/e2e/spaced-repetition.local.test.ts:204-260`
  - Issue: Test uses `await reviewPage.reload()` which bypasses WebSocket validation
  - Impact: Critical failures in Convex reactivity layer would go undetected
  - Fix: Remove `reload()`, use Playwright's auto-waiting assertions
  - Estimated complexity: SIMPLE

### COMPLETED (Fixed in recent commits)

- [x] ~~Handle clock skew gracefully~~ - Fixed: Returns 1.0 for negative hours
- [x] ~~Remove broken E2E test~~ - Fixed: Deleted obsolete dynamic polling test
- [x] ~~Fix division by zero in progress bar~~ - Fixed: Added guard clause for total === 0
- [x] ~~Update tests for graceful error handling~~ - Fixed: Tests now expect 1.0 for negative input