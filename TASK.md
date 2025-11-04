# [INFRA] Vercel Analytics and Observability

## Executive Summary

Maximize existing Vercel Analytics (already installed) with custom event tracking, add Sentry free tier for error monitoring, and configure email alerts. Focus on basics: error tracking, user counts, page views, and key action metrics (quiz generation, reviews, question management).

**Cost:** $0/month (Sentry free tier + existing Vercel plan)
**Timeline:** 1-2 weeks
**Value:** Production-grade error tracking + user behavior insights without additional spend

## User Context

**Problem:** Currently blind to user errors (only console logging) and user behavior patterns (no custom events). Can't debug user-reported issues or understand feature usage.

**Solution:** Leverage existing infrastructure + free tools for basic observability:
- Error aggregation and stack traces (Sentry)
- User behavior tracking (Vercel Analytics custom events)
- Email alerts for critical issues
- Zero additional cost

**Measurable Benefits:**
- Catch and debug production errors with stack traces
- Understand which features are used most (quiz generation vs manual creation)
- Track review session completion rates
- Monitor user growth and engagement trends

## Requirements

### Functional Requirements

1. **Error Tracking**
   - Capture frontend errors with stack traces
   - Track backend (Convex) errors
   - Group similar errors automatically
   - Source maps for production debugging

2. **Custom Event Tracking**
   - Quiz generation: start, complete, failure
   - Review sessions: start, complete, abandon
   - Question CRUD: create, edit, delete, archive, restore
   - Track event counts per user action

3. **Alert Configuration**
   - Email notifications for new error types
   - Configurable error rate thresholds
   - Alert throttling to prevent spam

4. **Dashboard Access**
   - Vercel Analytics: page views, unique visitors, top pages
   - Sentry Dashboard: error trends, affected users, stack traces
   - Real-time data (not batch processing)

### Non-Functional Requirements

- **Cost:** Stay within Sentry free tier (5k events/month)
- **Privacy:** No PII in error reports (reuse existing redaction patterns)
- **Performance:** No impact to page load times (async loading)
- **Maintainability:** Centralized analytics wrapper for consistency

## Architecture Decision

### Selected Approach: **Minimal Enhancement**

**What:** Maximize existing Vercel Analytics + add Sentry free tier

**Why:**
- **User Value:** Solves immediate needs (error debugging, usage metrics) at zero cost
- **Simplicity:** Builds on already-installed packages, minimal new dependencies
- **Explicitness:** All tracking centralized in `lib/analytics.ts`, easy to audit

**Rationale:**
- Vercel Analytics already captures page views, visitors, Core Web Vitals
- Sentry free tier (5k events/month) sufficient for current scale
- Custom events fill gap in user behavior understanding
- Email alerts provide proactive error detection

### Alternatives Considered

| Approach | Value | Simplicity | Cost | Why Not Chosen |
|----------|-------|-----------|------|----------------|
| **Comprehensive Observability** (Sentry Team + Session Replay + Synthetic Monitoring) | High | Medium | $100-300/mo | Over-engineered for current needs; can upgrade later |
| **Custom Analytics Platform** (OpenTelemetry + open-source backends) | Medium | Low | $30/mo | High setup effort; not worth time investment for basics |
| **Do Nothing** (Manual log checking) | None | High | $0 | Reactive debugging wastes time; can't track user behavior |

### Module Boundaries

**1. Analytics Wrapper (`lib/analytics.ts`)**
- **Interface:** `trackEvent(name, properties)`, `reportError(error, context)`
- **Responsibility:** Centralize all tracking logic, handle environment detection
- **Hidden Complexity:** Vercel Analytics API, Sentry API, error serialization

**2. Sentry Integration (`lib/sentry.ts`)**
- **Interface:** Auto-capture via error boundary, manual `Sentry.captureException()`
- **Responsibility:** Error aggregation, stack trace collection, source maps
- **Hidden Complexity:** Breadcrumb collection, PII redaction, release tracking

**3. Event Tracking Hooks (`hooks/useTrackEvent.ts`)**
- **Interface:** `useTrackEvent(eventName)` returns tracking function
- **Responsibility:** React-friendly event tracking in components
- **Hidden Complexity:** Memoization, environment checks, error handling

**4. Error Boundary (`components/analytics-error-boundary.tsx`)**
- **Interface:** Wrap app in `<AnalyticsErrorBoundary>` component
- **Responsibility:** Catch React errors, report to Sentry, show fallback UI
- **Hidden Complexity:** Error recovery, user-friendly messaging, retry logic

### Abstraction Layers

**Layer 1 (Infrastructure):** Vercel Analytics SDK, Sentry SDK
- Vocabulary: events, errors, breadcrumbs, stack traces

