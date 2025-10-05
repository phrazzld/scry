# TODO: Fix Deployment Mismatch & Prevent Future Occurrences

## Critical Path: Immediate Production Fix

- [!] **Deploy Convex functions to production manually**
  - Run: `npx convex deploy --env-file .env.production`
  - Verify functions deployed: `npx convex functions list --env-file .env.production | grep "generationJobs:getRecentJobs"`
  - Success criteria: Command completes without errors, all functions from `convex/` directory are listed
  - Validation: Visit scry.study - should load dashboard without "Server Error"
  ```
  Work Log:
  - BLOCKER: .env.production missing CONVEX_DEPLOY_KEY
  - Production Convex URL: https://uncommon-axolotl-639.convex.cloud
  - CONVEX_DEPLOY_KEY must be obtained from Convex dashboard (Settings → Deploy Keys)
  - Security note: Deploy keys should NOT be committed to repository
  - Alternative approach: Set CONVEX_DEPLOY_KEY as env var before running command
  - Command: CONVEX_DEPLOY_KEY=<key> npx convex deploy --prod
  - Next action: User must provide production deploy key or access Convex dashboard
  ```

- [ ] **Validate production deployment health**
  - Open scry.study in browser
  - Check browser console for errors (should be clear except preload warnings)
  - Test background tasks panel (navbar badge should be clickable)
  - Test question generation flow (should create job and show in panel)
  - Success criteria: All core functionality works, no CONVEX Q errors in console

## Build Configuration: Root Cause Fix

- [x] **Update Vercel build command in vercel.json**
  - ✅ File: `vercel.json` - Updated buildCommand
  - ✅ Changed to: `"buildCommand": "npx convex deploy --cmd 'pnpm build'"`
  - ✅ Ensures Convex functions deploy BEFORE Next.js build
  - ✅ Committed in: 887fbb1

- [ ] **Configure Convex deploy key in Vercel dashboard**
  - Navigate to Vercel project settings → Environment Variables
  - Verify `CONVEX_DEPLOY_KEY` exists for Production environment
  - If missing: Get production key from Convex dashboard → Settings → Deploy Keys
  - Add to Vercel with scope: Production only
  - Success criteria: Key visible in Vercel, value starts with `prod:`

- [ ] **Override build command in Vercel dashboard settings**
  - Navigate to: Project Settings → Build & Development Settings
  - Set "Build Command Override": `npx convex deploy --cmd 'pnpm build'`
  - This provides redundancy if vercel.json fails
  - Success criteria: Override command saved and visible in settings

- [ ] **Test automated deployment flow**
  - Make trivial change (add comment to README.md)
  - Commit and push to master: `git add README.md && git commit -m "test: verify automated Convex+Vercel deployment" && git push`
  - Watch Vercel deployment logs for: "Deploying Convex functions..."
  - Verify both Convex and Vercel deploy successfully
  - Success criteria: Deployment logs show Convex deploy before Next.js build, both succeed

## Deployment Health Checks: Validation Layer

- [x] **Create deployment health check script**
  - ✅ File: `scripts/check-deployment-health.sh` created
  - ✅ Check 1: Convex deployment connectivity via `npx convex data`
  - ✅ Check 2: All 7 critical functions verified to exist
  - ✅ Exit code 0 on success, 1 on failure with descriptive errors
  - ✅ Colored output with clear status indicators
  - ✅ Committed in: 65da215

- [x] **Make health check script executable**
  - ✅ Permissions set: `chmod +x scripts/check-deployment-health.sh`
  - ✅ Tested locally with dev environment - passes
  - ✅ Script validated and working correctly

- [ ] **Add health check to CI/CD pipeline**
  - File: `.github/workflows/ci.yml` (if exists)
  - Add step after build job, before deploy job (master branch only)
  - Step name: "Validate Convex Deployment Health"
  - Run: `./scripts/check-deployment-health.sh`
  - Set environment: `NEXT_PUBLIC_CONVEX_URL: ${{ secrets.NEXT_PUBLIC_CONVEX_URL }}`
  - Success criteria: CI fails fast if Convex deployment is unhealthy
  - **Note**: Can be added when CI/CD pipeline is set up

## Atomic Deployment: Orchestration Script

- [x] **Create atomic production deployment script**
  - ✅ File: `scripts/deploy-production.sh` created
  - ✅ Step 1: Deploy Convex with environment validation
  - ✅ Step 2: Validate with health check script
  - ✅ Step 3: Deploy Vercel with `vercel --prod`
  - ✅ Uses `set -euo pipefail` for strict error handling
  - ✅ Clear emoji indicators and colored output
  - ✅ Committed in: 4f503e7

