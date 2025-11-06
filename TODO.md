# TODO: Vercel Analytics and Observability

## Context
- **Architecture**: Minimal Enhancement - leverage existing Vercel Analytics + add Sentry free tier
- **Key Modules**: Analytics wrapper, Sentry integration, Error boundary, Event tracking hook
- **Patterns**: Follow existing logger.ts (PII redaction), ConvexErrorBoundary (error UX), use-review-flow.ts (React hooks)
- **Cost**: $0/month (Sentry free tier, existing Vercel plan)

## Implementation Tasks

### Phase 1: Core Infrastructure (Week 1)

- [x] **Install and configure Sentry SDK**
  ```
  Work Log:
  - Added shared redaction-aware Sentry configuration module consumed by all runtimes.
  - Generated client/server/edge bootstrap files and wired Next.js to upload source maps via plugin.
  - Updated environment template with new Sentry keys; linted to confirm integration compiles.
  ```
  ```
  Files:
    - package.json (add @sentry/nextjs dependency)
    - sentry.client.config.ts (create)
    - sentry.server.config.ts (create)
    - sentry.edge.config.ts (create)
    - next.config.ts (modify - add Sentry webpack plugin)
    - .env.local (add SENTRY_DSN, SENTRY_AUTH_TOKEN)

  Architecture: Install via `npx @sentry/wizard@latest -i nextjs`

  Success:
    - Sentry configs generated with PII redaction (reuse logger.ts patterns)
    - Environment variables added to .env.local
    - Sentry webpack plugin configured for source maps
    - Test error captured in development

  Test:
    - Trigger test error in dev: throw new Error('Sentry test')
    - Verify error appears in Sentry dashboard with stack trace
    - Verify PII redaction working (no emails in error context)

  Dependencies: None (can start immediately)

  Module Boundary:
    - Interface: Auto-capture via SDK, manual Sentry.captureException()
    - Hides: Breadcrumb collection, source map upload, release tracking

  Time: 1.5-2h
  ```

- [x] **Create centralized analytics wrapper module**
  ```
  Files:
    - lib/analytics.ts (create)
    - lib/analytics.test.ts (create)

  Architecture: Single module wrapping Vercel Analytics + Sentry

  Interface:
    export function trackEvent(name: string, properties?: Record<string, string | number | boolean>): void
    export function reportError(error: Error, context?: Record<string, unknown>): void
    export function setUserContext(userId: string, metadata?: Record<string, string>): void

  Success:
    - trackEvent() wraps Vercel Analytics track() with environment checks
    - reportError() integrates with Sentry.captureException()
    - TypeScript types for event names (discriminated union)
    - No-op in test/development environments (configurable)
    - Graceful degradation if SDK not loaded

  Test:
    - Unit test: trackEvent in production vs development
    - Unit test: reportError with/without Sentry initialized
    - Unit test: graceful handling of missing SDK

  Pattern: Follow lib/logger.ts structure (environment detection, type safety)

  Dependencies: Install Sentry SDK first

  Module Boundary:
    - Interface: trackEvent(), reportError(), setUserContext()
    - Hides: Vercel Analytics API, Sentry API, environment detection, error serialization

  Time: 1h
  ```

- [x] **Create React hook for event tracking**
  ```
  Files:
    - hooks/use-track-event.ts (create)
    - hooks/use-track-event.test.ts (create)

  Architecture: React hook wrapping lib/analytics.ts

  Interface:
    export function useTrackEvent(): (name: string, properties?: EventProperties) => void

  Success:
    - Returns memoized tracking function
    - Automatically includes user context from auth
    - Environment checks built-in
    - TypeScript event name autocomplete

  Test:
    - Unit test: hook returns memoized function
    - Unit test: includes user context
    - Integration test: actually calls trackEvent()

  Pattern: Follow hooks/use-review-flow.ts (useCallback, memoization)

  Dependencies: lib/analytics.ts

  Module Boundary:
    - Interface: useTrackEvent() → tracking function
    - Hides: Memoization, environment checks, user context extraction

  Time: 45min
  ```

- [x] **Enhance error boundary with Sentry reporting**
  ```
  Files:
    - components/convex-error-boundary.tsx (modify)
    - components/convex-error-boundary.test.tsx (create)

  Architecture: Extend existing ConvexErrorBoundary

  Changes:
    - Import reportError from lib/analytics.ts
    - In componentDidCatch: call reportError(error, errorInfo)
    - Add user context via setUserContext
    - Preserve existing UX (no visual changes)

  Success:
    - Errors reported to Sentry with componentStack
    - User context included (userId if authenticated)
    - PII redaction working
    - Existing error UI unchanged

  Test:
    - Unit test: componentDidCatch calls reportError
    - Integration test: error appears in Sentry dashboard
    - Verify: error context includes component stack

  Pattern: Reuse logger.ts PII redaction for user context

  Dependencies: lib/analytics.ts

  Module Boundary:
    - Interface: React Error Boundary (unchanged)
    - Hides: Error reporting, user context, retry logic

  Time: 30min
  ```

