# CI Investigation Final Report - PR #58

**Date**: 2025-11-09
**Branch**: `refactor/extract-ai-provider-initialization`
**Status**: ⏸️ **REQUIRES MANUAL DASHBOARD ACCESS**

---

## Executive Summary

**Root Cause Identified**: `pnpm install` failing in Vercel build environment
**Evidence**: Direct deployment via `vercel --yes` shows: `Error: Command "pnpm install" exited with 1`
**Blocking**: Cannot retrieve detailed error logs via Vercel CLI (deployment logs not accessible for failed builds)

---

## Investigation Timeline

### Initial Hypothesis (INCORRECT)
- **Suspected**: Missing `CONVEX_DEPLOY_KEY` for Preview environment
- **Finding**: Variable EXISTS but had **trailing newline characters** corrupting the value
- **Action Taken**: Removed and re-added `CONVEX_DEPLOY_KEY` and `OPENAI_API_KEY` without newlines

### Secondary Issue Found
- **Discovered**: Both `CONVEX_DEPLOY_KEY` and `OPENAI_API_KEY` had `\n` at end of values
- **Fixed**: Used `echo -n` to add variables without trailing newlines
- **Verification**: Confirmed clean values via `vercel env pull --environment=preview`

### Actual Root Cause (CONFIRMED)
- **Error**: `pnpm install` exiting with code 1 during Vercel build
- **Evidence**: Test deployment from `/scry` directory showed clear error message
- **Impact**: Build fails BEFORE build script runs (explains [0ms] build duration)

---

## Findings

### ✅ Fixed Issues
1. **Environment Variable Corruption**:
   - `CONVEX_DEPLOY_KEY` had trailing `\n`
   - `OPENAI_API_KEY` had trailing `\n`
   - **Resolution**: Removed and re-added with `echo -n`

### ❌ Unresolved Issue
**pnpm install failure in Vercel**:
- Error Code: Exit 1
- Timing: During dependency installation (before build)
- Local Test: `pnpm install` works perfectly locally (5.9s, no errors)
- pnpm Version: Specified as `pnpm@10.12.1` in `packageManager` field
- Node Version: `>=20.19.0` required

---

## Evidence

### Environment Variables (Current State)
```bash
# Verified via: vercel env pull --environment=preview
CONVEX_DEPLOY_KEY="preview:phaedrus:scry|[REDACTED_BASE64]"  # ✓ NO NEWLINE
OPENAI_API_KEY="sk-proj-[REDACTED]"  # ✓ NO NEWLINE
```

### Deployment Attempts
| Time | Deployment | Status | Duration | Finding |
|------|-----------|---------|----------|---------|
| 20h ago | F276UN2sf8qXPV9iA3zJWnoCbBhA | Error | [0ms] | Original failure |
| 6h ago | 9Nz6xBKRN8kpAgxwC6yGF5dwPdG7 | Error | [0ms] | After first redeploy |
| 25m ago | 2CErz6Kv3yvnizeBpekqEVffc7Wy | Error | [0ms] | After fixing env vars (first attempt with `echo`) |
| 6m ago | FwzQVX9Vgz4EFbUkJSdbdMNZc7V2 | Error | [0ms] | After fixing env vars (second attempt with `echo -n`) |

**Pattern**: ALL deployments fail with [0ms], indicating failure during `pnpm install` (before build starts)

### Local vs Vercel Comparison
| Test | Result |
|------|--------|
| Local `pnpm install` | ✅ SUCCESS (5.9s, pnpm v10.12.1) |
| Vercel `pnpm install` | ❌ FAIL (exit code 1) |
| GitHub Actions tests | ✅ PASS (all 12 checks) |
| Smoke test | ✅ PASS (can connect to Convex backend) |

---

## Hypotheses for pnpm Install Failure

### H1: Vercel Build Cache Corruption (60% likely)
**Evidence**:
- Repeated failures across multiple deployments
- Local install works fine
- Same package.json, same lockfile

**Test**: Clear Vercel build cache
- Go to: Vercel Dashboard → scry → Settings → General
- Enable "Ignore Build Cache"
- Redeploy

