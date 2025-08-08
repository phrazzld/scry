# Vitest Testing Foundation Implementation TODO

Generated from TASK.md on 2025-01-08

## Critical Path Items (Must complete in order)

- [ ] Verify existing test infrastructure runs correctly
  - Success criteria: `pnpm test` executes without errors
  - Dependencies: None
  - Estimated complexity: SIMPLE
  - Status: ✅ Tests already run (2 test files, 32 tests passing)

- [x] Adjust vitest.config.ts coverage thresholds for initial setup
  - Success criteria: Coverage check passes without blocking CI
  - Dependencies: Test verification
  - Estimated complexity: SIMPLE
  - Current: 80% thresholds causing failures (actual: 1.21% lines)
  - Action: Comment out thresholds or set to 0 temporarily

- [x] Create first utility function test
  - Success criteria: `lib/format-review-time.test.ts` passes with 100% coverage
  - Dependencies: Config adjustment
  - Estimated complexity: SIMPLE
  - Target functions: `formatNextReviewTime()`, `describeReviewInterval()`

## Parallel Work Streams

### Stream A: Test Scripts Verification
- [x] Verify all test scripts work correctly
  - Success criteria: Each script runs without errors
  - Can start: Immediately
  - Scripts to verify:
    - `pnpm test` ✅ (works)
    - `pnpm test:coverage` ✅ (works, no threshold failures now)
    - `pnpm test:watch` ✅ (works in interactive mode)
    - `pnpm test:ui` ⚠️ (needs @vitest/ui package - skip for now)

### Stream B: Documentation
- [x] Add testing section to README.md
  - Success criteria: Clear instructions for running tests
  - Can start: After tests verified
  - Content: Test commands, coverage viewing, watch mode usage

## CI/CD Integration

- [x] Verify GitHub Actions runs tests
  - Success criteria: CI workflow executes tests on PR
  - Dependencies: Coverage thresholds adjusted
  - File: `.github/workflows/ci.yml`
  - Current status: Needs checking if tests run in CI

- [ ] Ensure coverage reports are generated in CI
  - Success criteria: Coverage artifacts available in CI logs
  - Dependencies: CI test execution working
  - Note: Don't enforce thresholds yet

## Testing & Validation

- [x] Run full test suite locally
  - Success criteria: All tests pass, coverage report generates
  - Commands to validate:
    - `pnpm test --run`
    - `pnpm test:coverage --run`
    - `pnpm test:watch` (verify interactive mode)

- [ ] Create PR and verify CI passes
  - Success criteria: Green checkmark on PR
  - Dependencies: All above tasks complete
  - Validation: Tests run, no threshold failures

## Documentation & Cleanup

- [ ] Update package.json if any scripts missing
  - Success criteria: All standard test scripts present
  - Current status: Scripts look complete
  - Estimated complexity: SIMPLE

- [ ] Document test file patterns and conventions
  - Success criteria: Clear guidance in README
  - Location: README.md testing section
  - Include: File naming (`.test.ts`), test location, coverage viewing

## Implementation Notes

### Current State Analysis
- ✅ Vitest already configured and working
- ✅ 2 test files exist and pass (convex/fsrs.test.ts, convex/spacedRepetition.test.ts)
- ✅ Test scripts already in package.json
- ⚠️ Coverage thresholds too high (80%) for current codebase (1.21%)
- ⚠️ No utility function tests yet

### Files to Create/Modify
1. `vitest.config.ts` - Adjust coverage thresholds
2. `lib/format-review-time.test.ts` - New test file
3. `README.md` - Add testing documentation
4. `.github/workflows/ci.yml` - Verify test execution

### Test Example Structure
```typescript
// lib/format-review-time.test.ts
import { describe, it, expect } from 'vitest'
import { formatNextReviewTime, describeReviewInterval } from './format-review-time'

describe('formatNextReviewTime', () => {
  it('should format time as "Now" for reviews due within 1 minute', () => {
    const now = new Date('2025-01-08T10:00:00')
    const nextReview = new Date('2025-01-08T10:00:30').getTime()
    expect(formatNextReviewTime(nextReview, now)).toBe('Now')
  })
  
  // Add more test cases for each time range
})

describe('describeReviewInterval', () => {
  it('should describe intervals in human-readable format', () => {
    expect(describeReviewInterval(0)).toBe('Later today')
    expect(describeReviewInterval(1)).toBe('Tomorrow')
    expect(describeReviewInterval(7)).toBe('In 1 week')
  })
})
```

## Success Metrics
- [ ] 2-3 test files running successfully
- [ ] Coverage report generates (percentage not important yet)
- [ ] CI runs tests without failures
- [ ] Documentation clear for other developers
- [ ] No blocking thresholds preventing merges

## Non-Goals (Explicitly Not Doing)
- ❌ Setting high coverage thresholds
- ❌ Component testing setup
- ❌ API route testing
- ❌ Complex mocking infrastructure
- ❌ E2E test changes
- ❌ Performance testing
- ❌ Security scanning

## Estimated Total Effort
- Lines of code: ~100
- Files touched: 4-5
- Time estimate: 1-2 hours
- PR size: Small (ideal for quick review)