- [x] **Make deployment script executable**
  - ✅ Permissions set: `chmod +x scripts/deploy-production.sh`
  - ✅ Script logic verified - correct command sequence
  - ✅ No secrets in script - uses env vars correctly

- [x] **Document atomic deployment script usage**
  - ✅ File: `README.md` - Comprehensive deployment section added
  - ✅ Documented both automated and manual deployment
  - ✅ Includes troubleshooting for common failure scenarios
  - ✅ Clear best practices and verification steps
  - ✅ Committed in: a00f032

## Schema Versioning: Future-Proofing

- [x] **Implement schema version tracking**
  - ✅ File: `convex/schemaVersion.ts` created
  - ✅ Exported SCHEMA_VERSION = "2.0.0"
  - ✅ Comprehensive semantic versioning rules documented
  - ✅ Examples for major, minor, patch increments
  - ✅ When to increment guidelines included

- [x] **Create Convex query to expose schema version**
  - ✅ File: `convex/system.ts` created
  - ✅ Query: `getSchemaVersion` exported
  - ✅ Public access - no authentication required
  - ✅ Returns current schema version string

- [x] **Implement frontend deployment version check**
  - ✅ File: `lib/deployment-check.ts` created
  - ✅ Hook: `useDeploymentCheck()` exported
  - ✅ Queries backend version via `api.system.getSchemaVersion`
  - ✅ Compares with FRONTEND_VERSION constant
  - ✅ Throws detailed error on mismatch with fix instructions

- [x] **Add deployment check to root layout**
  - ✅ File: `app/layout.tsx` updated
  - ✅ Component: `DeploymentVersionGuard` wraps app
  - ✅ Uses `useDeploymentCheck()` hook internally
  - ✅ Error boundary catches and displays mismatches
  - ✅ All pages validate on load
  - ✅ Committed in: 4ef8c18

## Documentation: Knowledge Transfer

- [x] **Update README deployment section**
  - ✅ File: `README.md` → "Deployment" section completely rewritten
  - ✅ Documented critical order: Convex MUST deploy before Vercel
  - ✅ Added comprehensive subsections:
    - "Deployment Architecture" - instances and order
    - "Automated Deployment" - Vercel integration setup
    - "Manual Deployment" - atomic script usage
    - "Deployment Validation" - health check and version tracking
    - "Production Monitoring" - logs and verification
    - "Troubleshooting Deployments" - common issues and fixes
    - "Deployment Best Practices" - 5 key recommendations
  - ✅ New developer can deploy without asking questions
  - ✅ Committed in: a00f032

- [ ] **Create deployment troubleshooting guide**
  - File: `docs/deployment-troubleshooting.md`
  - Section 1: "Convex Function Not Found" errors → symptoms, diagnosis, fix
  - Section 2: Build command not deploying Convex → verification steps
  - Section 3: Schema version mismatch → what it means, how to resolve
  - Section 4: Rollback procedures if deployment fails
  - Success criteria: Common deployment issues have documented solutions
  - **Note**: README troubleshooting section covers most common cases; create this if more detail needed

- [ ] **Update CI/CD documentation**
  - File: `docs/ci-cd-setup.md` (if exists)
  - Add section: "Deployment Order and Dependencies"
  - Explain why Convex-first is critical (frontend depends on backend functions)
  - Document the health check validation step
  - Add flowchart: Convex Deploy → Validate → Vercel Deploy
  - Success criteria: CI/CD documentation reflects current deployment architecture
  - **Note**: Can be created when CI/CD pipeline is set up

## Validation & Testing

- [ ] **Test deployment health check with missing function**
  - Temporarily comment out a function export in `convex/generationJobs.ts`
  - Run health check: `./scripts/check-deployment-health.sh`
  - Verify: Script fails with specific error about missing function
  - Restore commented function
  - Success criteria: Health check correctly identifies missing critical functions

- [ ] **Test schema version mismatch detection**
  - Update `SCHEMA_VERSION` in `convex/schemaVersion.ts` to "3.0.0"
  - Deploy Convex: `npx convex deploy --env-file .env.local`
  - Open app in browser (pointing to dev deployment)
  - Verify: Error message shown about version mismatch
  - Restore version to match, redeploy
  - Success criteria: Frontend detects and displays version mismatch clearly

- [ ] **End-to-end deployment test**
  - Create test branch: `git checkout -b test/deployment-validation`
  - Make trivial code change (add console.log to a function)
  - Commit and push: Triggers automated deployment
  - Verify in deployment logs:
    1. Convex functions deploy first
    2. Health check passes
    3. Next.js build succeeds
    4. Vercel deployment completes
  - Delete test branch after validation
  - Success criteria: Full deployment pipeline works with new configuration
