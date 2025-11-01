# TODO: Quality Gates Improvements

**Context**: Comprehensive quality infrastructure audit revealed critical gaps in developer experience, coverage visibility, and infrastructure quality gates. These tasks improve deployment safety, reduce CI/CD time, and increase confidence in code changes.

**Philosophy**: Platform engineering mindset - ask "is this gate preventing real problems or creating bureaucracy?" Each improvement here has demonstrated value.

---

## Phase 1: Critical Fixes (Do First)

- [x] ### Fix build command to include Convex deployment

**File**: `package.json:13`

**Problem**: Build script is just `next build`, missing Convex backend deployment. CLAUDE.md explicitly requires "npx convex deploy && next build". Local builds work but CI/production could fail if Convex state is stale.

**Change**:
```json
- "build": "next build",
+ "build": "npx convex deploy && next build",
```

**Why**: Ensures Convex functions are deployed before Next.js build attempts to import them. Prevents runtime "function not found" errors in production.

**Success**: Running `pnpm build` deploys Convex functions first, then builds Next.js. Convex deployment URL is available during Next.js build.

---

- [x] ### Create Prettier configuration file

**File**: `.prettierrc.json` (create new)

**Problem**: No `.prettierrc` found but Prettier plugins installed (`@ianvs/prettier-plugin-sort-imports`, `prettier-plugin-ember-template-tag`). Formatter settings inconsistent across developers/IDEs.

**Create**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100,
  "plugins": [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-ember-template-tag"
  ],
  "importOrder": [
    "^react$",
    "^next",
    "<THIRD_PARTY_MODULES>",
    "^@/",
    "^[./]"
  ],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true
}
```

**Why**: Ensures consistent formatting across team, enables auto-import sorting (currently installed but not configured), prevents formatting debates.

**Success**: Run `pnpm format`, imports are sorted by configured order, code formatted consistently.

---

- [x] ### Add post-deploy health check to CI build job

**File**: `.github/workflows/ci.yml:84` (after build step)

**Problem**: Convex deploys succeed but critical functions might be missing. No validation that deployment is actually healthy.

**Add after line 84 (build step)**:
```yaml
- name: Validate deployment health
  run: ./scripts/check-deployment-health.sh
  env:
    NEXT_PUBLIC_CONVEX_URL: ${{ secrets.NEXT_PUBLIC_CONVEX_URL }}
