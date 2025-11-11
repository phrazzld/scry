# CLAUDE.md

Operational guidance for Claude Code working in this repository.

## Core Operations

**Package Manager:** pnpm only (10.0+)
**Dev Setup:** `pnpm dev` (Next.js + Convex concurrently)
**Convex instances:** dev=amicable-lobster-935, prod=uncommon-axolotl-639

## Critical Architecture Rules

**Backend-First Workflow (MANDATORY):**
1. Implement mutation/query in `convex/` with args schema
2. Wait for `npx convex dev` → "Convex functions ready!"
3. Then import `api` in frontend
4. Never frontend-first (causes runtime "function not found")

**Mutation Pairs (Reversible Ops):**
- Archive ↔ Unarchive | Soft Delete ↔ Restore | Hard Delete (irreversible)
- Both mutations MUST exist before implementing UI
- Use atomic validation via `validateBulkOwnership()` helper

**Confirmation UX:**
- Reversible → `useUndoableAction()` (soft delete, archive)
- Irreversible → `useConfirmation()` with `requireTyping`

## Pure FSRS Philosophy (NON-NEGOTIABLE)

**Zero Tolerance Rules:**
- ❌ No daily limits (300 due = show 300)
- ❌ No artificial interleaving/comfort features
- ❌ No "improvements" to algorithm
- ✅ Pure FSRS calculations only
- ✅ Natural consequences teach sustainable habits

## Environment Variables (CRITICAL)

**Vercel ≠ Convex:** Separate systems, must configure BOTH

**Convex Pro Architecture:**
- **Production**: Uses `prod:` deploy key → uncommon-axolotl-639 backend
- **Preview**: Uses `preview:` deploy key → branch-named isolated backends (e.g., `phaedrus:scry:feature-vector-embeddings-foundation`)
- Each preview deployment gets its own isolated Convex backend with fresh data
- Deploy key TYPE determines backend routing automatically
- `NEXT_PUBLIC_CONVEX_URL` is auto-set by `npx convex deploy` (do not manually configure)

