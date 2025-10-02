# TODO: Background Question Generation System

## Phase 1: Foundation - Schema & Configuration

- [x] **Add generationJobs table to schema**
  - File: `convex/schema.ts`
  - Add new table definition with fields: userId, prompt, status (union of 'pending'|'processing'|'completed'|'failed'|'cancelled'), phase (union of 'clarifying'|'generating'|'finalizing'), questionsGenerated, questionsSaved, estimatedTotal (optional), topic (optional), questionIds (array), durationMs (optional), errorMessage (optional), errorCode (optional), retryable (optional), createdAt, startedAt (optional), completedAt (optional), ipAddress (optional)
  - Add indexes: `by_user_status` on ['userId', 'status', 'createdAt'], `by_status_created` on ['status', 'createdAt']
  - Success criteria: Schema compiles, `npx convex dev` creates table in dashboard, indexes appear in Convex dashboard

- [x] **Create job configuration constants file**
  - File: `lib/constants/jobs.ts` (new)
  - Define `JOB_CONFIG` object with: MAX_CONCURRENT_PER_USER (3), MAX_PROMPT_LENGTH (5000), MIN_PROMPT_LENGTH (3), COMPLETED_JOB_RETENTION_DAYS (7), FAILED_JOB_RETENTION_DAYS (30)
  - Export as const with proper TypeScript typing
  - Success criteria: Config imports cleanly, TypeScript provides autocomplete for all fields

---

## Phase 2: Backend - Job Management

- [x] **Create generationJobs CRUD module**
  - File: `convex/generationJobs.ts` (new)
  - Import requireUserFromClerk, JOB_CONFIG, rateLimit functions
  - Implement `createJob` mutation with args: prompt (string), ipAddress (optional string)
  - In createJob: authenticate user, validate prompt length (MIN_PROMPT_LENGTH to MAX_PROMPT_LENGTH), check concurrent jobs limit (query by_user_status index where status='processing'), enforce rate limit using checkApiRateLimit with operation='questionGeneration', insert job record with status='pending', schedule internal.aiGeneration.processJob with ctx.scheduler.runAfter(0), return jobId
  - Success criteria: Can call createJob from client, returns valid jobId, enforces all limits correctly, throws appropriate errors for invalid inputs