```

**Why**: Script already exists (`scripts/check-deployment-health.sh`), just not integrated into CI. Catches schema mismatches, missing functions before they hit production.

**Success**: CI build job fails if critical Convex functions missing after deployment.

---

## Phase 2: Developer Experience (High ROI)

- [x] ### Migrate from Husky to Lefthook

**Problem**: Pre-commit hooks take 10-30s due to sequential type-checking on every staged file via lint-staged. Incentivizes `--no-verify`.

**Expected gain**: Pre-commit <5s (vs current 10-30s), pre-push <15s.

**Steps**:

1. **Install Lefthook**:
   ```bash
   pnpm add -D lefthook
   pnpm remove husky
   ```

2. **Create `.lefthook.yml`**:
   ```yaml
   pre-commit:
     parallel: true
     commands:
       format:
         glob: "*.{js,jsx,ts,tsx,json,md}"
         run: prettier --write {staged_files}
       lint:
         glob: "*.{js,jsx,ts,tsx}"
         run: eslint --fix --cache {staged_files}
       secrets:
         run: gitleaks protect --staged

   pre-push:
     commands:
       typecheck:
         run: pnpm tsc --noEmit --incremental
       test:
         run: pnpm test --run --changed
       convex-check:
         run: pnpm test:contract
   ```

3. **Update `package.json:28`**:
   ```json
   - "prepare": "husky",
   + "prepare": "lefthook install",
   ```

4. **Remove lint-staged type-check** in `package.json:109-115`:
   ```json
   "lint-staged": {
     "*.{js,jsx,ts,tsx}": [
       "prettier --write",
   -   "eslint --fix",
   -   "bash -c 'pnpm tsc --noEmit'"
   +   "eslint --fix"
     ]
   }
   ```

5. **Delete `.husky/` directory**:
   ```bash
   rm -rf .husky
   ```

**Why**: Type-checking entire project on every commit is slow and redundant (runs in CI anyway). Move to pre-push where it's expected to take longer. Parallel execution of format + lint + secrets saves 5-10s.

**Success**: Commit takes <5s, pre-push runs type-check + tests in parallel, all hooks faster than current setup.

---

- [x] ### Set up Codecov for test coverage visibility

**Problem**: Coverage generated but not visible. No badges, trends, or PR diff coverage. Hard to know if coverage is improving or degrading.

**Steps**:

1. **Sign up at codecov.io**, link GitHub repo

2. **Add to CI workflow** in `.github/workflows/ci.yml:57` (after test step):
   ```yaml
   - name: Upload coverage to Codecov
     uses: codecov/codecov-action@v4
     with:
       files: ./coverage/coverage-final.json
       token: ${{ secrets.CODECOV_TOKEN }}
       fail_ci_if_error: false
   ```

3. **Add Codecov badge to README.md:3** (after title):
   ```markdown
   [![codecov](https://codecov.io/gh/YOUR_USERNAME/scry/branch/main/graph/badge.svg?token=YOUR_TOKEN)](https://codecov.io/gh/YOUR_USERNAME/scry)
   ```

4. **Add GitHub secret**: `CODECOV_TOKEN` (from Codecov dashboard)

**Why**: Codecov provides coverage trends, diff coverage in PRs (shows +/- % for each PR), identifies uncovered lines. Free for open source. Superior to self-hosted badges.

**Success**: PR comments show coverage delta (+2.5%), badge in README displays current coverage %, Codecov dashboard shows trend over time.

---

- [x] ### Add coverage thresholds for critical paths

**File**: `vitest.config.ts:16-31`

**Problem**: 723 tests but no enforcement of coverage minimums. Critical paths (auth, FSRS scheduler, payment logic) could drop to 0% without CI failing.

**Change**:
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'json-summary', 'html', 'lcov'], // Add lcov for Codecov
  // Global thresholds (Google research: 60% acceptable, 75% commendable)
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 55,
    statements: 60,
  },
  // Per-file thresholds for critical paths
  perFile: true,
  include: [
    'lib/**',
    'convex/**',
    'hooks/**',
  ],
  exclude: [
    'node_modules/',
    'dist/',
    '.next/',
    '**/*.d.ts',
    '**/*.config.*',
    '**/test/**',
    '**/tests/**',
    'lib/generated/**',
    'scripts/**',
  ],
},
```

**Create `vitest.workspace.ts`** for critical path overrides:
```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      include: ['convex/spacedRepetition.test.ts'],
      coverage: {
        thresholds: {
          lines: 80,
          functions: 80,
        },
      },
    },
  },
  {
    test: {
      include: ['lib/auth-cookies.test.ts'],
      coverage: {
        thresholds: {
          lines: 80,
        },
      },
    },
  },
]);
```

**Why**: FSRS scheduling and auth are critical paths where bugs cause data loss. 80% threshold ensures they're well-tested. Global 60% threshold prevents degradation without being oppressive.

**Success**: CI fails if critical path coverage drops below 80%, or global coverage drops below 60%.

---

- [x] ### Add bundle size limit enforcement

**Problem**: No enforcement of bundle size growth. Could accidentally ship 2MB of dependencies without noticing until production performance degrades.

**Steps**:

1. **Install size-limit**:
   ```bash
   pnpm add -D size-limit @size-limit/preset-app
   ```

2. **Create `.size-limit.json`**:
   ```json
   [
     {
       "name": "Client bundle",
       "path": ".next/static/**/*.js",
       "limit": "500 KB",
       "webpack": false
     }
   ]
   ```

3. **Add CI check** in `.github/workflows/ci.yml:84` (after build):
   ```yaml
   - name: Check bundle size
     run: pnpm size-limit
   ```

4. **Add npm script** in `package.json:29`:
   ```json
   "size": "size-limit"
   ```

**Why**: Bundle size directly impacts Time to Interactive. Lighthouse tests exist but not enforced. size-limit fails CI if bundle exceeds threshold, with clear error message.

**Success**: CI fails if bundle exceeds 500KB, developers notified before merge.

---

## Phase 3: Infrastructure Quality Gates

- [x] ### Create Lighthouse CI workflow for performance budgets

**File**: `.github/workflows/lighthouse.yml` (create new)

**Problem**: Lighthouse tools installed (`package.json:20-21`) but no automated performance regression detection. Performance can degrade silently.

**Create**:
```yaml
name: Lighthouse CI
on:
  pull_request:
    branches: [main, master]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: '10.12.1'

      - uses: actions/setup-node@v4
        with:
          node-version: '20.19.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build
        env:
          NEXT_PUBLIC_CONVEX_URL: ${{ secrets.NEXT_PUBLIC_CONVEX_URL }}

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/quiz-mode
          configPath: './lighthouserc.json'
          uploadArtifacts: true
          temporaryPublicStorage: true
```

**Create `lighthouserc.json`**:
```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "startServerCommand": "pnpm start",
      "startServerReadyPattern": "Ready",
      "url": [
        "http://localhost:3000",
        "http://localhost:3000/quiz-mode"
      ]
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "interactive": ["error", {"maxNumericValue": 3500}],
        "speed-index": ["error", {"maxNumericValue": 3000}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**Why**: Performance is a feature. Lighthouse CI catches regressions before they reach production. Budgets set at current performance levels (85 performance score, <2s FCP).

**Success**: PR checks fail if performance score drops below 85, or FCP exceeds 2 seconds.

---

- [x] ### Add preview deployment smoke tests

**File**: `.github/workflows/preview-smoke-test.yml` (create new)

**Problem**: Preview deploys might be broken, discovered only when manually testing. No automated validation that preview URL is functional.

**Create**:
```yaml
name: Preview Deployment Smoke Test
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - name: Wait for Vercel preview deployment
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
        id: waitForDeployment
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300

      - name: Test preview health endpoint
        run: |
          response=$(curl -f -s "${{ steps.waitForDeployment.outputs.url }}/api/health")
          echo "Health check response: $response"

          # Verify status is "healthy"
          status=$(echo $response | jq -r '.status')
          if [ "$status" != "healthy" ]; then
            echo "ERROR: Preview deployment unhealthy: $status"
            echo $response | jq '.recommendations'
            exit 1
          fi
```

**Why**: Health endpoint exists (`app/api/health/route.ts`), comprehensive checks already implemented. Just need to call it from CI. Catches environment variable misconfigurations, Convex connection issues before manual QA.

**Success**: PR checks fail if preview deployment health endpoint returns non-healthy status.

---

- [~] ### Add environment variable validation to CI

**File**: `.github/workflows/ci.yml:38` (add to quality job)

**Problem**: Missing env vars discovered only when deployment fails. `validate-env-vars.sh` exists but not used in CI.

**Add to quality job after line 37**:
```yaml
- name: Validate production environment variables
  run: |
    # Install vercel CLI for env validation
    npm install -g vercel

    # Check env vars are set (script validates both Vercel and Convex)
    ./scripts/validate-env-vars.sh production
  env:
    CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

**Why**: Script already exists and validates both Vercel and Convex env vars. Failing CI early (in 30s) saves 5+ minutes waiting for Vercel deployment to fail.

**Success**: CI quality job fails if required env vars missing, lists which vars need to be set.

---

- [ ] ### Consolidate security scanning into dedicated workflow

**File**: `.github/workflows/security.yml` (create new)

**Problem**: Security scanning scattered (Gitleaks in hooks, Dependabot configured, npm audit in CI). No centralized weekly security review.

**Create**:
```yaml
name: Security Audit
on:
  push:
    branches: [main, master]
  pull_request:
  schedule:
    - cron: '0 6 * * 1' # Weekly Monday 6am UTC

jobs:
  security:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      security-events: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for Gitleaks

      - name: Run Gitleaks secret scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      - uses: pnpm/action-setup@v2
        with:
          version: '10.12.1'

      - uses: actions/setup-node@v4
        with:
          node-version: '20.19.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run npm audit (HIGH/CRITICAL only)
        run: pnpm audit --audit-level=high
        continue-on-error: true
```

**Why**: Trivy scans dependencies + container images + misconfigurations (more comprehensive than just npm audit). Gitleaks scans full history. Results integrated into GitHub Security tab. Weekly scan catches new vulnerabilities.

**Success**: Weekly security scan runs, results visible in GitHub Security tab, HIGH/CRITICAL alerts fail PR checks.

---

## Phase 4: Release Management

- [ ] ### Set up Changesets for automated changelog

**Problem**: No CHANGELOG.md, manual version bumps, no release automation. Git tags exist but not correlated with releases.

**Steps**:

1. **Install Changesets**:
   ```bash
   pnpm add -D @changesets/cli
   pnpm changeset init
   ```

2. **Configure `.changeset/config.json`**:
   ```json
   {
     "$schema": "https://unpkg.com/@changesets/config@2.3.0/schema.json",
     "changelog": "@changesets/cli/changelog",
     "commit": false,
     "fixed": [],
     "linked": [],
     "access": "public",
     "baseBranch": "main",
     "updateInternalDependencies": "patch",
     "ignore": []
   }
   ```

3. **Create `.github/workflows/release.yml`**:
   ```yaml
   name: Release
   on:
     push:
       branches: [main]

   concurrency: ${{ github.workflow }}-${{ github.ref }}

   jobs:
     release:
       runs-on: ubuntu-latest
       permissions:
         contents: write
         pull-requests: write
       steps:
         - uses: actions/checkout@v4
           with:
             fetch-depth: 0

         - uses: pnpm/action-setup@v2
           with:
             version: '10.12.1'

         - uses: actions/setup-node@v4
           with:
             node-version: '20.19.0'
             cache: 'pnpm'

         - name: Install dependencies
           run: pnpm install --frozen-lockfile

         - name: Create Release Pull Request
           uses: changesets/action@v1
           with:
             publish: pnpm changeset tag
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

4. **Add npm script** in `package.json:29`:
   ```json
   "changeset": "changeset",
   "version-packages": "changeset version",
   ```

**Workflow**:
1. Developer adds changeset: `pnpm changeset` → creates `.changeset/some-feature.md`
2. On merge to main, bot creates "Version Packages" PR
3. Merge PR → auto version bump, CHANGELOG update, git tag, GitHub release

**Why**: Changesets better for TypeScript monolith apps than semantic-release (which requires strict conventional commits). Human-written changelog entries vs auto-generated. Explicit control over versioning.

**Success**: Add changeset file, merge PR, bot creates "Version Packages" PR with updated CHANGELOG.md and version bump.

---

## Phase 5: Test Quality Improvements

- [ ] ### Fix or delete skipped E2E tests

**Problem**: 4 E2E tests using `.skip` or `.only` (found by grep). Skipped tests create false confidence, `.only` blocks other tests from running.

**Files to review**:
- `tests/e2e/spaced-repetition.test.ts`
- `tests/e2e/spaced-repetition.local.test.ts`
- `tests/e2e/review-next-button-fix.test.ts`
- `tests/e2e/example-auth.test.ts`

**Steps**:
1. Review each test with `.skip` or `.only`
2. For each: either fix the test, or delete it if obsolete
3. Run full E2E suite to verify all tests pass

**Why**: Skipped tests either indicate flaky tests (need fixing) or tests that are no longer relevant (delete). `.only` accidentally left in blocks other tests.

**Success**: All E2E tests run, no `.skip` or `.only` present, suite passes.

---

- [ ] ### Add CI check to prevent `.only` commits

**File**: `.github/workflows/ci.yml:38` (add to quality job)

**Problem**: Developers forget to remove `.only` before committing, blocks entire test suite from running in CI.

**Add to quality job**:
```yaml
- name: Check for .only in tests
  run: |
    if git grep -E "(describe|test|it)\.only" "*.test.{ts,tsx}"; then
      echo "ERROR: Found .only in test files"
      echo "Remove .only before committing"
      exit 1
    fi
```

**Why**: Catches `.only` early in CI quality checks (fast feedback). Prevents accidentally shipping tests that block the suite.

**Success**: CI fails if `.only` found in test files, lists which files contain it.

---

## Appendix: Success Metrics

**Developer Experience**:
- Pre-commit time: 10-30s → <5s (5-10 min/dev/day saved)
- Pre-push time: Unknown → <15s
- Coverage visibility: None → Badge in README + PR comments

**Deployment Safety**:
- Health checks: 0 → 2 (post-deploy + preview smoke test)
- Performance monitoring: Manual → Automated (Lighthouse CI)
- Env var validation: Post-deploy → Pre-deploy

**Code Quality**:
- Coverage enforcement: None → 60% global, 80% critical paths
- Bundle size: Unmonitored → 500KB limit enforced
- Security scanning: Scattered → Centralized weekly scan

**Release Management**:
- Changelog: Manual → Automated via Changesets
- Version bumps: Manual → Automated via Changesets
- Git tags: Manual → Automated via Changesets

**Estimated ROI**:
- Time savings: 5-10 min/dev/day (faster commits + pre-push)
- Bug prevention: Catch 80%+ of deployment issues before production
- Reduced incident response: Health checks catch misconfigurations early

---

**Last Updated**: 2025-10-31
**Estimated Total Effort**: 16-20 hours spread across phases
**Risk Level**: Low (all changes additive except Husky→Lefthook migration)
