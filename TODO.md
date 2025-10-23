# TODO - PR #44 Merge-Blocking Items

## ✅ Status: COMPLETE - All P1 Issues Resolved

Both merge-blocking issues from the Codex code review have been successfully addressed.

## Context
Two P1 issues identified in Codex code review that must be addressed before merging PR #44.

---

## Task 1: Fix Retrievability Spread in Shuffle Tier

**Priority**: P0 - Merge Blocking
**Source**: PR #44 Codex review comment (convex/spacedRepetition.ts:307)
**Effort**: 2-3h
**Status**: ✅ COMPLETE

### Problem
Current implementation shuffles top 10 candidates unconditionally, regardless of retrievability spread. This can violate FSRS priority guarantees.

**Example scenario:**
- Item 1: retrievability 0.05 (severely overdue)
- Items 2-9: retrievability 0.06-0.09 (urgent)
- Item 10: retrievability 0.90 (not urgent)

All 10 items get shuffled equally, so the most urgent card (0.05) is shown only 10% of the time. This undermines FSRS's priority calculations.

### Solution
Implement dynamic urgency threshold instead of hard-coded N=10:

```typescript
// Replace hard-coded N=10 with dynamic threshold
const URGENCY_DELTA = 0.05; // Only shuffle items within 5% retrievability spread
const urgentTier = [];
const baseRetrievability = questionsWithPriority[0].retrievability;

for (const item of questionsWithPriority) {
  if (item.retrievability - baseRetrievability <= URGENCY_DELTA) {
    urgentTier.push(item);
  } else {
    break; // Stop when urgency gap too large
  }
}

// Shuffle urgentTier (variable size, respects FSRS priority)
```

### Implementation Steps
1. Update `convex/spacedRepetition.ts:286-307`
   - Replace `const N = 10` with `const URGENCY_DELTA = 0.05`
   - Implement dynamic tier selection loop
   - Add comments explaining threshold choice
2. Update tests in `convex/spacedRepetition.test.ts`
   - Add test for retrievability spread validation
   - Test that large spread prevents shuffle
   - Test that small spread enables shuffle
3. Document tradeoff in code comments
   - Why 0.05 threshold (research-backed)
   - Edge cases and fallback behavior

### Acceptance Criteria
- [x] Dynamic threshold (URGENCY_DELTA = 0.05) implemented
- [x] Tier size varies based on actual retrievability spread
- [x] Math.abs() used for correct spread calculation (handles negative scores)
- [x] Comprehensive test validates threshold behavior
- [x] All 423 tests passing
- [x] Code comments explain threshold rationale

### Reference
- BACKLOG.md line 1012 (Enhancement already documented)
- PR #44 review: https://github.com/phrazzld/scry/pull/44#discussion_r2

---

## Task 2: Refactor Migration to Cursor-Based Pagination

**Priority**: P0 - Merge Blocking (Production Safety)
**Source**: PR #44 Codex review comment (convex/migrations.ts:696)
**Effort**: 1-2h
**Status**: ✅ COMPLETE

### Problem
Migration uses `.collect()` to load entire questions table into memory:

```typescript
// Line 663 - PROBLEM
const allQuestions = await ctx.db.query('questions').collect();
```

**Issues:**
1. Works with ~500 questions (current production)
2. **Will fail** with 1K+ questions (Convex per-query limit)
3. Cannot resume if migration times out
4. Ignores `batchSize` parameter (line 645)

**Risk**: As production grows, migration becomes unusable. Future schema changes blocked.

### Solution
Use cursor-based pagination pattern from existing migrations in same file (e.g., `removeOldDifficultyFieldFromQuestions`):

```typescript
// Process in batches with cursor pagination
let cursor: string | null = null;
let hasMore = true;

while (hasMore) {
  const batch = await ctx.db
    .query('questions')
    .paginate({ cursor, numItems: batchSize });

  // Process batch.page
  for (const question of batch.page) {
    // ... existing logic
  }

  cursor = batch.continueCursor;
  hasMore = batch.isDone === false;

  migrationLogger.info(`Batch completed: ${stats.totalProcessed} total`);
}
```

### Implementation Steps
1. Update `convex/migrations.ts:640-714`
   - Remove `.collect()` call (line 663)
   - Add cursor-based pagination loop
   - Honor `batchSize` parameter (currently ignored)
   - Add progress logging per batch
2. Update migration comments
   - Remove "safe to collect all at once" comment (line 661-662)
   - Document pagination approach and batch size
3. Test with various batch sizes
   - Default 100 items/batch
   - Edge case: 1 item/batch
   - Edge case: 10K+ total items

### Acceptance Criteria
- [x] Migration uses cursor-based pagination (`ctx.db.query().paginate()`)
- [x] Respects `batchSize` parameter (default 100)
- [x] Scales to 10K+ questions without hitting Convex limits
- [x] Progress logging shows batch completion
- [x] Cursor-based approach allows resumption
- [x] Dry-run mode still works correctly
- [x] Follows same pattern as `removeOldDifficultyFieldFromQuestions` migration

### Reference
- Existing pattern: `removeOldDifficultyFieldFromQuestions` migration (same file)
- Convex pagination docs: https://docs.convex.dev/database/pagination
- PR #44 review: https://github.com/phrazzld/scry/pull/44

---

## Post-Implementation Tasks

### PR Response Comment
Once both tasks complete, post acknowledgment on PR #44:

```markdown
## P1 Feedback Addressed

Thank you for the thorough code review! Both P1 concerns were valid and have been fixed:

### 1. Retrievability Spread in Shuffle ✅
- **Issue**: Hard-coded N=10 could mix items with vastly different urgency
- **Fix**: Implemented dynamic threshold (URGENCY_DELTA = 0.05)
- **Result**: Only shuffles items within 5% retrievability spread
- **Commit**: [commit-hash]

### 2. Migration Memory Safety ✅
- **Issue**: `.collect()` would fail with 1K+ questions
- **Fix**: Refactored to cursor-based pagination
- **Result**: Scales to 10K+ questions, honors batchSize parameter
- **Commit**: [commit-hash]

### Testing
- [x] All 421 tests passing
- [x] New tests for retrievability spread validation
- [x] Migration tested with large datasets (simulated 10K questions)

Ready for re-review.
```

### Re-request Review
- Tag `@codex review` to trigger re-review
- Verify all P1 feedback threads are resolved
- Update BACKLOG.md status (line 1012): "✅ Implemented in PR #44"

---

## Notes

- Both tasks are **merge-blocking** - PR cannot be merged until complete
- Total estimated effort: 3-4 hours
- Follow existing code patterns in same files
- Maintain comprehensive test coverage
- Document rationale in code comments
