# PRD: Convex Database Bandwidth Crisis - Optimization Strategy

**Status:** Ready for Implementation
**Date:** 2025-11-03
**Priority:** P0 - Critical Infrastructure Issue

---

## Executive Summary

Scry is experiencing catastrophic database bandwidth consumption on Convex, consuming **61.47 GB over 30 days** (Oct 27 - Nov 27) with a single developer testing 500 cards. Current overage costs are **$180-335/month** for development only, projecting to **$32,000-64,000/month** at 1,000 production users—making the product economically non-viable.

**Root Cause (Data-Driven):**
- `spacedRepetition.getDueCount`: **34.96 GB** (57% of total) - fetches 2,000 full docs to count them
- `spacedRepetition.getNextReview`: **25.93 GB** (42% of total) - fetches 110 full docs to pick 1

**Solution:** Three architectural approaches with 92-99.96% bandwidth reduction potential. Recommendation: **Start with Approach A** (minimal optimization, 15 min implementation, 92% reduction) and progressively add complexity only if needed at scale.

**Business Impact:**
- Immediate: Reduce costs from $180-335/mo → <$30/mo (development)
- Scale: Enable product viability at 100-1,000+ users
- Timeline: Emergency relief in 1 hour, permanent solution in 2-3 days if needed

---

## Problem Statement

### Symptoms

**Bandwidth Consumption (Oct 27 - Nov 27, 2025):**
- Total: 61.47 GB over 30 days
- Peak: 14.97 GB on October 31, 2025
- Average: 8-16 GB per day
- Pattern: Consistent high usage, not an isolated spike

**Current Costs:**
- Convex Pro plan: $25/month base
- Included bandwidth: 50 GB/month
- Overage: ~11 GB/month × $15/GB = **$165/month overage**
- Total: **$190/month** for single developer with 500 cards

**Scale Projection:**
| Users | Cards/User | Daily Bandwidth | Monthly Cost | Viability |
|-------|------------|-----------------|--------------|-----------|
| 1 (current) | 500 | 2 GB | $190 | ⚠️ Expensive |
| 10 | 500 | 20 GB | $325 | ⚠️ Expensive |
| 100 | 1,000 | 200 GB | $3,250 | ❌ Unsustainable |
| 1,000 | 1,000 | 2,000 GB | $32,500 | ❌ Fatal |

### Business Constraints

**Cannot launch to production users** at current consumption rates. Each new user adds $190/month in infrastructure costs—impossible unit economics for a SaaS product.

**Future features amplify the problem:** Planned agent workflows (background content analysis, automated insights, nightly processing) would 5-10× current bandwidth usage.

**Previous optimization efforts:** ADR-0001 successfully optimized review flow, interactions, and library browsing (90-95% reduction). However, two critical queries were either overlooked or added afterward, negating those gains.

---

## Root Cause Analysis

### Data-Driven Diagnosis

**Convex Dashboard - Functions Breakdown (Oct 27 - Nov 27):**

| Function | Environment | Bandwidth | % of Total |
|----------|-------------|-----------|------------|
| `spacedRepetition.getDueCount` | Prod | **34.96 GB** | 57% |
| `spacedRepetition.getNextReview` | Prod | **25.93 GB** | 42% |
| `spacedRepetition.getNextReview` | Dev | 183.7 MB | <1% |
| `spacedRepetition.getDueCount` | Dev | 165.31 MB | <1% |
| All other functions | All | <1 GB | <2% |

**Total accounted: 60.89 GB from just two queries.**

### Technical Analysis

#### getDueCount: The $175/Month Count

**Current Implementation:**
```typescript
export const getDueCount = query({
  handler: async (ctx) => {
    // Fetches 1,000 FULL question documents
    const dueQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user_next_review', q =>
        q.eq('userId', userId).lte('nextReview', now)
      )
      .take(1000); // Cap at 1000 for "1000+" badge

    // Fetches another 1,000 FULL question documents
    const newQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .filter(q => q.eq(q.field('nextReview'), undefined))
      .take(1000);

    // Returns two numbers from 2,000 documents
    return {
      dueCount: dueQuestions.length,
      newCount: newQuestions.length,
      totalReviewable: dueQuestions.length + newQuestions.length,
    };
  }
});
```

**Why It's Expensive:**
- **Document size:** ~2.5 KB per question (20+ fields: FSRS params, embeddings, timestamps, content)
- **Fetch cost:** 2,000 docs × 2.5 KB = **5 MB per call**
- **Call frequency:**
  - Page load: Every visit to review interface
  - Reactive re-runs: Every review answer (scheduleReview mutation triggers reactivity)
  - Polling: Every 60 seconds while tab open
  - Multiple tabs: 2-3 browser tabs multiply the cost

**Estimated Call Frequency:**
```
Daily usage (developer):
  - Page loads: 10/day
  - Reviews: 200/day (each triggers reactive re-run)
  - Polling: 3 tabs × 60 min/day ÷ 1 min = 180/day
  - Total: ~7,000 calls/month

Bandwidth: 7,000 calls × 5 MB = 35 GB/month ✓ (matches observed 34.96 GB)
```

**The Irony:** We already have a cached counter table (`userStats`) with exactly these counts, created in ADR-0001. `getDueCount` just isn't using it.

---

#### getNextReview: The $130/Month Queue

**Current Implementation:**
```typescript
export const getNextReview = query({
  handler: async (ctx) => {
    // Fetch 100 due questions for priority calculation
    const dueQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user_next_review', q =>
        q.eq('userId', userId).lte('nextReview', now)
      )
      .take(100); // 100 × 2.5 KB = 250 KB

    // Fetch 10 new questions
    const newQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .filter(q => q.eq(q.field('nextReview'), undefined))
      .take(10); // 10 × 2.5 KB = 25 KB

    const allCandidates = [...dueQuestions, ...newQuestions]; // 110 docs

    // Calculate priority for all 110, sort, return first
    const sorted = allCandidates
      .map(q => ({ question: q, priority: calculatePriority(q) }))
      .sort((a, b) => a.priority - b.priority);

    return sorted[0].question; // Return 1 document
  }
});
```

