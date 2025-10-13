# Environment Variable Production Issue - Root Cause Analysis & Fix

**Date:** 2025-10-13
**Issue:** Production question generation failing with `API_KEY` error
**Status:** ✅ RESOLVED

## Root Cause

Production Convex deployment was missing `GOOGLE_AI_API_KEY` environment variable.

### Why This Happened

**Architectural Misunderstanding:**
- Vercel (Next.js frontend) and Convex (backend) maintain **separate, isolated environment variable systems**
- Setting a variable in Vercel does NOT automatically sync to Convex
- The code in `convex/aiGeneration.ts:20` reads `process.env.GOOGLE_AI_API_KEY`
- This code runs in **Convex cloud**, not Vercel, so it reads Convex's environment variables

**Environment State:**
```
✅ Dev Convex (amicable-lobster-935):     Has GOOGLE_AI_API_KEY
❌ Prod Convex (uncommon-axolotl-639):   Missing GOOGLE_AI_API_KEY (CAUSE)
✅ Vercel (all environments):            Has GOOGLE_AI_API_KEY (but irrelevant for Convex)
```

**Why Dev/Preview Worked:**
- Both used dev Convex instance which had the key

**Why Production Failed:**
- Used separate prod Convex instance without the key
- AI generation code failed with API key error
- Error classifier caught "api key" → returned `API_KEY` error code
- User saw "API configuration error. Please contact support."

## Immediate Fix

Added missing environment variable to production Convex:

```bash
npx convex env set GOOGLE_AI_API_KEY "AIzaSy..." --prod
```

Verification:
```bash
$ npx convex env get GOOGLE_AI_API_KEY --prod
***REMOVED*** ✅
```

## Prevention Measures

### 1. Environment Validation Script ✅

**File:** `scripts/validate-env-vars.sh`

- Validates required env vars in BOTH Vercel AND Convex
- Checks production, preview, or development environments
- Provides clear error messages with fix instructions
- Exits with non-zero code if validation fails

Usage:
```bash
./scripts/validate-env-vars.sh production
```

### 2. Convex Health Check Query ✅

**File:** `convex/health.ts`

- Public query that validates all required env vars are present
- Returns `{ healthy: boolean, missing: string[], timestamp: string }`
- Can be called from CI/CD or deployment scripts
- Fails fast if critical vars missing

Usage:
```bash
npx convex run health:check --prod
```

### 3. Enhanced Deployment Health Check ✅

**File:** `scripts/check-deployment-health.sh`

- Now validates environment variables via health check query
- Runs connectivity tests
- Provides actionable error messages
- Prevents deployments with missing configuration

### 4. Pre-Deployment Validation ✅

**File:** `scripts/deploy-production.sh`

- Added Step 0: Environment validation (runs before deploying anything)
- Prevents partial deployments with missing config
- 4-step pipeline:
  1. Validate environment variables (NEW)
  2. Deploy Convex backend
  3. Validate deployment health
  4. Deploy Vercel frontend

### 5. Updated Documentation ✅

**Files:** `CLAUDE.md`, `.env.example`

- Clearly documented Vercel vs Convex environment separation
- Added table showing which vars go where
- Included setup commands for both systems
- Emphasized critical distinction to prevent future confusion

## Verification

**Production Health Check (After Fix):**
```json
{
  "deployment": "https://uncommon-axolotl-639.convex.cloud",
  "healthy": true,
  "missing": [],
  "timestamp": "2025-10-13T01:51:38.721Z"
}
```

**Environment Validation (After Fix):**
```
✅ Environment validation passed!
All required variables are present.
```

## Key Lessons

1. **Architecture Matters**: Understanding infrastructure boundaries is critical
2. **Environment Isolation**: Different services = different env var systems
3. **Validate Early**: Check configuration before deployment, not after
4. **Fail Fast**: Better to block deployment than deploy broken code
5. **Document Well**: Clear documentation prevents repeat issues

## Files Changed

- `convex/health.ts` (NEW) - Health check query
- `scripts/validate-env-vars.sh` (NEW) - Environment validation
- `scripts/check-deployment-health.sh` (ENHANCED) - Added env validation
- `scripts/deploy-production.sh` (ENHANCED) - Added pre-deployment validation
- `CLAUDE.md` (UPDATED) - Documented Vercel vs Convex separation
- `.env.example` (UPDATED) - Clarified variable scope

## Testing

To test the complete validation workflow:

```bash
# 1. Validate environment variables
./scripts/validate-env-vars.sh production

# 2. Check deployment health
NEXT_PUBLIC_CONVEX_URL="https://uncommon-axolotl-639.convex.cloud" \
  ./scripts/check-deployment-health.sh

# 3. Test production health check
npx convex run health:check --prod

# All should pass ✅
```

## Monitoring

Going forward, monitor for:
- Failed deployments due to missing env vars (should be caught early now)
- Health check failures (indicates configuration drift)
- API_KEY errors in production (should not occur anymore)

## References

- Convex Dashboard: https://dashboard.convex.dev/t/moomooskycow/uncommon-axolotl-639
- Vercel Dashboard: https://vercel.com/moomooskycow/scry/settings/environment-variables
- Error Classification: `convex/aiGeneration.ts:204-235`
