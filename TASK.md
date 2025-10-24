# Vector Embeddings Infrastructure - Semantic Search Foundation

**Status**: Approved
**Timeline**: 3-4 days
**Priority**: P0 - FOUNDATIONAL

---

## Executive Summary

**Problem**: Users cannot find questions by semantic meaning, only by browsing paginated lists. With 100+ questions, finding related content becomes tedious.

**Solution**: Build vector embeddings infrastructure enabling hybrid search (text keywords + semantic similarity) in the question library.

**User Value**: Search by meaning, not just exact text matches. "React state management" finds useState, useReducer, Context API questions even if those exact words aren't in the query.

**Success Criteria**:
- Questions generated with embeddings automatically
- Hybrid search returns semantically relevant results
- Manual QA validates embedding quality
- Foundation ready for deduplication feature (future work)

---

## User Context

**Who**: Learners with growing question libraries (50-500+ questions)

**Problems Being Solved**:
1. Can't find specific questions without scrolling through pages
2. Don't know what related questions exist for a topic
3. Manual organization (tags, collections) is tedious

**Measurable Benefits**:
- Search library in <2 seconds vs. 30+ seconds of browsing
- Discover 5-10 related questions instantly
- Validate embedding quality before building auto-deduplication

---

## Requirements

### Functional Requirements

**FR1: Automatic Embedding Generation**
- All newly generated questions receive embeddings automatically
- Embedding generated during background question generation job
- No user action required, no user-facing latency

**FR2: Hybrid Search**
- Users can search library by text query
- Returns results from both text matching AND semantic similarity
- Filters respect view state (active/archived/trash)
- Results ranked by relevance with similarity scores

**FR3: Backfill Safety Net**
- Daily cronjob identifies questions without embeddings
- Generates embeddings for up to 100 questions/day
- Retries failed generations gracefully

**FR4: Search UI**
- Search input in library header
- Loading state during search
- Results display with similarity scores
- Clear "no results" state

### Non-Functional Requirements

**NFR1: Performance**
- Embedding generation: <300ms per question
- Search response: <2 seconds for 50 results
- No user-facing latency (background job)

**NFR2: Bandwidth Efficiency**
- Single search: <500KB bandwidth
- Monthly search quota: <1% of 1GB Convex limit
- Embedding storage: 6KB per question

**NFR3: Reliability**
- Graceful degradation if embedding fails
- Questions save successfully even without embeddings
- Sync cron self-heals embedding gaps

**NFR4: Security**
- User can only search their own questions
- Server-side filtering enforces userId isolation
- No embedding data leakage between users

---

## Architecture Decision

### Selected Approach: Inline Background Generation + Hybrid Search

**Why This Approach**:
1. **User Value**: Embedding quality validated through search before building complex features (deduplication)
2. **Simplicity**: Leverages existing background job infrastructure, minimal new complexity
3. **Explicitness**: Questions either have embeddings or don't (optional field), no hidden state

**Alternatives Considered**:

| Approach | Value | Simplicity | Explicitness | Why Not Chosen |
|----------|-------|------------|--------------|----------------|
| **Inline Background Generation** (SELECTED) | HIGH - Immediate search | HIGH - Reuses job system | HIGH - Clear optional field | ✅ SELECTED |
| On-demand generation (lazy) | LOW - Search delay | MEDIUM - New lazy load logic | LOW - Hidden loading state | Deferred search UX |
| Client-side embedding | LOW - Can't do semantic search | LOW - Heavy client computation | MEDIUM - Clear client state | Impossible (need server for similarity) |

### Module Boundaries

**`convex/embeddings.ts`** (NEW):
- **Interface**: `searchQuestions(query, limit, view)`, `syncMissingEmbeddings()`
- **Responsibility**: Embedding generation, vector search, backfill coordination
- **Hidden Complexity**: Google AI API calls, cosine similarity computation, rate limiting