- [x] **Implement job query functions**
  - File: `convex/generationJobs.ts`
  - Implement `getRecentJobs` query with args: limit (optional number, default 20)
  - Query user's jobs ordered by createdAt desc, return with all fields
  - Implement `getJobById` query with args: jobId
  - Verify ownership (job.userId === authenticated user's ID), return job or null
  - Success criteria: Queries return correct data, ownership checks work, unauthenticated users get empty results

- [x] **Implement job mutation operations**
  - File: `convex/generationJobs.ts`
  - Implement `cancelJob` mutation with args: jobId
  - Verify ownership, check current status (can only cancel 'pending' or 'processing'), update status to 'cancelled'
  - Implement `updateProgress` internalMutation with args: jobId, phase, questionsGenerated, questionsSaved, estimatedTotal (optional)
  - Update specified fields, no auth check (internal only)
  - Implement `completeJob` internalMutation with args: jobId, topic, questionIds, durationMs
  - Set status='completed', completedAt=now, store results
  - Implement `failJob` internalMutation with args: jobId, errorMessage, errorCode, retryable
  - Set status='failed', completedAt=now, store error details
  - Success criteria: All mutations update database correctly, internal mutations cannot be called from client, ownership checks prevent unauthorized cancellations

- [x] **Add saveBatch mutation to questions module**
  - File: `convex/questions.ts`
  - Add `saveBatch` internalMutation with args: userId, topic (string), questions (array of question objects)
  - Use existing initializeCard() and cardToDb() for FSRS initialization
  - Insert all questions with Promise.all, return array of question IDs
  - Success criteria: Can save multiple questions efficiently, FSRS fields initialized correctly, returns all IDs in order

---

## Phase 3: Backend - AI Generation Processing

- [x] **Create AI generation action module**
  - File: `convex/aiGeneration.ts` (new)
  - Import google model, streamObject from ai SDK, logger, internal APIs
  - Define `processJob` internalAction with args: jobId
  - Success criteria: File structure created, imports resolve correctly

- [x] **Implement job initialization in processJob**
  - File: `convex/aiGeneration.ts`
  - In processJob handler: create logger instance, update job status to 'processing' with startedAt timestamp using updateProgress
  - Fetch job details using getJobById, validate job exists and status is not 'cancelled'
  - Return early with info log if job already cancelled
  - Success criteria: Job status updates correctly, early exit works for cancelled jobs

- [x] **Implement intent clarification phase**
  - File: `convex/aiGeneration.ts`
  - Call existing clarifyLearningIntent() function from lib/ai-client.ts with job.prompt
  - Update progress to phase='clarifying'
  - Parse clarified intent to extract estimated question count using existing logic
  - Update progress with estimatedTotal, phase='generating'
  - Success criteria: Intent clarification completes, estimated count is reasonable (5-50), progress updates reflect phase changes

- [x] **Implement streaming question generation**
  - File: `convex/aiGeneration.ts`
  - Build question prompt using buildQuestionPromptFromIntent() from lib/ai-client.ts
  - Create streamObject call with google('gemini-2.5-flash'), questionsSchema from lib/ai-client.ts
  - Initialize tracking: savedCount = 0, allQuestionIds = []
  - Iterate over partialObjectStream with for-await loop
  - Success criteria: streamObject initializes correctly, loop begins iteration

- [x] **Implement incremental question saving loop**
  - File: `convex/aiGeneration.ts`
  - In stream loop: check for new questions (partial.questions.length > savedCount)
  - Extract newQuestions = partial.questions.slice(savedCount)
  - Call saveBatch with userId, topic, newQuestions using ctx.runMutation
  - Collect returned IDs in allQuestionIds array
  - Update savedCount = partial.questions.length
  - Update progress with questionsGenerated, questionsSaved
  - Success criteria: Questions save incrementally as stream produces them, IDs accumulate correctly, progress updates in real-time

- [x] **Implement cancellation checking in generation loop**
  - File: `convex/aiGeneration.ts`
  - Every 10 questions (use modulo check), query current job status using getJobById
  - If status === 'cancelled', log cancellation with questionsSaved count, call completeJob with partial results, return early from action
  - Success criteria: Cancellation detected within ~10 questions of user action, partial results preserved, job marked completed

- [x] **Implement job completion handling**
  - File: `convex/aiGeneration.ts`
  - After stream loop completes, calculate durationMs = Date.now() - job.startedAt
  - Extract topic from clarifiedIntent or use first question's topic
  - Call completeJob with jobId, topic, allQuestionIds, durationMs
  - Log success with question counts
  - Success criteria: Completed jobs have all fields populated, questionIds match saved questions

- [x] **Implement error handling wrapper**
  - File: `convex/aiGeneration.ts`
  - Wrap entire processJob logic in try-catch
  - Create error classifier function: check error message for 'rate limit'/'429' (code='RATE_LIMIT', retryable=true), 'api key'/'401' (code='API_KEY', retryable=false), 'network'/'timeout' (code='NETWORK', retryable=true), default to code='UNKNOWN', retryable=false
  - In catch block: log error, call failJob with classified error, rethrow
  - Success criteria: All errors caught and classified, failed jobs have actionable error messages, logger captures full context

---

## Phase 4: Frontend - Background Tasks UI

- [x] **Create BackgroundTasksBadge component**
  - File: `components/background-tasks-badge.tsx` (new)
  - Import useQuery, api, Badge, Button, ActivityIcon (from lucide-react)
  - Query api.generationJobs.getRecentJobs with limit 50
  - Calculate activeCount = jobs filtered by status 'pending' or 'processing'
  - Render button with ActivityIcon, show Badge with activeCount if > 0
  - Add onClick to toggle panel open state (use useState)
  - Success criteria: Badge shows correct count, updates in real-time as jobs change status, click toggles panel

- [x] **Create BackgroundTasksPanel slide-out component**
  - File: `components/background-tasks-panel.tsx` (new)
  - Import Sheet, SheetContent, SheetHeader from ui/sheet, useQuery
  - Accept props: open (boolean), onClose (function)
  - Query api.generationJobs.getRecentJobs with limit 20
  - Render Sheet with side="right", map jobs to GenerationTaskCard components
  - Show "No background tasks" empty state if jobs array is empty
  - Success criteria: Panel slides in from right, shows all recent jobs, closes on backdrop click or X button

- [x] **Create GenerationTaskCard component**
  - File: `components/generation-task-card.tsx` (new)
  - Import Card, Progress, Button, useMutation, useRouter, formatDistanceToNow from date-fns
  - Accept props: job (Doc<'generationJobs'>)
  - Render different UI based on job.status:
    - 'processing': show Progress bar (value = questionsSaved / estimatedTotal * 100), phase text, cancel button, latest questions count
    - 'completed': show success checkmark, question count, "View Questions" button (navigates to /my-questions filtered by topic), completion time ago
    - 'failed': show error icon, errorMessage, retry button if retryable (calls createJob mutation with original prompt)
    - 'cancelled': show cancelled icon, partial results count, "View Partial Results" button
    - 'pending': show pending spinner, "Waiting to start" text
  - Success criteria: Each status renders correctly, buttons work, progress animates smoothly

- [x] **Create useActiveJobs hook**
  - File: `hooks/use-active-jobs.ts` (new)
  - Import useQuery, api
  - Query api.generationJobs.getRecentJobs
  - Filter for activeJobs where status is 'pending' or 'processing'
  - Return { jobs: all jobs, activeJobs, activeCount, hasActive: activeCount > 0 }
  - Success criteria: Hook returns correct filtered data, updates reactively

---

## Phase 5: Integration - Wire Everything Together

- [x] **Simplify GenerationModal component**
  - File: `components/generation-modal.tsx`
  - Remove: useQuestionContext state, contextQuestionId prop, currentQuestion prop, all context-related UI (badge, toggle), QUICK_PROMPTS array, context prompt building logic (lines ~44-117)
  - Keep: prompt state, isGenerating state, textareaRef, handleSubmit, handleKeyDown
  - Update handleSubmit: call useMutation(api.generationJobs.createJob) with { prompt, ipAddress: undefined }, remove all saveQuestions logic, remove AI generation fetch call, simply close modal and show toast "Generation started"
  - Update placeholder text to "What would you like to learn about? (e.g., 'NATO alphabet', 'React hooks', 'Periodic table')"
  - Success criteria: Modal is simplified to ~150 lines (from ~367), only has prompt input and submit button, creates job successfully

- [x] **Add BackgroundTasksBadge to navbar**
  - File: `components/navbar.tsx`
  - Import BackgroundTasksBadge and BackgroundTasksPanel components
  - Add state: const [tasksPanelOpen, setTasksPanelOpen] = useState(false)
  - In navbar JSX, add BackgroundTasksBadge before user menu button in right section
  - Pass onOpenPanel={() => setTasksPanelOpen(true)} to badge
  - Add BackgroundTasksPanel after navbar with open={tasksPanelOpen} onClose={() => setTasksPanelOpen(false)}
  - Success criteria: Badge appears in navbar, shows count, opens panel on click, panel displays correctly

- [x] **Wire up GenerationModal to use job system**
  - File: `components/generation-modal.tsx`
  - Import useMutation for createJob from api.generationJobs
  - In handleSubmit: call createJob({ prompt: submittedPrompt }), handle success (show toast with job ID or success message), handle error (show error toast)
  - Remove all generation-related toast updates (loading, progress), show single "Generation started - check Background Tasks" toast
  - Success criteria: Modal creates job successfully, user sees feedback, modal closes immediately

- [x] **Update empty states to use job system**
  - File: `components/empty-states.tsx`
  - Find NoQuestionsEmptyState and AllReviewsCompleteEmptyState components that have generation forms
  - Replace fetch to /api/generate-questions with createJob mutation call
  - Update success handling to show "Generation started" message instead of handling questions directly
  - Success criteria: Empty state forms create jobs successfully, give appropriate feedback

---

## Phase 6: Cleanup & Scheduling

- [x] **Remove old API route and tests**
  - Delete files: `app/api/generate-questions/route.ts`, `app/api/generate-questions/route.test.ts`
  - Search codebase for any remaining imports of these files (should be none after previous tasks)
  - Success criteria: Files deleted, no import errors, build succeeds

- [~] **Add job cleanup cron schedule**
  - File: `convex/cron.ts`
  - Import internal.generationJobs.cleanup
  - Add new cron: crons.daily('cleanupOldJobs', { hourUTC: 3, minuteUTC: 0 }, internal.generationJobs.cleanup)
  - Success criteria: Cron shows in Convex dashboard, scheduled correctly

- [~] **Implement cleanup mutation**
  - File: `convex/generationJobs.ts`
  - Add `cleanup` internalMutation with no args
  - Calculate completedThreshold = now - (COMPLETED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  - Calculate failedThreshold = now - (FAILED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  - Query jobs by status 'completed' where createdAt < completedThreshold
  - Query jobs by status 'failed' where createdAt < failedThreshold
  - Delete all matching jobs, track count
  - Log cleanup results with deletedCount
  - Return { deletedCompleted, deletedFailed, total }
  - Success criteria: Old jobs are deleted appropriately, recent jobs preserved

---

## Phase 7: Testing

- [ ] **Add unit tests for job creation**
  - File: `convex/generationJobs.test.ts` (new)
  - Test: createJob enforces MAX_CONCURRENT_PER_USER limit (create 3 jobs, 4th should throw)
  - Test: createJob enforces prompt length limits (empty, too short, too long)
  - Test: createJob calls rate limiter correctly
  - Test: createJob returns valid jobId
  - Success criteria: All tests pass, edge cases covered

- [ ] **Add unit tests for job mutations**
  - File: `convex/generationJobs.test.ts`
  - Test: cancelJob requires ownership (user A cannot cancel user B's job)
  - Test: cancelJob only works on pending/processing jobs
  - Test: updateProgress updates correct fields
  - Test: completeJob marks job correctly
  - Test: failJob stores error details
  - Success criteria: All mutation behaviors verified

- [ ] **Add unit tests for error classification**
  - File: `convex/aiGeneration.test.ts` (new)
  - Test: rate limit errors classified correctly (code='RATE_LIMIT', retryable=true)
  - Test: API key errors classified correctly (code='API_KEY', retryable=false)
  - Test: network errors classified correctly (code='NETWORK', retryable=true)
  - Test: unknown errors default to code='UNKNOWN', retryable=false
  - Success criteria: All error types classified accurately

- [ ] **Add integration test for full generation flow**
  - File: `convex/generationJobs.integration.test.ts` (new)
  - Test: Full flow - create job → job status becomes processing → questions saved incrementally → job completes with correct questionIds
  - Mock streamObject to return predictable partial results
  - Verify progress updates at each stage
  - Success criteria: End-to-end flow works, all state transitions correct

- [ ] **Add integration test for cancellation**
  - File: `convex/generationJobs.integration.test.ts`
  - Test: Create job, start processing, cancel mid-stream, verify partial results saved, job marked completed
  - Mock streamObject to yield controllable chunks
  - Call cancelJob after N questions generated
  - Success criteria: Cancellation detected, partial work preserved, status correct

- [ ] **Add E2E test for UI flow**
  - File: `tests/e2e/background-generation.test.ts` (new)
  - Test: User opens modal, enters prompt, submits, modal closes, badge appears with count, user opens panel, sees progress, job completes, user navigates to questions
  - Use Playwright page object patterns
  - Mock or use real Convex dev environment
  - Success criteria: Complete user journey works end-to-end

---

## Phase 8: Type Safety & Documentation

- [ ] **Add TypeScript types for job system**
  - File: `types/generation-jobs.ts` (new)
  - Export JobStatus type (union of status literals)
  - Export JobPhase type (union of phase literals)
  - Export ErrorCode type (union of error code literals)
  - Export type guards: isProcessingJob, isCompletedJob, isFailedJob
  - Success criteria: Types imported and used in components, TypeScript strict mode passes

- [ ] **Add JSDoc comments to public APIs**
  - File: `convex/generationJobs.ts`
  - Add JSDoc to createJob: describe params, return value, what it does, rate limiting behavior
  - Add JSDoc to cancelJob: describe cancellation behavior, partial results preservation
  - Add JSDoc to query functions: describe what they return, filtering behavior
  - Success criteria: Hover tooltips in VS Code show helpful documentation

- [ ] **Update CLAUDE.md with background jobs documentation**
  - File: `CLAUDE.md`
  - Add new section: "## Background Question Generation"
  - Document: how jobs are created, how to monitor progress, cancellation behavior, rate limits, retention policy
  - Add code examples of creating jobs and querying status
  - Document configuration constants location and how to adjust limits
  - Success criteria: Documentation is clear, examples are accurate, future developers can understand the system

---

## Verification Checklist

After completing all tasks, verify:
- [ ] `npx convex dev` runs without errors, all functions appear in dashboard
- [ ] `pnpm build` succeeds with no TypeScript errors
- [ ] `pnpm lint` passes with no violations
- [ ] All tests pass: `pnpm test`
- [ ] Can create generation job via UI, modal closes immediately
- [ ] Badge appears in navbar with active job count
- [ ] Panel opens and shows job in "processing" state
- [ ] Questions appear in My Questions page as they're generated
- [ ] Can cancel job mid-generation, partial results preserved
- [ ] Can start multiple concurrent jobs (up to 3)
- [ ] 4th concurrent job attempt shows error
- [ ] Rate limiting prevents spam (test rapid-fire submissions)
- [ ] Completed jobs show in panel with correct counts
- [ ] Failed jobs show error messages with retry option if retryable
- [ ] Old jobs get cleaned up by cron (verify in Convex dashboard after 7+ days)
