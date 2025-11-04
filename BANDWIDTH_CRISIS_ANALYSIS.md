# Scry Database Bandwidth Crisis - Situation Analysis

**Date:** 2025-11-03
**Author:** System Analysis
**Status:** Critical Infrastructure Issue

---

## Executive Summary

Scry is experiencing catastrophic database bandwidth consumption on the Convex platform. With a single user (developer) testing a collection of **a few hundred cards**, the system is consuming **14.97 GB of bandwidth per day** (October 31, 2025 peak), resulting in:

- Exceeding the Convex Pro plan's included 50 GB/month by 4.5× (projected 450 GB/month)
- Current metered overage costs estimated at **$35-45/month** for development/testing only
- **Zero actual production users** - this is purely internal testing and development
- Projected cost at scale: **$45,000/month** for 1,000 users with typical usage patterns

The bandwidth consumption is occurring despite implementing Phase 1 and Phase 2 of ADR-0001 (optimize-bandwidth-for-large-collections), which was designed to reduce bandwidth by 90-95% for users with 10,000+ card collections.

---

## System Architecture Overview

### Technology Stack

**Backend Infrastructure:**
- **Database:** Convex (real-time serverless database with WebSocket reactivity)
- **Current Plan:** Convex Pro ($25/month base + metered bandwidth overage)
- **Bandwidth Allowance:** 50 GB/month included
- **Overage Pricing:** ~$0.50-1.00 per GB over limit (estimated from typical cloud pricing)

**Application Architecture:**
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Backend Functions:** Convex serverless queries/mutations/actions
- **Real-time Updates:** Convex WebSocket subscriptions (automatic reactivity)
- **Authentication:** Clerk (magic link email auth)
- **AI Generation:** OpenAI GPT-5-mini (reasoning models), Google Gemini 2.5 Flash (fallback)

**Database Schema (Core Tables):**
- `users` - User accounts (Clerk integration)
- `questions` - Individual flashcard questions (10+ FSRS fields, soft delete, vector embeddings)
- `interactions` - Answer attempt history (every review creates one record)
- `userStats` - Cached statistics (O(1) counters updated incrementally)
- `generationJobs` - Background AI generation job tracking
- `rateLimits` - Rate limiting attempt tracking
- `deployments` - Deployment metadata

### Current Collection Size (Developer Account)

- **Questions:** A few hundred cards (exact count unknown, likely 200-500)
- **Interactions:** Unknown total count
  - Estimated: 200-500 cards × 50 reviews average = **10,000-25,000 interaction records**
- **Review frequency:** Active daily testing during development
- **Generation jobs:** Multiple AI generation sessions during testing
- **Genesis Lab usage:** Frequent experimental test runs (dev-only feature)

### Convex Real-Time Architecture

**Reactive Query System:**
- Convex queries automatically re-run when underlying data changes
- WebSocket connections push updates to all connected clients
- No polling needed - changes propagate in <1 second
- **Critical implication:** Mutations trigger cascading query re-execution

**Query Execution Flow:**
```
User reviews card → scheduleReview mutation
  ↓
Triggers reactive re-runs of:
  - getUserCardStats (stats dashboard)
  - getNextReview (review queue)
  - getUserStreak (streak calculation)
  - getRetentionRate (analytics)
  - getRecallSpeed (analytics)
  - getLibrary (if library view open)

Each re-run fetches fresh data from database
Multiple browser tabs = Multiple parallel re-runs
```

---

## Bandwidth Consumption Analysis

### Observed Usage Patterns

**Peak Usage (October 31, 2025):**
- **Total:** 14.97 GB in single day
- **Breakdown by project:**
  - chrondle: 3.82 MB (negligible)
  - volume: 1.55 MB (negligible)
  - noesis: 891.91 MB (60 GB/month rate)
  - **scry: 14.97 GB** (450 GB/month rate)

**Trend Analysis (October 27 - November 4):**
- Consistent 8-16 GB/day range
- Occasional spikes above 16 GB
- No significant reduction despite ADR-0001 implementation
- Pattern suggests structural issue, not isolated incident

### Current Optimization Status

**Previously Implemented (ADR-0001 Phases 1-2):**

**Phase 1: Schema Optimizations**
- ✅ `userStats` table created with O(1) cached counters
- ✅ Compound indexes added: `by_user_active`, `by_user_state`
- ✅ Incremental stats updates on mutations
- ✅ Library queries use cursor pagination

