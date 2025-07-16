# Spaced Repetition Engine Implementation TODO

Generated from TASK.md on 2025-01-16

## Critical Path Items (Must complete in order)

- [x] Install ts-fsrs dependency
  - Success criteria: `pnpm add ts-fsrs` completes successfully, package appears in package.json
  - Dependencies: None
  - Estimated complexity: SIMPLE
  - ✅ Completed: ts-fsrs@5.2.1 installed successfully

- [x] Extend questions table schema with FSRS fields
  - Success criteria: Schema compiles, includes all FSRS fields (nextReview, stability, fsrsDifficulty, etc.) with proper types and `by_user_next_review` index
  - Dependencies: ts-fsrs installed
  - Estimated complexity: MEDIUM
  - Files: `convex/schema.ts`
  - ✅ Completed: Added all FSRS fields as optional, added by_user_next_review index, schema compiles successfully

- [x] Create FSRS calculation utilities with automatic rating
  - Success criteria: Helper functions convert correctness to FSRS rating (correct=Good/Easy, incorrect=Again/Hard), handle DB format conversion
  - Dependencies: Schema extended
  - Estimated complexity: MEDIUM
  - Files: Create `convex/fsrs.ts`
  - ✅ Completed: Created utility functions for automatic rating, DB conversion, scheduling, and retrievability calculation

- [x] Implement scheduleReview mutation with automatic rating
  - Success criteria: Mutation calculates rating from isCorrect flag, updates FSRS state, records interaction
  - Dependencies: FSRS utilities created
  - Estimated complexity: COMPLEX
  - Files: `convex/questions.ts` or new `convex/spacedRepetition.ts`
  - ✅ Completed: Created spacedRepetition.ts with scheduleReview mutation, bonus getNextReview query and getDueCount query

- [x] Create getNextReview query
  - Success criteria: Returns single highest priority question based on FSRS retrievability, handles empty queue gracefully
  - Dependencies: scheduleReview mutation working
  - Estimated complexity: MEDIUM
  - Files: `convex/questions.ts` or `convex/spacedRepetition.ts`
  - ✅ Completed: Already implemented in spacedRepetition.ts with retrievability-based prioritization

- [ ] Unify quiz and review interfaces
  - Success criteria: Single component handles both quiz generation and reviews, shows history for reviews, maintains existing quiz functionality
  - Dependencies: Backend mutations and queries complete
  - Estimated complexity: COMPLEX
  - Files: Refactor `components/quiz-flow.tsx`

## Parallel Work Streams

### Stream A: Backend FSRS Integration
- [x] Update question creation to initialize FSRS fields
  - Success criteria: New questions created with state="new" and proper FSRS defaults
  - Can start: After schema extension
  - Files: `convex/quiz.ts` (saveQuizQuestions mutation)
  - ✅ Completed: Updated saveGeneratedQuestions in questions.ts to initialize all FSRS fields using initializeCard()

- [x] Modify recordInteraction to trigger FSRS scheduling
  - Success criteria: Interaction with isCorrect automatically triggers appropriate FSRS scheduling
  - Dependencies: scheduleReview mutation exists
  - Files: `convex/questions.ts`
  - ✅ Completed: Enhanced recordInteraction to include FSRS scheduling, returns nextReview time

- [x] Implement automatic rating calculation logic
  - Success criteria: Maps isCorrect to FSRS rating (e.g., correct→Good, incorrect→Again), considers time spent in future
  - Can start: After FSRS utilities created
  - Files: `convex/fsrs.ts`
  - ✅ Completed: Already implemented in fsrs.ts as calculateRatingFromCorrectness function

### Stream B: Frontend Components
- [x] Create historical attempts display component
  - Success criteria: Shows all attempts in scrollable list with date, correctness, time spent; handles many attempts gracefully
  - Can start: Immediately
  - Files: Create `components/question-history.tsx`
  - ✅ Completed: Created component with expand/collapse, success rate, loading/empty states

- [ ] Update answer submission flow for automatic scheduling
  - Success criteria: After answer submission, shows next review time without requiring user rating input
  - Can start: After UI unification started
  - Files: `components/quiz-flow.tsx`

- [ ] Implement empty state components
  - Success criteria: Shows appropriate messages for "no questions" and "all reviews complete" states
  - Can start: Immediately
  - Files: Create `components/empty-states.tsx`

### Stream C: Real-time Updates
- [ ] Add real-time review queue subscription
  - Success criteria: UI updates immediately when questions become due without page refresh
  - Dependencies: getNextReview query exists
  - Files: Update `components/quiz-flow.tsx` or new review component

- [ ] Display next review time after answering
  - Success criteria: Shows exact time until next review immediately after answer submission
  - Dependencies: scheduleReview returns next review time
  - Files: Answer feedback component

## Testing & Validation

- [ ] Test automatic rating calculation
  - Success criteria: Verify correct answers map to appropriate positive ratings, incorrect to negative ratings
  - Dependencies: Rating calculation logic complete
  - Create test scenarios for edge cases

- [ ] Test FSRS scheduling intervals
  - Success criteria: Verify scheduling intervals are appropriate for correct/incorrect answers
  - Dependencies: Backend complete

- [ ] Test review queue prioritization
  - Success criteria: Verify questions appear in correct order based on retrievability
  - Dependencies: getNextReview query complete

- [ ] E2E test complete review flow
  - Success criteria: Can create quiz, answer questions, see them in review queue, automatic scheduling works
  - Dependencies: All critical path items complete

- [ ] Performance test with 10,000 questions
  - Success criteria: Review queue generation completes in <100ms
  - Dependencies: Backend complete

- [ ] Mobile responsiveness testing
  - Success criteria: Review interface works smoothly on mobile devices, all interactions accessible
  - Dependencies: Frontend complete

## Documentation & Cleanup

- [ ] Document automatic rating approach
  - Success criteria: Clear explanation of how correctness maps to FSRS ratings
  - Files: `CLAUDE.md`, code comments

- [ ] Update CLAUDE.md with spaced repetition patterns
  - Success criteria: Document new mutations, queries, and component patterns
  - Files: `CLAUDE.md`

- [ ] Add spaced repetition section to README
  - Success criteria: Explain how the automatic review system works for users
  - Files: `README.md`

- [ ] Code review and refactoring pass
  - Success criteria: No TypeScript errors, follows existing patterns, no console.logs
  - Dependencies: All implementation complete

## Future Enhancements (BACKLOG.md candidates)

- [ ] Incorporate time spent into automatic rating calculation
- [ ] Add response confidence as factor in rating calculation
- [ ] Implement dynamic difficulty adjustment based on aggregate performance
- [ ] Personalized FSRS parameters based on user learning patterns
- [ ] Review statistics dashboard with retention metrics
- [ ] Batch review mode for multiple questions
- [ ] Review forecasting (show upcoming review load)
- [ ] Advanced analytics on automatic rating effectiveness
- [ ] A/B testing framework for rating calculation algorithms
- [ ] Machine learning model for optimal rating determination