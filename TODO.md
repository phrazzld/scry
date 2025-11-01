# TODO: Fix Vercel Build Failures & CI Validation

**Status**: In Progress
**Created**: 2025-11-01
**Context**: Production deployments failing due to double-deployment bug + CI validation requiring impossible authentication. See ultrathink analysis for full design review.

**Root Causes Identified:**
1. **Double deployment**: vercel-build.sh uses `--cmd 'pnpm build'` but package.json build script also runs `npx convex deploy`, causing nested deploy (first succeeds, second 404s)
2. **Missing secret**: CONVEX_DEPLOY_KEY not in GitHub secrets (verified via `gh secret list`)
3. **Impossible validation**: CI tries to validate Convex env vars with `npx convex env get`, but production deploy keys lack read permissions (only admin keys can read env vars)
4. **Broken local builds**: Proposed fix would make `pnpm build` fail locally because Convex functions wouldn't be deployed first

**Strategic Approach**: Fix incrementally with independent verification at each step. Deploy fast, validate reality (post-deployment health checks) instead of validating hypotheticals (pre-flight env var existence).

---

## Phase 1: Investigation & Verification

**Goal**: Verify assumptions before making changes. Ensure health checks provide sufficient coverage to replace pre-flight validation.

- [x] **Audit health check coverage against validate-env-vars.sh requirements**
  - Read `scripts/validate-env-vars.sh` and extract all vars from `CONVEX_REQUIRED_VARS` and `VERCEL_REQUIRED_VARS` arrays
  - Read `app/api/health/route.ts` and `convex/health.ts` to see which vars they actually validate
  - Create comparison table: which vars are validated by health checks, which aren't
  - Success criteria: Confirm health checks validate at minimum `GOOGLE_AI_API_KEY` (critical for AI generation), `NEXT_PUBLIC_CONVEX_URL` (critical for backend connectivity), and `CONVEX_CLOUD_URL`. If gaps exist for critical vars, note them for potential health check enhancement.
  - Context: We're replacing pre-flight "does env var exist?" checks with post-deployment "does the system actually work?" checks. This task ensures we're not losing critical validation coverage.
  ```
  Work Log:

  === ENVIRONMENT VARIABLE COVERAGE ANALYSIS ===

  Variables from validate-env-vars.sh:

  CONVEX_REQUIRED_VARS (2):
    - GOOGLE_AI_API_KEY
    - NEXT_PUBLIC_APP_URL

  VERCEL_REQUIRED_VARS (5):
    - NEXT_PUBLIC_CONVEX_URL
    - CONVEX_DEPLOY_KEY
    - CLERK_SECRET_KEY
    - CLERK_WEBHOOK_SECRET
    - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  Health Check Coverage Analysis:

  app/api/health/route.ts:
    - Validates: NONE (basic uptime/memory check only)
    - No env var validation

  convex/health.ts:
    - check() query: Validates GOOGLE_AI_API_KEY, NEXT_PUBLIC_APP_URL, CONVEX_CLOUD_URL
    - detailed() query: Same as check() with status levels
    - testGoogleAiKey() action: FUNCTIONAL test of GOOGLE_AI_API_KEY (makes actual API call)
    - functional() action: Comprehensive check with API test + recommendations

  === COMPARISON TABLE ===

  | Variable                          | validate-env-vars.sh | Health Checks | Validated By        |
  |-----------------------------------|----------------------|---------------|---------------------|
  | GOOGLE_AI_API_KEY (critical)      | ✅ Convex            | ✅ FUNCTIONAL | convex/health.ts    |
  | NEXT_PUBLIC_APP_URL               | ✅ Convex            | ✅ Existence  | convex/health.ts    |
  | CONVEX_CLOUD_URL                  | ❌ Not checked       | ✅ Existence  | convex/health.ts    |
  | NEXT_PUBLIC_CONVEX_URL            | ✅ Vercel            | ❌ Not checked| N/A                 |
  | CONVEX_DEPLOY_KEY                 | ✅ Vercel            | ❌ Not checked| N/A                 |
  | CLERK_SECRET_KEY                  | ✅ Vercel            | ❌ Not checked| N/A                 |
  | CLERK_WEBHOOK_SECRET              | ✅ Vercel            | ❌ Not checked| N/A                 |
  | NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | ✅ Vercel            | ❌ Not checked| N/A                 |

  === CRITICAL FINDINGS ===

  ✅ STRENGTH: convex/health.ts provides SUPERIOR validation:
     - Not just existence checks, but FUNCTIONAL testing
     - testGoogleAiKey() actually calls Google AI API with test prompt
     - Classifies errors (INVALID_KEY, RATE_LIMIT, API_DISABLED, NETWORK)
     - Provides actionable recommendations

  ✅ COVERAGE ADEQUATE for Convex vars:
     - GOOGLE_AI_API_KEY: Functionally validated (better than existence check)
     - NEXT_PUBLIC_APP_URL: Existence validated
     - CONVEX_CLOUD_URL: Existence validated (auto-set by Convex)

  ⚠️ GAP: Vercel vars not validated by health checks
     - NEXT_PUBLIC_CONVEX_URL: Frontend-only var, no backend validation possible
     - CONVEX_DEPLOY_KEY: Deployment auth, not runtime var
     - CLERK_*: Authentication vars, but Clerk integration itself tests them

  === VERDICT ===

  Health checks provide BETTER validation than validate-env-vars.sh:

  1. Functional testing > Existence checking
     - validate-env-vars.sh: "Is GOOGLE_AI_API_KEY set?" ✅
     - convex/health.ts: "Does GOOGLE_AI_API_KEY actually work?" ✅

  2. Validates in context (post-deployment)
     - Tests actual deployment configuration
     - Catches real issues (expired keys, rate limits, network problems)
     - Not hypothetical "vars exist" checks

  3. Gap analysis for Vercel vars:
     - NEXT_PUBLIC_CONVEX_URL: Auto-verified by frontend connectivity
       (if frontend can't reach Convex, app fails immediately)
     - CONVEX_DEPLOY_KEY: Only needed at deploy time (vercel-build.sh validates)
     - CLERK_*: Verified by Clerk SDK when auth is used

  RECOMMENDATION: Proceed with removing validate-env-vars.sh
  - No critical validation loss
  - Health checks are superior approach
  - Vercel var gaps are acceptable (validated by usage, not existence)
  ```

