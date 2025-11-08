# Observability Runbook

Operational guide for monitoring Scry's error tracking and analytics in production.

**Last Updated:** 2025-01-06
**On-Call Rotation:** [Add your team's on-call schedule here]

---

## Quick Links

**Dashboards:**
- [Sentry Dashboard](https://sentry.io/organizations/[your-org]/projects/scry/)
- [Vercel Analytics](https://vercel.com/[your-team]/scry/analytics)
- [Vercel Deployments](https://vercel.com/[your-team]/scry/deployments)
- [Convex Dashboard](https://dashboard.convex.dev/t/[your-team]/uncommon-axolotl-639)

**Documentation:**
- [Analytics Events Schema](./analytics-events.md)
- [Deployment Checklist](./deployment-checklist.md)
- [CLAUDE.md Analytics Section](../CLAUDE.md#analytics--observability)

---

## Daily Monitoring Routine

### Morning Check (5 minutes)

**1. Sentry Dashboard → Issues Tab**
```
Goal: Identify new error types overnight
Look for: Red "Unresolved" badges with high event count
Action: Triage new issues (see Triage Process below)
```

**Expected state:**
- 0-5 new errors in last 24 hours
- No critical unresolved issues
- Error rate <10 events/hour

**2. Sentry → Settings → Subscription**
```
Goal: Monitor quota usage
Look for: Progress bar showing errors consumed this month
Action: If >60% used mid-month, review top errors
```

**Expected state:**
- <2,500 errors consumed (50% of 5k free tier)
- Daily rate sustainable (<166 errors/day average)

**3. Vercel Analytics → Overview**
```
Goal: Check traffic patterns and Web Vitals
Look for: Anomalies in page views, Core Web Vitals regression
Action: Investigate if LCP/FID/CLS suddenly worse
```

**Expected state:**
- LCP < 2.5s (p75)
- FID < 100ms (p75)
- CLS < 0.1 (p75)
- Page views consistent with yesterday

---

## Weekly Review (30 minutes)

**Monday Morning Checklist:**

**1. Review Top Errors (Sentry)**
- [ ] Navigate to Issues → sorted by "Event Count"
- [ ] Review top 5 most frequent errors
- [ ] For each: Assign owner, set priority, add to sprint if needed

**2. Analytics Trends (Vercel)**
- [ ] Check custom events for the week:
  - Quiz generations: Started vs Completed ratio (should be >90%)
  - Review sessions: Abandoned ratio (target <30%)
  - Question CRUD: Creation trends
- [ ] Identify any anomalies or drop-offs

**3. Cost Monitoring**
- [ ] Sentry quota: On track to stay under 5k/month?
- [ ] If quota concern: Review ignore rules, consider sampling adjustments

**4. Alert Effectiveness**
- [ ] Review last week's alert emails
- [ ] Were any false positives? Tune alert rules
- [ ] Were any critical errors missed? Add new alert rules

---

## Error Triage Process

### Step 1: Assess Severity

**Critical (P0) - Immediate Action Required:**
- Prevents user sign-in or authentication
- Causes data loss or corruption
- Breaks payment processing
- Affects >10% of users
- High frequency (>50 events/hour)

**High (P1) - Address Same Day:**
- Breaks major feature (quiz generation, review sessions)
- Affects 1-10% of users
- Moderate frequency (10-50 events/hour)

**Medium (P2) - Address This Week:**
- Breaks minor feature
- Affects <1% of users
- Low frequency (<10 events/hour)
- Has workaround available

**Low (P3) - Backlog:**
- UI glitches, non-blocking
- Very rare (<5 events/day)
- Feature edge cases

### Step 2: Investigate Error

**In Sentry Dashboard:**

1. **Click error → "Full Details":**
   - Read error message and stack trace
   - Check which file/function failed (source maps should make it readable)
   - Review breadcrumbs (actions leading up to error)

2. **Check "Tags" tab:**
   - Browser version (is it outdated/unsupported?)
   - OS (specific to platform?)
   - Release version (introduced in recent deploy?)
   - Environment (only preview? only production?)

3. **Review "User Feedback":**
   - Any user context? (User ID, session ID)
   - What were they trying to do?

4. **Check similar issues:**
   - Click "Similar Issues" tab
   - Is this a duplicate of known issue?

### Step 3: Take Action

**For Critical/High Priority:**

1. **Create GitHub issue:**
   ```markdown
   Title: [P0] [Component] Brief description

   **Sentry Link:** [paste Sentry issue URL]
   **Severity:** Critical / High
   **Frequency:** X events/hour
   **Affected Users:** ~X%

   **Error Message:**
   ```
   [paste error]
   ```

   **Stack Trace:**
   ```
   [paste relevant stack trace lines]
   ```

   **Steps to Reproduce:**
   1. ...

   **Immediate Impact:**
   - What functionality is broken?
   - Is there a workaround?
   ```

2. **Assign owner and add to sprint**

3. **Notify team in Slack/Discord** if critical

**For Medium/Low Priority:**

1. **Add to backlog** with Sentry link
2. **Merge duplicates** in Sentry (select issues → "Merge")
3. **Add ignore rule** if truly not actionable

### Step 4: Resolve in Sentry

**After deploying fix:**

1. Navigate to Sentry issue
2. Click "Resolve" button
3. Select resolution type:
   - "In next release" (if fix not deployed yet)
   - "In current release" (if fix just deployed)
   - "Ignore" (if not a real bug, e.g., browser extensions)

**Monitor for re-open:**
- If error recurs after resolution, Sentry will re-open automatically
- Indicates fix didn't work or new variant of same issue

---

## Alert Response Playbooks

### Alert: "Production: New Error Type"

**Notification:** Email with subject "Sentry: New issue detected in Scry"

**Response time:** Within 1 hour during business hours

**Actions:**
1. Open Sentry link from email
2. Follow "Error Triage Process" above
3. If P0/P1: Create GitHub issue and notify team
4. If P2/P3: Create GitHub issue for backlog
5. Reply to email thread with triage decision

---

### Alert: "Production: High Error Rate"

**Notification:** Email "Sentry: Alert rule triggered - High error rate"

**Response time:** Within 30 minutes (indicates possible outage)

**Actions:**

1. **Check if widespread issue:**
   - Open Sentry dashboard
   - Look at Issues → Last hour
   - Is one error repeating, or many different errors?

2. **Assess impact:**
   - Check Vercel Analytics traffic (is site down?)
   - Try to reproduce in production (visit site, test key flows)
   - Check #support channel for user reports

3. **One repeating error:**
   - Follow "Error Triage Process" for that specific error
   - Likely a specific bug triggered by recent deployment

4. **Many different errors:**
   - Indicates possible bad deployment or infrastructure issue
   - Check recent deployments in Vercel
   - Consider rolling back (see "Incident Response" below)

5. **No errors visible / false alarm:**
   - Could be temporary spike that self-resolved
   - Adjust alert threshold if recurring false positives
   - Monitor for next 30 minutes

---

### Alert: "Production: Release Health Degradation"

**Notification:** Email "Sentry: Crash-free sessions below threshold"

**Response time:** Within 1 hour

**Actions:**

1. **Check Sentry → Releases → Latest release**
   - What's the crash-free rate? (target >98%)
   - How many sessions total?
   - How many crashes?

2. **Identify crash causes:**
   - Navigate to that release's issues
   - Sort by event count
   - Top 1-2 issues likely causing degradation

3. **Assess severity:**
   - Is crash rate still trending down?
   - What % of users affected?
   - Can users recover (refresh page works)?

4. **Take action:**
   - If critical: Follow incident response process
   - If not critical but concerning: Expedite fix
   - If minor/stabilizing: Create issue for normal sprint

---

## Incident Response

### Definition

An incident is declared when:
- Site is down or severely degraded for >10 minutes
- Critical feature broken affecting >50% of users
- Data loss or corruption detected
- Security breach suspected

### Incident Commander Responsibilities

**1. Declare incident** (in team chat):
```
🚨 INCIDENT DECLARED 🚨
Issue: [brief description]
Severity: Critical
Impact: [what's broken, how many users]
IC: [your name]
War room: [link to video call if needed]
```

**2. Assess and stabilize:**
- Is rollback needed? (see Rollback Procedure below)
- Can we hotfix quickly? (<30 min)
- Do we need to notify users?

**3. Communicate:**
- Update team chat every 15 minutes
- If user-facing: Post status page update (if you have one)
- If >1 hour: Consider email to users

**4. Resolve:**
- Deploy fix or rollback
- Verify resolution (test in production)
- Monitor for 30 minutes post-fix

**5. Post-mortem** (within 24 hours):
- Document what happened
- Root cause analysis
- Action items to prevent recurrence
- Share learnings with team

### Rollback Procedure

**Option 1: Vercel Dashboard (fastest)**
1. Navigate to Vercel → Deployments
2. Find last known good deployment
3. Click "..." → "Redeploy"
4. Monitor deployment logs

**Option 2: Git revert**
```bash
git revert <bad-commit-sha>
git push origin main
# Wait for auto-deploy
```

**Option 3: Disable problematic feature**
```bash
# Add feature flag to temporarily disable
vercel env add NEXT_PUBLIC_DISABLE_FEATURE true production
vercel --prod
```

**After rollback:**
- Verify site is stable
- Investigate root cause offline
- Fix and re-deploy when ready

---

## Performance Monitoring

### Web Vitals Thresholds

**Largest Contentful Paint (LCP):**
- Good: <2.5s
- Needs Improvement: 2.5-4s
- Poor: >4s

**First Input Delay (FID):**
- Good: <100ms
- Needs Improvement: 100-300ms
- Poor: >300ms

**Cumulative Layout Shift (CLS):**
- Good: <0.1
- Needs Improvement: 0.1-0.25
- Poor: >0.25

### Investigating Performance Regression

**If Web Vitals suddenly worse:**

1. **Check Vercel Analytics → Web Vitals:**
   - Which metric regressed?
   - When did it start? (correlate with deployment)
   - Which pages affected?

2. **Run Lighthouse locally:**
   ```bash
   pnpm test:lighthouse
   ```

3. **Compare bundle sizes:**
   ```bash
   ANALYZE=true pnpm build
   # Check bundle-analyzer report
   ```

4. **Profile in Chrome DevTools:**
   - Open affected page
   - DevTools → Performance → Record
   - Identify slow operations

5. **Check for large dependencies:**
   - Review recent PR that added new packages
   - Consider code-splitting or lazy loading

---

## Cost Management

### Sentry Free Tier Limits

**Monthly quota:** 5,000 errors
**Daily target:** <166 errors (to stay comfortably under limit)

**If approaching limit (>4,000 errors mid-month):**

**Option 1: Add ignore rules (recommended first step)**
1. Navigate to Sentry → Issues → Top errors
2. Identify noisy but non-critical errors
3. Settings → Inbound Filters → Add ignore pattern
4. Common candidates:
   - `ChunkLoadError` (usually auto-recoverable)
   - Browser extension errors (not our code)
   - Known third-party script errors

**Option 2: Reduce sample rates**
```bash
# Lower performance trace sampling
vercel env add SENTRY_TRACES_SAMPLE_RATE 0.05 production
vercel --prod
```

**Option 3: Upgrade to Team plan**
- Cost: $26/month
- Quota: 50,000 errors/month
- Additional features: Better search, custom alerts
- Decision: Discuss with team if recurring issue

### Vercel Analytics

**Cost:** Included in current Vercel plan (no additional charge)

**Monitor for:**
- Unexpected traffic spikes (could indicate attack)
- If approaching plan limits: Discuss with team

---

## Security & Privacy

### PII Redaction Verification

**Periodic audit (monthly):**

1. Open recent error in Sentry
2. Check "Extra Data" and "Context" tabs
3. Verify no emails in plain text (should be `[EMAIL_REDACTED]`)
4. Verify no auth tokens, API keys, passwords

**If PII leak detected:**
1. Immediately scrub from Sentry (if possible)
2. Update `lib/analytics.ts` sanitization patterns
3. Deploy fix ASAP
4. Review affected errors for compliance implications
5. Document in incident log

### GDPR Compliance

**User data deletion requests:**

1. User deletes account in Clerk (automatic)
2. Clerk webhook triggers Convex cleanup (see `convex/webhooks.ts`)
3. Vercel Analytics: User ID pseudonymized, no PII
4. Sentry: User ID is Clerk ID (not PII), no action needed

**Data retention:**
- Vercel Analytics: 13 months
- Sentry: 90 days (free tier)
- Convex: User controls via account deletion

---

## Troubleshooting Guide

### Problem: Error not appearing in Sentry

**Check:**
1. Is `SENTRY_DSN` set in production? (`vercel env ls production`)
2. Is `NEXT_PUBLIC_DISABLE_SENTRY` set to `true`?
3. Did error actually occur? (check Vercel deployment logs)
4. Is error rate limited by Sentry? (check quota)

**Test:**
1. Deploy to preview
2. Visit `/test-error` route
3. Trigger test error
4. Check Sentry within 30 seconds

---

### Problem: Stack traces are minified/unreadable

**Symptom:** Sentry shows webpack bundle references like `webpack:///_next/static/chunks/123.js:45`

**Fix:**
1. Verify `SENTRY_AUTH_TOKEN` set in Vercel production env
2. Check token has `project:releases` and `project:write` scopes
3. Redeploy to trigger source map upload
4. Verify in Sentry → Settings → Source Maps (should show recent uploads)

**If still not working:**
- Check Sentry plugin config in `next.config.ts`
- Verify `widenClientFileUpload: true`
- Check build logs for source map upload errors

---

### Problem: Too many false positive alerts

**Solution:** Tune alert rules in Sentry dashboard

**Example tuning:**
- Increase threshold: "High error rate" from 10/hour to 20/hour
- Add environment filter: Only alert on production, not preview
- Add frequency throttle: Max 1 email per hour (prevent spam)

---

### Problem: Event not in Vercel Analytics

**Check:**
1. Is environment production or preview? (dev doesn't send events)
2. Wait 10 minutes (dashboard has delay)
3. Check browser console for analytics errors
4. Verify event name matches `AnalyticsEventDefinitions` in `lib/analytics.ts`

**Debug:**
```typescript
// Temporarily enable debug logging
trackEvent('My Event', { prop: 'value' });
console.log('Event tracked:', 'My Event');
```

---

## On-Call Rotation

### On-Call Responsibilities

**Monitoring:**
- Check Sentry dashboard 2x per day (morning, end of day)
- Respond to alert emails within SLA times (see above)
- Escalate to team if incident declared

**Communication:**
- Keep team updated on significant errors
- Document issues found and resolutions
- Handoff to next on-call with summary

**Weekly handoff format:**
```
On-call week [dates] summary:
- Total errors: X (up/down Y% from last week)
- New issues created: X (link to GH issues)
- Incidents: X (link to post-mortems)
- Notable patterns: [observations]
- FYI for next on-call: [heads up on anything]
```

### Escalation Path

1. **First responder:** On-call engineer (you)
2. **Escalate to:** Tech lead (for incident declaration)
3. **Escalate to:** CTO/VP Eng (for customer-facing incidents)

---

## Useful Sentry Filters

**View only production errors:**
```
environment:production
```

**View errors from specific release:**
```
release:abc123def
```

**View errors affecting specific user:**
```
user.id:user_abc123
```

**View errors in last hour:**
```
age:-1h
```

**View unresolved high priority:**
```
is:unresolved priority:high
```

---

## Maintenance Tasks

### Quarterly Review (every 3 months)

**Review ignore rules:**
- Are any outdated? (errors we've since fixed)
- Remove rules for resolved issues

**Review alert rules:**
- Are thresholds still appropriate for traffic volume?
- Any new alert types needed?

**Review sample rates:**
- Adjust based on quota usage trends
- Balance cost vs visibility

**Update documentation:**
- This runbook
- Dashboard links if changed
- On-call rotation

---

## Contact Information

**Team:**
- On-call engineer: [Current on-call from rotation]
- Tech lead: [Name, Slack handle]
- DevOps: [Name, Slack handle]

**External:**
- Sentry support: https://sentry.io/support/
- Vercel support: https://vercel.com/support

**Emergency:**
- Incident channel: #incidents (Slack/Discord)
- After-hours: [Phone numbers if applicable]

---

**Remember:** When in doubt, escalate. It's better to over-communicate during an incident than to let an issue fester.

**End of Runbook**
