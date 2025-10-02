# BACKLOG: Background Question Generation System

This file tracks future enhancements and nice-to-have improvements that are out of scope for the initial implementation but worth considering later.

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

- **Profanity/inappropriate content filter**: Run generated questions through content moderation API before saving
  - Value: Safety, prevents inappropriate content
  - Estimated effort: S (integrate moderation API)
  - Options: OpenAI Moderation API, custom filter

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
