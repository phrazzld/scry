# BACKLOG: Background Question Generation System

> **Note**: For deployment-related enhancements, see [BACKLOG_DEPLOYMENT.md](./BACKLOG_DEPLOYMENT.md)

- ~~allow learners to postpone an item~~ → **IMPLEMENTED as Archive system in Library PR**
- better interleaving of content during reviews

---

## Question Library Enhancements

*Deferred from Library MVP (see TASK.md for implemented features)*

### Code Quality & Refactoring (From PR #30 Review)

**Selection State Simplification**:
- **Issue**: Complex bidirectional conversion between TanStack Table's `Record<string, boolean>` and `Set<Id<'questions'>>`
- **Location**: `app/library/_components/library-table.tsx:262-300`
- **Solution**: Use TanStack Table's `getRowId` option to use stable IDs instead of array indices
- **Value**: Eliminates O(n) conversion overhead, prevents stale index bugs on real-time updates
- **Estimated effort**: M (refactor table configuration, update selection callbacks)
- **Reference**: [PR #30 Review Comments](https://github.com/phrazzld/scry/pull/30)
- **Implementation**:
  ```typescript
  const table = useReactTable({
    // ...
    getRowId: (row) => row._id, // Use question ID instead of index
    // Now rowSelection uses IDs directly: { "questionId1": true, "questionId2": true }
  });
  ```

**Extract Mutation Logic into Custom Hook**:
- **Issue**: `LibraryClient` component has 5 mutation handlers (150+ lines) making it harder to test and reuse
- **Solution**: Create `hooks/use-library-mutations.ts` hook
- **Value**: Better separation of concerns, testable mutation logic, reusable across components
- **Estimated effort**: M (extract handlers, create hook, update imports)
- **Reference**: [PR #30 Review Comments](https://github.com/phrazzld/scry/pull/30)
- **Implementation Pattern**:
  ```typescript
  export function useLibraryMutations() {
    const archiveQuestions = useMutation(api.questions.archiveQuestions);
    // ... other mutations

    const handleArchive = async (ids: Id<'questions'>[]) => {
      try {
        await archiveQuestions({ questionIds: ids });
        toast.success(`Archived ${ids.length} questions`);
        return { success: true };
      } catch (error) {
        toast.error('Failed to archive questions');
        return { success: false, error };
      }
    };

    return { handleArchive, handleUnarchive, ... };
  }
  ```

**Empty State Text Correction**:
- **Issue**: `TrashEmptyState` mentions "30 days" auto-deletion but no cron job exists
- **Location**: `app/library/_components/library-empty-states.tsx:42-52`
- **Options**:
  1. Remove "30 days" claim from empty state text (5 min fix)
  2. Implement auto-deletion cron job in `convex/cron.ts` (M effort)
- **Value**: Accurate user communication OR automated cleanup
- **Estimated effort**: XS (text change) or M (cron implementation)
- **Reference**: [PR #30 Review Comments](https://github.com/phrazzld/scry/pull/30)

### Performance Monitoring & Optimization

**Client-Side Filtering Monitoring**:
- **Context**: `getLibrary` query over-fetches `limit * 2` questions then filters in-memory
- **Location**: `convex/questions.ts:597-641`, documented in `convex/schema.ts:57-60`
- **Current Trade-off**:
  - ✅ Simple implementation (follows hypersimplicity)
  - ✅ Avoids compound indexes (easier schema)
  - ❌ Inefficient for users with balanced states (e.g., 400 active, 400 archived, 200 trash)
  - ❌ May hit Convex query limits (1000 docs)
- **Action**: Add analytics to track question distribution (active/archived/trash ratios)
- **Optimization Trigger**: If >10% of users have 500+ questions per state, add compound index:
  ```typescript
  .index('by_user_state', ['userId', 'archivedAt', 'deletedAt', 'generatedAt'])
  ```
- **Value**: Data-driven decision on when to optimize
- **Estimated effort**: S (add analytics tracking) + M (implement compound index if needed)
- **Reference**: [PR #30 Review Comments](https://github.com/phrazzld/scry/pull/30) - Documented as acceptable MVP trade-off

### Testing Expansion

**Unit Tests for Bulk Operations**:
- **Coverage Gaps**: No tests for `archiveQuestions`, `unarchiveQuestions`, `bulkDelete`, `permanentlyDelete`
- **Critical Test Cases**:
  1. Ownership verification before operations
  2. Atomic validation (all-or-nothing behavior)
  3. Partial failure scenarios
  4. Large batch performance (100+ questions)
  5. Concurrent operation handling
- **Estimated effort**: L (write tests using Convex test framework)
- **Reference**: [PR #30 Review Comments](https://github.com/phrazzld/scry/pull/30)
- **Example Structure**:
  ```typescript
  describe('archiveQuestions', () => {
    it('should verify ownership before archiving', async () => {
      // Create question owned by user A
      // Attempt archive as user B
      // Expect error, no questions archived
    });

    it('should archive multiple questions atomically', async () => {
      // Create 10 questions
      // Archive all
      // Verify all have archivedAt timestamp
      // Verify all excluded from active view
    });
  });
  ```

**Integration Tests for FSRS Integration**:
- **Coverage Gaps**: Archive/trash impact on review queue not tested
- **Critical Test Cases**:
  1. Archived questions excluded from `getNextReview`
  2. Archived questions excluded from `getDueCount`
  3. Restored questions re-appear in review queue with preserved FSRS data
  4. Full lifecycle: Generate → Review → Archive → Restore → Review again
- **Estimated effort**: M (integration tests with Convex test harness)
- **Reference**: [PR #30 Review Comments](https://github.com/phrazzld/scry/pull/30)

**E2E Tests for User Workflows**:
- **Coverage Gaps**: No browser-based tests for library UI
- **Critical Test Cases**:
  1. Full lifecycle via UI: Generate → Archive → Delete → Restore
  2. Mobile responsive layout (Playwright viewport switching)
  3. Empty state rendering for each tab
  4. Selection persistence across operations
  5. Error handling and toast notifications
- **Estimated effort**: L (set up Playwright, write E2E suite)
- **Reference**: [PR #30 Review Comments](https://github.com/phrazzld/scry/pull/30)

### Search, Sort, Filter (Next PR Priority)

**Search**:
- **Plaintext search**: Full-text search across question text using Convex search index
  - Value: Quickly find specific questions
  - Estimated effort: S (add search index, search input component)
  - Implementation: `questions.searchIndex("search_content", { searchField: "question" })`

- **Semantic search**: Vector similarity search using embeddings
  - Value: Find conceptually similar questions ("react hooks" matches "useState, useEffect")
  - Estimated effort: L (embedding generation, vector DB integration, similarity search)
  - Dependencies: OpenAI embeddings or similar service
  - Trade-off: Costs per search, requires external service

**Column Sorting**:
- Sort by: Date (newest/oldest), Attempts (most/least), Success rate (high/low), Alphabetical (A-Z, Z-A)
  - Value: Power users organizing large libraries
  - Estimated effort: S (TanStack Table built-in sorting, already in framework)
  - Implementation: Add `getSortedRowModel()` to table config

**Filtering**:
- Filter by: Topic (multi-select), Type (MC/TF), FSRS state (new/learning/review/relearning), Success rate threshold
  - Value: Focus on specific question subsets
  - Estimated effort: M (filter UI components, client-side filtering logic)
  - Implementation: Filter chips with "Clear all" button, sidebar on desktop, sheet on mobile

### Data Model Evolution (Tag System)

**userPrompts Table**:
```typescript
userPrompts: defineTable({
  userId: v.id("users"),
  prompt: v.string(),           // Raw user input
  clarifiedTopic: v.string(),   // AI's interpretation
  createdAt: v.number(),
  questionCount: v.number(),    // Denormalized count
})
  .index("by_user", ["userId", "createdAt"])
```
- Value: Track what users ask for, enable "generate more like this" feature
- Estimated effort: M (new table, backfill from generationJobs, update generation flow)

**questionTags Table** (many-to-many):
```typescript
questionTags: defineTable({
  questionId: v.id("questions"),
  tag: v.string(),
  source: v.union(v.literal("ai"), v.literal("user")), // Who created tag
  createdAt: v.number(),
})
  .index("by_question", ["questionId"])
  .index("by_tag", ["tag"])
```
- Value: Multiple tags per question, flexible categorization, tag cloud UI
- Estimated effort: L (new table, migration from topic field, tag management UI, tag autocomplete)
- Migration path: Create initial tags from existing `topic` field

**Tag Cloud Interface**:
- Visual tag cloud with size based on question count
- Click tag to filter library
- Multi-tag selection (AND/OR logic)
- Tag editing: rename, merge, delete
  - Value: Horizontal organization vs hierarchical topics
  - Estimated effort: M (tag cloud component, tag CRUD operations)

### Export & Data Portability

**Export formats**:
- CSV: For spreadsheet analysis
- JSON: For backup/import
- Anki format: For users migrating to/from Anki
  - Value: User owns their data, can analyze externally
  - Estimated effort: M (export generation, file download, format conversion)

**Import**:
- Import from CSV/JSON/Anki
- Bulk question upload
  - Value: Onboarding users with existing question sets
  - Estimated effort: L (parsing, validation, duplicate handling, UI)

### Performance Optimizations

**Virtual Scrolling** (only if needed):
- Add TanStack Virtual when users have 1000+ questions
- Conditional rendering based on dataset size
  - Value: Maintains performance at extreme scale
  - Estimated effort: S (already researched, TanStack Virtual integrates with Table)
  - Threshold: Enable when `questionCount > 1000`

**Cursor-based Pagination**:
- Replace "load 500 max" with infinite scroll
- Fetch next batch as user scrolls
  - Value: Handle unlimited library size
  - Estimated effort: M (cursor queries, pagination state, intersection observer)
  - Trade-off: More complex, only needed if 500 limit is hit regularly

### Analytics & Insights

**Learning Analytics Dashboard**:
- Forgetting curve visualization per topic
- Retention rate graphs over time
- Difficulty distribution histogram
- Performance trends (improving/declining topics)
  - Value: Data-driven learning insights
  - Estimated effort: XL (data aggregation, chart library, statistical calculations)
  - Dependencies: Chart library (recharts, visx, or similar)

**Question Statistics**:
- Per-question: First attempt success rate, average time to answer, FSRS stability/difficulty trends
- Library-wide: Total learning time, most/least successful topics, review load forecast
  - Value: Understand learning patterns
  - Estimated effort: L (aggregation queries, visualization components)

### Advanced Library Features

**Shared Libraries** (far future):
- Public question libraries (e.g., "React Interview Prep - 200 questions")
- Import from shared libraries
- Publish your library for others
  - Value: Community learning, reduce generation costs
  - Estimated effort: XL (permissions, discovery UI, import/export, moderation)
  - Trade-off: Moderation burden, copyright concerns

**Question History/Versioning**:
- Track edits to questions over time
- Revert to previous versions
- See how question performance changed after edits
  - Value: Understand impact of question quality on learning
  - Estimated effort: M (history table, diff UI, version comparison)

---

## Future Enhancements

### Question Validation & Quality Control
- **Duplicate detection**: Check if generated question already exists in user's library based on semantic similarity (not just exact text match)
  - Value: Prevents redundant questions, improves user experience
  - Estimated effort: M (need embedding model + similarity search)
  - Dependencies: Embedding service (OpenAI, Cohere, or local model)

- **Quality scoring**: Automatically score questions based on: has explanation, sufficient options (2+ for true/false, 4 for multiple choice), clear wording, no duplicate answers
  - Value: Filters out low-quality AI generations
  - Estimated effort: S (implement scoring heuristics)
  - Implementation: Add `qualityScore` field to questions, filter/sort by score

### Contextual Question Generation (Sophisticated v2)
- **Topic-aware generation**: When user has 100+ questions on "React", suggest generating deeper subtopic questions (hooks, context, performance, etc.)
  - Value: Better organization, progressive learning depth
  - Estimated effort: L (need topic clustering, recommendation engine)

- **Gap analysis**: Analyze user's question library to identify knowledge gaps, suggest topics to fill gaps
  - Value: Personalized learning paths
  - Estimated effort: XL (complex ML/heuristic system)

- **Related questions with smart context**: Bring back "generate related" but with proper implementation - include recent 10 questions from topic, topic summary, user performance data
  - Value: Better coherence in question sets
  - Estimated effort: M (context building logic)

### Advanced Rate Limiting
- **Tiered limits**: Free users get 10 jobs/day, Pro users get 100/day, Enterprise unlimited
  - Value: Monetization path, abuse prevention
  - Estimated effort: S (add user tier to schema, check in rate limit)

- **Cost tracking**: Track AI API token usage per user, show in settings
  - Value: Transparency, cost management
  - Estimated effort: M (need token counting, aggregation)

### Job Management Features
- **Retry failed jobs**: One-click retry for failed jobs with exponential backoff
  - Value: Better UX for transient failures
  - Estimated effort: S (add retry mutation, track attempt count)

- **Job templates**: Save common prompts as templates ("Generate 20 React questions", "NATO alphabet full set")
  - Value: Speed up common workflows
  - Estimated effort: M (new templates table, UI)

- **Batch operations**: Select multiple jobs to cancel/delete at once
  - Value: Bulk management
  - Estimated effort: S (multi-select UI, batch mutations)

- **Job scheduling**: Schedule job to run at specific time (e.g., "Generate tomorrow morning")
  - Value: Preparation, planning
  - Estimated effort: M (scheduler integration)

---

## UI/UX Improvements

### Progress Visualization
- **Estimated time remaining**: Show "~2 minutes remaining" based on average question generation speed
  - Value: User expectations management
  - Estimated effort: S (track historical speeds, calculate ETA)

- **Live question preview**: Show questions as they stream in within the panel (not just count)
  - Value: Engaging, shows immediate value
  - Estimated effort: M (real-time question subscription, UI)

- **Mini progress indicator**: Show tiny progress bar in badge itself (not just count)
  - Value: At-a-glance progress
  - Estimated effort: S (circular progress or bar in badge)

### Panel Enhancements
- **Filter/sort jobs**: Filter by status (active/completed/failed), sort by date/name/status
  - Value: Better navigation with many jobs
  - Estimated effort: S (add filter controls, client-side filtering)

- **Job history stats**: Show total jobs run, success rate, total questions generated
  - Value: User engagement, gamification
  - Estimated effort: M (aggregation queries, stats component)

- **Collapsible sections**: Collapse completed/failed jobs to focus on active
  - Value: Cleaner UI
  - Estimated effort: S (accordion component)

---

## Technical Debt Opportunities

### Performance Optimizations
- **Question deduplication at DB level**: Before saving, check if question text already exists for user
  - Benefit: Prevents duplicates at source
  - Effort: S (add unique constraint or pre-insert query)
  - Trade-off: Slower inserts, but cleaner data

- **Batch progress updates**: Instead of updating after every question, batch updates every 5 questions
  - Benefit: Reduces DB writes by 80%
  - Effort: S (add batching logic in stream loop)
  - Trade-off: Slightly less real-time progress

- **Cursor-based job pagination**: For users with hundreds of jobs, implement cursor pagination
  - Benefit: O(1) pagination vs O(N)
  - Effort: M (rewrite queries with continueCursor)
  - Trade-off: More complex query logic

### Code Quality
- **Extract stream handling to utility**: Create `lib/ai-streaming-utils.ts` with reusable stream processing logic
  - Benefit: DRY, reusable for future streaming tasks
  - Effort: S (extract ~50 lines into utility)
  - When: After we have 2+ streaming use cases

- **Job state machine formalization**: Create explicit state machine with transition rules
  - Benefit: Clearer valid state transitions, easier to reason about
  - Effort: M (add state machine library or custom implementation)
  - Trade-off: More abstraction, overkill for simple status flow

- **Error recovery strategies**: Implement automatic retry with exponential backoff for transient errors
  - Benefit: Higher success rate, less user intervention
  - Effort: M (retry logic, backoff calculation, attempt tracking)
  - Trade-off: Longer "stuck" feeling if multiple retries fail

### Testing Improvements
- **Mock AI responses**: Create realistic mock data generator for streamObject responses
  - Benefit: Faster tests, deterministic
  - Effort: S (create mock factory)

- **Load testing**: Simulate 100+ concurrent jobs to verify DB/infrastructure handles load
  - Benefit: Confidence in scalability
  - Effort: M (setup load test infrastructure)

---

## Out of Scope (Don't Build)

These are explicitly NOT worth building based on our "hypersimplicity" philosophy:

- ❌ Job priority/queue management (YAGNI - scheduler handles ordering)
- ❌ Job dependencies (YAGNI - each job is independent)
- ❌ Job templates with variables (overengineering - just save common prompts)
- ❌ Custom job execution environment config (overengineering - one config works for all)
- ❌ Job pause/resume (complexity nightmare - just cancel and restart)
- ❌ Job output streaming to multiple destinations (YAGNI - questions table is destination)
- ❌ Job versioning/rollback (overengineering - just create new job)
- ❌ Complex job workflow DAGs (way overengineered - we're not Airflow)

---

## Post-Migration Cleanup

After initial deployment is stable:

- [ ] Remove deprecated context-related types/utilities if any remain in codebase
- [ ] Archive old generation-related documentation that referenced API route
- [ ] Update any screenshots/videos in docs that show old generation flow
- [ ] Consider removing old empty state generation forms if jobs are working well