**Variable Distribution:**
- **Convex backend env vars**: `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `AI_REASONING_EFFORT`, `NEXT_PUBLIC_APP_URL`
  - Set in Convex dashboard → Settings → Environment Variables
  - Must be configured separately for production and preview backends
- **Vercel env vars**: `CONVEX_DEPLOY_KEY` (prod/preview), `CLERK_*`, `OPENAI_API_KEY` (for Convex deployments)
  - Production: `prod:` key for production backend
  - Preview: `preview:` key for isolated preview backends
  - `OPENAI_API_KEY` needed in Vercel for automated deployments that trigger Convex backend deploys

### Environment Variable Loading (CRITICAL)

**Critical**: `.env.production` uses Vercel format (bare key=value), NOT bash export syntax.

**❌ WRONG**:
```bash
source .env.production  # Silently fails, no error output
npx convex run migrations:xyz
# ^ Deploys to DEV (local context), not PROD
```

**✅ CORRECT**:
```bash
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)
npx convex run migrations:xyz
# ^ Explicitly targets PROD via env var
```

**Why this matters**:
- Bash `source` returns exit code 0 even if file is invalid
- Convex CLI defaults to local `.convex/config` if CONVEX_DEPLOY_KEY unset
- No warning that deployment target switched

**Safeguard**: Use `./scripts/deploy-production.sh` (handles env vars correctly) instead of manual commands.

## Deployment Architecture

**Order:** Convex backend → Validation → Vercel frontend

**Automated (Recommended):**
```bash
vercel --prod           # Production: Deploys to uncommon-axolotl-639
vercel                  # Preview: Creates branch-named isolated backend
```

Both run: `npx convex deploy --cmd 'pnpm build'`
- Deploy key TYPE (`prod:` vs `preview:`) determines target backend
- `NEXT_PUBLIC_CONVEX_URL` is auto-injected by Convex
- No manual backend URL configuration needed

**Manual/Hotfix:**
```bash
./scripts/deploy-production.sh  # Atomic with health checks
./scripts/check-deployment-health.sh  # Verify critical functions exist
```

### Build Script Usage (CRITICAL)

**Context-Specific Build Commands:**

The project has three build scripts for different contexts. Using the wrong one causes deployment failures.

| Command | Context | Deploys Convex? | Usage |
|---------|---------|-----------------|-------|
| `pnpm build` | CI/Vercel builds | ❌ No | **Used by** `vercel-build.sh` via `--cmd` flag<br>**Never run directly** (Convex already deployed by wrapper) |
| `pnpm build:local` | Local testing | ✅ Yes (dev) | Testing production builds locally<br>`npx convex deploy && next build` |
| `pnpm build:prod` | Manual production | ✅ Yes (atomic) | Standalone production build<br>`npx convex deploy --cmd 'next build'` |
| `pnpm dev` | Development | ✅ Yes (watch) | Normal development with hot reload<br>`concurrently "next dev" "convex dev"` |

**Why multiple build commands?**

The base `build` script is called by `vercel-build.sh` via the `--cmd` flag:
```bash
# vercel-build.sh orchestrates the deployment
npx convex deploy --cmd 'pnpm build'
```

This ensures atomicity: Convex functions only deploy if frontend build succeeds, preventing mismatched versions.

**Common mistake**: Running `pnpm build` directly and expecting Convex to deploy
- **Result**: Next.js builds but Convex functions not deployed
- **Fix**: Use `pnpm build:local` for local production builds OR use Vercel/deploy-production.sh for actual deployments

**When to use each command:**

- **Development** → `pnpm dev` (always)
- **Local production testing** → `pnpm build:local` (deploys to dev backend, then builds)
- **CI/Vercel builds** → Automatic (vercel-build.sh handles everything)
- **Manual production deploy** → `./scripts/deploy-production.sh` (uses `build:prod` internally)
- **Never run** → `pnpm build` directly (only for use by vercel-build.sh)

**Schema Versioning:**
- Keep `convex/schemaVersion.ts` ↔ `lib/deployment-check.ts` synced
- Deploy backend first, then frontend
- Emergency bypass: `NEXT_PUBLIC_DISABLE_VERSION_CHECK=true`

**Preview Deployment Lifecycle:**
- Each Git branch gets isolated Convex backend (e.g., `phaedrus:scry:feature-branch-name`)
- Fresh database with no production data
- Automatically cleaned up when branch/deployment is deleted
- Requires Convex Pro ($25/mo)

### CI vs Deployment Separation (CRITICAL)

**GitHub Actions CI** (`.github/workflows/ci.yml`):
- ✅ Quality: lint, typecheck, security audit
- ✅ Tests: unit tests with coverage
- ✅ Build: verify `pnpm build` succeeds
- ❌ NO deployment (Vercel handles this)

**Vercel Deployments**:
- **Preview**: Auto-deploys on PR push
  - Uses `CONVEX_DEPLOY_KEY` (Preview environment)
  - Creates isolated Convex backend (branch-named)
  - Runs `./scripts/vercel-build.sh` → `npx convex deploy --cmd 'pnpm build'`
  - Each PR gets unique: `https://phaedrus-scry-{branch}.convex.cloud`

- **Production**: Auto-deploys on merge to master
  - Uses `CONVEX_DEPLOY_KEY` (Production environment)
  - Deploys to: `https://uncommon-axolotl-639.convex.cloud`
  - Same script: `vercel-build.sh`

**Key Insight**: Deploy key TYPE (preview: vs prod:) determines target backend automatically.

### Deployment Resilience (NEW: 2025-11-10)

**Retry Logic**: `vercel-build.sh` now includes automatic retry with exponential backoff

**Configuration:**
- **Max Attempts**: 3
- **Backoff Strategy**: Exponential (1s → 2s → 4s)
- **Total Max Delay**: ~7 seconds
- **Handles**: Transient Convex API failures (500, 503 errors)

**Example Output:**
```
🔄 Deployment attempt 1/3...
⚠️  Attempt 1 failed (exit code: 1)
⏳ Retrying in 1s...
🔄 Deployment attempt 2/3...
✅ Deployment succeeded on attempt 2
```

**Rationale:**
- Convex experienced elevated instability in November 2025 (see status.convex.dev)
- Retry logic handles transient API outages without manual intervention
- Reduces false-positive deployment failures
- Industry best practice for distributed systems