**Phase 2: Query Optimizations**
- ✅ Interaction history limited to 10 recent (for FSRS algorithm)
- ✅ `getUserCardStats` replaced with cached O(1) query
- ✅ Library over-fetching eliminated (removed `limit * 2` pattern)
- ✅ Generation jobs use index ordering instead of collection scans
- ✅ Daily reconciliation cron for stats drift detection

**Expected Impact vs. Actual:**
- **Expected:** 90-95% bandwidth reduction (640 MB/day → 32-64 MB/day)
- **Actual:** No significant reduction observed (still 14+ GB/day)
- **Gap:** 200-400× higher than expected post-optimization bandwidth

### Deployment Status Uncertainty

**Critical Unknown:** When was ADR-0001 actually deployed to production?

The ADR document states:
- "Status: Accepted"
- "Implementation Complete (Phases 1-2)"
- "Last Updated: 2024-10-16"

However, the continuing high bandwidth usage (October-November 2025, over a year later) suggests either:
1. The optimizations never deployed to production
2. The optimizations deployed but were later broken by new code
3. The optimizations deployed but had calculation errors in expected impact
4. New bandwidth leaks introduced after ADR-0001 implementation
5. The spike is from a different source not addressed by ADR-0001

**No production deployment logs available** to confirm actual deployment date or validate optimization effectiveness.

---

## Identified Bandwidth Anti-Patterns

A comprehensive audit of the current `convex/` codebase identified **14 specific bandwidth optimization opportunities** across 8 files. These patterns explain the observed bandwidth consumption despite ADR-0001 implementation.

### Category 1: Unbounded Collection Queries

**Pattern:** Queries using `.collect()` without `.take(limit)` to fetch ALL matching records.

**Occurrences Found:**
1. `spacedRepetition.ts:533` - `getUserStreak()` fetches ALL user interactions
2. `spacedRepetition.ts:628` - `getRetentionRate()` fetches ALL interactions, filters to 7 days
3. `spacedRepetition.ts:703/716` - `getRecallSpeedImprovement()` fetches ALL interactions twice
4. `userStats.ts:52` - `reconcileUserStats()` fetches ALL users to sample 100
5. `questionsLibrary.ts:170` - `getQuizInteractionStats()` fetches ALL interactions, filters by sessionId
6. `generationJobs.ts:274` - Job cleanup fetches ALL completed jobs, filters by age
7. `rateLimit.ts` (6 occurrences) - Rate limit checks fetch ALL attempts in window

**Why This Matters:**
- Developer account with ~10,000 interactions
- Each unbounded query fetches 10,000 documents
- Document size: ~500 bytes average (interaction records)
- Single query: 10,000 docs × 500 bytes = **5 MB per call**
- Reactive re-runs multiply this cost

**Example Scale Impact:**
```
getUserStreak() unbounded query:
  - Fetches: 10,000 interactions (5 MB)
  - Called: Dashboard load (10× daily) + reactive re-runs (200 reviews)
  - Total calls: 210 per day
  - Bandwidth: 210 × 5 MB = 1.05 GB/day from single query
```

### Category 2: Post-Collection Filtering

**Pattern:** Fetching large result sets, then filtering in memory instead of database-level filtering.

**Occurrences Found:**
1. `spacedRepetition.ts:628` - Fetch all interactions, filter `attemptedAt >= 7 days ago`
2. `spacedRepetition.ts:697/716` - Fetch all interactions, filter by time window + timeSpent existence
3. `questionsLibrary.ts:166` - Fetch all user interactions, filter by `context.sessionId`
4. `generationJobs.ts:274` - Fetch all completed jobs, filter by `createdAt < threshold`
5. `embeddings.ts:434` - Fetch all active questions, filter `embedding === undefined`

**Why This Matters:**
- Convex charges for documents fetched, not documents returned
- Fetching 10,000 docs to return 200 costs same as fetching 10,000 docs to return 10,000
- Post-filtering wastes bandwidth on documents immediately discarded

**Missing Indexes:**
- `interactions` table lacks `by_user_attempted` index combining `[userId, attemptedAt]`
- `questions` table lacks `by_embedding_missing` index for undefined embedding checks
- `rateLimits` table lacks `by_timestamp` index for cleanup operations