- [ ] **Retrieve production CONVEX_DEPLOY_KEY from Convex dashboard**
  - Log into https://dashboard.convex.dev
  - Navigate to Settings → Project Settings → Deploy Keys
  - Copy **Production Deploy Key** (starts with `prod:`)
  - Store temporarily in password manager (will be added to GitHub secrets in Phase 3)
  - Success criteria: Have production deploy key ready for GitHub secret creation
  - Context: This key is required for vercel-build.sh to deploy Convex functions. Currently missing from GitHub secrets, causing build failures.

---

## Phase 2: Fix Double Deployment Bug

**Goal**: Make build process work correctly in all contexts (local development, Vercel CI, manual production builds) without nested deployments.

- [ ] **Update package.json with context-specific build scripts**
  - Change `"build": "npx convex deploy && next build"` to `"build": "next build"`
  - Add `"build:prod": "npx convex deploy --cmd 'next build'"` for standalone atomic production builds
  - Add `"build:local": "npx convex deploy && next build"` for local testing of production builds
  - Keep `"dev": "concurrently \"next dev --turbopack\" \"convex dev\""` unchanged
  - Success criteria: `pnpm build` only builds Next.js, `pnpm build:local` deploys Convex then builds Next.js for local testing, `pnpm build:prod` uses atomic `--cmd` flag for production
  - Context: The base `build` script is called by vercel-build.sh via `--cmd` flag. It shouldn't deploy Convex itself because vercel-build.sh already handles deployment. The new scripts provide explicit paths for different build contexts.

