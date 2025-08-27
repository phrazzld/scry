
# Task: Set Up Basic Vitest Testing Foundation

## Scope (Single PR)
Establish minimal Vitest configuration with 2-3 example tests to prove the testing infrastructure works.

## Deliverables
- [ ] Verify Vitest configuration works with existing `vitest.config.ts`
- [ ] Add one utility function test (e.g., `lib/format-review-time.test.ts`)
- [ ] Add one Convex function test (e.g., `convex/fsrs.test.ts` already exists - verify it runs)
- [ ] Ensure `pnpm test` executes successfully
- [ ] Add `pnpm test:watch` script for development
- [ ] Verify coverage reporting generates (don't enforce thresholds yet)

## Success Criteria
- CI runs tests successfully on PR
- Coverage report visible (even if low)
- No failing tests
- Documentation updated with test commands

## Files to Change
- `package.json` - Add test scripts if missing
- `lib/format-review-time.test.ts` - New simple test file
- `README.md` - Add testing section
- `.github/workflows/ci.yml` - Ensure tests run (may already be configured)

## Non-Goals (Future PRs)
- Setting coverage thresholds
- Component testing setup
- Security scanning
- Pre-commit hooks
- Comprehensive test suite

## Size
~50-100 lines of code, 4-5 files touched