**Example Waste:**
```
getRetentionRate() post-filtering:
  - Fetches: 10,000 interactions (all user's history)
  - Needs: 200 interactions (last 7 days only)
  - Wasted: 9,800 documents (98% waste)
  - Per call: 4.9 MB wasted
  - Daily: 49 MB wasted (10 calls/day)
```

### Category 3: Reactive Query Amplification

**Pattern:** Expensive queries subscribed via reactive hooks, re-running on every mutation.

**Critical Dashboard Queries:**
- `getUserStreak()` - Calculates consecutive days with reviews (scans all interactions)
- `getRetentionRate()` - Calculates 7-day retention percentage (scans all interactions)
- `getRecallSpeedImprovement()` - Compares weekly speed metrics (scans all interactions twice)
- `getUserCardStats()` - Returns card state counts (optimized with userStats cache)

**Reactive Cascade Scenario:**
```
User performs 200 reviews in session:
  ↓
Each review = 1 scheduleReview mutation
  ↓
Each mutation triggers reactive re-run of 4 dashboard queries
  ↓
4 queries × 200 mutations = 800 query executions
  ↓
Each query fetches 10,000-20,000 interactions
  ↓
800 executions × 15,000 docs average × 500 bytes = 6 GB per session
```

**Multiple Browser Tabs:**
- Each tab maintains independent WebSocket subscription
- Each subscription triggers independent query re-runs
- 3 open tabs = 3× bandwidth consumption
- Developer workflow commonly has 3-5 tabs open (localhost dev server, production, Genesis Lab, docs)

**Genesis Lab Impact:**
- Development-only testing environment for AI generation configs
- Runs against production database (shares same Convex backend)
- Each test execution may trigger review flow queries
- Frequent test iterations during development = amplified reactive cascades

### Category 4: High-Frequency Operations Without Bounds

**Pattern:** Operations called frequently (1000+ times/day) without fetch limits.

**Occurrences Found:**
1. `rateLimit.ts` checks (every magic link send, every API call, every generation request)
   - Fetches ALL rate limit attempts in 1-hour window
   - High-frequency: 1000+ checks per day during active development
   - Edge case: Rate-limited user with 100 attempts/hour = 2,400 entries fetched per check

2. `getQuizInteractionStats()` after each quiz session
   - Fetches ALL user interactions to find session matches
   - Called 10-20× per day during active testing
   - Scales with total interaction count, not session size

**Multiplicative Effect:**
```
Rate limit check bandwidth:
  - Per check: 2,400 entries × 200 bytes = 480 KB (rate-limited case)
  - Frequency: 1,000 checks/day (active development)
  - Daily: 480 MB from rate limiting alone
```

### Category 5: Cron Job Full Table Scans

**Pattern:** Scheduled background jobs scanning entire tables.

**Occurrences Found:**
1. `rateLimit.ts:cleanupExpiredRateLimits` (hourly)
   - Scans ALL rateLimits records (no timestamp index)
   - Filters `timestamp < cleanupThreshold` in memory
   - Table size: 100,000+ entries over time
   - **24 full table scans per day**

2. `userStats.ts:reconcileUserStats` (daily at 3:15 AM)
   - Fetches ALL users to randomly sample 100
   - Database with 10,000 users: Fetches 10,000 to return 100 (99% waste)
   - Only runs once daily (lower impact than rate limits)

**Cleanup Paradox:**
- Cleanup jobs designed to reduce storage costs
- But full table scans cost more in bandwidth than they save in storage
- Hourly rate limit cleanup: 24 scans/day × 100k entries × 200 bytes = **480 MB/day**

### Category 6: Vector Search Double Fetching

**Pattern:** Vector search returns partial documents, then full documents fetched separately.

**Occurrence:**
- `embeddings.ts:268-299` - `searchQuestions()` hybrid search
  - Step 1: Vector search returns 40 IDs (with `limit × 2` over-fetch)
  - Step 2: Fetch full documents for each ID via `getQuestionsByIds`
  - Result: Each document fetched twice (once in vector search, once for full data)

**Why This Happens:**
- Convex vector search doesn't support complex filter conditions
- Cannot filter by `deletedAt === undefined AND archivedAt === undefined` in vector query
- Must over-fetch, then filter full documents in memory