**Layer 2 (Integration):** Analytics wrapper, Sentry config
- Vocabulary: trackEvent(), reportError(), user context

**Layer 3 (Application):** useTrackEvent hook, AnalyticsErrorBoundary
- Vocabulary: quiz generation, review sessions, question actions

**Layer 4 (UI):** Button clicks, form submissions, user flows
- Vocabulary: user intent, feature usage, completion rates

Each layer transforms concepts meaningfully - UI actions → domain events → analytics primitives.

## Dependencies & Assumptions

### External Dependencies
- Vercel Analytics SDK (`@vercel/analytics@1.5.0`) - already installed ✅
- Sentry Next.js SDK (`@sentry/nextjs@latest`) - to be installed
- Vercel deployment platform (production environment)

### Assumptions
- **Scale:** <5k errors/month (Sentry free tier limit)
- **Traffic:** Current user base fits Vercel Analytics included tier
- **Environment:** Production deployment on Vercel with source maps
- **Team:** Solo developer, no shared Sentry team needed
- **Privacy:** Existing PII redaction patterns sufficient

### Integration Requirements
- Sentry DSN (free account signup required)
- Vercel environment variables (SENTRY_DSN, SENTRY_AUTH_TOKEN)
- Email for alert notifications
- Source map upload in build process

## Implementation Phases

### Phase 1: MVP (Core Error Tracking + Basic Events)
**Effort:** 4-6 hours | **Timeline:** Week 1

1. **Sentry Setup** (2h)
   - Install `@sentry/nextjs` via wizard
   - Configure `sentry.client.config.ts` and `sentry.server.config.ts`
   - Add Sentry DSN to `.env.local` and Vercel env vars
   - Test error capture in dev environment

2. **Analytics Wrapper** (1h)
   - Create `lib/analytics.ts` with `trackEvent()` function
   - Wrap Vercel Analytics `track()` with environment checks
   - Add TypeScript types for event names/properties

3. **Basic Custom Events** (2h)
   - Quiz generation: track start/complete in `aiGeneration.ts`
   - Review sessions: track start/complete in review flow
   - Question CRUD: track create/edit/delete/archive actions

4. **Error Boundary Enhancement** (1h)
   - Update `components/convex-error-boundary.tsx` to report to Sentry
   - Add user context (userId, environment)
   - Test error reporting with intentional errors

**Success Criteria:**
- Errors appear in Sentry dashboard with stack traces
- Custom events visible in Vercel Analytics
- Error boundary catches and reports React errors
- No console errors from analytics code

### Phase 2: Hardening (Alerts + Testing)
**Effort:** 2-3 hours | **Timeline:** Week 2

1. **Alert Configuration** (1h)
   - Configure Sentry email alerts for new error types
   - Set error rate threshold alerts (>10 errors/hour)
   - Configure Vercel uptime checks for `/api/health`
   - Test alert delivery

2. **Event Tracking Validation** (1h)
   - Add debug logging in development
   - Verify events reach Vercel Analytics dashboard
   - Test custom properties captured correctly
   - Document event schema

3. **Error Tracking Testing** (1h)
   - Trigger test errors in production preview
   - Verify source maps working (readable stack traces)
   - Test breadcrumb collection (user actions before error)
   - Validate PII redaction working

**Success Criteria:**
- Email alerts received for test errors
- Uptime checks operational
- All tracked events appear in dashboards
- Source maps show original TypeScript code

### Phase 3: Future Enhancements (Backlog)
**Estimated effort:** 1-2 days each

1. **Advanced Event Tracking**
   - Genesis Lab experiment runs and results
   - AI provider fallback occurrences (OpenAI → Google)
   - Background job queue depth tracking
   - Review streak tracking

2. **Session Replay** (if upgrade to Sentry Team $26/mo)
   - Visual reproduction of user sessions
   - Debug complex UI issues
   - Filter replays by error occurrence

3. **Custom Dashboards**
   - Genesis Lab metrics dashboard
   - User engagement funnel visualization
   - AI generation cost tracking (token usage)

4. **Performance Monitoring**
   - Custom Performance API marks/measures
   - Track question render performance (ADR-0001 concern)
   - AI streaming latency tracking

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|---------|-----------|
| **Exceed Sentry free tier (5k events/month)** | Medium | Low | Implement sampling if approaching limit; errors more important than events |
| **PII leakage in error reports** | Low | High | Reuse existing logger PII redaction patterns; audit Sentry config |
| **Alert fatigue from too many notifications** | Medium | Medium | Start conservative, adjust thresholds based on actual error rates |
| **Performance impact from tracking** | Low | Low | Async loading, test with Lighthouse CI |
| **Source maps not uploading** | Medium | Medium | Test in preview deployment first; verify Sentry auth token |

