# Pre-Merge TODO for ui-ux-quality-improvements Branch

**Branch**: ui-ux-quality-improvements  
**PR**: #5  
**Last Updated**: 2025-09-06

## 🚨 CRITICAL: Fix Failing Tests (42 failures blocking merge)

### High Priority Test Fixes

#### [CODE FIX] API Route Tests - 16 failures in `app/api/generate-quiz/route.test.ts`
- **Issue**: ConvexHttpClient instantiated at module level prevents mocking
- **Root Cause**: Module-level instantiation in route.ts line 13 happens before mocks
- **Failures**: All tests except "should only export POST method"
- **Fix Options**:
  1. Refactor route.ts to lazy-load ConvexHttpClient
  2. Use dependency injection pattern
  3. Mock at a different level (e.g., network layer)
- **Verification**: All 17 tests should pass

#### [CODE FIX] Question Mutations Hook - 7 failures in `hooks/use-question-mutations.test.ts`
- **Failures**:
  - `optimisticEdit` tests not calling mutations
  - `optimisticDelete` tests not marking items as deleted
  - Toast error messages not matching expected
- **Root Cause**: Incorrect mock setup or missing React context
- **Fix**: Review mock implementation and ensure proper hook testing setup
- **Verification**: All 8 tests should pass

#### [CODE FIX] Polling Query Hook - 2 timeouts in `hooks/use-polling-query.test.ts`
- **Failures**:
  - "should update timestamp at specified interval" - 10s timeout
  - "should resume polling when document becomes visible" - 10s timeout
- **Root Cause**: Tests waiting for intervals that never fire
- **Fix**: Use fake timers or mock setInterval properly
- **Verification**: All 8 tests should pass without timeouts

### Medium Priority Test Fixes

#### [CODE FIX] Component Tests - Review Flow, Auth Modal, Generation Modal
- **Status**: Tests created but many are failing
- **Issues**: Complex mocking requirements, DOM rendering
- **Files**:
  - `components/review-flow.test.tsx`
  - `components/auth/auth-modal.test.tsx`
  - `components/generation-modal.test.tsx`
- **Fix**: Ensure proper mock setup for Convex, Next.js router, and other dependencies

### Test Infrastructure Issues

#### [TEST INFRA] Coverage Threshold Not Met
- **Current**: ~4% coverage
- **Required**: 60% (enforced in CI)
- **Blocker**: This will fail CI even after fixing individual tests
- **Options**:
  1. Lower threshold temporarily to 5% and increase gradually
  2. Add more tests to reach 60%
  3. Focus on high-value unit tests for business logic

## ✅ COMPLETED: CI/CD Infrastructure

### Phase 1: CI Configuration ✅
- [x] Fixed duplicate test arguments in CI workflow
- [x] Created dedicated `test:ci` script with 60% coverage
- [x] Removed manual Vercel deployment from CI
- [x] Simplified CI workflow to 44 lines (from 512)

### Phase 2: Workflow Simplification ✅
- [x] Deleted redundant security workflows
- [x] Parallelized quality checks (lint, tsc, audit)
- [x] Added 5-minute timeout to prevent hanging
- [x] Simplified pre-push hook to just build

## 📋 Pre-Merge Checklist

- [ ] All tests passing (currently 42 failures)
- [ ] Coverage threshold met (currently 4%, need 60%)
- [ ] CI fully green
- [ ] No merge conflicts with main branch
- [ ] PR description updated with all changes
- [ ] Breaking changes documented (if any)
- [ ] Manual testing completed for critical flows

## 🎯 Merge Strategy

Once tests are fixed:
1. Rebase on latest main to avoid conflicts
2. Squash commits if needed for cleaner history
3. Ensure all CI checks pass
4. Request code review if required
5. Merge using GitHub PR interface

## 📊 Progress Tracking

### Test Status
- **Total Tests**: 254
- **Passing**: 212 ✅
- **Failing**: 42 ❌
- **Success Rate**: 83.5%

### Files Needing Fixes
1. `app/api/generate-quiz/route.test.ts` - 16 failures
2. `hooks/use-question-mutations.test.ts` - 7 failures  
3. `hooks/use-polling-query.test.ts` - 2 failures
4. Component tests - ~17 failures

### Coverage Gap
- **Current**: 4%
- **Target**: 60%
- **Gap**: 56%

## 🔧 Quick Commands

```bash
# Run tests locally
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run CI-equivalent tests
pnpm test:ci

# Run specific test file
pnpm test app/api/generate-quiz/route.test.ts

# Check which tests are failing
pnpm test --reporter=verbose
```

## 📝 Notes

- CI infrastructure is now working correctly
- Test failures are legitimate code issues, not CI problems
- Focus on fixing high-impact test failures first
- Consider temporarily lowering coverage threshold to unblock merge
- Component tests may need significant rework due to complex mocking

---

*Branch started: 2025-08-27*  
*Target merge: ASAP after test fixes*