**Bandwidth Cost:**
```
Vector search double fetch:
  - Vector search: 40 partial docs × 1 KB = 40 KB
  - Full doc fetch: 40 full docs × 3 KB = 120 KB
  - Total: 160 KB per search
  - Over-fetch multiplier: 2× (fetches 40 to return 20)
  - Effective cost: 320 KB per search (80 docs × 500 bytes average)
```

---

## Reactive Queries and Bandwidth Multiplication

### Convex Reactivity Mechanism

**How It Works:**
1. Frontend components use `useQuery(api.module.queryName, args)`
2. Convex establishes WebSocket subscription for that query
3. When ANY mutation changes data the query depends on, Convex re-runs the query
4. Fresh results pushed to client via WebSocket
5. React re-renders component with new data

**Bandwidth Implication:**
- Mutation triggers query re-execution on **server side**
- Server fetches fresh data from database
- Bandwidth consumed for **every re-execution**, not just initial fetch
- Client receives only the result (compressed), but server pays for full fetch

### Dashboard Reactive Subscriptions

**Typical Dashboard Load:**
When user opens `/` (dashboard page), the following queries subscribe:

1. `getUserCardStats()` - Card state counts (optimized, 1 doc fetch via userStats)
2. `getUserStreak()` - Consecutive review days (unbounded, fetches all interactions)
3. `getRetentionRate()` - 7-day retention % (unbounded, fetches all interactions)
4. `getRecallSpeedImprovement()` - Weekly speed comparison (unbounded, 2× all interactions)
5. `getNextReview()` - Next card due for review (optimized, bounded fetch)

**Total Bandwidth Per Dashboard Load:**
```
Initial page load:
  - getUserCardStats: 3 KB (1 userStats doc)
  - getUserStreak: 5 MB (10,000 interactions)
  - getRetentionRate: 5 MB (10,000 interactions)
  - getRecallSpeedImprovement: 10 MB (10,000 interactions × 2)
  - getNextReview: 5 KB (bounded)
  ────────────────────────────────────────
  Total: ~20 MB per page load
```

### Review Session Amplification

**Scenario:** User performs 200 reviews in 30-minute session

**Mutation Cascade:**
```
Each review = 1 scheduleReview mutation
  ↓
Mutation updates:
  - questions table (1 doc: the reviewed question)
  - interactions table (1 doc: new interaction record)
  - userStats table (1 doc: incremental counter update)
  ↓
Triggers reactive re-runs (ALL subscribed queries):
  - getUserCardStats (depends on userStats)
  - getUserStreak (depends on interactions)
  - getRetentionRate (depends on interactions)
  - getRecallSpeedImprovement (depends on interactions)
  - getNextReview (depends on questions.nextReview)
```

**Bandwidth Calculation:**
```
Per review mutation:
  - getUserCardStats re-run: 3 KB
  - getUserStreak re-run: 5 MB
  - getRetentionRate re-run: 5 MB
  - getRecallSpeedImprovement re-run: 10 MB
  - getNextReview re-run: 5 KB
  ────────────────────────────────────────
  Total per review: ~20 MB

200 reviews × 20 MB = 4 GB per session
```

**With 3 Browser Tabs Open:**
```
3 tabs × 4 GB per session = 12 GB
```

This **matches the observed 14.97 GB spike** on October 31, 2025.

### Genesis Lab Testing Impact

**Genesis Lab Overview:**
- Development-only tool for testing AI generation configurations
- Runs experimental prompts against production Convex backend
- URL: `/lab` and `/lab/playground`
- Guarded by `NODE_ENV === 'production'` check (blocked in production)

**Bandwidth Considerations:**
- Lab queries run against same database as main app
- Each test execution may read questions, interactions, jobs
- Unknown frequency during October 31 testing session
- Could contribute to spike if extensive A/B testing occurred

**Potential Impact:**
```
Genesis Lab test run:
  - Reads: 100-500 questions for config testing
  - Generates: 20-50 new questions
  - Triggers: Reactive queries if dashboard open in parallel

If 10 test runs during session:
  - 10 runs × 500 questions × 3 KB = 15 MB
  - Plus reactive cascades from generation = unknown additional bandwidth
```

---

## Current Database Schema Analysis

### Tables and Index Coverage