- [ ] **Add inline documentation explaining build script usage**
  - In package.json, add comment block above scripts section:
    ```json
    "// NOTE": "Build script contexts:",
    "// build": "Used by vercel-build.sh --cmd flag (Convex already deployed)",
    "// build:prod": "Standalone production build with atomic deployment",
    "// build:local": "Local production build for testing (deploys then builds)",
    ```
  - Success criteria: Developers reading package.json understand when to use which script
  - Context: Prevents confusion from having multiple build commands. Makes implicit contract (vercel-build.sh owns deployment) explicit.

- [ ] **Verify vercel-build.sh uses --cmd flag correctly**
  - Open `scripts/vercel-build.sh`
  - Confirm line 51 is: `npx convex deploy --cmd 'pnpm build'`
  - Confirm script validates CONVEX_DEPLOY_KEY exists (lines 18-32)
  - No changes needed if correct (this is verification task)
  - Success criteria: vercel-build.sh correctly orchestrates deploy → build sequence
  - Context: The `--cmd` flag ensures atomicity: Convex functions only deploy if frontend build succeeds. This prevents mismatched frontend/backend versions in production.

- [ ] **Test local build workflow with new scripts**
  - Run `pnpm build:local` locally
  - Verify: (1) Convex deploys to dev backend, (2) Next.js build succeeds, (3) no duplicate deployment
  - Check `.next/` directory contains static assets
  - Run `pnpm build` alone (should build Next.js without deploying Convex)
  - Success criteria: Both commands work correctly, no errors, build output matches expectations
  - Context: This validates the fix before pushing to CI. If local builds fail, the problem is in our script changes, not infrastructure.

---

## Phase 3: Infrastructure Setup

**Goal**: Add missing GitHub secret required for Convex deployment in CI/Vercel.

- [ ] **Add CONVEX_DEPLOY_KEY to GitHub repository secrets**
  - Use production deploy key from Phase 1
  - Run: `gh secret set CONVEX_DEPLOY_KEY` (will prompt for value)
  - Paste production deploy key when prompted
  - Verify: `gh secret list | grep CONVEX_DEPLOY_KEY` shows the secret exists
  - Success criteria: Secret appears in `gh secret list` output
  - Context: This key authorizes vercel-build.sh to deploy Convex functions in CI/Vercel builds. Without it, deployments fail with authentication errors. Production deploy keys can deploy code but cannot read environment variables (intentional security limitation).

