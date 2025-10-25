# TODO: Vector Embeddings - Ready for Merge

**Branch**: `feature/vector-embeddings-foundation`
**PR**: [#47](https://github.com/phrazzld/scry/pull/47)
**Status**: All blocking issues resolved ✅

---

## Completed Fixes ✅

- **CB-1**: Args validation fixed (convex/embeddings.ts:77)
- **CB-2**: Error handling with graceful degradation (convex/embeddings.ts:214-228)
- **CR-1**: Bandwidth optimization with DB-level filtering (convex/questionsLibrary.ts:211-253)
- **CR-2**: Vector search archived view post-filtering (convex/embeddings.ts:282-305)
- **CR-4**: Batch error logging with question details (convex/aiGeneration.ts:417-430)
- **CR-6**: Query length validation (convex/embeddings.ts:211-217)

**Total time invested**: ~2.5 hours

---

## Optional Improvements (Not Blocking)

### CR-3: Add initial backfill migration [1.5hr]

**Why**: Daily cron backfills 100/day = 100 days for 10K questions. One-time migration provides immediate value.

**Implementation**: Add `backfillEmbeddingsInitial` to `convex/migrations.ts`:
- Schedule embedding generation with 10-sec delays
- Run in batches of 100 with 1-hour delays between batches
- Monitor via Pino logs

**Decision**: Optional - cron provides safety net, MVP valuable without instant rollout.

---

### CR-5: Strengthen rate limit protection [30min]

**Current**: 10 parallel requests, 1-sec delay between batches
**Proposed**: 5 parallel requests, 2-sec delay

**Analysis**: Google free tier = 20M tokens/month (~55K/day). Daily sync = 2,000 tokens/day. Well under limits.

**Decision**: Monitor Pino logs for 429 errors first. Reduce batch size if needed post-launch.

---

### CR-7: Adjust cron schedule [2min]

**Current**: Embedding sync at 3:30 AM
**Proposed**: Move to 4:00 AM (avoid overlap with stats reconciliation at 3:15 AM)

**Why**: Prevent resource contention between cron jobs.

---

## Pre-Merge Checklist

**Tests**:
- [x] TypeScript compiles without errors
- [x] Unit tests pass
- [ ] Manual test: Generate questions → verify embeddings (768 dimensions)
- [ ] Manual test: Search in all views (active/archived/trash)
- [ ] Manual test: Graceful degradation (remove `GOOGLE_AI_API_KEY`)

**Verification**:
- [ ] Review PR description matches implementation
- [ ] BACKLOG.md updated with follow-up work
- [ ] Commits squashed/cleaned if needed

**Post-Merge Monitoring**:
- [ ] Pino logs show embedding success rate >90%
- [ ] Search latency <2 seconds
- [ ] Sync cron executes daily without errors
- [ ] No bandwidth spikes (monitor Convex dashboard)

---

## Context & Notes

**Why This Feature**:
- Enables semantic search ("React state management" finds useState, useReducer, Context)
- Foundation for deduplication (find similar questions)
- MVP validates embedding quality before building complex features

**Key Decisions**:
- **Inline generation**: Embeddings generated during background job (no user-facing latency)
- **Hybrid search**: Vector + text (catches both semantic + keyword matches)
- **Graceful degradation**: Questions save without embeddings if API fails
- **Daily sync cron**: Backfills 100/day as safety net

**Technical Details**:
- Google `text-embedding-004`: 768 dimensions, free tier 20M tokens/month
- Convex vector search: Native platform feature, filterFields for userId/deletedAt/archivedAt
- Storage: 6KB per question (60MB for 10K questions)
- Bandwidth: ~300KB per search (<0.03% monthly quota)

**Follow-Up Work**: See BACKLOG.md - "Vector Search Robustness Improvements" (11hr of polish deferred post-launch)