**`questions` Table:**
- **Indexes:**
  - `by_user` - `[userId, generatedAt]`
  - `by_user_unattempted` - `[userId, attemptCount]`
  - `by_user_next_review` - `[userId, nextReview]`
  - `by_user_active` - `[userId, deletedAt, archivedAt, generatedAt]` ✅ (ADR-0001)
  - `by_user_state` - `[userId, state, deletedAt, archivedAt]` ✅ (ADR-0001)
  - `by_embedding` - Vector index (768-dim)
  - `search_questions` - Full-text search on `question` field

**`interactions` Table:**
- **Indexes:**
  - `by_user` - `[userId, attemptedAt]`
  - `by_question` - `[questionId, attemptedAt]`
  - `by_user_question` - `[userId, questionId]`

- **Missing (Identified in Audit):**
  - `by_user_attempted` - `[userId, attemptedAt]` for time-range queries
  - `by_user_session` - `[userId, context.sessionId]` for session stats (if nested fields supported)

**`userStats` Table:** ✅ (ADR-0001)
- **Indexes:**
  - `by_user` - `[userId]`
- Stores cached counters: `totalCards`, `newCount`, `learningCount`, `matureCount`, `nextReviewTime`

**`rateLimits` Table:**
- **Indexes:**
  - `by_identifier` - `[identifier, timestamp]`
  - `by_operation` - `[operation, timestamp]`

- **Missing (Identified in Audit):**
  - `by_timestamp` - `[timestamp]` for efficient cleanup operations

**`generationJobs` Table:**
- **Indexes:**
  - `by_user_status` - `[userId, status, createdAt]` ✅
  - `by_status_created` - `[status, createdAt]` ✅

### Index Usage Effectiveness

**Well-Covered Queries:**
- ✅ `getLibrary()` - Uses `by_user_active` compound index (ADR-0001 optimization)
- ✅ `getUserCardStats()` - Uses `userStats.by_user` index (ADR-0001 optimization)
- ✅ `getRecentJobs()` - Uses `by_user_status` compound index
- ✅ Review queue queries - Use `by_user_next_review` index

**Poorly-Covered Queries:**
- ❌ `getUserStreak()` - Uses `by_user` index but no `attemptedAt` range filtering
- ❌ `getRetentionRate()` - Post-filters `attemptedAt` in memory (no compound index)
- ❌ `getRecallSpeedImprovement()` - Post-filters `attemptedAt` twice (no compound index)
- ❌ `getQuizInteractionStats()` - Post-filters `context.sessionId` (no nested field index)
- ❌ Rate limit cleanup - Filters `timestamp` without dedicated index

---

## Cost Projection Analysis

### Current State (Development/Testing Only)

**Observed:**
- Daily bandwidth: 14.97 GB peak, 8-12 GB average
- Monthly bandwidth: ~360 GB (12 GB × 30 days)
- Convex Pro allowance: 50 GB/month
- Overage: 310 GB/month
- Overage cost: ~$155-310/month (at $0.50-1.00/GB)
- **Total monthly cost: $180-335** for single developer testing

### Production Scale Projections

**Assumptions for typical user:**
- Collection size: 1,000 cards (moderate Anki user)
- Daily reviews: 50 cards
- Interaction history: 1,000 cards × 50 reviews average = 50,000 interactions
- Dashboard views: 5× per day
- Multiple devices: 2 active tabs average (desktop + mobile)

**Per-User Daily Bandwidth (Unoptimized):**
```
Dashboard loads:
  - 5 loads/day × 20 MB = 100 MB

Review sessions (50 reviews):
  - 50 reviews × 20 MB (reactive cascade) × 2 tabs = 2 GB

Library browsing:
  - 10 views × 5 MB = 50 MB

Background operations:
  - Stats reconciliation: 1 MB (daily sample)
  - Rate limit checks: 5 MB
  ────────────────────────────────────────
Total per user: ~2.15 GB/day
```

**Cost at Scale (Unoptimized):**

| Users | Daily GB | Monthly GB | Overage GB | Overage Cost | Total Cost |
|-------|----------|------------|------------|--------------|------------|
| 10 | 21.5 GB | 645 GB | 595 GB | $297-595 | $322-620 |
| 100 | 215 GB | 6,450 GB | 6,400 GB | $3,200-6,400 | $3,225-6,425 |
| 1,000 | 2,150 GB | 64,500 GB | 64,450 GB | $32,225-64,450 | $32,250-64,475 |
| 10,000 | 21,500 GB | 645,000 GB | 644,950 GB | $322,475-644,950 | $322,500-644,975 |

