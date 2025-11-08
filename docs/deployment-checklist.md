# Production Deployment Checklist

Use this checklist before deploying observability changes or any major feature to production.

---

## Pre-Deployment: Environment Configuration

### Sentry Setup via Vercel Integration (⭐ RECOMMENDED)

**Step 1: Install Vercel Integration**
- [ ] Navigate to: https://vercel.com/integrations/sentry
- [ ] Click "Add Integration"
- [ ] Select your Vercel project
- [ ] Authorize Sentry access
- [ ] Integration auto-creates these Vercel env vars:
  - [ ] `SENTRY_AUTH_TOKEN` (auto-set)
  - [ ] `NEXT_PUBLIC_SENTRY_DSN` (auto-set)
  - [ ] `SENTRY_ORG` (auto-set)
  - [ ] `SENTRY_PROJECT` (auto-set)

**Step 2: Verify Auto-Created Variables**
- [ ] Go to Vercel → Project → Settings → Environment Variables
- [ ] Confirm `NEXT_PUBLIC_SENTRY_DSN` exists for Production & Preview
- [ ] Confirm `SENTRY_AUTH_TOKEN` exists for Production & Preview
- [ ] Note DSN value for next step

**Alternative: Manual Setup (if not using integration)**
- [ ] `SENTRY_DSN` set (from Sentry → Settings → Client Keys)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` set (usually same as SENTRY_DSN)
- [ ] `SENTRY_AUTH_TOKEN` set (from Sentry → Settings → Auth Tokens)
  - [ ] Token has `project:releases` scope
  - [ ] Token has `project:write` scope
- [ ] `SENTRY_ORG` set (your Sentry organization slug)
- [ ] `SENTRY_PROJECT` set (your Sentry project slug)
- [ ] All above variables also set for Preview environment

### Sentry Environment Variables (Convex Dashboard)

**Convex Production Backend:**
```bash
npx convex env set SENTRY_DSN "<your-dsn>" --prod
npx convex env list --prod | grep SENTRY  # Verify
```

- [ ] `SENTRY_DSN` set in Convex production backend

### Sample Rate Configuration (Optional)

If you want non-default sample rates, add to Vercel env vars:

- [ ] `SENTRY_TRACES_SAMPLE_RATE` (default: 0.1 = 10% of transactions)
- [ ] `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` (default: 0 = no routine replays, recommend 0.05 = 5%)
- [ ] `SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` (default: 1.0 = 100% of errors)

**Session Replay Recommendations:**
- Start with error-only replays (SESSION=0, ON_ERROR=1.0) to minimize quota usage
- If helpful, enable 5% routine replays (SESSION=0.05) to catch non-error UX issues
- Each replay ~100KB, factor into Sentry quota planning

---

## Pre-Deployment: Sentry Dashboard Configuration

### Alert Rules

**Navigate to:** Sentry Dashboard → Alerts → Create Alert Rule

**Alert #1: New Issue Types**
- [ ] Type: "When a new issue is created"
- [ ] Environment filter: `production`
- [ ] Level filter: `error` or `fatal`
- [ ] Action: Email notification
- [ ] Frequency: Once every 30 minutes (throttle)
- [ ] Name: "Production: New Error Type"
- [ ] Status: Active

**Alert #2: High Error Rate**
- [ ] Type: "When event count exceeds threshold"
- [ ] Threshold: `> 10 events in 1 hour`
- [ ] Environment filter: `production`
- [ ] Action: Email notification
- [ ] Frequency: Once every 30 minutes
- [ ] Name: "Production: High Error Rate"
- [ ] Status: Active

**Alert #3: Release Health Degradation**
- [ ] Type: "When crash free sessions < threshold"
- [ ] Threshold: `< 98% in 1 hour`
- [ ] Environment filter: `production`
- [ ] Action: Email notification
- [ ] Frequency: Once every 30 minutes
- [ ] Name: "Production: Release Health Degradation"
- [ ] Status: Active

### Ignore Rules (Optional)

**Navigate to:** Sentry → Settings → Inbound Filters

Configure ignore patterns for known non-critical errors:
- [ ] `ChunkLoadError` (common in SPAs, usually auto-retries work)
- [ ] Other patterns based on your app's known noisy errors

---

## Pre-Deployment: Vercel Dashboard Configuration

### Uptime Monitoring

**Navigate to:** Vercel Dashboard → Project → Monitoring → Checks

**Check #1: Health Endpoint**
- [ ] URL: `https://scry.study/api/health` (or your production domain)
- [ ] Frequency: Every 5 minutes
- [ ] Timeout: 10 seconds
- [ ] Alert method: Email on failure
- [ ] Status: Active

