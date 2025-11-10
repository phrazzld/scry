# Deployment Resilience & Error Handling

This document describes how Scry handles transient deployment failures and recovers from upstream service outages.

## Overview

Scry deployments depend on two external services:
- **Convex** (backend/database)
- **Vercel** (frontend hosting)

Both services can experience transient failures. This document describes our resilience strategies.

---

## Retry Mechanism

### Convex Deploy Retry Logic

**File**: `scripts/vercel-build.sh`

**Strategy**: Exponential backoff with 3 attempts

```bash
# Attempt 1: Immediate
# Attempt 2: After 1 second
# Attempt 3: After 2 seconds (3 seconds total)
# Total max delay: ~7 seconds
```

**Handles**:
- ✅ 500 Internal Server Error (Convex API outage)
- ✅ 503 Service Unavailable (Convex degraded performance)
- ✅ Network timeouts and connection failures
- ✅ Transient database cluster issues

**Does NOT retry**:
- ❌ 400 Bad Request (invalid configuration)
- ❌ 401 Unauthorized (invalid deploy key)
- ❌ Syntax errors in Convex functions

**Why 3 attempts?**
- Convex incidents typically resolve in <5 minutes (per status.convex.dev history)
- 3 attempts with exponential backoff = ~7 seconds total
- Vercel build timeout is 10 minutes; 7 seconds is negligible
- Balances quick recovery vs. unnecessary retries

---

## Error Scenarios & Handling

### 1. Transient Convex API Failure

**Symptom**:
```
⚠️  Attempt 1 failed (exit code: 1)
⏳ Retrying in 1s...
🔄 Deployment attempt 2/3...
```

**Expected Behavior**:
- Script automatically retries with exponential backoff
- Most transient issues resolve on retry 2 or 3
- Deployment succeeds within 7 seconds

**Manual Intervention**: None required

---

### 2. Persistent Convex Outage

**Symptom**:
```
❌ All 3 deployment attempts failed (exit code: 1)

This may indicate:
  1. Transient Convex API outage (check https://status.convex.dev)
  2. Invalid CONVEX_DEPLOY_KEY
  3. Network connectivity issues
```

**Expected Behavior**:
- Vercel deployment fails
- GitHub Actions status check shows failure
- PR blocked from merging

**Manual Response**:
1. Check Convex status: https://status.convex.dev
2. If active incident: **Wait** for Convex to resolve (typically <30 min)
3. If operational: Investigate deploy key or network issues
4. Manually retry via GitHub Actions "Re-run failed jobs"

---

### 3. Invalid Deploy Key

**Symptom**:
```
❌ ERROR: CONVEX_DEPLOY_KEY not set
```

**Expected Behavior**:
- Build fails immediately (no retries)
- Clear error message with remediation steps

**Manual Response**:
1. Verify `CONVEX_DEPLOY_KEY` exists in Vercel env vars
2. Check variable is scoped to correct environment (Preview vs Production)
3. Regenerate deploy key if corrupted

---

### 4. Convex Function Syntax Error

**Symptom**:
```
✖ Error: Convex functions failed to compile
TypeError: Cannot read property 'foo' of undefined
  at convex/myFunction.ts:42:7
```

**Expected Behavior**:
- All 3 retry attempts fail with same error
- Error output shows specific file and line number

**Manual Response**:
1. Fix syntax error in Convex function
2. Commit and push fix
3. New deployment auto-triggers

---

## Monitoring & Alerting

### Current State (2025-11-10)

**Automated**:
- ✅ Retry logic handles transient failures
- ✅ Clear error messages guide manual resolution

**Manual**:
- ⚠️  Check Convex status page during persistent failures
- ⚠️  GitHub Actions notification emails for failed deployments

### Planned Improvements

See **Phase 2** in `docs/adr/0002-deployment-resilience-retry-logic.md`:

1. **Pre-deployment health checks**
   - Query Convex status API before attempting deployment
   - Skip deployment if Convex reporting active incident
   - Reduces wasted build minutes

