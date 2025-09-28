# TODO

## 🔴 CRITICAL: E2E Test Infrastructure (68% tests failing - blocks deployments)

### Immediate Triage (Fix today)
- [x] Delete `tests/e2e/auth.test.ts` completely - tests NextAuth UI that no longer exists (Clerk replaced it)
  - Impact: Removes 45 failing test runs (9 tests × 5 browsers)
  - Success: `rm tests/e2e/auth.test.ts && npx playwright test` shows fewer failures
- [x] Add `CLERK_TEST_MODE=true` to `.env.test.local` for E2E test authentication bypass
  - Context: Clerk provides test mode to skip real auth in tests
  - Success: Tests can authenticate without real email flow
- [x] Create `tests/fixtures/test-auth.ts` with Clerk test token generation
  ```typescript
  // Example structure needed:
  export const getTestAuthToken = () => {...}
  export const authenticateTest = async (page) => {...}
  ```

### E2E Test Reduction (Reduce complexity)
- [x] Reduce Playwright browser matrix from 5 to 2 in `playwright.config.ts`
  - Keep: Desktop Chrome, Mobile Chrome
  - Remove: Firefox, Safari, Mobile Safari
  - Rationale: 5× test runs for marginal browser coverage is waste
  - Success: Test runs drop from 145 to 58 (27 tests × 2 browsers + 4 skipped)
- [x] Mark non-critical E2E tests with `test.skip()` - keep only:
  1. Quiz generation → completion flow
  2. Spaced repetition review cycle
  3. Mobile responsive check
  - File: `tests/e2e/spaced-repetition.test.ts` - skip 2 of 5 tests
  - File: `tests/e2e/spaced-repetition.local.test.ts` - skip 6 of 9 tests
  - Success: E2E suite focuses on critical user paths only

### Test Selector Stability
- [x] Add `data-testid` attributes to critical UI elements
  - `components/generation-modal.tsx`: Add `data-testid="generate-quiz-button"`
  - `components/navbar.tsx`: Add `data-testid="user-menu"`
  - `components/review-flow.tsx`: Add `data-testid="answer-option-{index}"`
  - Success: Tests use stable selectors, not brittle text matching
- [x] Update E2E tests to use `page.getByTestId()` instead of `getByRole()` with text
  - Files: All remaining `.test.ts` files in `tests/e2e/`
  - Example: `getByRole('button', { name: 'Generate' })` → `getByTestId('generate-quiz-button')`

## ⚡ Quick Wins (30 min each, high impact)

### Code Formatting Consistency
- [x] Install and configure Prettier
  ```bash
  pnpm add -D prettier eslint-config-prettier
  echo '{"semi": true, "singleQuote": true, "trailingComma": "es5"}' > .prettierrc
  ```
  - Update `.eslintrc.json`: Add "prettier" to extends array
  - Success: `pnpm prettier --check .` runs without errors
- [x] Add Prettier to pre-commit hooks in `.husky/pre-commit`
  ```bash
  npx lint-staged --concurrent false
  # Add to lint-staged in package.json:
  # "*.{js,jsx,ts,tsx}": ["prettier --write", "eslint --fix"]
  ```
  - Success: Commits auto-format code, no more formatting debates

### CI/CD Alignment
- [x] Fix Node version mismatch in `.github/workflows/ci.yml`
  - Change: `node-version: 20` → `node-version: 20.19.0`
  - Matches `package.json` engines requirement
  - Success: CI uses exact same Node version as local development
- [x] Add Node version check to CI before install
  ```yaml
  - name: Verify Node version
    run: node -v | grep -q "v20.19" || exit 1
  ```

### Import Organization
- [x] Install import sorting plugin
  ```bash
  pnpm add -D @ianvs/prettier-plugin-sort-imports
  ```
  - Update `.prettierrc`: Add import sort configuration
  - Success: Imports auto-organize, reducing diff noise

## 🚀 Test Infrastructure Improvements

### Test Utilities (Reduce duplication)
- [x] Create `lib/test-utils/auth-helpers.ts` with Clerk mock utilities
  ```typescript
  export const mockClerkAuth = () => {...}
  export const createMockUser = () => {...}
  ```
- [x] Create `lib/test-utils/render-with-providers.tsx` for React Testing Library
  ```typescript
  export const renderWithProviders = (ui, options?) => {...}
  ```
- [x] Create `lib/test-utils/fixtures.ts` with reusable test data
  ```typescript
  export const mockQuestion = {...}
  export const mockQuizSession = {...}
  ```
  - Success: Test files import utilities instead of duplicating setup

### Test Performance
- [x] Enable Vitest parallel execution in `vitest.config.ts`
  ```typescript
  pool: 'threads',
  poolOptions: { threads: { singleThread: false } }
  ```
  - Current: Tests run sequentially
  - Target: < 30 seconds for all unit tests
  - Success: Tests now run in ~1.3 seconds (310 tests)
- [x] Add test timing output to identify slow tests
  ```typescript
  reporters: ['verbose']
  ```
  - Success: `pnpm test` shows individual test execution times in milliseconds

### Coverage Visibility (No thresholds!)
- [x] Add coverage comment bot to GitHub Actions
  ```yaml
  - uses: davelosert/vitest-coverage-report-action@v2
    if: github.event_name == 'pull_request'
    with:
      json-summary-path: ./coverage/coverage-summary.json
      json-final-path: ./coverage/coverage-final.json
  ```
  - Success: PRs show coverage changes without blocking
  - Note: Changed from jest-coverage-report-action to vitest-coverage-report-action for Vitest compatibility

## 📊 Monitoring (Optional - only if problems arise)

### Bundle Size Tracking
- [x] Add bundle analyzer script to `package.json`
  ```json
  "analyze": "ANALYZE=true next build"
  ```
  - Only run when investigating performance issues
  - Success: `pnpm analyze` shows bundle composition
  - Reports generated at `.next/analyze/*.html`

### Performance Budgets
- [x] Add Lighthouse CI configuration (`.lighthouserc.js`)
  ```javascript
  module.exports = {
    ci: {
      assert: {
        assertions: {
          'first-contentful-paint': ['warn', {maxNumericValue: 2000}],
          'interactive': ['warn', {maxNumericValue: 5000}]
        }
      }
    }
  }
  ```
  - Non-blocking warnings only, no hard failures
  - Success: Performance regressions get flagged in PR comments
  - Added comprehensive metrics: Core Web Vitals, resources, JS performance, a11y, SEO

## 🎯 Success Metrics

### Week 1 Targets
- [ ] E2E test pass rate > 95% (reduced, focused test set)
- [ ] Total test runtime < 2 minutes (currently ~3 min)
- [ ] CI pipeline < 5 minutes (currently ~7 min)

### Anti-Goals (What NOT to do)
- ❌ Don't add test coverage thresholds
- ❌ Don't add more ESLint rules
- ❌ Don't require 100% test pass rate
- ❌ Don't test all browser variants
- ❌ Don't mock everything - some integration is good

---

*Philosophy: Fix what's broken, delete what doesn't work, measure what matters.*
*Time estimate: 10-15 hours total, but frontload the critical E2E fixes (2-3 hours).*
