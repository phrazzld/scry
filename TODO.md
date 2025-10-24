# TODO: Vector Embeddings Infrastructure

## Context

**Approach**: Inline background generation + hybrid search + daily sync cron
**Architecture**: Three independent modules with minimal coupling
**Patterns**: Follow existing Convex patterns (aiGeneration.ts, questionsCrud.ts, cron.ts)
**Test Strategy**: Unit tests for embeddings module, integration tests for search

### Key Files
- `convex/schema.ts`: Add embedding field + vector index
- `convex/aiGeneration.ts`: Inline embedding generation during question creation
- `convex/embeddings.ts`: NEW - Embedding service (generation, search, sync)
- `convex/cron.ts`: Add daily sync job
- `app/library/_components/library-client.tsx`: Search UI integration

### Module Boundaries
1. **Schema Layer**: Vector index definition, storage format (no business logic)
2. **Embeddings Service**: Deep module hiding Google AI API, cosine similarity, batch processing
3. **UI Layer**: Search input/results (thin, delegates to embeddings service)

---

## Phase 1: Foundation (Schema + Embedding Generation)

### Module 1: Schema Extension

- [x] Add embedding fields to questions schema with vector index
  ```
  File: convex/schema.ts:33-70
  Commit: 3a1ad20 - feat: add vector embedding fields and index to questions schema
  Completed: Added embedding (768-dim), embeddingGeneratedAt fields
  Vector index: by_embedding with userId, deletedAt, archivedAt filters
  ```

### Module 2: Embeddings Service Core

- [x] Create convex/embeddings.ts with embedding generation helper
  ```
  File: convex/embeddings.ts (NEW)
  Commit: 569ad44 - feat: create embeddings service module with generation helper
  Completed: generateEmbedding internal action, API key validation, error classification, Pino logging
  ```

- [x] Add embedding generation to aiGeneration.ts processJob action
  ```
  File: convex/aiGeneration.ts:359-415
  Commit: 1cf6214 - feat: add inline embedding generation to question generation flow
  Completed: Batch processing (10/batch), graceful degradation, combines question + explanation
  ```

- [x] Modify questionsCrud.ts saveBatch to accept optional embeddings
  ```
  File: convex/questionsCrud.ts:80-120
  Commit: 8f1fade - feat: add optional embedding fields to saveBatch mutation
  Completed: Optional embedding fields, conditional inclusion, backward compatible
  ```

**Phase 1 Checkpoint**: ✅ Questions generated with embeddings automatically, graceful degradation works

---

## Phase 2: Search Implementation

### Module 3: Vector Search Action

- [x] Implement searchQuestions action in embeddings.ts
  ```
  File: convex/embeddings.ts:174-253
  Commit: 9b943bf - feat: implement vector search action for semantic question search
  Completed: searchQuestions action, getAuthenticatedUserId helper, view filtering, Pino logging
  Learnings: Actions can't call requireUserFromClerk directly (created internal query helper)
  ```

- [ ] Add text search fallback to questionsLibrary.ts
  ```
  File: convex/questionsLibrary.ts (new internal query)
  Approach: Add textSearchQuestions query using .filter() on question field
  Exports:
    - textSearchQuestions(query, limit, userId): internal query
  Implementation:
    - Filter questions where question.toLowerCase().includes(query.toLowerCase())
    - Apply userId filter
    - Return matching questions
  Success: Text search finds keyword matches
  Test: Search for "React", returns questions containing "React"
  Module: Simple keyword matching, complements vector search
  Time: 30min
  ```

- [ ] Implement hybrid search merging in embeddings.ts
  ```
  File: convex/embeddings.ts (extend searchQuestions)
  Approach: Call both vector + text search, merge results
  Changes:
    - Call ctx.vectorSearch (semantic)
    - Call ctx.runQuery(internal.questionsLibrary.textSearchQuestions) (keywords)
    - Merge: Dedupe by _id, prioritize vector results, sort by score
    - Return top N results
  Success: Hybrid search returns both semantic + keyword matches
  Test: Search "state management" finds useState (semantic) + "state" (keyword)
  Module: Composition of vector + text search, clean merge algorithm
  Time: 45min
  ```

**Phase 2 Checkpoint**: Hybrid search working, returns ranked results

---

## Phase 3: UI Integration

### Module 4: Search UI Components