**`convex/aiGeneration.ts`** (MODIFIED):
- **New Responsibility**: Generate embeddings inline during question generation
- **Interface Change**: None (internal implementation detail)
- **Hidden Complexity**: Embedding generation failures gracefully degrade

**`convex/cron.ts`** (MODIFIED):
- **New Responsibility**: Schedule daily embedding sync
- **Interface**: Daily cron job at 3 AM UTC
- **Hidden Complexity**: Rate limiting, batch processing

**`app/library/_components/library-client.tsx`** (MODIFIED):
- **New Feature**: Search input with hybrid search
- **Interface**: Text input, debounced search, results display
- **Hidden Complexity**: Loading states, error handling, result ranking

### Abstraction Layers

**Layer 1: Database Schema** (Convex)
- Vocabulary: `embedding`, `vectorIndex`, `vectorSearch`
- Concepts: Float64 arrays, cosine similarity, filter fields

**Layer 2: Embedding Service** (`embeddings.ts`)
- Vocabulary: `generateEmbedding`, `searchQuestions`, `syncMissing`
- Concepts: Semantic similarity, hybrid search, graceful degradation
- **Abstraction**: Hides Google AI API, vector math, batch processing

**Layer 3: UI Components** (React)
- Vocabulary: `SearchInput`, `SearchResults`, `SimilarityScore`
- Concepts: User query, search results, relevance ranking
- **Abstraction**: Hides embeddings, vector search, API calls

---

## Dependencies & Assumptions

### Dependencies

**Existing (Already Integrated)**:
- `@ai-sdk/google` (v1.2.22): Provides `embed()` function
- `ai` (v4.3.16): Provides `embed` and `embedMany` utilities
- Convex vector search: Native platform feature
- Pino logger: Structured logging infrastructure

**New Dependencies**: None

### Assumptions

**Scale**:
- Average user has <1,000 questions
- Average question text: 100-200 tokens
- Search frequency: <50 queries/day/user

**Environment**:
- `GOOGLE_AI_API_KEY` configured in Convex backend
- Google free tier quota: 20M tokens/month (sufficient for 100K questions/month)
- Convex Starter plan: 1GB bandwidth/month

**Technical**:
- Convex vector search supports filtering by `undefined` fields (for deletedAt, archivedAt)
- Embedding generation adds ~200-300ms per question (acceptable in background)
- `text-embedding-004` produces stable 768-dimensional embeddings
- Cosine similarity >0.7 indicates semantic relevance

**User Behavior**:
- Users will manually QA search results to validate quality
- Similarity score distribution will inform deduplication threshold (future work)
- Search is exploratory, not critical path (graceful degradation acceptable)

### Environment Variables

**Required**:
- `GOOGLE_AI_API_KEY`: Already configured for question generation

**Optional**: None

---

## Implementation Phases

### Phase 1: Schema & Inline Generation (Day 1-2)

**Deliverables**:
- Schema updated with `embedding` field (optional, 768 dimensions)
- Vector index `by_embedding` with filterFields: userId, deletedAt, archivedAt
- `aiGeneration.ts` modified to generate embeddings inline
- `questionsCrud.ts` accepts optional embedding parameter
- Pino logging for embedding generation success/failure

**Testing**:
- Generate 10 questions, verify embeddings present in DB
- Check embedding dimensions (should be 768)
- Verify Pino logs show embedding generation metrics
- Confirm questions save successfully even if embedding fails

**Acceptance Criteria**:
- New questions have `embedding` field populated
- Embeddings are 768-dimensional float64 arrays
- No user-facing latency increase (already background job)
- Graceful degradation: Questions save without embeddings on failure

---

### Phase 2: Search Implementation (Day 2-3)

**Deliverables**:
- `convex/embeddings.ts` module with `searchQuestions` action
- Hybrid search: Combine text search + vector search results
- Merge and deduplicate results by question ID
- Rank by relevance (similarity score)
- Filter by userId, view state (active/archived/trash)