**When All Retries Fail:**
1. Check https://status.convex.dev for active incidents
2. Verify `CONVEX_DEPLOY_KEY` is valid and not corrupted
3. Wait for Convex service recovery (typical: 10-30 minutes)
4. Manually retry via GitHub Actions "Re-run failed jobs"

**Documentation**: See `docs/operations/deployment-resilience.md` for detailed runbook

### Vercel Environment Variable Setup

**Must be configured in Vercel Dashboard** (Settings → Environment Variables):

| Variable | Preview | Production | Notes |
|----------|---------|------------|-------|
| `CONVEX_DEPLOY_KEY` | `preview:phaedrus:scry\|...` | `prod:uncommon-axolotl-639\|...` | **Different keys per environment** |
| `GOOGLE_AI_API_KEY` | ✓ Same value | ✓ Same value | From Convex Dashboard |
| `CLERK_SECRET_KEY` | ✓ Same value | ✓ Same value | From Clerk Dashboard |
| `CLERK_WEBHOOK_SECRET` | ✓ Same value | ✓ Same value | From Clerk Dashboard |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ Same value | ✓ Same value | From Clerk Dashboard |
| `NEXT_PUBLIC_CONVEX_URL` | ❌ **Auto-set by Convex** | ❌ **Auto-set by Convex** | Do not configure manually |

**Setup Guide**: See `docs/operations/vercel-environment-setup.md` for detailed instructions.

### Deployment Safeguards

**Pre-Deployment Checklist**:
- [ ] Export CONVEX_DEPLOY_KEY: `echo $CONVEX_DEPLOY_KEY | grep "^prod:"`
- [ ] Verify target: `echo $CONVEX_DEPLOY_KEY | cut -d: -f2 | cut -d'|' -f1`
- [ ] Expected output: `uncommon-axolotl-639` (production)
- [ ] Tests passing: `pnpm test && pnpm test:contract`
- [ ] Health check: `./scripts/check-deployment-health.sh`

**Common Failure Modes**:
1. **"Migration says 690 migrated but data still broken"**
   - Root cause: Deployed to DEV instead of PROD (wrong environment)
   - Diagnosis: Check deployment URL in migration logs
   - Fix: `export CONVEX_DEPLOY_KEY=<prod-key>`, re-run migration
   - Prevention: Use `./scripts/run-migration.sh` (validates target)

2. **"TypeScript compiles but migration doesn't detect fields"**
   - Root cause: TypeScript optimizes away property checks for removed schema fields
   - Bad: `if (doc.field !== undefined)` (compile-time check, gets removed)
   - Good: `if ('field' in (doc as any))` (runtime property check)
   - Prevention: Follow migration development guide

3. **"Functions deployed successfully but not available"**
   - Root cause: TypeScript compilation errors preventing actual deployment
   - Diagnosis: Check `pnpm tsc --noEmit` for errors
   - Fix: Resolve compilation errors, redeploy
   - Prevention: Pre-deployment checklist includes tests

## Background Job System

**Components:**
- `convex/generationJobs.ts` - Job CRUD/lifecycle
- `convex/aiGeneration.ts` - AI streaming with incremental saves
- `lib/constants/jobs.ts` - Config (max 3 concurrent/user)
- UI: BackgroundTasksBadge, BackgroundTasksPanel, GenerationTaskCard

**Lifecycle:** pending → processing → completed/failed/cancelled
**Cleanup:** Daily cron (3 AM UTC) removes completed (7d), failed (30d)

## AI Provider Configuration

**Production Provider:** OpenAI GPT-5 mini with high reasoning effort
**Fallback Provider:** Google Gemini 2.5 Flash (kept for rollback capability)

### Multi-Provider Architecture

**Provider Selection (Environment-Driven):**
- Set via `AI_PROVIDER` env var: `openai` (default) or `google`
- Production uses OpenAI for superior question quality via reasoning models
- Google provider kept configured for instant rollback if needed