- [ ] Add search state and debounced input to library-client.tsx
  ```
  File: app/library/_components/library-client.tsx:24-75
  Approach: Add search state alongside pagination state
  Changes:
    - State: searchQuery (string), searchResults (array), isSearching (boolean)
    - useAction for api.embeddings.searchQuestions
    - Debounce: useEffect with 300ms delay
    - Clear search on tab change
  Success: Search input triggers debounced action
  Test: Type "React", wait 300ms, verify action called once
  Module: Thin UI layer, delegates to embeddings service
  Time: 30min
  ```

- [ ] Add search input UI to library header
  ```
  File: app/library/_components/library-client.tsx (render section)
  Approach: Add Input component above Tabs
  Changes:
    - Import Input from ui/input
    - Search input with placeholder "Search questions..."
    - Show loading spinner when isSearching
    - Clear button (X icon) to reset search
  Success: Search input renders, shows loading state
  Test: Visual inspection, type and see spinner
  Module: Presentational component, no business logic
  Time: 20min
  ```

- [ ] Display search results with similarity scores
  ```
  File: app/library/_components/library-client.tsx
  Approach: Conditional render - show searchResults when query exists
  Changes:
    - If searchQuery: Render searchResults instead of paginatedQuestions
    - Add Badge component showing similarity score (e.g., "87% match")
    - Empty state: "No results for '{query}'"
    - Show result count: "5 results for 'React'"
  Success: Search results display with scores, empty state works
  Test: Search "React", see results with scores; search "xyzabc", see empty
  Module: Result presentation, reuses LibraryCards/LibraryTable components
  Time: 45min
  ```

**Phase 3 Checkpoint**: Search UI functional, results displayed

---

## Phase 4: Backfill & Monitoring

### Module 5: Sync Cronjob

- [ ] Add helper queries for sync cron to embeddings.ts
  ```
  File: convex/embeddings.ts
  Approach: Add internal queries for cron to fetch questions without embeddings
  Exports:
    - getQuestionsWithoutEmbeddings(limit: 100): internal query
    - countQuestionsWithoutEmbeddings(): internal query
    - getQuestionForEmbedding(questionId): internal query
    - saveEmbedding(questionId, embedding, timestamp): internal mutation
  Success: Queries return questions without embeddings
  Test: Create question without embedding, verify query finds it
  Module: Data access layer for sync operation
  Time: 30min
  ```

- [ ] Implement syncMissingEmbeddings cron action in embeddings.ts
  ```
  File: convex/embeddings.ts
  Approach: Follow generationJobs.ts cleanup pattern for batch processing
  Exports:
    - syncMissingEmbeddings(): internal action
  Implementation:
    1. Fetch 100 questions without embeddings
    2. Chunk into batches of 10
    3. For each batch: Promise.allSettled(generateEmbedding)
    4. Sleep 1s between batches (rate limit protection)
    5. Log success/failure counts via Pino
  Success: Processes 100 questions/day, logs metrics
  Test: Create 150 questions without embeddings, run cron, verify 100 processed
  Module: Batch processing with graceful failure, rate limit protection
  Time: 1h
  ```

- [ ] Register daily sync cron in cron.ts
  ```
  File: convex/cron.ts:39-41 (after existing crons)
  Approach: Follow existing cron pattern (cleanup, reconcileUserStats)
  Changes:
    - crons.daily("sync question embeddings", { hourUTC: 3, minuteUTC: 30 }, internal.embeddings.syncMissingEmbeddings)
  Success: Cron registered, appears in Convex dashboard
  Test: Verify cron shows in dashboard, manual trigger works
  Module: Simple cron registration
  Time: 10min
  ```

- [ ] Add Pino logging for embedding operations
  ```
  File: convex/embeddings.ts (throughout)
  Approach: Follow aiGeneration.ts logging pattern
  Logging Events:
    - embeddings.generation.success (questionId, dimensions, duration)
    - embeddings.generation.failure (error, questionId)
    - embeddings.search.success (query, resultCount, duration)
    - embeddings.sync.start (count)
    - embeddings.sync.complete (successCount, failureCount, duration)
  Success: Structured logs appear during operations
  Test: Generate questions, search, run sync - verify logs in Convex dashboard
  Module: Observability layer, no business logic impact
  Time: 20min
  ```

**Phase 4 Checkpoint**: Sync cron running daily, logs showing metrics

---

## Testing & Validation

- [ ] Write unit tests for embeddings module
  ```
  File: convex/embeddings.test.ts (NEW)
  Approach: Follow aiGeneration.test.ts pattern
  Tests:
    - generateEmbedding returns 768-dim array
    - searchQuestions filters by userId
    - searchQuestions respects view filters (active/archived/trash)
    - Hybrid search deduplicates by _id
    - Hybrid search ranks by score (highest first)
    - Sync processes batches correctly
  Success: All tests pass, coverage >80%
  Test Framework: Vitest (already configured)
  Time: 1h
  ```