**Search Algorithm**:
```typescript
1. Generate embedding for user query
2. Vector search: ctx.vectorSearch() with filters
3. Text search: ctx.db.query() with .search() (keyword matching)
4. Merge results: Deduplicate by _id, rank by score
5. Return top 20-50 results
```

**Testing**:
- Search "React hooks" → returns useState, useEffect, useContext questions
- Search "photosynthesis" → returns biology questions, not unrelated topics
- Verify filters work: active view excludes deleted/archived
- Check similarity scores: >0.7 for relevant, <0.5 for unrelated

**Acceptance Criteria**:
- Search returns semantically similar questions
- Text search catches keyword matches
- Filters respect view state (active/archived/trash)
- Results ranked by relevance (highest scores first)

---

### Phase 3: UI Integration (Day 3)

**Deliverables**:
- Search input in library header
- Debounced search (300ms delay)
- Loading spinner during search
- Results display with similarity scores
- Empty state for no results
- Error handling for search failures

**UI Components**:
- `<SearchInput>`: Text input with debounce
- `<SearchResults>`: Question cards with similarity badges
- `<SimilarityScore>`: Visual indicator (0.0-1.0 scale)

**Testing**:
- Type "React" → see loading spinner → see results
- Verify debounce: Typing quickly doesn't trigger multiple searches
- Check empty state: Search "xyzabc" shows "No results"
- Error handling: Disconnect network, verify error message

**Acceptance Criteria**:
- Search input visible in library header
- Results appear within 2 seconds
- Similarity scores displayed as badges (e.g., "95% match")
- Loading and error states work correctly

---

### Phase 4: Backfill & Monitoring (Day 3-4)

**Deliverables**:
- Daily cron: `syncMissingEmbeddings` scheduled at 3 AM UTC
- Batch processing: 100 questions/day, parallel batches of 10
- Rate limit protection: Delays between batches
- Graceful failure handling: Log errors, skip to next batch
- Monitoring: Pino logs for sync progress, success rate

**Sync Algorithm**:
```typescript
1. Query questions where embedding === undefined (limit 100)
2. Chunk into batches of 10
3. For each batch:
   - Generate embeddings in parallel
   - Save to DB
   - Log success/failure
4. Sleep 1 second between batches (rate limit protection)
```

**Testing**:
- Create 150 questions without embeddings
- Run cron manually
- Verify 100 embeddings generated, 50 remain for next run
- Check logs: Success count, failure count, duration
- Test failure scenario: Invalid API key → graceful skip

**Acceptance Criteria**:
- Cron runs daily at 3 AM UTC
- Processes up to 100 questions/day
- Logs show success/failure metrics
- Failed embeddings retry on next run
- No rate limit errors from Google API

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Rate Limiting** (20M tokens/month) | LOW | MEDIUM | Daily sync limit (100/day = 3K tokens/day), monitor token usage via Pino |
| **Embedding Quality Poor** | MEDIUM | HIGH | MVP validates quality through manual QA before building deduplication |
| **Search Bandwidth Exceeds Quota** | LOW | MEDIUM | Server-side filtering, reasonable limits (20-50 results = 300KB/search) |
| **Storage Growth** (6KB/question) | LOW | LOW | 10K questions = 60MB (well within Convex limits), grows linearly |
| **Embedding Generation Failure** | MEDIUM | LOW | Graceful degradation: Save question without embedding, sync cron retries |
| **Schema Migration Breaking** | LOW | HIGH | Use 3-phase pattern: Optional field → backfill → required (if needed) |
| **Text Search Missing** | LOW | MEDIUM | Convex text search or simple `.filter()` fallback if native not available |

---

## Key Decisions

### Decision 1: Inline Embedding Generation

**What**: Generate embeddings in the existing background question generation job
**Alternatives**: On-demand (lazy), separate background job, client-side
**Rationale**:
- Questions are semantically searchable immediately after generation
- No new background job infrastructure needed
- User already waiting for background job (no perceived latency)
- Graceful degradation: Question saves even if embedding fails