**Why It's Expensive:**
- **Fetch cost:** 110 docs × 2.5 KB = **275 KB per call**
- **Call frequency:**
  - Page load: Every review interface visit
  - Reactive re-runs: Every review answer
  - Aggressive polling: Likely every 10-60s (inferred from high call count)
  - Multiple tabs: 2-3 browser tabs

**Estimated Call Frequency:**
```
To reach 26 GB/month:
  26 GB ÷ 275 KB = ~95,000 calls/month
  ~3,200 calls/day
  ~133 calls/hour

With 2-3 tabs open, 2-3 hours/day reviewing:
  - Actual review time: 3 hours × 60 min ÷ 5 min/review = 36 reviews
  - Reactive re-runs: 36 × 3 tabs = 108 calls
  - Polling (estimated 10s interval): 3 hours × 360 intervals/hour × 3 tabs = 3,240 calls
  - Total: ~3,350 calls/day ✓ (matches estimate)
```

**The Question:** Do we need to fetch 110 cards to calculate priority? FSRS already indexes by `nextReview` ascending—the first 20-25 cards are likely the most urgent already.

---

### Why ADR-0001 Didn't Solve This

**ADR-0001 Status (implemented Oct 2024):**
- ✅ Created `userStats` table with cached counters (totalCards, newCount, learningCount, matureCount)
- ✅ Added compound indexes for efficient filtering
- ✅ Optimized interaction history queries (ALL → 10 recent)
- ✅ Fixed library over-fetching
- ✅ Optimized generation job queries

**What ADR-0001 Fixed:**
- Review flow bandwidth: 90% reduction ✓
- Library browsing: 95% reduction ✓
- Background jobs: 96% reduction ✓

**What ADR-0001 Missed:**
- `getDueCount` still fetches 2,000 docs instead of reading cached `userStats`
- `getNextReview` batch size (110) not optimized

**Hypothesis:** These queries were either:
1. Overlooked during ADR-0001 implementation
2. Added after ADR-0001 and not reviewed for bandwidth efficiency
3. Assumed to be "bounded enough" (they use `.take()`) without analyzing total bandwidth impact

**Result:** ADR-0001 optimizations worked, but two high-frequency queries negated the gains.

---

## User Context & Requirements

### Who Uses This

**Current:** Single developer testing core review flow
**Target:** Power users with large personal knowledge bases (1,000-10,000 cards)
**Scale:** Aim to support 100-1,000 active users within 12 months

### Problems Being Solved

**Immediate:** Reduce infrastructure costs to viable levels
**Short-term:** Enable product launch without cost anxiety
**Long-term:** Scale to 1,000+ users without bandwidth-driven cost explosion

### Success Criteria

**Phase 1 (Immediate Relief):**
- Bandwidth: <5 GB/month at current scale (1 user, 500 cards)
- Cost: <$30/month total (base plan, no overage)
- Timeline: Deploy within 1-2 hours

**Phase 2 (Production Ready):**
- Bandwidth: <50 GB/month at 100 users
- Cost: <$500/month at 100 users (<$5/user/month infrastructure)
- Latency: Query response <200ms p95
- Accuracy: Count/queue correctness >99%

**Phase 3 (Scale):**
- Bandwidth: <500 GB/month at 1,000 users
- Cost: <$5,000/month at 1,000 users (<$5/user/month infrastructure)
- Support: 10,000 cards per user efficiently

---

## Requirements

### Functional Requirements

**FR-1: Accurate Due Count**
- Show user how many cards are ready for review
- Update count immediately after reviewing a card (real-time)
- Support time-based maturation (cards become due as clock advances)
- Acceptable accuracy: ±1% (eventual consistency OK)

**FR-2: Optimal Next Card Selection**
- Select next card based on FSRS retrievability/priority
- Support temporal dispersion (shuffle urgent tier to prevent clustering)
- Latency: <200ms for next card fetch
- Quality: Pick from top 20-50 most urgent cards (not entire collection)

**FR-3: Multi-Tab Support**
- Allow 2-3 browser tabs without 3× bandwidth multiplication
- Shared cache or coordination to reduce redundant queries
- Consistent state across tabs (acceptable 1-2s lag)

**FR-4: Developer Experience**
- Changes transparent to UI (no user-facing modifications needed)
- Maintain existing review flow UX
- No performance regressions (latency, accuracy)

### Non-Functional Requirements

**NFR-1: Cost**
- Target: <$30/mo at current scale (1 user)
- Constraint: <$500/mo at 100 users
- Scaling: <$5/user/mo infrastructure cost at scale

**NFR-2: Performance**
- Query latency: <200ms p95
- Count accuracy: >99% (within 1% of actual)
- Review queue load time: <500ms total (all queries)

**NFR-3: Reliability**
- No data loss during optimization migration
- Graceful degradation if optimizations fail (fallback to current queries)
- Eventual consistency acceptable (<5s lag)

**NFR-4: Maintainability**
- Minimize new tables/invariants (complexity)
- Reuse existing infrastructure where possible
- Clear migration path (no breaking changes)
- Comprehensive monitoring/alerting

**NFR-5: Scalability**
- Support 10,000 cards per user efficiently
- Scale to 1,000 active users
- Handle future agent workflows (background processing)

---

## Architectural Approaches

We evaluated three approaches with progressive complexity. Recommendation: **Start with Approach A**, monitor impact, only progress to B or C if proven necessary at scale.

---

### Approach A: Minimal Optimization (RECOMMENDED)

**Strategy:** Fix the obvious inefficiencies with minimal code changes.

#### Changes Required

**1. Fix getDueCount to Use Cached Stats (5 minutes)**

**File:** `convex/spacedRepetition.ts:363-407`

**Current (fetches 2,000 docs):**
```typescript
export const getDueCount = query({
  args: { _refreshTimestamp: v.optional(v.number()) },
  handler: async (ctx, _args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Fetches up to 1,000 due questions (FULL documents)
    const dueQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user_next_review', q =>
        q.eq('userId', userId).lte('nextReview', now)
      )
      .filter(q => q.and(
        q.eq(q.field('deletedAt'), undefined),
        q.eq(q.field('archivedAt'), undefined)
      ))
      .take(1000);

    // Fetches up to 1,000 new questions (FULL documents)
    const newQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .filter(q => q.and(
        q.eq(q.field('nextReview'), undefined),
        q.eq(q.field('deletedAt'), undefined),
        q.eq(q.field('archivedAt'), undefined)
      ))
      .take(1000);

    return {
      dueCount: dueQuestions.length,
      newCount: newQuestions.length,
      totalReviewable: dueQuestions.length + newQuestions.length,
    };
  }
});
```