**Implementation Pattern:**
- **Shared initializer** – `convex/lib/aiProviders.ts` exports `initializeProvider()` which encapsulates env reads, diagnostics, and Google/OpenAI client creation. Both `convex/aiGeneration.ts` and `convex/lab.ts` import this helper so provider selection lives in one place.
- **ProviderClient contract** – Callers receive `{ provider, model?, openaiClient?, diagnostics }`, hiding SDK-specific plumbing while keeping explicit dependencies.
- **Contract tests** – `convex/lib/aiProviders.test.ts` mocks each SDK to verify happy-path initialization, missing key failures, and unsupported provider guards.

```ts
// ProviderClient interface
interface ProviderClient {
  provider: 'google' | 'openai';
  model?: LanguageModel;           // Present for Google (Vercel AI SDK models)
  openaiClient?: OpenAI;           // Present for OpenAI Responses API usage
  diagnostics: SecretDiagnostics;  // Sanitized metadata for logging
}
```

> When adding Anthropic or other providers, extend `initializeProvider()` and its tests; downstream modules stay untouched if the ProviderClient surface remains stable.

### OpenAI Reasoning Models

**What are reasoning models?**
- GPT-5, GPT-5-mini, GPT-5-nano perform internal chain-of-thought before responding
- Invisible "reasoning tokens" billed as output tokens (~30-50% of total)
- Superior quality for structured output, format adherence, context injection

**Reasoning Parameters:**
```typescript
reasoning_effort: 'minimal' | 'low' | 'medium' | 'high'
  // Controls internal reasoning token budget
  // Production uses 'high' for maximum question quality

verbosity: 'low' | 'medium' | 'high'
  // Controls output conciseness (not reasoning depth)
  // Production uses 'medium' for balanced explanations

max_completion_tokens: number
  // TOTAL tokens including invisible reasoning tokens
  // Production uses 65536 (model default) for long-form generation
```

**Prompt Optimization for Reasoning Models:**
- ✅ Direct task descriptions with clear examples
- ✅ Explicit JSON schema requirements
- ❌ "Think step by step" (redundant - model does this internally)
- ❌ "Explain your reasoning" (wastes output tokens)

### Configuration Reference

**Required Environment Variables:**

```bash
# Convex Backend (set via: npx convex env set VAR value --prod)
OPENAI_API_KEY=sk-proj-...              # OpenAI API key
AI_PROVIDER=openai                       # Provider selection (openai/google)
AI_MODEL=gpt-5-mini                      # Model name (gpt-5, gpt-5-mini, gemini-2.0-flash-exp)
AI_REASONING_EFFORT=high                 # Reasoning budget (minimal/low/medium/high) - openai only
AI_VERBOSITY=medium                      # Output detail (low/medium/high) - openai only

# Kept for rollback
GOOGLE_AI_API_KEY=AIzaSy...             # Google AI key

# Vercel (set via: vercel env add OPENAI_API_KEY production)
OPENAI_API_KEY=sk-proj-...              # Needed for Convex deployments during Vercel build
```

**Configuration Locations:**
- `.env.local` - Local development (both Next.js and Convex via `npx convex dev`)
- `.env.production` - Production reference (not directly used, copied to Convex/Vercel)
- Convex dashboard - Production backend env vars
- Vercel dashboard - Build-time env vars (for Convex deployments)

### Cost Analysis

**OpenAI GPT-5-mini (high reasoning):**
- Input: $0.25/M tokens
- Output: $2.00/M tokens (includes reasoning tokens)
- Per generation: ~$0.0163 (avg 4k input, 2.5k output + 2k reasoning)

**Google Gemini 2.5 Flash:**
- Input: $0.10/M tokens
- Output: $0.40/M tokens
- Per generation: ~$0.0021 (avg 4k input, 2.5k output)

**Cost Increase:** ~8x higher for OpenAI
**Justification:** Reasoning models deliver superior:
- Format adherence (fewer schema validation errors)
- Context injection (better source attribution in questions)
- Deduplication (fewer redundant questions)
- Overall question quality (measured in Genesis Lab)

### Rollback Procedures

**Instant rollback to Google Gemini:**
```bash
# Production
npx convex env set AI_PROVIDER "google" --prod

# Verify
npx convex env list --prod | grep AI_PROVIDER
```