**Tradeoffs**:
- ✅ Immediate search availability for new questions
- ✅ Simple implementation (reuse existing job flow)
- ❌ Adds 200-300ms per question to background job (acceptable, already async)

---

### Decision 2: Audit/Sync Cronjob

**What**: Daily cron generates embeddings for questions missing them (100/day)
**Alternatives**: One-time migration, on-demand, no backfill
**Rationale**:
- Safety net for existing questions without embeddings
- Self-healing for failed embedding generations
- Rate limit protection (100/day << 20M tokens/month)
- Non-blocking (doesn't delay feature launch)

**Tradeoffs**:
- ✅ Graceful backfill (no rate limit risk)
- ✅ Self-healing (retries failures automatically)
- ❌ Takes 100 days for 10K questions (acceptable, not blocking user value)

---

### Decision 3: Hybrid Search (Text + Vector)

**What**: Search combines keyword matching (text) and semantic similarity (vector)
**Alternatives**: Vector-only, text-only, separate search modes
**Rationale**:
- Catches both exact matches ("useState") and semantic matches ("React state hook")
- Better UX than forcing users to choose search mode
- Simple merge algorithm: Deduplicate by ID, rank by score
- Validates vector search quality in real-world usage

**Tradeoffs**:
- ✅ Best of both worlds (precision + recall)
- ✅ Validates embedding quality through usage
- ❌ Slightly more complex than vector-only (acceptable complexity)

---

### Decision 4: Server-Side Search

**What**: Vector search runs on server, returns filtered results
**Alternatives**: Client-side filtering, cached results
**Rationale**:
- Vector search requires server (cosine similarity computation)
- 300KB per search is 0.03% of monthly quota (trivial cost)
- Clean API: Client just displays results
- Proper security: userId filtering server-side

**Tradeoffs**:
- ✅ Clean architecture, proper security
- ✅ Acceptable bandwidth (300KB << 1GB quota)
- ❌ Not reactive (action, not query) - acceptable, search is one-shot

---

### Decision 5: Hardcoded Model

**What**: `text-embedding-004` hardcoded in implementation
**Alternatives**: Configurable model, multi-model support
**Rationale**:
- Faster iteration for MVP
- Google SDK already integrated
- Free tier sufficient (20M tokens/month)
- Can abstract later if needed (BACKLOG: OpenRouter migration)

**Tradeoffs**:
- ✅ Simpler code, faster shipping
- ✅ Sufficient for MVP validation
- ❌ Switching models requires re-embedding all questions (acceptable future cost)

---

### Decision 6: Graceful Degradation

**What**: If embedding fails, save question without embedding
**Alternatives**: Fail hard (reject question), retry infinitely
**Rationale**:
- Embeddings enhance search but aren't critical path
- Sync cron will backfill missing embeddings
- Better UX: Question generation succeeds
- Aligns with philosophy from CLAUDE.md (bandwidth optimization, graceful failures)

**Tradeoffs**:
- ✅ Robust: Failures don't block question creation
- ✅ Self-healing: Sync cron fills gaps
- ❌ Temporary search gaps (acceptable, non-critical feature)

---

## Success Criteria

### MVP Acceptance (End of Phase 2)

**Technical**:
- ✅ New questions have `embedding` field populated (768 dimensions)
- ✅ Vector index `by_embedding` exists in schema
- ✅ Search action returns semantically similar questions
- ✅ Filters work: userId, deletedAt, archivedAt
- ✅ No embedding failures in Pino logs (graceful degradation working)

**Functional**:
- ✅ Search "React hooks" → returns useState, useEffect, useContext questions
- ✅ Search "photosynthesis" → returns biology questions, not programming
- ✅ Search respects view filters (active/archived/trash)
- ✅ Results ranked by similarity score (highest first)

**User Experience**:
- ✅ Search response time <2 seconds
- ✅ Results display with similarity scores
- ✅ Empty state for no results
- ✅ Loading state during search

---

### Production Ready (End of Phase 4)

**Technical**:
- ✅ Daily cron scheduled and running
- ✅ Sync processes 100 questions/day
- ✅ Error handling verified (rate limits, API failures)
- ✅ Monitoring dashboard shows embedding coverage

**Functional**:
- ✅ All existing questions have embeddings (or scheduled for backfill)
- ✅ Library UI has search input
- ✅ Hybrid search works (text + vector)
- ✅ Search results accurate and relevant

**Analytics** (Informs Future Deduplication):
- ✅ Similarity score distribution documented (histogram of scores)
- ✅ Manual QA of 20+ searches validates quality
- ✅ Known duplicate pairs tested (similarity scores recorded)
- ✅ False positive rate analyzed (>0.90 similarity, not duplicates)

---

## Future Work (Out of Scope)

**Not Implementing Now**:
- ❌ Deduplication detection (requires similarity threshold analysis from this MVP)
- ❌ "Postpone related items" feature (requires embeddings foundation)
- ❌ Knowledge gap detection (requires embeddings + analytics)
- ❌ Content-aware FSRS (research phase, needs embedding clustering)

**Data Collection for Future Features**:
- Similarity score distribution (informs deduplication threshold)
- False positive rate (pairs >0.90 similarity that aren't duplicates)
- User search patterns (common queries, result click-through)
- Embedding quality feedback (relevant results vs. irrelevant)

**Next Feature After MVP**: Deduplication
Based on MVP data, spec out deduplication with confidence in similarity threshold (likely 0.90), UI for reviewing duplicate pairs, and smart merge preserving FSRS state.

---

## Monitoring & Observability

**Metrics to Track** (via Pino):

**Embedding Generation**:
- Success rate (generated / attempted)
- Average generation time (ms per question)
- Failure reasons (rate limit, API error, network)
- Token usage (track toward 20M/month quota)

**Search Performance**:
- Search latency (time to first result)
- Results count (avg results per query)
- Similarity score distribution (histogram)
- Search frequency (queries/day/user)

**Backfill Progress**:
- Questions with embeddings (count, percentage)
- Questions without embeddings (count, age)
- Sync cron success rate
- Backfill completion ETA

**Example Pino Log**:
```json
{
  "level": "info",
  "event": "embeddings.generation.success",
  "questionId": "abc123",
  "dimensions": 768,
  "duration": 245,
  "model": "text-embedding-004",
  "timestamp": 1704067200000
}
```

---

## Appendix: Technical Specifications

### Schema Changes

```typescript
// convex/schema.ts
questions: defineTable({
  // ... existing fields ...
  embedding: v.optional(v.array(v.float64())), // 768-dimensional vector
  embeddingGeneratedAt: v.optional(v.number()), // Track freshness
})
  // ... existing indexes ...
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 768, // Google text-embedding-004
    filterFields: ["userId", "deletedAt", "archivedAt"]
  })
```

### Embedding Generation

```typescript
// convex/aiGeneration.ts (modified)
import { embed } from 'ai';
import { google } from '@ai-sdk/google';

// In processGenerationJob action:
for (const question of generatedQuestions) {
  try {
    // Generate embedding
    const { embedding } = await embed({
      model: google.textEmbedding('text-embedding-004'),
      value: `${question.question} ${question.explanation || ''}`
    });

    // Save with embedding
    await ctx.runMutation(internal.questionsCrud.saveQuestion, {
      ...question,
      embedding,
      embeddingGeneratedAt: Date.now()
    });

    logger.info({
      event: 'embeddings.generation.success',
      questionId: question._id,
      dimensions: embedding.length
    });
  } catch (error) {
    // Graceful degradation: Save without embedding
    await ctx.runMutation(internal.questionsCrud.saveQuestion, question);

    logger.warn({
      event: 'embeddings.generation.failure',
      error: error.message
    });
  }
}
```

### Search Action

```typescript
// convex/embeddings.ts (new module)
export const searchQuestions = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    view: v.optional(v.union(
      v.literal('active'),
      v.literal('archived'),
      v.literal('trash')
    ))
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const limit = args.limit ?? 20;

    // 1. Generate query embedding
    const { embedding } = await embed({
      model: google.textEmbedding('text-embedding-004'),
      value: args.query
    });

    // 2. Vector search
    const vectorResults = await ctx.vectorSearch("questions", "by_embedding", {
      vector: embedding,
      limit: limit * 2, // Get more for merging
      filter: (q) => {
        const filters = [q.eq("userId", user._id)];

        if (args.view === 'active') {
          filters.push(q.eq("deletedAt", undefined));
          filters.push(q.eq("archivedAt", undefined));
        } else if (args.view === 'archived') {
          filters.push(q.eq("deletedAt", undefined));
          // Note: archivedAt must be checked post-fetch
        } else if (args.view === 'trash') {
          // deletedAt must be checked post-fetch
        }

        return q.and(...filters);
      }
    });

    // 3. Text search (keyword matching)
    const textResults = await ctx.runQuery(
      internal.questionsLibrary.textSearchQuestions,
      { query: args.query, limit, userId: user._id }
    );

    // 4. Merge and deduplicate
    const merged = mergeSearchResults(vectorResults, textResults, limit);

    logger.info({
      event: 'embeddings.search.success',
      query: args.query,
      resultCount: merged.length,
      vectorCount: vectorResults.length,
      textCount: textResults.length
    });

    return merged;
  }
});

function mergeSearchResults(vectorResults, textResults, limit) {
  const seen = new Set();
  const merged = [];

  // Add vector results first (usually more relevant)
  for (const result of vectorResults) {
    if (!seen.has(result._id)) {
      seen.add(result._id);
      merged.push({ ...result, source: 'vector' });
    }
  }

  // Add text results
  for (const result of textResults) {
    if (!seen.has(result._id)) {
      seen.add(result._id);
      merged.push({ ...result, source: 'text' });
    }
  }

  // Return top N, sorted by score
  return merged
    .sort((a, b) => (b._score || 0) - (a._score || 0))
    .slice(0, limit);
}
```

### Sync Cronjob

```typescript
// convex/cron.ts (modified)
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Existing crons...

// NEW: Daily embedding sync
crons.daily(
  "sync question embeddings",
  { hourUTC: 3, minuteUTC: 0 }, // 3 AM UTC
  internal.embeddings.syncMissingEmbeddings
);

export default crons;
```

```typescript
// convex/embeddings.ts (sync function)
export const syncMissingEmbeddings = internalAction({
  handler: async (ctx) => {
    const startTime = Date.now();

    // Find questions without embeddings
    const questions = await ctx.runQuery(
      internal.embeddings.getQuestionsWithoutEmbeddings,
      { limit: 100 }
    );

    logger.info({
      event: 'embeddings.sync.start',
      count: questions.length
    });

    let successCount = 0;
    let failureCount = 0;

    // Process in batches of 10 (rate limit protection)
    const batches = chunk(questions, 10);

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(q => generateQuestionEmbedding(ctx, q._id))
      );

      successCount += results.filter(r => r.status === 'fulfilled').length;
      failureCount += results.filter(r => r.status === 'rejected').length;

      // Rate limit protection: 1 second between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = Date.now() - startTime;

    logger.info({
      event: 'embeddings.sync.complete',
      successCount,
      failureCount,
      duration,
      questionsRemaining: await ctx.runQuery(
        internal.embeddings.countQuestionsWithoutEmbeddings
      )
    });
  }
});

async function generateQuestionEmbedding(ctx, questionId) {
  const question = await ctx.runQuery(
    internal.embeddings.getQuestion,
    { questionId }
  );

  if (!question) return;

  const { embedding } = await embed({
    model: google.textEmbedding('text-embedding-004'),
    value: `${question.question} ${question.explanation || ''}`
  });

  await ctx.runMutation(internal.embeddings.saveEmbedding, {
    questionId,
    embedding,
    embeddingGeneratedAt: Date.now()
  });
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Next Review**: After Phase 2 completion (manual QA of search results)