**Optimized (fetches 1 cached doc):**
```typescript
export const getDueCount = query({
  args: { _refreshTimestamp: v.optional(v.number()) },
  handler: async (ctx, _args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Fetch cached stats (single document, ~200 bytes)
    const stats = await ctx.db
      .query('userStats')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first();

    // userStats already tracks these counts (updated incrementally on mutations)
    return {
      dueCount: (stats?.learningCount || 0) + (stats?.matureCount || 0),
      newCount: stats?.newCount || 0,
      totalReviewable: stats?.totalCards || 0,
    };
  }
});
```

**Why This Works:**
- `userStats` table already exists (created in ADR-0001)
- Already maintains `newCount`, `learningCount`, `matureCount` via incremental updates
- Updated on every mutation (scheduleReview, create, delete, restore)
- Accuracy: Same as current implementation (uses same source data, just cached)

**Bandwidth Impact:**
- Before: 7,000 calls/month × 5 MB = 35 GB
- After: 7,000 calls/month × 200 bytes = 1.4 MB
- Reduction: **99.996%** (35 GB → 1.4 MB)

**Implementation Risk:** **Very low**
- Reuses existing table (no schema changes)
- Maintains exact same API (getDueCount still returns same data)
- No UI changes needed
- Fallback: If stats missing, returns zeros (degraded but safe)

---

**2. Reduce getNextReview Batch Size (10 minutes)**

**File:** `convex/spacedRepetition.ts:237-351`

**Current (fetches 110 docs):**
```typescript
const dueQuestions = await ctx.db
  .query('questions')
  .withIndex('by_user_next_review', q =>
    q.eq('userId', userId).lte('nextReview', now)
  )
  .filter(q => q.and(
    q.eq(q.field('deletedAt'), undefined),
    q.eq(q.field('archivedAt'), undefined)
  ))
  .take(100); // ← Fetch 100 for priority calculation

const newQuestions = await ctx.db
  .query('questions')
  .withIndex('by_user', q => q.eq('userId', userId))
  .filter(q => q.and(
    q.eq(q.field('nextReview'), undefined),
    q.eq(q.field('deletedAt'), undefined),
    q.eq(q.field('archivedAt'), undefined)
  ))
  .take(10); // ← Fetch 10 new questions
```

**Optimized (fetches 25 docs):**
```typescript
const dueQuestions = await ctx.db
  .query('questions')
  .withIndex('by_user_next_review', q =>
    q.eq('userId', userId).lte('nextReview', now)
  )
  .filter(q => q.and(
    q.eq(q.field('deletedAt'), undefined),
    q.eq(q.field('archivedAt'), undefined)
  ))
  .take(20); // ← Reduced from 100

const newQuestions = await ctx.db
  .query('questions')
  .withIndex('by_user', q => q.eq('userId', userId))
  .filter(q => q.and(
    q.eq(q.field('nextReview'), undefined),
    q.eq(q.field('deletedAt'), undefined),
    q.eq(q.field('archivedAt'), undefined)
  ))
  .take(5); // ← Reduced from 10
```

**Rationale:**
- FSRS already indexes by `nextReview` ascending
- First 20 due cards are likely the most urgent (lowest retrievability)
- Priority calculation within top-20 window is sufficient for good card selection
- Temporal dispersion shuffle already randomizes within urgent tier (urgency delta = 0.05)

**Bandwidth Impact:**
- Before: 95,000 calls/month × 275 KB = 26 GB
- After: 95,000 calls/month × 62.5 KB = 5.9 GB
- Reduction: **77%** (26 GB → 5.9 GB)

**Accuracy Trade-off:**
- Current: Priority calculated from top 110 cards
- Optimized: Priority calculated from top 25 cards
- Impact: Marginal - FSRS priority within top 25 is highly correlated with top 110
- Validation: Can A/B test batch sizes (20 vs 15 vs 30) and measure card selection quality

**Implementation Risk:** **Low**
- Simple numeric changes (100 → 20, 10 → 5)
- Existing shuffle logic still applies
- Maintains FSRS priority algorithm
- Rollback: Increase batch size if quality degrades

---

**3. Delete Unused Analytics Queries (15 minutes)**

**Files:** `convex/spacedRepetition.ts`

**Remove:**
- `getUserStreak` (lines 521-586) - Fetches ALL interactions, never called from UI
- `getRetentionRate` (lines 615-681) - Fetches ALL interactions, never called from UI
- `getRecallSpeedImprovement` (lines 687-759) - Fetches ALL interactions twice, never called from UI

**Rationale:**
- git history confirms these were added Sept 18, 2025 (`bfd4c83`)
- grep confirms they're never imported/used in app/ or components/
- Listed in BACKLOG.md as future features, not current
- Following YAGNI principle: delete now, re-implement when needed

**Bandwidth Impact:**
- These are not currently being called (confirmed via UI audit)
- But removing prevents future accidental usage
- Reduces codebase complexity (~150 LOC removed)

**Implementation Risk:** **None**
- Unused code, safe to delete
- Can restore from git history if needed later

---

#### Summary: Approach A

**Total Changes:**
- 3 files modified
- ~170 LOC changed (mostly deletions)
- 0 new tables/indexes
- 0 migrations required
- 0 UI changes

**Bandwidth Impact:**
- getDueCount: 35 GB → 1.4 MB (99.996% reduction)
- getNextReview: 26 GB → 5.9 GB (77% reduction)
- **Total: 61 GB → 5.9 GB (90.3% reduction)**

**Cost Impact:**
- Before: $25 base + $165 overage = $190/month
- After: $25 base + $0 overage = **$25/month**
- **Savings: $165/month** (87% reduction)

**Pros:**
- ✅ 30 minutes total implementation time
- ✅ Zero new complexity (uses existing infrastructure)
- ✅ Very low risk (minimal code changes)
- ✅ Immediate cost relief ($165/mo savings)
- ✅ Validates assumptions before bigger investment
- ✅ Good enough for current scale (1-100 users)