**No code deployment needed** - provider switch is environment-driven

**When to rollback:**
- OpenAI API outage (check status.openai.com)
- Cost concerns (monitor usage in OpenAI dashboard)
- Quality regression (compare Genesis Lab results)

### Genesis Laboratory Testing

**PROD Baseline Config:**
- **Source of Truth:** Dynamically loaded from `convex/lib/productionConfig.ts:getProductionConfig()`
- **Reads from:** Convex environment variables (same vars production uses)
- **Current values:** See Convex dashboard → Settings → Environment Variables
  - `AI_PROVIDER` - Provider selection (openai/google)
  - `AI_MODEL` - Model name (gpt-5-mini, gpt-5, gemini-2.0-flash-exp)
  - `AI_REASONING_EFFORT` - Reasoning budget (minimal/low/medium/high)
  - `AI_VERBOSITY` - Output detail (low/medium/high)

**Why Dynamic Config?**
- **Prevents divergence:** Lab always tests exactly what production uses
- **No static constants:** Can't drift between code and runtime
- **Instant updates:** Change env var → both Lab and production update
- **Impossible to lie:** Testing in Lab = testing actual production behavior

**Comparing Providers:**
1. Create test input in Genesis Lab (e.g., "Nicene Creed")
2. PROD config shows current production settings (dynamically loaded)
3. Create custom config with `provider: "google"` (comparison)
4. Run both configs on same input
5. Compare: format adherence, context injection, deduplication, reasoning token usage

### References

- **Production config query:** `convex/lib/productionConfig.ts` - Single source of truth
- **Type definitions:** `types/lab.ts` - Discriminated unions for provider configs
- **Executor:** `convex/lab.ts` - Genesis Lab multi-phase executor
- **Production pipeline:** `convex/aiGeneration.ts` - Background question generation
- **Prompt templates:** `convex/lib/promptTemplates.ts` - Learning science prompt
- **UI clients:** `app/lab/_components/unified-lab-client.tsx`, `app/lab/configs/_components/config-manager-page.tsx`

## Convex Real-Time (Zero Polling)

**Built-in reactivity:** WebSockets auto-update queries when data changes
**What we removed:** Custom events, aggressive polling
**What we kept:** 60s polling ONLY for time-based conditions (`nextReview` due checks)

## Modular Convex Architecture

**Backend modules:**
- `questionsCrud.ts` - CRUD ops (create, update, soft delete, restore)
- `questionsBulk.ts` - Atomic bulk ops (archive, delete, restore, permanent delete)
- `questionsInteractions.ts` - Answer recording + auto FSRS scheduling
- `questionsLibrary.ts` - Browse/filter/stats queries
- `spacedRepetition.ts` - Review queue (Pure FSRS, no modifications)
- `generationJobs.ts` + `aiGeneration.ts` - Background AI generation
- `lib/validation.ts` - Shared atomic validation helpers

**Validation pattern:** All bulk ops use `validateBulkOwnership()` to prevent partial failures

## Testing & Scripts

**Test stack:** Vitest (unit), Playwright (E2E)
```bash
pnpm test           # Unit tests
pnpm test:coverage  # With coverage report
pnpm test:contract  # API contract validation
```

**Utility scripts:**
- `./scripts/check-deployment-health.sh` - Verify Convex functions deployed
- `convex/health.ts` - Functional health checks (GOOGLE_AI_API_KEY validation, env vars)

## Analytics & Observability

**Architecture:** Vercel Analytics (user behavior) + Sentry (error tracking)
**Cost:** $0/month (Sentry free tier 5k errors/month, Analytics included in Vercel)

### Setup (2025 Best Practice)

**⭐ Sentry Vercel Integration (Recommended):**
- Install: https://vercel.com/integrations/sentry
- Auto-creates: `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- Benefits: Eliminates release ID mismatch, automatic source map uploads, zero manual token management
- Status: Uses modern config options (`hideSourceMaps`, `disableLogger`, `automaticVercelMonitors`)

**Session Replay (Configured):**
- Defaults: 0% routine sessions, 100% of error sessions
- Optional: Set `SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.05` for 5% routine replay capture
- Captures user interactions before errors for debugging

**Next.js Configuration:**
- Source maps: Hidden in production (`hideSourceMaps: true`)
- Logger: Tree-shaken in bundles (`disableLogger: true`)
- Cron monitoring: Auto-tracked via `automaticVercelMonitors: true`

### Event Tracking

**Frontend (React):**
```typescript
import { useTrackEvent } from '@/hooks/use-track-event';