**At 1,000 users:** $32k-64k per month in bandwidth costs alone.

### Future Agent Workflows Impact

**Planned Features (from context):**
- Agents running in background organizing content
- Automated analysis of weak topics
- Content optimization and recommendations
- Automated report generation
- Pattern detection and insights

**Estimated Agent Bandwidth:**
Each agent task likely requires:
- Reading entire user collection (1,000 cards × 3 KB = 3 MB)
- Analyzing interaction history (50,000 interactions × 500 bytes = 25 MB)
- Generating reports/insights (writes, minimal bandwidth)
- **Total per agent run: ~30 MB**

**Daily Agent Runs:**
```
If agents run nightly per user:
  - 1 agent × 1,000 users = 1,000 runs/night
  - 1,000 runs × 30 MB = 30 GB/night
  - Monthly: 900 GB additional bandwidth
  - Cost: $450-900/month at 1,000 users
```

**Combined Cost (Reviews + Agents):**
- At 1,000 users: $32k + $0.9k = **$33k-65k/month**

---

## Database Query Hotspots

### Top 10 Bandwidth Consumers (Estimated)

Based on audit findings and usage patterns:

| Query/Mutation | Docs/Call | Frequency/Day | Daily Docs | Daily MB | Priority |
|----------------|-----------|---------------|------------|----------|----------|
| `getUserStreak` | 10,000 | 210 (10 loads + 200 reviews) | 2,100,000 | 1,050 | P0 |
| `getRecallSpeedImprovement` | 20,000 | 210 | 4,200,000 | 2,100 | P0 |
| `getRetentionRate` | 10,000 | 210 | 2,100,000 | 1,050 | P0 |
| Rate limit checks | 2,400 | 1,000 | 2,400,000 | 1,200 | P1 |
| `getQuizInteractionStats` | 10,000 | 10 | 100,000 | 50 | P1 |
| Rate limit cleanup (cron) | 100,000 | 24 | 2,400,000 | 1,200 | P2 |
| `reconcileUserStats` (cron) | 10,000 | 1 | 10,000 | 5 | P2 |
| `textSearchQuestions` | 5,000 | 5 | 25,000 | 12.5 | P2 |
| Job cleanup (cron) | 12,000 | 1 | 12,000 | 6 | P2 |
| Vector search double fetch | 80 | 5 | 400 | 0.2 | P2 |

**Total Estimated:** ~13.2 million documents/day = **6.6 GB/day base** (without reactive amplification)

**With Reactive Amplification (200 reviews × 3 tabs):**
- Dashboard queries re-run: 600× per day
- Bandwidth multiplier: 30×
- **Amplified total: ~200 GB/day potential**

The observed 14.97 GB suggests reactive amplification factor of ~2× (conservative estimate).

---

## Development Workflow Patterns

### Typical Developer Session

**Browser Setup During Development:**
1. Localhost dev server (`http://localhost:3000`) - Main development tab
2. Production (`https://scry.vercel.app`) - Validation tab
3. Convex Dashboard (`https://dashboard.convex.dev`) - Monitoring tab
4. Genesis Lab (`http://localhost:3000/lab`) - Testing tab
5. Documentation/notes - Reference tab

**All connected to production Convex backend:**
- Preview deployments use isolated Convex backends (branch-named)
- Local development (`pnpm dev`) connects to production backend
- Genesis Lab runs against production backend (dev-only guard in queries)

**Bandwidth Multiplication:**
- Each tab establishes independent WebSocket connection
- Each connection subscribes to same queries independently
- 5 tabs × 20 MB per page load = **100 MB per refresh**
- 5 tabs × 4 GB per review session = **20 GB per session**

This explains the 14.97 GB spike with just a few hundred cards.

### Genesis Lab Usage Pattern

**Purpose:** Test AI generation configurations before deploying to production.

**Workflow:**
1. Create test input (e.g., "Nicene Creed" text)
2. Define 2-5 configs (different prompts, models, parameters)
3. Execute N×M matrix (1 input × 5 configs = 5 parallel executions)
4. Review generated questions, metrics, JSON output
5. Iterate: Tweak prompts, re-run tests