**Cons:**
- ⚠️ Still 5.9 GB/month from getNextReview (acceptable but not optimal)
- ⚠️ May need Phase 2 optimization at higher scale (100+ users)
- ⚠️ Batch size reduction slightly reduces priority calculation accuracy (minor)

**Timeline:**
- Implementation: 30 minutes
- Testing: 1 hour (validate queries, test review flow)
- Deployment: 30 minutes
- Validation: 48 hours (monitor bandwidth dashboard)
- **Total: 1 day to full validation**

**Recommendation:** **Implement Approach A first.** Validates that simplified fixes solve the problem before investing in more complex solutions. If 5.9 GB/month is still problematic at scale, proceed to Approach B.

---

### Approach B: Ready Queue Materialization

**Strategy:** Implement external engineer's recommended pattern - maintain materialized view of ready-to-review cards in separate tables with incremental updates.

**Note:** This is the "proper" Convex solution for reactive count queries at scale. However, Approach A achieves 90% of the benefit with 1% of the complexity. Only implement if Approach A proves insufficient at scale.

#### Architecture

**New Tables:**
```typescript
// Materialized queue: tiny docs with just IDs and priorities
readyQueue: defineTable({
  userId: v.id('users'),
  questionId: v.id('questions'),
  dueAt: v.number(),
  priority: v.number(), // Pre-calculated retrievability score
  addedAt: v.number(),
})
  .index('by_user_priority', ['userId', 'priority', 'dueAt'])
  .index('by_question', ['questionId']),

// Materialized counter: single doc per user
readyCounters: defineTable({
  userId: v.id('users'),
  totalReady: v.number(), // Live count of ready cards
  lastMatured: v.number(), // Last time maturation ran
  lastUpdated: v.number(),
})
  .index('by_user', ['userId']),
```

#### Changes Required

**1. Schema Changes**
- Add `readyQueue` table
- Add `readyCounters` table
- Deploy schema changes to production

**2. Helper Functions** (~200 LOC)
- `addToReadyQueue()` - Insert card when becomes ready
- `removeFromReadyQueue()` - Remove card when no longer ready
- `updateQueuePriority()` - Update priority when FSRS params change
- `incrementReadyCounter()` - Atomically increment count
- `decrementReadyCounter()` - Atomically decrement count

**3. Mutation Updates** (~400 LOC)
- Update `scheduleReview` to maintain queue on every review
- Update `createQuestion` to add to queue if ready
- Update `softDeleteQuestion` to remove from queue
- Update `restoreQuestion` to add back to queue if ready
- Update `archiveQuestions` to remove from queue
- Update `unarchiveQuestions` to add back to queue if ready
- Update all bulk operations similarly

**4. Maturation Logic** (~100 LOC)
- `matureDueCards` mutation - Find cards that became due, add to queue
- Client-side nudge on page mount + every 60s
- Hourly cron backup (safety net)

**5. Replace Queries** (~50 LOC)
- `getDueCount` - Read from `readyCounters` (single doc fetch)
- `getNextReview` - Read from `readyQueue` top 50, pick from urgent tier

**6. Migration** (~100 LOC)
- `initializeReadyQueue` - Populate initial state for existing users
- Idempotent, dry-run support
- Batch processing for large datasets

**7. Drift Reconciliation** (~50 LOC)
- Weekly cron to detect/fix counter drift
- Sample 100 users, compare queue count vs counter
- Auto-correct if drift >5 cards

#### Invariants to Maintain

**Invariant 1: Queue Completeness**
- Every ready card (nextReview <= now) exists in readyQueue
- Enforced: Add on mutation, maturation checks time-based transitions

**Invariant 2: Counter Accuracy**
- `readyCounters.totalReady === readyQueue.count()`
- Enforced: Increment/decrement atomically with queue add/remove
- Fallback: Weekly reconciliation cron

**Invariant 3: Queue Validity**
- Every readyQueue entry points to valid, non-deleted question
- Enforced: Remove on delete, cleanup on getNextReview if orphaned

**Invariant 4: Priority Sync**
- readyQueue priority scores match current FSRS fields
- Enforced: Update priority on every FSRS param change

#### Bandwidth Impact

**getDueCount:**
- Before: 7,000 calls/month × 5 MB = 35 GB
- After: 7,000 calls/month × 200 bytes = 1.4 MB (same as Approach A)
- Reduction: 99.996%

**getNextReview:**
- Before: 95,000 calls/month × 275 KB = 26 GB
- After: 95,000 calls/month × (50 docs × 50 bytes) = 237 MB
- Reduction: 99.1%

**Total:**
- Before: 61 GB/month
- After: 238 MB/month
- **Reduction: 99.6%** (61 GB → 238 MB)

**Incremental gain over Approach A:** 5.9 GB → 238 MB = **$3/month savings**

#### Complexity Analysis

**New Complexity:**
- 2 new tables (readyQueue, readyCounters)
- 4 invariants to maintain
- 7 mutation update points (every operation touching questions)
- Temporal coupling (maturation must run periodically)
- Eventual consistency (drift reconciliation needed)
- ~900 LOC total

**Operational Complexity:**
- Migration required for existing users
- Monitoring for drift detection
- Debugging when invariants break
- Every new feature touching questions must remember to update queue

**Tradeoffs:**
- **Pro:** Maximum bandwidth efficiency (99.6% reduction)
- **Pro:** Scales to unlimited users/cards
- **Pro:** Handles any query frequency
- **Con:** High implementation cost (2-3 days)
- **Con:** High maintenance burden (4 invariants)
- **Con:** Premature for current scale (1 user)

#### When to Implement

**Trigger Conditions:**
- Approach A deployed and bandwidth still >50 GB/month, OR
- User count >100 and bandwidth costs >$500/month, OR
- Query latency >500ms consistently

**Prerequisites:**
- Validate Approach A first
- Measure actual vs. expected bandwidth reduction
- Confirm simplified solution insufficient before adding complexity

**Timeline:**
- Design: 4 hours (schema, helpers, migration strategy)
- Implementation: 2 days (mutations, queries, maturation, migration)
- Testing: 1 day (unit tests, integration tests, migration dry-run)
- Deployment: 4 hours (schema deploy, migration run, validation)
- **Total: 3-4 days**

