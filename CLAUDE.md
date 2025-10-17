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

**Preview Limitation (Free Tier):**
- Preview deployments share PROD Convex backend
- Missing `GOOGLE_AI_API_KEY` in Convex prod breaks ALL environments
- No env isolation until Convex Pro ($25/mo)

**Variable Distribution:**
- Convex backend: `GOOGLE_AI_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`
- Vercel frontend: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `CLERK_*`

## Deployment Architecture

**Order:** Convex backend → Validation → Vercel frontend

**Automated (Recommended):**
```bash
vercel --prod  # Runs: npx convex deploy --cmd 'pnpm build'
```

**Manual/Hotfix:**
```bash
./scripts/deploy-production.sh  # Atomic with health checks
./scripts/check-deployment-health.sh  # Verify critical functions exist
```

**Schema Versioning:**
- Keep `convex/schemaVersion.ts` ↔ `lib/deployment-check.ts` synced
- Deploy backend first, then frontend
- Emergency bypass: `NEXT_PUBLIC_DISABLE_VERSION_CHECK=true`

## Background Job System

**Components:**
- `convex/generationJobs.ts` - Job CRUD/lifecycle
- `convex/aiGeneration.ts` - AI streaming with incremental saves
- `lib/constants/jobs.ts` - Config (max 3 concurrent/user)
- UI: BackgroundTasksBadge, BackgroundTasksPanel, GenerationTaskCard

**Lifecycle:** pending → processing → completed/failed/cancelled
**Cleanup:** Daily cron (3 AM UTC) removes completed (7d), failed (30d)

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
- `./scripts/validate-env-vars.sh` - Check env config
- `./scripts/check-deployment-health.sh` - Verify functions deployed

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