function MyComponent() {
  const track = useTrackEvent(); // Auto-includes user context from Clerk

  track('Quiz Generation Started', {
    jobId: 'k17abc',
    questionCount: 10,
    provider: 'openai'
  });
}
```

**Backend (Convex):**
```typescript
import { trackEvent } from '../lib/analytics';

export const myMutation = mutation({
  handler: async (ctx, args) => {
    trackEvent('Question Created', {
      questionId: result._id,
      userId: ctx.auth.userId,
      source: 'ai'
    });
  }
});
```

**Event Schema:** All events documented in `docs/analytics-events.md`
**Type Safety:** TypeScript autocomplete for event names + properties via discriminated unions

### Error Reporting

**Automatic capture:**
- All unhandled React errors via `ConvexErrorBoundary`
- All Next.js API/middleware errors via instrumentation.ts
- Source maps uploaded automatically (readable stack traces)

**Manual capture:**
```typescript
import { reportError } from '@/lib/analytics';

try {
  await riskyOperation();
} catch (error) {
  reportError(error, {
    context: 'payment-processing',
    userId: user.id
  });
  throw error;
}
```

**PII Protection:** Automatic redaction of emails, auth tokens, sensitive headers

### Dashboard Links

**Sentry:** https://sentry.io/organizations/[your-org]/projects/scry/
- View: Errors, stack traces, user context
- Alerts: Configured for new error types + high error rate
- Retention: 90 days (free tier)

**Vercel Analytics:** https://vercel.com/[your-team]/scry/analytics
- View: Custom events, Web Vitals (CLS/LCP/FCP/FID/TTFB)
- Retention: 13 months

### Production Monitoring

**Daily checks:**
1. Sentry dashboard for new error types (should be ~0-5 errors/day normally)
2. Check Sentry quota usage (Settings → Subscription, stay under 166 errors/day)
3. Vercel Analytics for traffic anomalies

**Alert configuration:**
- Email on new error types in production
- Email on error rate >10/hour
- Email on crash-free sessions <98%

### Troubleshooting

**Errors not appearing in Sentry:**
- Verify `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` set in Vercel env vars
- Check `SENTRY_AUTH_TOKEN` configured (required for source maps)
- Ensure `NEXT_PUBLIC_DISABLE_SENTRY !== 'true'`
- Wait ~30 seconds for events to appear

**Minified stack traces (unreadable):**
- Vercel Integration not installed or source maps not uploading
- If manual setup: Missing `SENTRY_AUTH_TOKEN` or token lacks required scopes
- Solution: Install Vercel Integration (recommended) or verify auth token
- Check Sentry → Settings → Source Maps for recent uploads

**Events not in Vercel Analytics:**
- Only production/preview environments send events (dev is disabled)
- Wait 5-10 minutes for dashboard to update
- Check `NEXT_PUBLIC_DISABLE_ANALYTICS !== 'true'`

**High Sentry quota usage:**
- Lower `SENTRY_TRACES_SAMPLE_RATE` from 0.1 to 0.05 (5%)
- Add ignore rules in Sentry dashboard for noisy non-critical errors
- Review if upgrade needed ($26/mo Team = 50k errors/month)

**Sensitive data in logs:**
- All emails auto-redacted to `[EMAIL_REDACTED]`
- Sensitive headers (auth, cookies, API keys) automatically filtered
- If leak detected, add pattern to `lib/analytics.ts` sanitization

### Alert Configuration (Manual Setup via Sentry UI)

**Configure alerts manually in Sentry dashboard:**
1. Navigate to: Sentry → Alerts → Create Alert
2. **High Error Rate:**
   - Type: "Number of Errors"
   - Threshold: > 10 events in 1 hour
   - Environment: production
   - Action: Email notification
3. **Release Health:**
   - Type: "Crash Free Sessions"
   - Threshold: < 98% in 1 hour
   - Environment: production
   - Action: Email notification

**List configured alerts:**
```bash
# Via sentry-cli
pnpm exec sentry-cli alerts list -o misty-step -p scry