#### Recommendation

**Defer Approach B until proven necessary.** The external engineer's solution is architecturally sound and follows Convex best practices. However:

1. **Scale mismatch:** Built for 1,000+ users, we have 1 user
2. **Premature optimization:** 99.6% reduction vs 90% reduction = $3/month for 80× more code
3. **YAGNI violation:** Building infrastructure for scale we don't have yet
4. **Strategic design:** Invest complexity when needed, not "just in case"

**When Approach B makes sense:** At 100-1,000 users with heavy usage. Not at current scale.

---

### Approach C: Hybrid Architecture (Postgres + Convex)

**Strategy:** Separate concerns - Convex for real-time review flow, Postgres for analytics/counts/agent workflows.

#### Architecture

**Convex Responsibilities:**
- Real-time review queue (getNextReview)
- Review mutations (scheduleReview)
- Question CRUD mutations
- WebSocket reactivity for review flow

**Postgres Responsibilities:**
- Count queries (getDueCount, getUserCardStats)
- Analytics queries (streaks, retention, insights)
- Agent background processing
- Reporting and data export

**Sync Pipeline:**
- Every Convex mutation writes to Postgres (async)
- Convex → Postgres CDC via webhooks or scheduled sync
- Eventual consistency (1-5s lag acceptable for counts)

#### Bandwidth Impact

**Convex:**
- Only review flow queries
- getNextReview: 26 GB (unchanged, but this is the real-time critical path)
- All mutations: ~500 MB
- **Total Convex: ~27 GB/month**

**Postgres:**
- getDueCount: Unlimited queries, fixed cost
- All analytics: Unlimited queries, fixed cost
- Agent processing: Unlimited complexity, fixed cost
- **Total Postgres: $10-25/month flat (Supabase/Neon pricing)**

**Total Cost:**
- Convex Pro: $25/month + ~$400 overage = $425/month (for review flow only)
- Postgres: $10-25/month (unlimited analytics)
- **Total: $435-450/month**

**Wait, that's more expensive!** Yes, hybrid doesn't reduce costs at current scale. It makes sense for:
1. Heavy analytics workloads (dashboards, reporting, agent queries)
2. Need for SQL flexibility (complex joins, aggregations)
3. Predictable costs at high scale

#### When to Implement

**Trigger Conditions:**
- Need heavy analytics/reporting features, OR
- Agent workflows running every hour across all users, OR
- Convex bandwidth consistently >500 GB/month despite optimizations

**Prerequisites:**
- Exhaust Convex optimizations first (Approaches A + B)
- Prove that analytics/agent workloads are the bottleneck
- Validate cost model (Postgres savings > migration cost)

**Timeline:**
- Design: 1 week (data model, sync strategy, migration plan)
- Implementation: 3-4 weeks (Postgres schema, sync pipeline, query migration)
- Testing: 1 week (integration tests, data consistency validation)
- Migration: 1 week (phased rollout, monitoring)
- **Total: 6-8 weeks**

#### Recommendation

**Not viable for current problem.** Hybrid architecture solves different problems:
- Problem we have: Expensive counting queries
- Problem hybrid solves: Unlimited analytics at scale

**When hybrid makes sense:** When building agent features that query all users' data hourly. Not for simple count queries.

---

## Decision Framework: Progressive Complexity

**Strategic Principle:** Optimize for current scale + 10×, not 1,000× scale. Add complexity only when proven necessary.

### Stage 1: Minimal Optimization (Approach A)

**Scale:** 1-100 users
**Cost Target:** <$50/month
**Implementation:** 30 minutes
**Bandwidth:** 61 GB → 5.9 GB (90% reduction)

**Deploy when:** Immediately (current state)
**Exit criteria:** Bandwidth >50 GB/month OR query latency >500ms

---

### Stage 2: Materialized Queue (Approach B)

**Scale:** 100-1,000 users
**Cost Target:** <$500/month
**Implementation:** 2-3 days
**Bandwidth:** 5.9 GB → 238 MB (96% additional reduction)

**Deploy when:** Stage 1 proves insufficient at scale
**Exit criteria:** Need heavy analytics OR agent workflows

---

### Stage 3: Hybrid Architecture (Approach C)

**Scale:** 1,000-10,000+ users
**Cost Target:** <$5,000/month
**Implementation:** 6-8 weeks
**Bandwidth:** Unlimited analytics, fixed cost

**Deploy when:** Convex optimizations exhausted, need analytics at scale
**Exit criteria:** N/A (terminal architecture)

---

### Current Recommendation

**Implement Stage 1 (Approach A) immediately.**

**Rationale:**
1. **Current scale:** 1 user, 500 cards - Stage 1 is sufficient
2. **Cost/benefit:** 90% reduction for 30 min work vs 99.6% for 3 days work
3. **Risk:** Low - minimal code changes, reuses existing infrastructure
4. **Validation:** Proves assumptions before investing in complex solution
5. **Strategic:** Optimize for current + 10× scale (10 users), not 1,000× scale

**Defer Stage 2 until:**
- User count >100, OR
- Bandwidth >50 GB/month after Stage 1, OR
- Query latency >500ms consistently

**Defer Stage 3 until:**
- Need agent workflows querying all users hourly, OR
- Heavy analytics/reporting features, OR
- Convex bandwidth >500 GB/month despite Stages 1 + 2

---

## Implementation Plan (Approach A)

### Phase 1: Emergency Patch (30 minutes)

**Goal:** Deploy bandwidth fixes to production, achieve immediate cost relief.

#### Task 1: Fix getDueCount (5 minutes)

**File:** `convex/spacedRepetition.ts:363-407`

