# Pure FSRS with Fresh Question Priority - Implementation TODO

Generated from TASK.md on 2025-01-09

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

### Test Coverage Gaps (HIGH PRIORITY)
- [ ] Add comprehensive tests for calculateFreshnessDecay() function
  - Success criteria: Test returns 1.0 at 0 hours, ~0.37 at 24 hours, ~0.14 at 48 hours
  - File: convex/spacedRepetition.test.ts
  - Implementation:
    ```typescript
    describe('calculateFreshnessDecay', () => {
      it('should return 1.0 for newly created questions', () => {
        expect(calculateFreshnessDecay(0)).toBe(1.0);
      });
      it('should decay to ~0.37 after 24 hours', () => {
        expect(calculateFreshnessDecay(24)).toBeCloseTo(0.37, 2);
      });
      it('should handle negative input gracefully', () => {
        expect(calculateFreshnessDecay(-1)).toBeGreaterThan(1.0);
      });
    });
    ```
  - Estimated complexity: SIMPLE

- [ ] Add tests for fresh question priority range validation
  - Success criteria: Verify questions get -2 to -1 priority based on age
  - File: convex/spacedRepetition.test.ts
  - Test cases: 0 hours → -2, 12 hours → ~-1.7, 24 hours → ~-1.37, 72+ hours → ~-1
  - Estimated complexity: SIMPLE

### Code Hardening (LOW PRIORITY)
- [ ] Add input validation to calculateFreshnessDecay()
  - Success criteria: Handle negative hours gracefully (return Math.exp(hoursSinceCreation / 24) for negative values)
  - File: convex/spacedRepetition.ts:52
  - Implementation: Add guard clause `if (hoursSinceCreation < 0) return Math.exp(hoursSinceCreation / 24);`
  - Estimated complexity: SIMPLE

- [ ] Namespace custom events for better isolation
  - Success criteria: Change 'questions-generated' to 'scry:questions-generated'
  - Files: 
    - components/generation-modal.tsx:144
    - components/review-flow.tsx:96
    - components/minimal-header.tsx:45
  - Prevents potential conflicts with other scripts
  - Estimated complexity: SIMPLE

## Risk Mitigation

- [ ] Add fallback for event system failures
  - Success criteria: Polling still works if events fail
  - Dependencies: Event system implementation
  - Estimated complexity: SIMPLE

- [ ] Handle edge case of 0 questions in queue
  - Success criteria: Graceful empty state handling
  - Dependencies: Core queue system
  - Estimated complexity: SIMPLE

- [ ] Prevent infinite polling loops
  - Success criteria: Max polling attempts before fallback to default interval
  - Dependencies: Dynamic polling
  - Estimated complexity: SIMPLE

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