- [ ] Manual QA: Search quality validation
  ```
  Actions:
    1. Generate 20+ questions on different topics (React, biology, history)
    2. Search "React hooks" → verify useState, useEffect, useContext appear
    3. Search "photosynthesis" → verify biology questions, not programming
    4. Search keyword "state" → verify both semantic + keyword matches
    5. Document similarity scores for known duplicates (>0.90)
    6. Document false positives (>0.90 but not duplicates)
  Success: Search returns semantically relevant results
  Output: Document findings in TASK.md "Analytics" section
  Time: 30min
  ```

---

## Definition of Done

**Technical**:
- [ ] Schema deployed with vector index
- [ ] Questions generated with embeddings (768 dimensions)
- [ ] Search action returns filtered, ranked results
- [ ] Sync cron scheduled and logging metrics
- [ ] Unit tests passing (>80% coverage)
- [ ] TypeScript compiles without errors
- [ ] Pino logs show embedding operations

**Functional**:
- [ ] Generate questions → embeddings present in DB
- [ ] Search "React hooks" → semantically relevant results
- [ ] Search respects view filters (active/archived/trash)
- [ ] Similarity scores displayed in UI
- [ ] Empty state for no results
- [ ] Graceful degradation: Questions save without embeddings on failure

**Analytics** (for future deduplication):
- [ ] Similarity score distribution documented
- [ ] Manual QA of 20+ searches validates quality
- [ ] Known duplicate pairs tested (similarity >0.90)
- [ ] False positive rate analyzed

---

## Design Iteration Checkpoints

**After Phase 1**: Review embedding generation graceful degradation
- Verify questions save successfully even when embedding fails
- Check error logs for failure patterns
- Consider: Should we retry failed embeddings immediately or wait for sync?

**After Phase 2**: Review search result quality
- Analyze similarity score distribution (histogram)
- Identify quality threshold for relevance (likely >0.7)
- Consider: Do we need to tune vector search limit (currently limit * 2)?

**After Phase 3**: Review UI/UX patterns
- Gather user feedback on search relevance
- Check search latency (<2 seconds?)
- Consider: Should search replace pagination or supplement it?

**After Phase 4**: Review sync cron performance
- Monitor batch processing duration
- Check for rate limit errors
- Consider: Should we increase daily limit if backlog is large?

---

## Automation Opportunities

**Embedding Coverage Monitoring**:
```bash
# Script to check embedding coverage percentage
convex run embeddings:countQuestionsWithoutEmbeddings
convex run questionsLibrary:countTotalQuestions
# Calculate percentage, alert if <95%
```

**Search Quality Regression Tests**:
```bash
# Automated search tests with expected results
# Search "React hooks" → assert useState in top 5
# Search "photosynthesis" → assert no programming questions
```

**Similarity Score Analysis**:
```bash
# Script to generate similarity distribution histogram
# Helps determine deduplication threshold
```

---

## Module Complexity Assessment

**Deep Modules** (high value, simple interface):
- ✅ `embeddings.ts`: Simple search API hides Google AI, vector math, batch processing
- ✅ `vectorIndex`: Simple schema definition hides Convex vector search internals

**Acceptable Complexity**:
- ✅ `aiGeneration.ts`: Extended slightly but maintains single responsibility
- ✅ `library-client.tsx`: Added search state but delegates to embeddings service

**Watch For**:
- ⚠️ Hybrid search merging: If merge logic becomes complex, extract to helper
- ⚠️ Search UI: If conditional rendering becomes tangled, split into SearchResults component

---

## Notes

**Why No Text Search Integration Tests?**
Convex text search uses native DB features - integration tests would just test Convex itself. Unit tests with mocked queries are sufficient.

**Why Batch Size of 10?**
Rate limit protection. Google free tier: 20M tokens/month = ~55K tokens/day. Batch of 10 = ~200 tokens, 1 second delay = max 864K tokens/day (well under limit).

**Why 768 Dimensions?**
Google text-embedding-004 default. Could be configured down to 512 for storage savings, but 768 provides better quality for marginal cost (6KB vs 4KB per question).

**Why Server-Side Search?**
- Vector search requires server (cosine similarity computation)
- Proper userId security enforcement
- Clean API boundary
- 300KB per search is trivial (<0.03% monthly quota)