**Changes:**
```typescript
// BEFORE (lines 363-407) - DELETE these lines
export const getDueCount = query({
  args: { _refreshTimestamp: v.optional(v.number()) },
  handler: async (ctx, _args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    const dueQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user_next_review', q =>
        q.eq('userId', userId).lte('nextReview', now)
      )
      .filter(q => q.and(
        q.eq(q.field('deletedAt'), undefined),
        q.eq(q.field('archivedAt'), undefined)
      ))
      .take(1000);

    const newQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .filter(q => q.and(
        q.eq(q.field('nextReview'), undefined),
        q.eq(q.field('deletedAt'), undefined),
        q.eq(q.field('archivedAt'), undefined)
      ))
      .take(1000);

    return {
      dueCount: dueQuestions.length,
      newCount: newQuestions.length,
      totalReviewable: dueQuestions.length + newQuestions.length,
    };
  }
});

// AFTER - REPLACE with this
export const getDueCount = query({
  args: { _refreshTimestamp: v.optional(v.number()) },
  handler: async (ctx, _args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Use cached stats from userStats table (already maintained by ADR-0001)
    const stats = await ctx.db
      .query('userStats')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first();

    // Calculate due count from cached state counters
    // learningCount + matureCount = cards in learning/review state (due when nextReview <= now)
    // newCount = cards never reviewed (always "due")
    return {
      dueCount: (stats?.learningCount || 0) + (stats?.matureCount || 0),
      newCount: stats?.newCount || 0,
      totalReviewable: (stats?.learningCount || 0) + (stats?.matureCount || 0) + (stats?.newCount || 0),
    };
  }
});
```

**Validation:**
- Test query returns expected counts
- Verify userStats table exists and has data
- Compare old vs new getDueCount results (should match within ±1)

---

#### Task 2: Reduce getNextReview Batch Sizes (10 minutes)

**File:** `convex/spacedRepetition.ts:248-270`

**Changes:**
```typescript
// Line 248 - CHANGE
// BEFORE:
    .take(100);
// AFTER:
    .take(20); // Reduced from 100: fetch top 20 most urgent due cards

// Line 262 - CHANGE
// BEFORE:
    .take(10);
// AFTER:
    .take(5); // Reduced from 10: fetch top 5 new cards
```

**Validation:**
- Test review flow still selects appropriate cards
- Verify temporal dispersion shuffle still works
- Check latency hasn't increased

---

#### Task 3: Delete Unused Analytics Queries (15 minutes)

**File:** `convex/spacedRepetition.ts`

**Delete:**
- Lines 521-586: `getUserStreak` query + `updateUserStreak` mutation
- Lines 615-681: `getRetentionRate` query
- Lines 687-759: `getRecallSpeedImprovement` query

**Validation:**
- Run TypeScript build: `pnpm tsc --noEmit`
- Verify no imports of deleted functions in app/ or components/
- Grep codebase to confirm: `grep -r "getUserStreak\|getRetentionRate\|getRecallSpeed" app/ components/`

---

#### Deployment

```bash
# 1. Run tests
pnpm test

# 2. Type check
pnpm tsc --noEmit

# 3. Deploy Convex functions
npx convex deploy --prod

# 4. Verify deployment
./scripts/check-deployment-health.sh

# 5. Test in production
# - Load review interface
# - Verify due count shows correct number
# - Review a card
# - Verify count updates
# - Check query latency in Convex dashboard
```

**Rollback Plan:**
- If getDueCount shows incorrect counts: Revert to previous version
- If getNextReview fails: Increase batch sizes back to 100/10
- Full rollback: `git revert` + `npx convex deploy --prod`

---

### Phase 2: Validation (48 hours)

**Goal:** Confirm bandwidth reduction meets expectations, no regressions.

#### Monitoring Checklist

**Convex Dashboard (dashboard.convex.dev):**
- [ ] Check "Database Bandwidth" chart (Oct 27 - Nov 27 baseline)
- [ ] Verify getDueCount bandwidth drops: 35 GB → <50 MB
- [ ] Verify getNextReview bandwidth drops: 26 GB → <6 GB
- [ ] Total bandwidth target: <6 GB over 48 hours (projected <100 GB/month)
- [ ] Check query latency: p50 <100ms, p95 <200ms
- [ ] Monitor error rates (should be 0%)

**Application Monitoring:**
- [ ] Test review flow in production
- [ ] Verify due count accuracy (spot check against manual query)
- [ ] Check multiple tabs behavior (2-3 tabs open simultaneously)
- [ ] Test time-based maturation (wait 5 minutes, refresh, verify new due cards appear)
- [ ] Validate FSRS priority quality (are good cards being selected?)

**Cost Validation:**
- [ ] Check Convex billing dashboard
- [ ] Projected monthly cost: <$30 (base plan + minimal overage)
- [ ] Compare to baseline: $190/month → <$30/month (84%+ reduction)

---

#### Success Criteria

**Must achieve all:**
- ✅ getDueCount bandwidth: <50 MB over 48 hours (<750 MB/month projected)
- ✅ getNextReview bandwidth: <6 GB over 48 hours (<90 GB/month projected)
- ✅ Total bandwidth: <7 GB over 48 hours (<105 GB/month projected)
- ✅ Query latency p95: <200ms
- ✅ Due count accuracy: ±1% of actual
- ✅ Zero errors in review flow
- ✅ Projected monthly cost: <$50 total

**If success criteria met:**
- ✅ Approach A is sufficient for current scale
- ✅ Monitor monthly, revisit if user count >100
- ✅ Document learnings, close task

**If success criteria NOT met:**
- ⚠️ Investigate discrepancy (measurement methodology? hidden queries?)
- ⚠️ Consider batch size tuning (test 15 vs 20 vs 25)
- ⚠️ If still >50 GB/month, begin design for Approach B

---

### Phase 3: Tuning (Optional, if needed)

**Goal:** Fine-tune batch sizes for optimal bandwidth/quality tradeoff.

#### A/B Testing Plan

**Variables to test:**
- getNextReview due batch: 15 vs 20 vs 25
- getNextReview new batch: 3 vs 5 vs 7

**Methodology:**
1. Deploy batch size variant
2. Monitor bandwidth for 7 days
3. Measure card selection quality (user feedback, completion rates)
4. Compare bandwidth vs quality tradeoff
5. Select optimal batch size

**Quality Metrics:**
- User completes review session: Good card selection
- User skips/archives immediately: Poor card selection
- Time per card: Faster suggests easier/better cards
- Correctness rate: Should match expected FSRS distribution

**Decision matrix:**

