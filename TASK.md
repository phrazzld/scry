
### [SCALABILITY][CRITICAL] Eliminate Unbounded .collect() Queries

**Files**:
- `convex/userStats.ts:52` - Reconciliation cron fetches ALL users
- `convex/rateLimit.ts` - Rate limit checks
- `convex/questionsLibrary.ts:getQuizInteractionStats` - Analytics
- `convex/clerk.ts:deleteUser` - User cleanup

**Perspectives**: performance-pathfinder, architecture-guardian (cross-validated by 2 agents)

**Problem**: Multiple queries use `.collect()` to fetch ALL records without pagination:
- **Reconciliation cron**: Fetches ALL users, uses `.sort(() => Math.random() - 0.5)` for sampling
  - With 100 users: 200ms query time ✓
  - **At 10,000 users: >10s (cron timeout), reconciliation FAILS** ✗
- **Rate limits**: O(N) bandwidth per request
- **Analytics**: Fetches entire interaction history
- Will cause **silent failures at scale**

**User Impact**: Daily reconciliation stops working → stats badges show incorrect counts → broken UX erosion

**Fix**:
```typescript
// userStats.ts:52 - Use random cursor sampling instead of fetch-all-then-filter
const SAMPLE_SIZE = 100;
const randomOffset = Math.floor(Math.random() * (allUserCount - SAMPLE_SIZE));

const sampled = await ctx.db
  .query('users')
  .withIndex('by_creation_time') // NEW INDEX REQUIRED
  .order('asc')
  .skip(randomOffset)
  .take(SAMPLE_SIZE);

// rateLimit.ts, questionsLibrary.ts, clerk.ts - Paginate all queries
// Use .take(limit) or .paginate() patterns
```

**Actions**:
1. Add `by_creation_time` index to users schema
2. Refactor reconciliation cron (userStats.ts:52) to use sampling
3. Refactor rate limit queries to use `.take(100)` + pagination
4. Add Vitest regression tests with >1,100 document fixtures
5. Document anti-pattern in `docs/guides/convex-bandwidth.md`

**Acceptance Criteria**:
- Reconciliation cron completes in <5s with 10,000 simulated users
- Rate limit queries bounded to <100 records max
- All runtime queries use `.take()` or `.paginate()`
- Tests prove no crash with 1,100+ documents

**Effort**: 1.5 days | **Priority**: P0 - Prevents catastrophic failure at 10k users

---