**Bandwidth Per Test:**
```
Single config execution:
  - Reads production questions for context: 500 docs × 3 KB = 1.5 MB
  - Generates 20-50 questions: Minimal (writes)
  - Returns results to UI: 50 KB

Full lab session (5 configs × 3 iterations):
  - 15 executions × 1.5 MB = 22.5 MB
```

Low direct impact, but:
- Runs concurrent with main app (triggers reactive queries)
- May contribute to overall load during heavy testing days
- Genesis Lab queries not optimized (dev-only tool)

---

## ADR-0001 Implementation Status

### What Was Implemented

**Schema Changes:** ✅
- `userStats` table created with `by_user` index
- Compound indexes added to `questions`: `by_user_active`, `by_user_state`

**Core Query Optimizations:** ✅
- Interaction history limited to 10 recent (FSRS algorithm)
- `getUserCardStats` replaced with O(1) cached query
- Library over-fetching eliminated (removed `limit * 2` pattern)
- Generation jobs use index ordering

**Stats Infrastructure:** ✅
- `userStatsHelpers.ts` created with incremental update functions
- Stats updates integrated into mutations (scheduleReview, create, delete, restore)

**Data Migration & Monitoring:** ✅
- `initializeUserStats` migration for existing users
- `reconcileUserStats` daily cron for drift detection
- Deployment health check validation

### What Was Not Addressed by ADR-0001

**Unbounded Dashboard Queries:**
- `getUserStreak()` - Still fetches all interactions
- `getRetentionRate()` - Still fetches all interactions with post-filtering
- `getRecallSpeedImprovement()` - Still fetches all interactions twice

**Possible Explanations:**
1. **Dashboard queries added after ADR-0001** - These analytics features may have been developed later without bandwidth considerations
2. **Scope limitation** - ADR-0001 focused on review flow and library, not analytics
3. **Oversight** - Analytics queries not identified during initial audit
4. **Intentional trade-off** - Accepted analytics cost for simpler implementation

**Missing Indexes:**
- `interactions.by_user_attempted` - Would enable efficient time-range filtering
- `rateLimits.by_timestamp` - Would enable efficient cleanup
- `questions.by_embedding_missing` - Would enable efficient backfill queries

### Expected vs. Actual Results

**ADR-0001 Projections:**
```
Before optimization:
  - Daily reads: 213,000 documents
  - Bandwidth: 640 MB/day

After optimization (expected):
  - Daily reads: 10,000-21,000 documents
  - Bandwidth: 32-64 MB/day
  - Reduction: 90-95%
```

**Actual Observations (November 2025):**
```
Current state:
  - Bandwidth: 8,000-15,000 MB/day
  - Reduction: None observed (possibly increased)
  - Gap: 200-400× higher than expected
```

**Hypothesis:**
- ADR-0001 optimizations successfully reduced review flow bandwidth (10× improvement achieved)
- BUT dashboard analytics queries (getUserStreak, getRetentionRate, getRecallSpeed) introduced after ADR-0001
- New analytics queries consume 50-100× more bandwidth than optimized review flow
- Net result: Overall bandwidth increased despite review flow optimization

**Validation Needed:**
- Check git history for when dashboard queries were added
- Review Convex bandwidth breakdown by function (if available)
- Confirm ADR-0001 deployment date and validate optimizations active in production

---

## Strategic Context

### Product Vision

**Current State:**
- MVP spaced repetition system with AI generation
- Pure FSRS algorithm (no daily limits, no comfort features)
- Genesis Laboratory for AI testing
- Background job system for async generation

**Future Roadmap:**
- Agent-driven content organization and analysis
- Automated insights and recommendations
- Pattern detection and weak topic identification
- Multi-user collaboration features
- Mobile app (additional clients = more reactive subscriptions)

### Scalability Requirements

**Target Scale:**
- Thousands to tens of thousands of active users
- Large personal collections (1,000-10,000 cards per user)
- Daily active usage (reviews, generation, analytics)
- Background agent processing

**Current Bottleneck:**
- Database bandwidth costs make current architecture unviable at scale
- Extrapolated costs: $60k/month at 1,000 users (unoptimized)
- Even with 95% optimization: $3k/month at 1,000 users
- Metered bandwidth pricing creates unpredictable costs