**Check #2: Homepage**
- [ ] URL: `https://scry.study/`
- [ ] Frequency: Every 10 minutes
- [ ] Timeout: 15 seconds
- [ ] Alert method: Email on failure
- [ ] Status: Active

### Analytics Configuration

**Navigate to:** Vercel Dashboard → Project → Analytics

- [ ] Verify Speed Insights is enabled
- [ ] Check that Web Vitals data is flowing (may take first deployment)

---

## Pre-Deployment: Local Testing

### Build Verification

```bash
# Run full production build locally
pnpm build

# Check for TypeScript errors
pnpm tsc --noEmit

# Run test suite
pnpm test

# Run contract tests
pnpm test:contract
```

**Verification:**
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Contract tests pass

### Linting & Formatting

```bash
# Run linter
pnpm lint

# Check formatting
pnpm format:check
```

**Verification:**
- [ ] No linting errors
- [ ] Code properly formatted

---

## Deployment: Preview Testing

### Deploy to Preview

```bash
git push origin <your-branch>
```

**Wait for:**
- [ ] Vercel preview deployment completes
- [ ] GitHub PR checks pass
- [ ] Convex preview backend deployed

### Test Error Tracking in Preview

**Navigate to preview URL + `/test-error`:**

1. **Trigger test error:**
   - [ ] Visit `https://<preview-url>/test-error`
   - [ ] See error boundary UI
   - [ ] Click "Retry" button (should clear error)

2. **Verify in Sentry Dashboard (wait ~30 seconds):**
   - [ ] Error appears in Sentry dashboard
   - [ ] Environment shows as `preview` or similar (not `production`)
   - [ ] Stack trace is readable TypeScript (not minified)
   - [ ] Source file paths visible (e.g., `app/test-error/page.tsx:10`)
   - [ ] No PII in error context (emails redacted)

3. **If stack traces are minified:**
   - [ ] Check `SENTRY_AUTH_TOKEN` set in Vercel
   - [ ] Verify token has correct scopes
   - [ ] Check Sentry → Settings → Source Maps (should show uploaded)

### Test Event Tracking in Preview

**Test quiz generation events:**
1. [ ] Generate a quiz (trigger "Quiz Generation Started")
2. [ ] Wait for completion (trigger "Quiz Generation Completed")
3. [ ] Check Vercel Analytics (wait 5-10 minutes for events to appear)

**Test review session events:**
1. [ ] Start review session (trigger "Review Session Started")
2. [ ] Complete or abandon session
3. [ ] Verify events in Vercel Analytics

**Test CRUD events:**
1. [ ] Create a question (trigger "Question Created")
2. [ ] Edit question (trigger "Question Updated")
3. [ ] Delete/archive (trigger respective events)

### Performance Verification

**Run Lighthouse in preview:**
```bash
# Replace with your preview URL
pnpm test:lighthouse -- https://<preview-url>/quiz-mode
```

**Verification:**
- [ ] Performance score unchanged or improved (no regression)
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1

---

## Deployment: Production

### Pre-Merge Checklist

Before merging to `main` (or your production branch):

**Code Quality:**
- [ ] All PR review comments addressed
- [ ] No console.log or debug statements
- [ ] No TODOs marked as "BEFORE_MERGE"
- [ ] Documentation updated (CLAUDE.md, README if needed)

**Configuration:**
- [ ] All environment variables verified in dashboards
- [ ] Sentry alerts configured and tested
- [ ] Vercel uptime checks configured

**Testing:**
- [ ] Preview deployment tested thoroughly
- [ ] Sentry error tracking verified (readable stack traces)
- [ ] Analytics events verified in dashboard
- [ ] No performance regression (Lighthouse)

### Merge & Deploy

```bash
# Merge to main
gh pr merge <pr-number> --squash

# Monitor deployment
vercel --prod  # If manual deployment needed

# Or wait for automatic deployment to complete
```

**Monitor during deployment:**
- [ ] Vercel deployment logs show no errors
- [ ] Convex production backend deployment succeeds
- [ ] Build completes successfully
- [ ] Health checks pass

---

## Post-Deployment: Verification

### Immediate Checks (within 5 minutes)

**Sentry:**
1. [ ] Navigate to Sentry dashboard
2. [ ] No new errors in production environment
3. [ ] If test error triggered: verify it appears correctly

**Vercel:**
1. [ ] Navigate to Vercel Analytics dashboard
2. [ ] Verify deployment successful
3. [ ] Check uptime monitoring is active

**Functional Testing:**
1. [ ] Visit production URL: `https://scry.study`
2. [ ] Test critical paths:
   - [ ] User can sign in
   - [ ] Quiz generation works
   - [ ] Review session loads
   - [ ] Questions can be created/edited

