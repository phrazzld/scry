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

- [x] Add text search fallback to questionsLibrary.ts
  ```
  File: convex/questionsLibrary.ts:187-240
  Commit: a9d5ba9 - feat: add text search fallback for hybrid question search
  Completed: textSearchQuestions internal query with case-insensitive substring matching
  Filters by userId and view state (active/archived/trash)
  Searches question + explanation fields
  ```

- [x] Implement hybrid search merging in embeddings.ts
  ```
  File: convex/embeddings.ts:243-330
  Commit: e498bd2 - feat: implement hybrid search merging vector and text results
  Completed: Extended searchQuestions with hybrid search
  Calls both ctx.vectorSearch and internal.questionsLibrary.textSearchQuestions
  mergeSearchResults helper: Dedupes by _id Set, prioritizes vector, assigns 0.5 score to text-only
  Pino logs show vectorCount, textCount, mergedCount for monitoring
  ```

**Phase 2 Checkpoint**: ✅ Hybrid search working, returns ranked results

---

## Phase 3: UI Integration

### Module 4: Search UI Components

- [x] Add search state and debounced input to library-client.tsx
- [x] Add search input UI to library header
- [x] Display search results with similarity scores
  ```
  File: app/library/_components/library-client.tsx + library-table.tsx
  Commit: 173ef14 - feat: add complete search UI with similarity scores
  Completed: All 3 Phase 3 tasks in one coherent commit

  Library Client:
  - Search state: searchQuery, searchResults, isSearching
  - useAction for api.embeddings.searchQuestions with 300ms debounce
  - Search input with loading spinner and clear button (X icon)
  - Results count display and empty state
  - Conditional rendering: search results vs paginated questions
  - Hides pagination when showing search
  - Auto-clears on tab change

  Library Table:
  - Extended LibraryQuestion type with optional _score field
  - Similarity column with color-coded badges (>=80% green, >=60% yellow, <60% gray)
  - Conditionally shows similarity column only when search results present
  ```

**Phase 3 Checkpoint**: ✅ Search UI functional, results displayed with similarity scores

---

## Phase 4: Backfill & Monitoring

### Module 5: Sync Cronjob

- [x] Add helper queries for sync cron to embeddings.ts
  ```
  File: convex/embeddings.ts:332-438
  Commit: 33ddcfe - feat: add helper queries for embedding sync cron
  Completed: 4 internal functions for sync data access layer
  - getQuestionsWithoutEmbeddings: Fetches up to N active questions without embeddings
  - countQuestionsWithoutEmbeddings: Returns count with isApproximate flag (1000 sample limit)
  - getQuestionForEmbedding: Fetches single question by ID
  - saveEmbedding: Patches question with embedding + timestamp
  All use .take(limit) for bandwidth safety, filter for active only
  ```

- [x] Implement syncMissingEmbeddings cron action in embeddings.ts
  ```
  File: convex/embeddings.ts:440-562
  Commit: 5f7a6d9 - feat: implement syncMissingEmbeddings cron action
  Completed: Daily sync action with batch processing and rate limit protection
  - Fetches 100 questions without embeddings via getQuestionsWithoutEmbeddings
  - Chunks into batches of 10, processes with Promise.allSettled
  - 1 second sleep between batches for rate limit protection
  - Graceful failure: Logs errors, continues processing remaining batches
  - Pino logging: sync.start, sync.batch-failure, sync.complete (with counts/duration/remaining)
  - chunkArray helper for clean batch processing
  Ready for cron.ts registration
  ```

- [x] Register daily sync cron in cron.ts
  ```
  File: convex/cron.ts:40-50
  Commit: 7e5e729 - feat: register daily embedding sync cron
  Completed: Cron registered at 3:30 AM UTC
  Named 'syncQuestionEmbeddings' for dashboard visibility
  Scheduled 30 min after job cleanup, 15 min after stats reconciliation
  ```

- [x] Add Pino logging for embedding operations
  ```
  Already implemented throughout embeddings.ts development
  Events logged:
  - embeddings.generation.missing-key (89) - API key validation
  - embeddings.generation.success (112) - Successful embedding with dimensions/duration
  - embeddings.generation.failure (145) - Generation errors with error type
  - embeddings.search.start (204) - Search initiation with query/limit/view
  - embeddings.search.success (265) - Search completion with vector/text/merged counts
  - embeddings.sync.start (475) - Sync initiation with question count
  - embeddings.sync.batch-failure (521) - Individual batch failures with error
  - embeddings.sync.complete (543, 464) - Sync completion with success/failure/remaining counts
  All logging implemented incrementally during feature development
  ```

**Phase 4 Checkpoint**: ✅ Sync cron running daily, comprehensive Pino logging showing metrics

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