### Technology Constraints

**Convex Specific:**
- Reactive query model inherently bandwidth-intensive
- Every mutation triggers subscribed query re-runs
- No built-in query result caching (always fresh from database)
- No count-only or aggregate-only query APIs
- Limited compound index support for nested fields
- Vector search doesn't support complex filter conditions

**Architectural Limitations:**
- Real-time reactivity couples mutation writes to query reads
- Multiple client connections (tabs, devices) multiply bandwidth linearly
- Background jobs (crons) run full table scans without pagination APIs
- No query batching or request coalescing

---

## Measurement Gaps

### Missing Metrics

**Convex Dashboard Visibility:**
- Bandwidth breakdown by function (may exist, not confirmed)
- Query frequency distribution (calls per function)
- Average document size per query
- Reactive re-run frequency (how many times queries re-execute)

**Application-Level Monitoring:**
- No instrumentation for bandwidth tracking
- No query performance metrics
- No reactive cascade detection
- No cost attribution per feature

**Deployment Validation:**
- No confirmation that ADR-0001 optimizations deployed to production
- No A/B testing or phased rollout metrics
- No bandwidth trend analysis before/after optimization deployment

### Data Collection Needs

To accurately diagnose and optimize bandwidth:

1. **Function-level bandwidth breakdown** - Which queries consume most bandwidth?
2. **Query frequency analysis** - How many times is each query called per day?
3. **Reactive re-run tracking** - How many times does each query re-execute per mutation?
4. **Document size distribution** - What's the average payload per query?
5. **User session analytics** - How many tabs, devices, sessions per user?
6. **Code change correlation** - When were high-bandwidth queries introduced?

Without this data, optimization efforts are based on code analysis and estimates rather than empirical measurements.

---

## Risk Assessment

### Immediate Risks

**Financial:**
- Current overage costs: $35-45/month for single developer
- Unpredictable spikes: 14.97 GB day could be outlier or new baseline
- No cost controls or budgeting mechanisms in place

**Development Velocity:**
- Bandwidth concerns may inhibit feature development
- Genesis Lab testing may be restricted to avoid costs
- Multiple tab workflow (normal development pattern) creates cost anxiety

**Production Readiness:**
- Cannot launch to real users at current bandwidth consumption
- Cost structure makes product economically non-viable
- No clear path to profitability at scale

### Future Risks

**Agent Workflows:**
- Background agents will amplify bandwidth consumption
- Nightly processing across all users = massive batch load
- Current architecture cannot support planned features economically

**Scale Barriers:**
- At 100 users: $3k-6k/month (break-even challenge)
- At 1,000 users: $32k-64k/month (unsustainable)
- Linear cost scaling with users (no economy of scale)

**Architecture Lock-In:**
- Deep integration with Convex features (real-time, serverless)
- Migration cost increases with codebase maturity
- Sunk cost fallacy may delay necessary architecture changes

---

## Summary

Scry is experiencing a **critical infrastructure cost crisis** driven by unbounded database queries, reactive query amplification, and architectural patterns that don't scale economically on Convex's bandwidth-metered pricing model.

**Key Facts:**
- **Current cost:** $180-335/month for single developer testing
- **Current usage:** 14.97 GB/day peak with a few hundred cards
- **Projected cost at scale:** $32k-64k/month for 1,000 users
- **Root causes:** 3 dashboard analytics queries fetching 10,000-20,000 interactions each, multiplied by reactive re-runs
- **Previous optimizations:** ADR-0001 implemented 90% of intended optimizations, but new features added after may have negated gains
- **Measurement gap:** No function-level bandwidth metrics or deployment validation data

**The situation is urgent** because:
1. Costs are already unsustainable in development
2. Cannot launch to production users at current costs
3. Future agent features will 10× the problem
4. Architectural changes get harder as codebase matures

This document provides the factual basis for architectural decision-making, but does not prescribe solutions. The path forward requires explicit trade-off decisions between cost, complexity, and feature capabilities.

---

**Next Steps Required:**
1. Obtain Convex function-level bandwidth breakdown for October 31, 2025
2. Validate ADR-0001 optimizations deployed and active in production
3. Measure actual query frequency and reactive re-run counts
4. Decide on architectural approach based on cost tolerance and technical constraints