# Via API
curl "https://sentry.io/api/0/projects/misty-step/scry/rules/" \
  -H "Authorization: Bearer $SENTRY_API_TOKEN"
```

### Cost Monitoring

**Sentry Free Tier:** 5,000 errors/month = ~166 errors/day
- Check usage: Sentry → Settings → Subscription
- Approaching limit? Lower sample rates or add ignore rules

**Vercel Analytics:** Included in current plan, no additional cost

### References

- Event schema: `docs/analytics-events.md`
- Operational runbook: `docs/observability-runbook.md`
- Implementation: `lib/analytics.ts`, `lib/sentry.ts`
- Testing: Visit `/test-error` in preview (dev only, triggers test error)

## Database Bandwidth Optimization

**Context:** Convex Starter plan = 1 GB/month. Anki-scale collections (10k+ cards) were hitting 640 MB/day.

**Root Cause:** O(N) queries, reactive re-runs, unbounded fetches. See `docs/adr/0001-optimize-bandwidth-for-large-collections.md` for full analysis.

### Anti-Patterns (AVOID)

❌ **Unbounded `.collect()` on user-scoped queries:**
```typescript
// BAD: Fetches ALL user's questions (could be 10,000+)
const questions = await ctx.db
  .query('questions')
  .withIndex('by_user', q => q.eq('userId', userId))
  .collect();
```

❌ **Client-side filtering after over-fetching:**
```typescript
// BAD: Fetches 2x, filters in memory
const questions = await ctx.db
  .query('questions')
  .take(limit * 2)
  .filter(q => !q.deletedAt);
```

❌ **Reactive O(N) calculations:**
```typescript
// BAD: 10k docs read on every review mutation
export const getUserStats = query({
  handler: async (ctx) => {
    const allCards = await ctx.db.query('questions').collect();
    return { total: allCards.length };
  }
});
```

### Best Practices (USE)

✅ **Limit fetches with `.take(limit)`:**
```typescript
// GOOD: Fetches exactly what's needed
const interactions = await ctx.db
  .query('interactions')
  .withIndex('by_user_question', q =>
    q.eq('userId', userId).eq('questionId', questionId)
  )
  .order('desc')
  .take(10); // FSRS only needs recent trend
```

✅ **DB-level filtering with compound indexes:**
```typescript
// GOOD: Uses by_user_active index [userId, deletedAt, archivedAt]
const questions = await ctx.db
  .query('questions')
  .withIndex('by_user_active', q =>
    q.eq('userId', userId)
     .eq('deletedAt', undefined)
     .eq('archivedAt', undefined)
  )
  .take(limit);
```

✅ **Incremental counters for O(1) stats:**
```typescript
// GOOD: Single document read instead of 10k
const stats = await ctx.db
  .query('userStats')
  .withIndex('by_user', q => q.eq('userId', userId))
  .first();

// Update incrementally in mutations
await updateStatsCounters(ctx, userId, {
  totalCards: 1,
  newCount: 1
});
```

✅ **Index ordering instead of in-memory sorting:**
```typescript
// GOOD: Uses index ordering + take
const jobs = await ctx.db
  .query('generationJobs')
  .withIndex('by_user_status', q => q.eq('userId', userId))
  .order('desc') // Sorted by createdAt (in index)
  .take(limit);