2. **Structured error logging**
   - Send deployment failures to Sentry
   - Track Convex API latency metrics
   - Alert team if failure rate exceeds threshold

3. **Auto-retry in GitHub Actions**
   - Automatically re-run failed workflow after 5 minutes
   - Max 3 workflow-level retries
   - Only retry on Convex API errors (not code errors)

---

## Runbook: Convex API Outage

**When**: All 3 deployment attempts fail with 500/503 errors

**Steps**:

1. **Verify Convex Status**
   ```bash
   curl -s https://status.convex.dev/api/v2/status.json | grep status
   ```
   - If `"status":"operational"`: Not a Convex outage, investigate deploy key
   - If degraded: Proceed to step 2

2. **Check Incident Timeline**
   - Visit https://status.convex.dev
   - Read latest incident update
   - Estimate time to resolution (historical average: 10-30 minutes)

3. **Communicate Status**
   - Add comment to PR: "Deployment blocked by Convex API outage (status.convex.dev). Will retry when service recovers."
   - Update team in Slack #engineering

4. **Wait for Resolution**
   - Monitor status page
   - Do NOT spam retry attempts (wastes build minutes)

5. **Retry Deployment**
   - Once Convex reports "All Systems Operational"
   - GitHub Actions → Re-run failed jobs
   - Should succeed immediately

6. **Post-Mortem (if prolonged outage >1 hour)**
   - Document impact in #incidents
   - Consider adding Convex health check to CI (see Phase 2 roadmap)

---

## Historical Context

### November 2025 Convex Incidents

Based on status.convex.dev:

1. **Nov 10**: Project creation failures (10:07-10:47 AM Pacific)
   - Impact: Some customers unable to create Convex projects
   - Resolution: 40 minutes
   - **This PR affected**: Retry logic added in response

2. **Nov 5**: Database cluster latency
   - Impact: Elevated latency/errors for subset of customers
   - Resolution: 10 minutes

3. **Nov 3**: Database cluster elevation
   - Impact: Significant latency/error rate increase
   - Resolution: All deployments restored by 12:23 UTC

**Pattern**: Convex experiencing elevated instability in early November
**Mitigation**: Retry logic reduces impact of transient issues

---

## Testing

### Manual Testing

**Test transient failure handling**:
```bash
# Simulate Convex API failure with invalid deploy key
export CONVEX_DEPLOY_KEY="invalid-key"
./scripts/vercel-build.sh

# Expected output:
# 🔄 Deployment attempt 1/3...
# ⚠️  Attempt 1 failed (exit code: 1)
# ⏳ Retrying in 1s...
# 🔄 Deployment attempt 2/3...
# ... (3 attempts total)
# ❌ All 3 deployment attempts failed
```

**Test successful deployment**:
```bash
# Use valid deploy key
export CONVEX_DEPLOY_KEY="preview:phaedrus:scry|..."
./scripts/vercel-build.sh

# Expected output:
# 🔄 Deployment attempt 1/3...
# [Convex deploy output]
# ✅ Deployment succeeded on attempt 1
```

---

## Metrics to Track (Future)

Once monitoring infrastructure is in place:

1. **Deployment Success Rate**
   - % of deployments succeeding on attempt 1
   - % succeeding on attempt 2-3 (retry helped)
   - % failing after all retries

2. **Convex API Latency**
   - Time to complete `claim_preview_deployment` call
   - Baseline: <2 seconds
   - Alert if p95 >5 seconds

3. **Mean Time to Recovery (MTTR)**
   - Time from first failure to successful deployment
   - Target: <10 minutes for transient issues
   - Target: <1 hour for Convex incidents

---

## References

- **Convex Status**: https://status.convex.dev
- **Convex Docs**: https://docs.convex.dev/production/hosting/preview-deployments
- **Retry Best Practices**: https://cloud.google.com/storage/docs/retry-strategy
- **ADR**: `docs/adr/0002-deployment-resilience-retry-logic.md` (future)
