# TODO: Database Bandwidth Optimization for Anki-Scale Collections

**Context:** Users with 10k+ cards hitting Starter plan bandwidth limits (1 GB/month). Root causes: (1) `.collect()` on unbounded queries, (2) reactive query re-runs on every card change, (3) interaction history fetching all attempts per card.

**Target:** 90-95% bandwidth reduction while maintaining Pure FSRS philosophy.

**Status:** Phases 1-3 complete (14 commits on `optimize/database-bandwidth` branch). Ready for testing + deployment.

**Reference:** See `docs/adr/0001-optimize-bandwidth-for-large-collections.md` (to be created) for full analysis.

---

## ✅ Phase 1: Critical Bandwidth Fixes (COMPLETE)

### Schema Changes (Foundation) ✅
- ✅ **Add userStats table** - `convex/schema.ts:17-27` (commit 68eb4c1)
- ✅ **Add compound indexes** - `convex/schema.ts:71-72` (commit 3e10ff0)
- ⏸️ **reviewQueue table** - Deferred to Phase 2 optimization (diminishing returns after Phase 1)

### Core Query Fixes ✅
- ✅ **Limit interaction history** - `convex/spacedRepetition.ts:274-283` (commit ecbf71c)
- ✅ **Replace getUserCardStats** - `convex/spacedRepetition.ts:377-411` (commit d7d2487)
- ✅ **Fix getLibrary over-fetching** - `convex/questionsLibrary.ts:38-84` (commit f4ae99a)
- ✅ **Fix getRecentJobs scan** - `convex/generationJobs.ts:86-94` (commit 209ca94)

### Incremental Stats Infrastructure ✅
- ✅ **Stats helper module** - `convex/lib/userStatsHelpers.ts` (commit cb6bde3)
- ✅ **scheduleReview integration** - `convex/spacedRepetition.ts:165-215` (commit c7f58ee)
- ✅ **Question creation stats** - `convex/questionsCrud.ts:64-69, 121-126` (commit 8b460da)
- ✅ **Deletion/restoration stats** - `convex/questionsBulk.ts:95-130, 152-187, 207-242` (commit 9ea72b0)

---

## ✅ Phase 2: Data Migration & Rollout (COMPLETE)

### Data Migration ✅

- ✅ **Create migration to initialize userStats for existing users** (commit fb36d8c)
  - File: `convex/migrations.ts:619-820`
  - Internal mutation: `initializeUserStats`
  - Logic:
    1. Query all users
    2. For each user: Count questions by state (not deleted)
    3. Insert userStats record if missing (idempotent)
    4. Process in batches of 10 to avoid memory issues
  - Test with dev environment first
  - Success criteria: All existing users have userStats records

- ✅ **Add reconciliation cron for stats drift detection** (commit 1d97615)
  - File: `convex/userStats.ts`, `convex/cron.ts`
  - Schedule: Daily at 3:15am UTC
  - Function: `reconcileUserStats`
  - Logic:
    1. Sample 100 random users
    2. Recalculate stats from source (questions table)
    3. Compare with cached userStats
    4. Log drift >5 cards
    5. Auto-fix drift by updating userStats
  - Success criteria: Drift monitoring + auto-correction

### Deployment Validation ✅

- ✅ **Update deployment health check** (commit fb24d07)
  - File: `scripts/check-deployment-health.sh`
  - Add: Verify userStats table exists
  - Add: Check compound indexes deployed (`by_user_active`, `by_user_state`)
  - Add: Sample query to verify userStats populated
  - Success criteria: Pre-deploy validation catches infrastructure issues

---

## Phase 3: Documentation

- ✅ **Write ADR for bandwidth optimization** (commit e25d67f)
  - File: `docs/adr/0001-optimize-bandwidth-for-large-collections.md`
  - Sections:
    - Status: Accepted, Phase 1 & 2 implemented
    - Context: Bandwidth explosion analysis (10k cards × 200 reviews/day)
    - Problem: Root cause breakdown with query examples
    - Decision: Incremental stats + interaction limits + compound indexes
    - Consequences: 90%+ bandwidth reduction, <1% eventual consistency
    - Implementation: Phase 1-2 commits, migration complete
  - Success criteria: Comprehensive technical reference ✅