### Phase 2: Event Tracking Integration (Week 1-2)

- [x] **Add quiz generation event tracking**
  ```
  Files:
    - convex/aiGeneration.ts:processJob (modify - lines 86-200)
    - convex/lib/logger.ts (check if analytics integration needed)

  Architecture: Track generation lifecycle events

  Events:
    - "Quiz Generation Started" (at job start)
    - "Quiz Generation Completed" (on success)
    - "Quiz Generation Failed" (on error)

  Properties:
    - jobId, userId, questionCount, provider (openai/google), duration

  Success:
    - Events visible in Vercel Analytics dashboard
    - Properties captured correctly
    - No impact to generation performance
    - Convex logger integration (optional)

  Test:
    - Run generation job in dev
    - Verify events in Vercel Analytics (may need production preview)
    - Check properties include all metadata

  Pattern: Follow existing convex/lib/logger.ts patterns

  Dependencies: lib/analytics.ts (for event types)

  Note: Convex actions run server-side, may need server-side track import

  Time: 1h
  ```

- [x] **Add review session event tracking**
  ```
  Files:
    - hooks/use-review-flow.ts (modify - add tracking to handlers)
    - components/review/review-mode.tsx (verify tracking points)

  Architecture: Track review flow lifecycle

  Events:
    - "Review Session Started" (when first question loads)
    - "Review Session Completed" (when queue empty)
    - "Review Session Abandoned" (on unmount before completion)

  Properties:
    - sessionId (generate UUID), questionsReviewed, duration

  Success:
    - Events tracked at correct lifecycle points
    - Abandoned sessions detected via useEffect cleanup
    - Session duration calculated accurately

  Test:
    - Start review → verify "Started" event
    - Complete review → verify "Completed" + questionsReviewed count
    - Leave page mid-review → verify "Abandoned" event

  Pattern: Follow hooks/use-review-flow.ts existing patterns

  Dependencies: hooks/use-track-event.ts

  Time: 1h
  ```

- [ ] **Add question CRUD event tracking**
  ```
  Files:
    - convex/questionsCrud.ts (modify - add to mutations)
    - convex/questionsBulk.ts (modify - add to bulk operations)

  Architecture: Track question management actions

  Events:
    - "Question Created" (saveGeneratedQuestions, createQuestion)
    - "Question Updated" (updateQuestion)
    - "Question Deleted" (softDelete)
    - "Question Archived" (archiveQuestions)
    - "Question Restored" (restoreQuestions)

  Properties:
    - questionId (or count for bulk), userId, source (manual/ai)

  Success:
    - All CRUD operations tracked
    - Bulk operations include count
    - No performance impact (async tracking)

  Test:
    - Create question → verify event
    - Archive multiple → verify count
    - Restore → verify event

  Pattern: Follow convex/lib/logger.ts server-side patterns

  Dependencies: Server-side analytics integration

  Note: May need to use Convex logger instead of direct Vercel Analytics

  Time: 1.5h
  ```

### Phase 3: Configuration & Testing (Week 2)

- [ ] **Configure Sentry email alerts**
  ```
  Files: N/A (Sentry dashboard configuration)

  Process:
    1. Navigate to Sentry dashboard → Alerts
    2. Create alert: "New error types" → email notification
    3. Create alert: "Error rate >10/hour" → email notification
    4. Configure throttling: max 1 email per 30 min
    5. Test alert delivery with intentional error

  Success:
    - Email received for new error type
    - Email includes stack trace link
    - Throttling prevents spam

  Test:
    - Trigger new error type in preview deployment
    - Wait for email (may take 5-10 min)
    - Verify email content helpful

  Dependencies: Sentry SDK installed, errors flowing to dashboard

  Time: 30min
  ```

- [ ] **Configure Vercel uptime checks**
  ```
  Files: N/A (Vercel dashboard configuration)

  Process:
    1. Navigate to Vercel → Monitoring → Checks
    2. Add check: /api/health → every 5 min
    3. Add check: / (homepage) → every 10 min
    4. Configure alert: email on failure
    5. Test by temporarily breaking endpoint

  Success:
    - Checks running every 5/10 min
    - Email alert on failure
    - Dashboard shows uptime %

  Test:
    - Temporarily return 500 from /api/health
    - Wait for alert email
    - Restore endpoint, verify recovery

  Dependencies: /api/health endpoint exists (already exists)

  Time: 20min
  ```

