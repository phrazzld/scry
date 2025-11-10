# Convex Bandwidth Guardrails

This guide captures the patterns and anti-patterns uncovered during the bandwidth hardening effort. The goal is simple: **never fetch more than you need**. Every Convex query must be predictable in the number of documents it reads or writes.

## Golden Rules

1. **Ban `.collect()` in runtime code paths.** Use `.take()` for bounded lists or `.paginate()` when you truly need to iterate.
2. **Always index for the filter you need.** Client-side filtering after `.collect()` is not acceptable.
3. **Stream large workloads.** Scan in fixed-size batches (100–200 docs) and stop as soon as you have enough data.
4. **Surface truncation.** When you cap results (e.g., quiz sessions at 1,500 interactions), return an `isTruncated` flag so callers can warn users instead of hiding data loss.
5. **Codify regression suites.** High-volume Vitest fixtures (>1,100 docs) guard every critical path against accidental `.collect()` calls.

## Recipes

### Random sampling without full scans

```ts
const SAMPLE_SIZE = 100;
const pivot = randomBetween(minCreatedAt, maxCreatedAt);
const sampled = await ctx.db
  .query('users')
  .withIndex('by_created_at', (q) => q.gte('createdAt', pivot))
  .order('asc')
  .take(SAMPLE_SIZE);
```

### Paginated scans

```ts
const PAGE_SIZE = 200;
let page = await query.paginate({ numItems: PAGE_SIZE, cursor: null });
while (true) {
  process(page.page);
  if (page.isDone) break;
  page = await query.paginate({ numItems: PAGE_SIZE, cursor: page.continueCursor });
}
```

### Bounded rate-limit reads

```ts
const recentAttempts = await ctx.db
  .query('rateLimits')
  .withIndex('by_identifier', (q) => q.eq('identifier', id).gt('timestamp', windowStart))
  .order('desc')
  .take(MAX_RATE_LIMIT_READS);
```

## Anti-Patterns (Never Ship)

- `.collect()` on tables that can grow beyond a few dozen documents.
- Filtering or sorting in JavaScript after fetching an unbounded result set.
- Deleting or patching thousands of documents with `Promise.all` over a `.collect()` result.
- Forgetting to document truncation or sampling behavior in the API response.

## Verification Checklist

1. **Indexes:** updated schema provides the exact index each query uses.
2. **Pagination:** every query that can return >50 docs uses `.paginate()` with a cap.
3. **Batched writes:** bulk mutations (deleteUser, migrations, etc.) patch in batches ≤200 docs.
4. **Tests:** `convex/bandwidth-regressions.test.ts` passes locally (requires installing dependencies).
5. **Docs:** this guide is linked from `README.md` and `BACKLOG.md` for future discoverability.