```

### Implementation Checklist

When writing new Convex queries:

1. **Scope check:** Will this query scale to 10k+ documents?
2. **Limit check:** Does it use `.take(limit)` or have bounded size?
3. **Index check:** Does filtering happen at DB level (index) or client (`.filter()`)?
4. **Reactivity check:** If called from reactive query, does it re-run on every mutation?
5. **Counter check:** Should this be an incremental counter instead of calculation?

### Bandwidth Budget

**Starter plan limits:**
- 1 GB/month = 33 MB/day
- ~10,000 documents/day (at 3 KB/doc average)

**Per-review targets:**
- Question fetch: 1 doc
- Interaction history: 10 docs (not 50+)
- Stats update: 1 doc (not 10,000)
- **Total: ~12 docs/review** (within budget for 200 reviews/day)

### Monitoring

**Drift detection:** Daily cron (`userStats:reconcileUserStats`) samples 100 users, auto-corrects drift >5 cards

**Health check:** `./scripts/check-deployment-health.sh` verifies:
- `userStats` table exists
- Compound indexes deployed (`by_user_active`, `by_user_state`)

### Reference

- **ADR:** `docs/adr/0001-optimize-bandwidth-for-large-collections.md`
- **Migration:** `convex/migrations.ts:initializeUserStats`
- **Reconciliation:** `convex/userStats.ts:reconcileUserStats`
- **Helpers:** `convex/lib/userStatsHelpers.ts`

## Migration Development Patterns

### Required Components

Every migration MUST include:

1. **Dry-run support**:
   ```typescript
   args: {
     dryRun: v.optional(v.boolean()),
   }
   ```

2. **Diagnostic query** (same file):
   ```typescript
   export const <migrationName>Diagnostic = query({
     args: {},
     handler: async (ctx) => {
       // Return count of records that still need migration
       const needsMigration = await ctx.db
         .query('table')
         .filter(q => 'deprecatedField' in q)
         .take(1);
       return { count: needsMigration.length };
     }
   });
   ```

3. **Runtime property checks** (not TypeScript types):
   ```typescript
   // ❌ WRONG: Compiler optimizes away (type erasure)
   if (doc.deprecatedField !== undefined)

   // ✅ CORRECT: Runtime check
   if ('deprecatedField' in (doc as any))
   ```

4. **Environment logging**:
   ```typescript
   migrationLogger.info('Migration started', {
     dryRun,
     // Deployment context logged automatically via createLogger
   });
   ```

5. **Batch processing** (for large datasets >500 records):
   ```typescript
   for (const batch of chunks(allRecords, 100)) {
     // Process batch
     migrationLogger.info(`Batch processed: ${stats.totalProcessed}`);
   }
   ```

### 3-Phase Schema Removal Pattern

When removing a field from schema, use this sequence to avoid schema validation errors:

```bash
# Phase 1: Make field optional (backwards-compatible)
# Edit convex/schema.ts: fieldName: v.string() → v.optional(v.string())
git commit -m "temp: make field optional for migration"
./scripts/deploy-production.sh

# Phase 2: Run migration on production
./scripts/run-migration.sh <migrationName> production
# Verify: npx convex run migrations:<migrationName>Diagnostic
# Should return: { count: 0 }

# Phase 3: Remove field from schema (pristine state)
# Edit convex/schema.ts: Remove fieldName line entirely
git commit -m "feat: remove field permanently - pristine schema"
./scripts/deploy-production.sh
```

### Testing Workflow

```bash
# 1. Test in development
export CONVEX_DEPLOY_KEY=dev:amicable-lobster-935|...
npx convex run migrations:<name> --args '{"dryRun":true}'
# Review output: "Would update X records"

npx convex run migrations:<name>
# Verify: "Successfully updated X records"

npx convex run migrations:<name>Diagnostic
# Should return: { count: 0 }

# 2. Deploy to production (with safeguards)
./scripts/run-migration.sh <name> production
# Script enforces: dry-run → manual approval → actual migration → verification
```

### Anti-Patterns

❌ **Testing migration by deploying schema change first**
- Schema validation will reject existing data
- Forces emergency rollback
- **Always** run migration BEFORE removing field from schema

❌ **Using TypeScript property checks for runtime data**
```typescript
// BAD: Gets optimized away at compile time
if (question.topic !== undefined) { ... }

// GOOD: Runtime property existence check
if ('topic' in (question as any)) { ... }
```

❌ **Using `.filter()` after `.collect()` for migrations**
- Fetches ALL records (bandwidth explosion for 10k+ items)
- **Instead**: Use compound indexes or `.take()` with batching

❌ **No dry-run or diagnostic queries**
- Can't preview changes before running
- No verification that migration completed
- **Always** implement both for production migrations