- ✅ **Document bandwidth optimization in CLAUDE.md** (commit 3133908)
  - File: `CLAUDE.md`
  - New section: "Database Bandwidth Optimization"
  - Anti-patterns: `.collect()` on user queries, unbounded fetches
  - Best practices: `.take(limit)`, compound indexes, incremental counters
  - Reference: Link to ADR-0001
  - Success criteria: Future code reviews catch bandwidth issues ✅

- ✅ **Add inline comments to optimized queries** (commit 9b7d804)
  - Enhanced comments on all `.take()` calls with rationale
  - Files: `convex/spacedRepetition.ts`, `convex/questionsLibrary.ts`, `convex/generationJobs.ts`
  - Documented batch sizes, overflow behavior, and bandwidth trade-offs
  - Success criteria: Self-documenting code ✅

---

## Phase 4: Testing & Validation

### Unit Tests

- [ ] **Write unit tests for userStats helpers**
  - File: `convex/lib/userStatsHelpers.test.ts` (new)
  - Tests:
    - `updateStatsCounters()` increments/decrements correctly
    - Handles missing stats record (new user)
    - Prevents negative counts (Math.max safety)
    - Applies multiple deltas correctly
  - Success criteria: 100% coverage of helper functions

### Integration Tests

- [ ] **Write integration tests for stats lifecycle**
  - File: `convex/spacedRepetition.test.ts` (append)
  - Tests:
    - Review mutation updates stats
    - State transitions reflected correctly
    - Question creation initializes stats
    - Delete/restore maintains accuracy
  - Success criteria: End-to-end stats validation

### Performance Validation

- [ ] **Test bandwidth reduction with simulated load**
  - Script: `scripts/test-bandwidth-usage.ts` (new)
  - Simulate: 1000 cards, 100 reviews
  - Measure: Document reads before/after optimization
  - Compare: Baseline vs Phase 1 implementation
  - Success criteria: Verify 90%+ reduction empirically

- [ ] **Validate query performance at scale**
  - Script: `scripts/seed-large-dataset.ts` (new/existing)
  - Seed: 10k cards, 50k interactions
  - Measure: Query latency (getNextReview, getUserCardStats, getLibrary)
  - Target: All queries <100ms, getUserCardStats <10ms
  - Success criteria: Performance scales to Anki power users

---

## Phase 5: Monitoring (Post-Deploy)

- [ ] **Add bandwidth usage monitoring**
  - File: `convex/monitoring.ts` (new)
  - Query: `getBandwidthMetrics`
  - Metrics: Queries/user, doc reads, bandwidth trends
  - Success criteria: Dashboard visibility

- [ ] **Add stats drift monitoring**
  - File: `convex/monitoring.ts`
  - Query: `getStatsDriftReport`
  - Shows: Drift magnitude, last reconciliation
  - Success criteria: Operations debugging support

---

## Rollout Strategy

**Current State:**
- ✅ Phase 1 complete: 10 commits, all code implemented
- 🔄 Ready for: Migration development → testing → deploy

**Deployment Plan:**
1. **Dev Testing** (1 day)
   - Run migration in dev environment
   - Verify stats accuracy manually
   - Test reconciliation cron

2. **Staging Deploy** (1 day)
   - Deploy schema + code to staging
   - Run migration for staging users
   - Monitor for 24h, verify no drift

3. **Production Deploy** (phased)
   - Deploy backend (schema + functions)
   - Run migration during low-traffic window
   - Monitor bandwidth metrics for 48h
   - Deploy frontend if needed

**Rollback Plan:**
- If stats drift: Reconciliation cron auto-fixes within 24h
- If migration fails: New getUserCardStats falls back to default stats
- If critical issue: Revert branch, old queries still work

**Success Metrics:**
- Bandwidth: 704 MB spike → <70 MB (90%+ reduction)
- Query performance: <100ms at 10k cards
- Stats accuracy: <1% drift over 7 days
- Zero FSRS philosophy impact

---

## Notes

**Phase 1 Implementation Time:** ~3 hours (10 commits)
**Remaining Estimate:** ~8 hours (migration + testing + docs)
**Total Project Time:** ~11 hours as estimated

**Key Decisions:**
- Interaction history limit: 10 recent (vs all) - FSRS only needs trend
- Stats eventual consistency: Imperceptible (<1s lag via reactive queries)
- reviewQueue table: Deferred to Phase 2 (diminishing returns)

**Next Actions:**
1. Implement userStats migration
2. Add reconciliation cron
3. Test in dev environment
4. Write ADR documentation
5. Deploy to staging for validation