- [ ] **Verify secret propagation to GitHub Actions**
  - Push a trivial commit to trigger CI
  - Check CI quality job runs successfully (should still fail on env validation for now)
  - Look for "CONVEX_DEPLOY_KEY not set" errors in logs (shouldn't appear now)
  - Success criteria: No authentication errors in CI logs related to Convex deployment
  - Context: Verifies secret is correctly configured before we remove validation step. If this fails, we know the secret setup was wrong before we remove our ability to validate.

---

## Phase 4: Remove Broken Pre-Flight Validation

**Goal**: Remove CI validation step that fundamentally cannot work (requires admin key, which is security risk). Rely on post-deployment health checks instead.

- [ ] **Remove environment validation step from .github/workflows/ci.yml**
  - Open `.github/workflows/ci.yml`
  - Delete lines 39-48 (entire "Validate production environment variables" step)
  - Verify the next step "Check for .only in tests" (lines 50-56) remains intact
  - Success criteria: Git diff shows clean removal of validation step, no syntax errors in workflow file
  - Context: This validation requires `npx convex env get`, which needs admin key (overprivileged for CI). Production deploy keys intentionally lack env var read access. Post-deployment health checks provide better validation anyway (tests actual functionality, not hypothetical config).

- [ ] **Delete scripts/validate-env-vars.sh**
  - Run: `rm scripts/validate-env-vars.sh`
  - Verify no other files reference this script: `git grep validate-env-vars.sh`
  - Success criteria: Script deleted, no remaining references in codebase
  - Context: This 188-line script becomes dead code after removing CI validation. Deleting prevents zombie code confusion. If env validation is needed in future, health checks are the right pattern (validate actual functionality, not config existence).

- [ ] **Verify CI build job health checks remain intact**
  - Open `.github/workflows/ci.yml` and locate build job (lines 92-124)
  - Confirm line 117-120 contains: "Validate deployment health" step calling `./scripts/check-deployment-health.sh`
  - Confirm line 122-123 contains: "Check bundle size" step calling `pnpm size-limit`
  - No changes needed (verification task)
  - Success criteria: Post-deployment health checks still run, providing actual validation of working system
  - Context: These health checks replace pre-flight validation with better approach: deploy, then verify it actually works. Tests real API connectivity, schema validity, and function availability.

---

## Phase 5: Documentation & Polish

**Goal**: Document the new build workflow and environment variable architecture for future developers.

- [ ] **Create docs/environment-variables.md reference**
  - Create `docs/` directory if it doesn't exist
  - Write comprehensive table of all env vars with columns: Variable Name, Convex (Y/N), Vercel (Y/N), CI (Y/N), Purpose, How to Set
  - Include these vars at minimum:
    - `GOOGLE_AI_API_KEY`: Backend AI generation (Convex only)
    - `NEXT_PUBLIC_CONVEX_URL`: Frontend backend connection (Vercel, auto-set by convex deploy)
    - `CONVEX_DEPLOY_KEY`: Deployment authentication (Vercel + CI)
    - `CLERK_SECRET_KEY`: Auth verification (Vercel + CI)
    - `CLERK_WEBHOOK_SECRET`: Webhook validation (Vercel + CI)
    - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Frontend auth (Vercel + CI)
  - Add section explaining Convex vs Vercel env vars are separate systems (setting in one doesn't set in other)
  - Success criteria: Single source of truth for "which env var goes where" questions
  - Context: Eliminates repeated confusion about environment variable configuration. Current knowledge is scattered across validate-env-vars.sh, CLAUDE.md, and tribal knowledge.

- [ ] **Update CLAUDE.md with build script usage patterns**
  - Open `CLAUDE.md` in project root
  - Add section under "## Deployment Architecture" explaining:
    - When to use `pnpm build` (never directly, only via vercel-build.sh)
    - When to use `pnpm build:local` (testing production builds locally)
    - When to use `pnpm build:prod` (manual production deployments)
    - When to use `pnpm dev` (normal development)
  - Add note that vercel-build.sh is the canonical production build path
  - Success criteria: Developers understand build workflow without tribal knowledge
  - Context: CLAUDE.md is the project's operational guide. This prevents confusion from having multiple build commands and makes the implicit contract (vercel-build.sh owns production builds) explicit.

- [ ] **Update TODO.md to reflect completion**
  - Mark all tasks as completed with `[x]`
  - Add summary at top noting: "Completed 2025-11-0X. Fixed double deployment bug, removed impossible pre-flight validation, enhanced documentation."
  - Move any optional enhancements to BACKLOG.md
  - Success criteria: TODO.md accurately reflects completed work
  - Context: Keeps project management artifacts in sync with reality.

---

## Success Criteria for Entire Fix

**Build Pipeline**:
- ✅ Vercel builds succeed without double deployment
- ✅ Local production builds work with `pnpm build:local`
- ✅ CI runs without environment validation failures

**Validation**:
- ✅ Post-deployment health checks validate critical env vars
- ✅ No overprivileged secrets (admin keys) in CI
- ✅ Deployments that succeed are actually functional (not just "vars exist")

**Developer Experience**:
- ✅ Clear documentation of which build command to use when
- ✅ Single source of truth for environment variable configuration
- ✅ No tribal knowledge required to understand build workflow

---

## Rollback Plan

If CI still fails after all tasks complete:

1. Check CI logs for specific error
2. Verify CONVEX_DEPLOY_KEY secret exists and is production key (starts with `prod:`)
3. Test vercel-build.sh locally: `CONVEX_DEPLOY_KEY=<key> ./scripts/vercel-build.sh`
4. If health checks fail, temporarily re-add validation step to isolate issue
5. Escalate to Convex support if deploy key permissions seem wrong

---

## Future Enhancements (see BACKLOG.md)

- Consolidate `check-deployment-health.sh` and `/api/health` into single comprehensive endpoint
- Add preview deployment smoke tests (already in preview-smoke-test.yml, verify it calls /api/health)
- Consider Vercel GitHub Action instead of vercel-build.sh for better integration