### H2: Network Issue Fetching Specific Dependency (25% likely)
**Evidence**:
- Transient network issues can cause pnpm to fail
- Some registries may be blocked in Vercel's infrastructure

**Test**: Check deployment logs for specific failed package
- Requires manual dashboard access to see which package failed

### H3: Post-Install Script Failing (10% likely)
**Evidence**:
- Local shows warnings about "Ignored build scripts"
- Vercel may not have same ignore configuration

**Relevant packages with scripts**:
```
@clerk/shared, @sentry/cli, @tailwindcss/oxide, @vercel/speed-insights,
esbuild, lefthook, sharp, unrs-resolver
```

**Test**: Check if any post-install script is failing

### H4: Missing Environment Variable Needed by Dependency (5% likely)
**Evidence**:
- Some packages check for env vars during install
- Unlikely since local install works without Vercel-specific vars

**Test**: Review package.json scripts for install hooks

---

## Required Actions (MANUAL)

### Immediate: Access Vercel Dashboard
1. **Get detailed build logs**:
   - Visit: https://vercel.com/moomooskycow/scry
   - Navigate to recent failed deployment
   - Click "Build Logs" tab
   - Scroll to `pnpm install` section
   - **Capture exact error message** (which package failed, why)

2. **Clear build cache** (Test H1):
   - Settings → General → Build & Development Settings
   - Enable "Ignore Build Cache"
   - Trigger new deployment

3. **Check deployment configuration**:
   - Verify Framework Preset: "Next.js"
   - Verify Root Directory: "./" (not nested)
   - Verify Build Command: "./scripts/vercel-build.sh"
   - Verify Install Command: "pnpm install"

### After Getting Logs

**If specific package fails**:
- Check if package exists in registry
- Check if version is available
- Try updating/downgrading package

**If post-install script fails**:
- Add failing package to "ignored build scripts" in Vercel settings
- Or fix the script to work in Vercel environment

**If network/timeout**:
- Retry deployment
- Contact Vercel support if persistent

---

## CLI Limitations Encountered

### Cannot Access Deployment Logs
```bash
$ vercel logs <deployment-id>
Error: Deployment not ready. Currently: ● Error.
```
**Reason**: Vercel CLI cannot fetch logs from failed builds

### Cannot Inspect by ID
```bash
$ vercel inspect F276UN2sf8qXPV9iA3zJWnoCbBhA
Error: Can't find the deployment "F276UN2sf8qXPV9iA3zJWnoCbBhA"
```
**Reason**: Deployment ID format from PR checks doesn't match CLI expectations

### Successful via URL (but limited info)
```bash
$ vercel inspect https://scry-<hash>-moomooskycow.vercel.app
# Shows: status ● Error, builds [0ms]
# Cannot show: actual error logs
```

---

## Commits Made During Investigation

1. `ecd6350` - chore: trigger Vercel redeploy
2. `af1b6b4` - chore: trigger redeploy after fixing env vars
3. `f14fbec` - chore: trigger redeploy after properly fixing env vars (no newlines)

---

## Next Steps

1. **User manually accesses Vercel dashboard** to get pnpm install error details
2. **Based on error**:
   - Clear build cache if cache corruption
   - Update/fix specific failing package
   - Add build script exceptions if post-install failure
   - Contact Vercel support if infrastructure issue
3. **Clean up investigation files** after resolution
4. **Document solution** in CI-RESOLUTION-PLAN.md for future reference

---

## Files Created During Investigation

- `CI-FAILURE-SUMMARY.md` - Initial analysis and hypotheses
- `CI-RESOLUTION-PLAN.md` - Resolution strategies for each scenario
- `CI-INVESTIGATION-FINAL.md` - This file (comprehensive findings)
- `.env.preview` - Downloaded preview environment variables (for verification)
- `.env.preview.check` - Verification after first fix attempt
- `.env.preview.final` - Verification after second fix attempt (clean)

---

## Status

**Current State**: Environment variables clean, pnpm install failing in Vercel
**Blocking**: Need manual dashboard access to see detailed pnpm error logs
**Recommended**: User access Vercel dashboard → Build Logs → find exact pnpm failure reason