- [ ] **Create event schema documentation**
  ```
  Files:
    - docs/analytics-events.md (create)
    - lib/analytics.ts (update with event type definitions)

  Architecture: Document all tracked events

  Content:
    - Event name → purpose, properties, trigger point
    - TypeScript event name enum/union type
    - Example payloads
    - Privacy notes (what's excluded)

  Success:
    - All events documented
    - TypeScript types enforce schema
    - Examples show actual usage

  Test:
    - Docs match implementation
    - Types prevent typos in event names

  Pattern: Follow existing docs/ structure

  Dependencies: All event tracking implemented

  Time: 45min
  ```

- [ ] **Add analytics patterns to CLAUDE.md**
  ```
  Files:
    - CLAUDE.md (modify - add Analytics & Observability section)

  Content:
    ## Analytics & Observability

    **Event Tracking:** Use `useTrackEvent()` hook in components, `trackEvent()` in Convex
    **Error Reporting:** Automatic via ConvexErrorBoundary, manual via `reportError()`
    **Sentry Dashboard:** [link] - check daily for new errors
    **Vercel Analytics:** [link] - review weekly for usage trends

    **Privacy:** PII automatically redacted (emails, auth tokens, user IDs in URLs)
    **Cost:** Sentry free tier = 5k errors/month, Vercel Analytics included
    **Alerts:** Email notifications for new errors + uptime issues

  Success:
    - Documentation clear and actionable
    - Links to dashboards
    - Privacy/cost notes prominent

  Dependencies: All implementation complete

  Time: 20min
  ```

- [ ] **E2E test: error tracking flow**
  ```
  Files:
    - tests/e2e/error-tracking.test.ts (create)

  Architecture: Playwright test for error boundary + Sentry

  Test scenarios:
    - Trigger React error → verify error boundary UI shown
    - Click retry → verify error clears
    - Check Sentry dashboard API for error (via API key)

  Success:
    - Test passes in CI
    - Error boundary UX verified
    - Sentry integration confirmed

  Dependencies: All Phase 1 tasks complete

  Time: 1h
  ```

- [ ] **E2E test: event tracking flow**
  ```
  Files:
    - tests/e2e/analytics-events.test.ts (create)

  Architecture: Playwright test for custom events

  Test scenarios:
    - Generate quiz → verify "Started" and "Completed" events
    - Start review → verify "Review Session Started" event
    - Create question → verify "Question Created" event

  Success:
    - Tests pass in CI
    - Events captured in test environment
    - Properties validated

  Note: May need mock/stub for Vercel Analytics in tests

  Dependencies: All Phase 2 tasks complete

  Time: 1h
  ```

## Design Iteration Checkpoints

**After Phase 1 (Core Infrastructure):**
- Review module boundaries: Is analytics.ts doing too much? Should we split?
- Check coupling: Can we test without Sentry/Vercel Analytics SDKs?
- Extract patterns: Any reusable error context builders?

**After Phase 2 (Event Tracking):**
- Review interfaces: Are event names/properties consistent?
- Identify repetition: Any event tracking boilerplate to abstract?
- Plan refactoring: Should we create event builders/factories?

## Validation Checklist

**Before merging to main:**
- [ ] All Sentry errors show readable TypeScript stack traces (source maps working)
- [ ] PII redaction verified (no emails, auth tokens in error context)
- [ ] Custom events visible in Vercel Analytics dashboard
- [ ] Email alerts received for test errors
- [ ] Uptime checks operational
- [ ] Lighthouse CI passes (no performance regression)
- [ ] TypeScript compiles with no errors
- [ ] All E2E tests pass
- [ ] Documentation complete (CLAUDE.md + analytics-events.md)

## Environment Setup Checklist

- [ ] Sign up for Sentry free account
- [ ] Create Sentry project "scry"
- [ ] Copy SENTRY_DSN to .env.local
- [ ] Generate Sentry auth token for source maps
- [ ] Add SENTRY_DSN to Vercel env vars (production + preview)
- [ ] Add SENTRY_AUTH_TOKEN to Vercel env vars (production + preview)
- [ ] Verify NEXT_PUBLIC_VERCEL_ANALYTICS_ID set automatically

## Future Enhancements (BACKLOG.md)

These are explicitly OUT OF SCOPE for this PR but documented for future consideration:

- Genesis Lab experiment tracking (events for config runs, A/B comparisons)
- AI provider fallback tracking (when OpenAI → Google switch happens)
- Background job queue depth monitoring
- Review streak tracking (consecutive days)
- Session Replay (requires Sentry Team $26/mo upgrade)
- Custom dashboards (Genesis Lab metrics, engagement funnels)
- Performance marks/measures (question render time, AI streaming latency)

## Automation Opportunities

- **Sentry release tracking**: Auto-tag releases with git SHA in CI/CD
- **Alert threshold tuning**: Script to analyze error rates and suggest thresholds
- **Event schema validation**: Automated test that event payloads match docs
- **Cost monitoring**: Script to check Sentry event count approaching free tier limit