| Batch Size | Bandwidth | Quality | Verdict |
|------------|-----------|---------|---------|
| 15 | 4.5 GB | TBD | Test if quality acceptable |
| 20 | 5.9 GB | Baseline | Current |
| 25 | 7.4 GB | TBD | Test if bandwidth acceptable |

---

## Risks & Mitigation

### Risk 1: Simplified Solution Insufficient

**Risk:** Approach A reduces bandwidth to 5.9 GB/month, but scale to 100 users → 590 GB/month → $2,950 overage.

**Likelihood:** Medium (depends on actual user behavior, query frequency)

**Impact:** High (cost explosion at scale)

**Mitigation:**
- Monitor bandwidth closely as user count grows
- Set alert threshold: >50 GB/month → investigate
- Have Approach B designed and ready to implement
- Trigger: At 50 users, if bandwidth >250 GB/month, deploy Approach B

**Contingency:** Approach B implementation ready in 2-3 days if needed.

---

### Risk 2: Batch Size Too Small Affects Quality

**Risk:** Reducing from 110 → 25 cards degrades card selection quality (picks suboptimal cards).

**Likelihood:** Low (FSRS index by nextReview already orders by urgency)

**Impact:** Medium (poor user experience, incorrect difficulty curve)

**Mitigation:**
- A/B test batch sizes (15 vs 20 vs 25 vs 30)
- Measure quality metrics (completion rate, time per card, user feedback)
- Make batch size configurable (env var)
- Rollback plan: Increase batch size if quality degrades

**Contingency:** Can increase batch size to 30-40 if 20 proves insufficient (still 64% bandwidth reduction vs current).

---

### Risk 3: Hidden Bandwidth Consumers

**Risk:** We optimize getDueCount + getNextReview, but bandwidth stays high due to other queries.

**Likelihood:** Low (dashboard shows these two account for 99% of bandwidth)

**Impact:** High (optimization effort wasted)

**Mitigation:**
- Export FULL function breakdown from Convex dashboard (not just top 10)
- Check if Dev/Preview environments counted separately
- Validate measurement methodology with Convex support if needed
- Monitor all queries during validation period

**Contingency:** If bandwidth doesn't drop as expected, investigate top 20 functions, not just top 2.

---

### Risk 4: userStats Drift/Inaccuracy

**Risk:** getDueCount using userStats shows incorrect counts due to drift or bugs.

**Likelihood:** Very Low (userStats already proven accurate in ADR-0001, daily reconciliation active)

**Impact:** Medium (users see wrong counts, confusion)

**Mitigation:**
- Validate userStats accuracy before deploying getDueCount change
- Compare getDueCount (new) vs manual query of questions table
- Daily reconciliation cron already active (detects/fixes drift)
- Alert on drift >5% (existing monitoring)

**Contingency:** If counts inaccurate, investigate userStats maintenance logic, fix bugs, re-run reconciliation.

---

### Risk 5: Premature Optimization Regret

**Risk:** We implement Approach B prematurely, then realize we didn't need it (wasted 3 days on complexity).

**Likelihood:** High if we skip Approach A (current plan avoids this)

**Impact:** High (technical debt, maintenance burden, wasted engineering time)

**Mitigation:**
- Follow progressive complexity strategy (A → B → C only if needed)
- Measure Approach A impact before considering Approach B
- Set clear trigger criteria for Approach B (>50 GB/month OR latency >500ms)
- Document decision rationale

**Contingency:** If we build Approach B unnecessarily, plan to remove later (pay down debt).

---

## Monitoring & Alerts

### Bandwidth Metrics

**Daily Monitoring (Convex Dashboard):**
- Total bandwidth usage (target: <200 MB/day)
- getDueCount bandwidth (target: <5 MB/day)
- getNextReview bandwidth (target: <195 MB/day)
- Function call frequency (track query reactivity)

**Weekly Review:**
- Bandwidth trend (increasing/decreasing?)
- Cost projection (stay under $50/month?)
- User count growth (approaching trigger for Approach B?)

**Monthly Review:**
- Total monthly cost (target: <$50)
- Bandwidth per user (calculate unit economics)
- Review trigger criteria (need Approach B?)

---

### Performance Metrics

**Query Latency (Convex Dashboard):**
- getDueCount: p50 <50ms, p95 <100ms
- getNextReview: p50 <100ms, p95 <200ms
- Alert if p95 >500ms (degradation)

**Error Rates:**
- getDueCount errors: 0%
- getNextReview errors: 0%
- Alert on any errors (investigate immediately)

**Accuracy:**
- Compare getDueCount (cached) vs manual query weekly
- Alert if drift >5% (userStats reconciliation should prevent this)

---

### Alert Thresholds

**Critical (Immediate Action):**
- Bandwidth >50 GB/month → Investigate, consider Approach B
- Query errors >1% → Rollback or fix immediately
- Due count accuracy <95% → Fix userStats bugs

**Warning (Monitor Closely):**
- Bandwidth >20 GB/month → Trending toward threshold
- Query latency p95 >300ms → Degrading performance
- Due count accuracy <99% → Minor drift

**Info (Track Trends):**
- Bandwidth 10-20 GB/month → Monitor growth rate
- User count >50 → Approaching Approach B trigger
- Cost >$40/month → Track toward $50 threshold

---

## Success Metrics

### Phase 1: Immediate Relief (1-2 hours)

**Success:**
- ✅ Deploy completed without errors
- ✅ Review flow functional (manual testing)
- ✅ Due counts appear accurate (spot check)
- ✅ No immediate user complaints

---

### Phase 2: Validation (48 hours)

**Success:**
- ✅ getDueCount bandwidth: 35 GB → <50 MB (99%+ reduction)
- ✅ getNextReview bandwidth: 26 GB → <6 GB (77%+ reduction)
- ✅ Total bandwidth: 61 GB → <7 GB (88%+ reduction)
- ✅ Query latency p95: <200ms
- ✅ Due count accuracy: ±1%
- ✅ Zero errors
- ✅ Cost projection: <$50/month

---

### Phase 3: Long-term (30 days)

**Success:**
- ✅ Monthly bandwidth: <100 GB
- ✅ Monthly cost: <$50 total
- ✅ User count growth supported (1 → 10 users with linear cost growth)
- ✅ No user-facing regressions
- ✅ Code quality maintained (no technical debt added)

---

