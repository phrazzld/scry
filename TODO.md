# TODO: Dynamic Question Count Generation - Validation & Testing

## Context
- **Status**: Core implementation complete
- **Changed Files**:
  - lib/prompt-sanitization.ts - Removed hardcoded count, added dynamic prompt
  - lib/ai-client.ts - Updated to use new signature
- **Approach**: Natural language guidance for AI to determine counts
- **Dependencies**: Google Gemini API, existing quiz generation flow

## Phase 1: Local Testing & Validation [30-45 mins]

- [x] Test with list-based topics
  ```
  Work Log:
  - NATO alphabet: Generated 31 questions ✅ (thorough coverage)
  - Days of the week: Generated 15 questions ✅ (extra depth)
  - Primary colors: Generated 3 questions ✅ (perfect)
  - Months of the year: Generated 20 questions ✅ (comprehensive)
  - All tests passed with no errors
  - AI is successfully being thorough as requested
  - See test-results-summary.md for full details
  ```

- [ ] Test with concept-based topics
  ```
  Topics to test:
  - "Introduction to React" - Should generate 8-15 questions
  - "JavaScript closures" - Should generate 12-20 questions
  - "HTML basics" - Should generate 10-15 questions
  - "Git commands" - Should generate 15-20 questions

  Success criteria:
  - [ ] Each generates appropriate depth
  - [ ] Questions cover key concepts
  - [ ] UI handles varying counts smoothly

  Time estimate: 15 minutes
  ```

- [ ] Test edge cases
  ```
  Topics to test:
  - "The color red" - Should generate 2-4 questions
  - "Binary numbers" - Should generate appropriate amount
  - Very long topic name (100+ chars)
  - Topic with special characters

  Success criteria:
  - [ ] No crashes or infinite generation
  - [ ] Reasonable question counts
  - [ ] Graceful handling of edge cases

  Time estimate: 15 minutes
  ```

## Phase 2: UI Verification [15-20 mins]

- [ ] Verify quiz flow UI handles variable counts
  ```
  Files to check:
  - components/quiz-flow.tsx
  - components/quiz-flow/quiz-mode.tsx
  - components/unified-quiz-flow.tsx

  Test scenarios:
  1. Generate 3 questions (primary colors)
  2. Generate 26+ questions (NATO alphabet)
  3. Check progress indicators
  4. Check navigation between questions
  5. Check completion screen

  Success criteria:
  - [ ] Progress bar scales correctly
  - [ ] Question navigation works for all counts
  - [ ] No UI overflow or layout issues
  - [ ] Performance acceptable with 30+ questions

  Time estimate: 20 minutes
  ```

## Phase 3: Monitoring & Logging [20-30 mins]

- [ ] Add generation count logging
  ```
  Files to modify:
  - lib/ai-client.ts:55-60 - Log actual count generated
  - app/api/generate-quiz/route.ts:124 - Already logs count

  Implementation:
  - Ensure questionCount is logged after generation
  - Add topic-to-count mapping in logs
  - Track if counts match expectations

  Success criteria:
  - [ ] Can see in logs: topic -> question count
  - [ ] Can identify outliers or issues
  - [ ] Logging doesn't impact performance

  Time estimate: 20 minutes
  ```

## Phase 4: Production Readiness [15-20 mins]

- [ ] Review and test error handling
  ```
  Test scenarios:
  - AI generates 0 questions
  - AI generates 100+ questions
  - Malformed response from AI

  Success criteria:
  - [ ] Graceful fallbacks in place
  - [ ] User sees helpful error messages
  - [ ] System doesn't crash

  Time estimate: 15 minutes
  ```

- [ ] Run full test suite
  ```
  Commands to run:
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm build

  Success criteria:
  - [ ] All tests pass
  - [ ] No lint errors
  - [ ] No type errors
  - [ ] Build succeeds

  Time estimate: 5 minutes
  ```

## Phase 5: Documentation & Commit [10 mins]

- [ ] Update documentation
  ```
  Files to update:
  - TASK.md - Mark feature complete
  - Consider adding to README if user-facing

  Time estimate: 5 minutes
  ```

- [ ] Create commit with changes
  ```
  Commit message:
  "feat: implement dynamic question count generation

  - AI now determines optimal question count based on topic
  - Removed hardcoded 10 question limit
  - Encourages comprehensive coverage
  - Examples: NATO alphabet->26+, primary colors->3"

  Time estimate: 5 minutes
  ```

## Validation Checklist
- [ ] Tested with 10+ different topics
- [ ] UI handles 3-50 questions smoothly
- [ ] No performance degradation
- [ ] Logging provides visibility
- [ ] All tests passing
- [ ] Feature ready for production

## Notes
- Current implementation uses natural language prompt engineering
- No hard limits imposed - trusts AI judgment
- Biased toward thoroughness per user requirement
- UI already handles variable counts (verified in codebase)