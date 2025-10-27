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
- **Convex backend env vars**: `GOOGLE_AI_API_KEY`, `NEXT_PUBLIC_APP_URL`
  - Set in Convex dashboard → Settings → Environment Variables
  - Must be configured separately for production and preview backends
- **Vercel env vars**: `CONVEX_DEPLOY_KEY` (prod/preview), `CLERK_*`
  - Production: `prod:` key for production backend
  - Preview: `preview:` key for isolated preview backends

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

**Schema Versioning:**
- Keep `convex/schemaVersion.ts` ↔ `lib/deployment-check.ts` synced
- Deploy backend first, then frontend
- Emergency bypass: `NEXT_PUBLIC_DISABLE_VERSION_CHECK=true`

**Preview Deployment Lifecycle:**
- Each Git branch gets isolated Convex backend (e.g., `phaedrus:scry:feature-branch-name`)
- Fresh database with no production data
- Automatically cleaned up when branch/deployment is deleted
- Requires Convex Pro ($25/mo)

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