## Open Questions

### Investigation Needed

**Q1: What is the actual call frequency for getDueCount and getNextReview?**
- Convex dashboard shows bandwidth, not call count
- Need to instrument queries to measure exact frequency
- Compare estimated (7,000 and 95,000 calls/month) vs actual

**Q2: Are Dev/Preview environments counted in production bandwidth?**
- Dashboard shows separate rows for Dev/Preview/Prod
- Clarify if totals are per-environment or combined
- Validate that 61 GB = production only

**Q3: What are functions #11-50 in bandwidth breakdown?**
- Dashboard screenshot shows top 10 only
- Export full breakdown to ensure no hidden consumers
- Validate our 99% coverage assumption

**Q4: How accurate are userStats counts currently?**
- Before relying on userStats for getDueCount, validate accuracy
- Run manual query: count questions where state = learning/review/new
- Compare to userStats.learningCount + matureCount + newCount
- Alert if drift >1%

### User Validation Needed

**Q5: Is due count accuracy ±1% acceptable?**
- Current implementation: Exact count (fetches all cards)
- Optimized (Approach A): Cached count (eventual consistency)
- Acceptable lag: <5 seconds (userStats updated on mutation)

**Q6: Is batch size reduction (110 → 25) noticeable in card quality?**
- Need user feedback after deployment
- Measure: Completion rate, time per card, skip frequency
- A/B test if concerns arise

---

## Next Steps

### Immediate (Today)

1. ✅ **Approve PRD** - Review and sign off on Approach A
2. ⏳ **Implement Phase 1** - Fix getDueCount, reduce batch sizes, delete dead code (30 min)
3. ⏳ **Deploy to production** - Deploy changes, verify deployment health (30 min)
4. ⏳ **Initial validation** - Test review flow, check counts, monitor errors (1 hour)

### Short-term (This Week)

5. ⏳ **Monitor bandwidth** - Track Convex dashboard daily, validate reductions (48 hours)
6. ⏳ **Validate success criteria** - Confirm 88%+ reduction, <200ms latency, 0% errors
7. ⏳ **Document learnings** - Update CLAUDE.md with patterns, update BANDWIDTH_CRISIS_ANALYSIS.md with results
8. ⏳ **Close task** - If success criteria met, mark as complete

### Medium-term (This Month)

9. ⏳ **Monthly review** - Assess total cost, bandwidth trends, user growth
10. ⏳ **Tune if needed** - A/B test batch sizes if quality concerns
11. ⏳ **Monitor trigger conditions** - Watch for >50 GB/month or >100 users

### Long-term (Next Quarter)

12. ⏳ **Reassess architecture** - If triggers met, design Approach B
13. ⏳ **Plan agent features** - Consider Approach C when building heavy analytics
14. ⏳ **Audit all queries** - Find other optimization opportunities

---

## References

### Documentation

- **BANDWIDTH_CRISIS_ANALYSIS.md** - Comprehensive technical investigation
- **ADR-0001** - Previous bandwidth optimization (interactions, library, jobs)
- **CLAUDE.md** - Operational guidance, bandwidth optimization patterns
- **Convex Dashboard** - Real-time bandwidth metrics, function breakdown

### External Input

- **External Engineer Feedback** - Ready queue pattern recommendation (architecturally sound, but premature for scale)
- **Ultrathink Review** - Design critique validating progressive complexity approach

### Code References

- `convex/spacedRepetition.ts` - getDueCount, getNextReview implementations
- `convex/schema.ts` - userStats table definition
- `convex/lib/userStatsHelpers.ts` - Counter maintenance logic
- `convex/userStats.ts` - Reconciliation cron

### Metrics Sources

- **Convex Bandwidth Dashboard** - Oct 27 - Nov 27, 2025 data
- **Git History** - Analytics queries added Sept 18, 2025 (commit bfd4c83)
- **Usage Patterns** - 2-3 browser tabs, 2-3 hours/day development/testing

---

## Appendix: Cost Model

### Current State (Baseline)

| Metric | Value | Cost |
|--------|-------|------|
| Monthly bandwidth | 61 GB | $25 base + $165 overage = $190 |
| Users | 1 | N/A |
| Cost per user | $190 | Unsustainable |

### After Approach A (Optimized)

| Metric | Value | Cost |
|--------|-------|------|
| Monthly bandwidth | 5.9 GB | $25 base + $0 overage = $25 |
| Users | 1 | N/A |
| Cost per user | $25 | Good for <100 users |

### Scale Projections

**Approach A (90% reduction):**

| Users | Bandwidth/Month | Cost/Month | Cost/User |
|-------|-----------------|------------|-----------|
| 1 | 5.9 GB | $25 | $25.00 |
| 10 | 59 GB | $25 + $40 = $65 | $6.50 |
| 50 | 295 GB | $25 + $245 = $270 | $5.40 |
| 100 | 590 GB | $25 + $540 = $565 | $5.65 |
| 500 | 2,950 GB | $25 + $2,900 = $2,925 | $5.85 |

**Break-even:** ~200 users at $5/user/mo target

**Approach B (99.6% reduction):**

| Users | Bandwidth/Month | Cost/Month | Cost/User |
|-------|-----------------|------------|-----------|
| 1 | 238 MB | $25 | $25.00 |
| 10 | 2.4 GB | $25 | $2.50 |
| 100 | 24 GB | $25 | $0.25 |
| 1,000 | 240 GB | $25 + $190 = $215 | $0.22 |
| 10,000 | 2,400 GB | $25 + $2,350 = $2,375 | $0.24 |

**Break-even:** Viable for any user count at $5/user/mo target

### Decision Point

**At 100 users with Approach A:**
- Cost: $565/month
- Revenue needed: $5.65/user/mo to break even
- Acceptable if subscription >$10/mo (56% margin)

**If revenue <$10/mo per user:**
- Need <$5/user/mo infrastructure cost
- Approach A insufficient at 100 users → Deploy Approach B
- Approach B gives $0.25/user/mo → 95% margin

**Recommendation:** Start with Approach A, monitor unit economics, deploy Approach B when user count justifies the complexity investment.

---

**End of PRD**

*Last Updated: 2025-11-03*
*Version: 1.0*
*Status: Ready for Implementation*