## Key Decisions

### Decision 1: Sentry Free Tier vs Paid
- **What:** Use Sentry free tier (5k events/month, 30-day retention)
- **Alternatives:** Sentry Team ($26/mo, 50k events, Session Replay), No Sentry
- **Rationale:** Free tier sufficient for current scale; can upgrade if needed
- **Tradeoff:** Limited to 5k errors/month, but that's ~166 errors/day (plenty)

### Decision 2: Centralized Analytics Wrapper
- **What:** Single `lib/analytics.ts` module for all tracking
- **Alternatives:** Direct SDK calls throughout codebase, Multiple wrappers
- **Rationale:** Easier to audit, test, and migrate if switching providers
- **Tradeoff:** One more abstraction layer, but improves maintainability

### Decision 3: Custom Events via Vercel Analytics (not separate service)
- **What:** Use Vercel Analytics `track()` for custom events
- **Alternatives:** Mixpanel, PostHog, Amplitude
- **Rationale:** Zero cost, already installed, sufficient for basic metrics
- **Tradeoff:** Less powerful than dedicated analytics platforms, but meets needs

### Decision 4: Error Boundary Enhancement (not new component)
- **What:** Extend existing `ConvexErrorBoundary` with Sentry reporting
- **Alternatives:** New separate error boundary, Multiple boundaries
- **Rationale:** Reuse existing UX, single error handling path
- **Tradeoff:** Couples Sentry to error boundary, but acceptable for now

### Decision 5: Email Alerts (not Slack)
- **What:** Configure email notifications from Sentry and Vercel
- **Alternatives:** Slack webhook, PagerDuty, No alerts
- **Rationale:** Simplicity - no additional integrations needed
- **Tradeoff:** Email less immediate than Slack, but sufficient for solo developer

## Implementation Notes

### Files to Create
- `lib/analytics.ts` - Analytics wrapper module
- `lib/sentry.ts` - Sentry configuration helpers
- `hooks/useTrackEvent.ts` - React hook for event tracking
- `components/analytics-error-boundary.tsx` - Enhanced error boundary
- `sentry.client.config.ts` - Sentry client config (created by wizard)
- `sentry.server.config.ts` - Sentry server config (created by wizard)

### Files to Modify
- `app/layout.tsx` - Add AnalyticsErrorBoundary wrapper
- `convex/aiGeneration.ts` - Add quiz generation event tracking
- `app/review/_components/*` - Add review session tracking
- `convex/questionsCrud.ts` - Add CRUD event tracking
- `.env.local` - Add SENTRY_DSN
- `.env.production` - Add SENTRY_DSN (via Vercel dashboard)
- `next.config.ts` - Configure Sentry webpack plugin
- `CLAUDE.md` - Document analytics patterns

### Environment Variables Required
```bash
# Sentry (add to Vercel dashboard)
SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"
SENTRY_AUTH_TOKEN="sntrys_xxx" # For source map upload
SENTRY_ORG="your-org"
SENTRY_PROJECT="scry"

# Vercel (already set automatically)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="auto-generated"
VERCEL_ENV="production|preview|development"
```

### Testing Checklist
- [ ] Sentry captures frontend errors with stack traces
- [ ] Sentry captures backend (Convex) errors
- [ ] Source maps show TypeScript code (not compiled JS)
- [ ] Quiz generation events tracked (start/complete)
- [ ] Review session events tracked (start/complete/abandon)
- [ ] Question CRUD events tracked (create/edit/delete/archive)
- [ ] Email alerts received for test errors
- [ ] PII redaction working (no emails, user IDs in errors)
- [ ] Analytics wrapper handles missing SDK gracefully
- [ ] No performance regression (Lighthouse CI passing)

## Success Metrics

**Immediate (Week 1):**
- Errors appearing in Sentry dashboard
- Custom events visible in Vercel Analytics
- Zero production errors from analytics code itself

**Short-term (Month 1):**
- 5-10 unique errors identified and fixed
- Understand which features are most used
- Email alerts configured and tested

**Long-term (Quarter 1):**
- Reduced time to debug user-reported issues (stack traces)
- Data-driven feature prioritization (usage metrics)
- Proactive error detection (alerts catch issues before user reports)

## Next Steps

After completing this spec:
1. Run `/plan` to break down implementation tasks
2. Install Sentry via `npx @sentry/wizard@latest -i nextjs`
3. Create `lib/analytics.ts` wrapper module
4. Add event tracking to quiz generation flow
5. Test error reporting with preview deployment
6. Configure email alerts in Sentry dashboard
7. Document patterns in `CLAUDE.md`