### 1-Hour Monitoring

**Sentry Dashboard:**
- [ ] Check for any new error types
- [ ] Verify error count is low (<5 errors/hour expected)
- [ ] Check release health (should be >98% crash-free)

**Vercel Analytics:**
- [ ] Verify custom events appearing
- [ ] Check Web Vitals look normal
- [ ] Monitor for traffic anomalies

### 24-Hour Monitoring

**Sentry:**
- [ ] Total errors < ~50/day (well within free tier limit)
- [ ] No critical unhandled errors
- [ ] All errors have readable stack traces

**Vercel:**
- [ ] Uptime checks showing 100% or near 100%
- [ ] No unexpected downtime
- [ ] Analytics showing normal traffic patterns

**Cost Monitoring:**
- [ ] Sentry quota usage check (Settings → Subscription)
  - [ ] Total errors this month < 2,500 (50% of free tier)
  - [ ] Daily rate sustainable (<166/day average)

---

## Rollback Procedures

### If Critical Errors After Deployment

**Option 1: Disable Sentry temporarily**
```bash
vercel env add NEXT_PUBLIC_DISABLE_SENTRY true production
vercel --prod  # Redeploy
```

**Option 2: Revert deployment**
```bash
# In Vercel dashboard, find previous deployment
# Click "..." → "Redeploy"
# Or via CLI:
vercel rollback <deployment-url>
```

**Option 3: Revert git commit**
```bash
git revert <commit-sha>
git push origin main
# Wait for auto-deployment
```

### If High Sentry Quota Usage

**Temporary fix:**
```bash
vercel env add SENTRY_TRACES_SAMPLE_RATE 0.05 production
vercel --prod
```

**Longer-term fix:**
- Add ignore rules in Sentry dashboard for noisy errors
- Review if Team plan upgrade needed ($26/mo = 50k errors/month)

---

## Emergency Contacts

**Sentry Support:** https://sentry.io/support/
**Vercel Support:** https://vercel.com/support
**Internal:** [Add your team contact info]

---

## Post-Deployment: Documentation

After successful production deployment:

- [ ] Update this checklist if any steps were missing/incorrect
- [ ] Document any issues encountered in `docs/observability-runbook.md`
- [ ] Share Sentry/Vercel dashboard access with team
- [ ] Schedule first weekly review of metrics (add to calendar)

---

## Appendix: Common Issues & Solutions

### Issue: Minified stack traces in Sentry

**Symptoms:** Error stack traces show webpack bundle references, not source files

**Solutions:**
1. Verify `SENTRY_AUTH_TOKEN` set in Vercel production env vars
2. Check token has `project:releases` and `project:write` scopes
3. Trigger new deployment to upload source maps
4. Check Sentry → Settings → Source Maps shows recent uploads

### Issue: Events not appearing in Vercel Analytics

**Symptoms:** Custom events don't show in dashboard after 10+ minutes

**Solutions:**
1. Check environment - dev environments don't send events
2. Verify `NEXT_PUBLIC_DISABLE_ANALYTICS` is not set to `'true'`
3. Check browser console for analytics errors
4. Confirm `getDeploymentEnvironment()` returns `'production'`

### Issue: High error rate after deployment

**Symptoms:** Sentry showing >50 errors/hour

**Immediate actions:**
1. Check Sentry dashboard for error pattern
2. If same error repeated: likely real bug, investigate quickly
3. If many different errors: possible bad deployment, consider rollback
4. Check if errors affect critical paths (auth, payments, data loss)

**Investigation:**
1. Group errors by type in Sentry
2. Check release notes for what changed
3. Review recent PR changes
4. Test affected functionality in production
5. If widespread: rollback deployment

### Issue: Sentry quota exceeded

**Symptoms:** Email alert from Sentry about quota limit reached

**Immediate actions:**
1. Check Sentry → Settings → Subscription for usage
2. Identify top error types in dashboard
3. Add ignore rules for non-critical errors
4. Lower `SENTRY_TRACES_SAMPLE_RATE` to 0.05 or 0.02

**Long-term solutions:**
1. Fix underlying bugs causing repeated errors
2. Review if free tier sufficient for your scale
3. Consider Team plan ($26/mo = 50k errors/month) if needed

### Issue: Alerts not received

**Symptoms:** Expected email alerts from Sentry not arriving

**Solutions:**
1. Check email spam folder
2. Verify alert rules are Active in Sentry dashboard
3. Test alert by triggering condition manually
4. Check alert email address is correct
5. Verify Sentry has correct notification settings

---

**Last Updated:** 2025-01-06
**Maintained By:** Development Team
