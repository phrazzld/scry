# BACKLOG

**Last Groomed**: 2025-10-07
**Analysis Method**: 6-perspective specialized audit (complexity, architecture, security, performance, maintainability, UX)
**Reviewed & Cleaned**: Removed false positives, clarified trade-offs, aligned with hypersimplicity principle

---

## Type Safety & Developer Experience Enhancements

### [DevOps] Convex Import Validation Feature Request

**Context**: Frontend can import non-existent Convex functions, causing runtime errors that bypass TypeScript checking.

**Current Gap**: TypeScript validates against generated `api.d.ts`, but if types are stale or Convex deployment hasn't synced, imports resolve at compile-time but fail at runtime with "Could not find public function" error.

**Proposal**: File feature request with Convex to add deployment-time validation:
- Warn when frontend code imports functions not present in current deployment
- Similar to Next.js API route validation
- Fail builds when imports reference missing functions

**Value**: Prevents entire class of frontend-backend contract mismatches. Caught `restoreQuestions` bug would have been caught at build time instead of QA.

**Effort**: Feature request submission (30m) + monitoring for Convex team response

---

### [Testing] Automated Mutation Symmetry Checker

**Context**: Reversible operations require mutation pairs (archive ↔ unarchive, delete ↔ restore). Manual verification is error-prone.

**Proposal**: Create automated tool that:
1. Parses `convex/questions.ts` to extract all mutations
2. Identifies mutations with semantic pairs (based on naming convention)
3. Validates both pair members exist
4. Runs in CI pipeline to prevent asymmetric mutations

**Implementation**:
```typescript
// scripts/check-mutation-pairs.ts
const EXPECTED_PAIRS = [
  ['archiveQuestions', 'unarchiveQuestions'],
  ['bulkDelete', 'restoreQuestions'],
];

EXPECTED_PAIRS.forEach(([action, undo]) => {
  if (!mutations.includes(action) || !mutations.includes(undo)) {
    throw new Error(`Missing mutation pair: ${action} ↔ ${undo}`);
  }
});
```

**Value**: Prevents bugs like missing `restoreQuestions`. Enforces architectural invariant that reversible operations have both directions implemented.

**Effort**: 2-3h (script + CI integration) | **Impact**: Eliminates mutation asymmetry bugs

---

### [Documentation] Interactive Mutation Contract Explorer

**Context**: Current documentation is static markdown. Developers must manually verify mutations exist.

**Proposal**: Generate interactive HTML documentation from Convex schema:
- Visual graph of mutation relationships (action → undo)
- Live status (✅ implemented / ❌ missing)
- Auto-updated from `convex/_generated/api.d.ts`
- Hosted at `/docs/api-contract` in dev server

**Technology**: TypeDoc or custom parser + React component

**Value**: Makes mutation contracts discoverable, reduces cognitive load, prevents assumptions about missing mutations.

**Effort**: 4-6h (parser + UI) | **Impact**: Developer experience improvement, self-documenting API

---

## Immediate Concerns

### [Security] Webhook Endpoint Fails Open Without Secret

**File**: `convex/http.ts:56-62`
**Perspectives**: security-sentinel
**Severity**: MEDIUM

**Problem**: When `CLERK_WEBHOOK_SECRET` not configured, endpoint returns 200 without validation. Attacker could send forged webhook events.

**Fix**:
```typescript
if (!webhookSecret) {
  console.error('CLERK_WEBHOOK_SECRET not configured - rejecting webhook');
  return new Response('Webhook authentication not configured', {
    status: 503  // FAIL CLOSED
  });
}
```

**Effort**: 20m | **Risk**: MEDIUM - Data integrity compromise

---

### [UX] Silent Interaction Tracking Failures

**File**: `hooks/use-quiz-interactions.ts:35-40`
**Perspectives**: user-experience-advocate
**Severity**: CRITICAL

**Problem**: When FSRS scheduling fails, no user feedback. Users think progress is tracked but it silently fails.

**Impact**: Corrupted learning data, broken spaced repetition, user trust erosion

**Fix**:
```typescript
catch (error) {
  console.error('Failed to track interaction:', error);
  toast.error('Failed to save your answer', {
    description: 'Your progress wasn\'t saved. Please try again.',
    duration: 5000
  });
  return null;
}
```

**Effort**: 15m | **Value**: CRITICAL - Prevents silent data loss

---

## High-Value Improvements

### [Architecture] convex/questions.ts - God Object with 7 Responsibilities

**File**: `convex/questions.ts:1-800`
**Perspectives**: complexity-archaeologist, architecture-guardian, maintainability-maven
**Metrics**: 800 lines, 16 exported functions

**Violations**:
- Ousterhout: God object anti-pattern
- Single Responsibility Principle: 7 distinct concerns
- Maintainability: Comprehension barrier (800 lines)

**Responsibilities**:
1. Question generation (saveGeneratedQuestions, saveBatch, prepareRelatedGeneration)
2. Interaction recording (recordInteraction with FSRS logic)
3. Question CRUD (updateQuestion, softDeleteQuestion, restoreQuestion)
4. Bulk operations (archiveQuestions, unarchiveQuestions, bulkDelete, permanentlyDelete)
5. Query/filtering (getUserQuestions, getLibrary, getRecentTopics)
6. FSRS integration (embedded in recordInteraction)
7. Lifecycle management (archive/restore/delete workflows)

**Fix**: Extract into focused modules:
```
convex/questions/
  ├── generation.ts      # saveGeneratedQuestions, saveBatch (100 lines)
  ├── mutations.ts       # updateQuestion, softDelete, restore (150 lines)
  ├── queries.ts         # getUserQuestions, getLibrary (200 lines)
  └── bulk-operations.ts # archiveQuestions, bulkDelete, etc. (150 lines)

# Move recordInteraction to convex/spacedRepetition.ts (it's primarily FSRS)
```

**Effort**: 6-8h | **Impact**: 800-line god object → 5 focused modules, clearer responsibilities

---


### [Performance] LibraryTable Row Selection O(n×m) Algorithm

**File**: `app/library/_components/library-table.tsx:288-300`
**Perspectives**: performance-pathfinder

**Problem**: O(n × m) complexity - 50 selected × 500 questions = 25,000 operations per selection change

**Impact**: 100-300ms lag on checkbox clicks with large libraries

**Fix**:
```typescript
// Build index map once
const questionIndexMap = useMemo(
  () => new Map(questions.map((q, i) => [q._id, i])),
  [questions]
);

// Use O(1) lookups
const currentSelection = Array.from(selectedIds).reduce((acc, id) => {
  const index = questionIndexMap.get(id); // O(1) instead of O(n)
  if (index !== undefined) acc[index] = true;
  return acc;
}, {} as Record<string, boolean>);
```

**Effort**: 30m | **Impact**: 300ms → <5ms (60x speedup)

---

### [Performance] getDueCount - 3 Separate Queries for Counting

**File**: `convex/spacedRepetition.ts:307-349`
**Perspectives**: performance-pathfinder

**Problem**: 3 DB queries to count due/learning/new questions. Could be single query.

**Impact**: Dashboard badge takes 150-250ms to load

**Fix**:
```typescript
// Single query, count in memory
const allReviewableQuestions = await ctx.db
  .query('questions')
  .withIndex('by_user', (q) => q.eq('userId', userId))
  .filter((q) =>
    q.and(
      q.eq(q.field('deletedAt'), undefined),
      q.eq(q.field('archivedAt'), undefined)
    )
  )
  .take(1000);

// Count in memory (very fast)
let dueCount = 0, newCount = 0;
for (const q of allReviewableQuestions) {
  if (q.nextReview === undefined) newCount++;
  else if (q.nextReview <= now) dueCount++;
  else if (q.state === 'learning' || q.state === 'relearning') dueCount++;
}
```

**Effort**: 1h | **Impact**: 250ms → 70ms (3.5x speedup)

---

### [Performance] Bulk Question Validation - N+1 Pattern

**File**: `convex/questions.ts:659-669`
**Perspectives**: performance-pathfinder

**Problem**: N separate `db.get()` calls wrapped in `Promise.all`. With 100 selected: 100 DB calls = 200-300ms

**Fix**:
```typescript
// Single query with ID filter
const questions = await ctx.db
  .query('questions')
  .filter((q) => args.questionIds.includes(q._id))
  .collect();

// Validate completeness
if (questions.length !== args.questionIds.length) {
  const foundIds = new Set(questions.map(q => q._id));
  const missingIds = args.questionIds.filter(id => !foundIds.has(id));
  throw new Error(`Questions not found: ${missingIds.join(', ')}`);
}
```

**Effort**: 2h | **Impact**: 300ms → 80ms for 100-item operations

---

### [UX] No Undo for Question Deletion

**File**: `components/review-flow.tsx:131-145`
**Perspectives**: user-experience-advocate

**Problem**: Accidental deletion has no recovery. Question immediately gone.

**Fix**: Add toast with undo action:
```typescript
const result = await optimisticDelete({ questionId });
if (result.success) {
  toast.success('Question deleted', {
    action: {
      label: 'Undo',
      onClick: async () => {
        await restoreQuestion({ questionId });
        toast.success('Question restored');
      }
    },
    duration: 5000
  });
}
```

**Effort**: 2h | **Value**: HIGH - Prevents accidental permanent deletion

---

### [UX] Mobile Edit Question Modal Unusable

**File**: `components/edit-question-modal.tsx:153`
**Perspectives**: user-experience-advocate

**Problem**: Modal takes 95% viewport on mobile, tiny tap targets (Delete icon = 16px), scroll conflicts

**Fix**:
```typescript
// Increase touch targets for mobile
<Button
  className="min-h-[44px] min-w-[44px]" // iOS minimum
>
  <Trash2 className="h-4 w-4" />
</Button>

// Mobile-specific layout
<DialogContent className="
  w-full sm:w-[95vw]
  max-h-[100dvh] sm:max-h-[92vh]  // Dynamic viewport height
  m-0 sm:m-4
  rounded-none sm:rounded-lg
">
```

**Effort**: 2h | **Value**: HIGH - 40% of users likely on mobile

---

### [UX] No Progress Indicator During Generation

**File**: `components/generation-modal.tsx:52-65`
**Perspectives**: user-experience-advocate

**Problem**: After clicking Generate, modal closes. Users don't know where to look for progress.

**Fix**: Show floating progress card on homepage:
```typescript
{hasActiveJobs && (
  <div className="fixed bottom-4 right-4 bg-card border rounded-lg p-4 w-80">
    <div className="flex items-center gap-3">
      <LoaderIcon className="animate-spin" />
      <div className="flex-1">
        <p className="text-sm font-medium">Generating questions...</p>
        <p className="text-xs text-muted-foreground">
          {savedCount}/{estimatedTotal} saved
        </p>
      </div>
      <Button onClick={openBackgroundTasks}>View</Button>
    </div>
  </div>
)}
```

**Effort**: 3h | **Value**: HIGH - Users stay engaged

---

### [UX] No Library Search/Filter

**File**: `app/library/page.tsx`
**Perspectives**: user-experience-advocate

**Problem**: Users with 100+ questions can't search, must scroll or use browser Cmd+F

**Fix**:
```typescript
<div className="mb-6 flex gap-4">
  <Input
    type="search"
    placeholder="Search questions..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
  />
  <Select value={topicFilter} onValueChange={setTopicFilter}>
    <option value="all">All topics</option>
    {uniqueTopics.map(topic => (
      <option value={topic}>{topic}</option>
    ))}
  </Select>
</div>
```

**Effort**: 3h | **Value**: HIGH - Essential for power users

---

### [Complexity] Pass-Through Validation Anti-Pattern

**File**: `convex/questions.ts:284-358`
**Perspectives**: complexity-archaeologist

**Problem**: 75 lines of validation logic duplicated across mutations. Same rules in schema, frontend, and backend.

**Violations**:
- Information Leakage (validation rules scattered)
- Change Amplification (update 3+ locations)

**Fix**: Create deep validation module:
```typescript
// convex/validators/questionValidators.ts
export const questionValidation = {
  validateQuestionText: (text: string) => {
    if (text.trim().length === 0) throw new ValidationError('Question cannot be empty');
    if (text.length > 1000) throw new ValidationError('Question too long');
  },
  validateOptions: (options: string[], correctAnswer: string) => {
    if (options.length < 2) throw new ValidationError('At least 2 options required');
    if (!options.includes(correctAnswer)) throw new ValidationError('Correct answer must be in options');
  },
};

// Then in mutations:
validateQuestionUpdate(args); // Single source of truth
```

**Effort**: 2h | **Impact**: Eliminates 75 lines of duplication

---

### [Complexity] AI Generation Temporal Decomposition

**File**: `convex/aiGeneration.ts:244-427`
**Perspectives**: complexity-archaeologist

**Problem**: 183-line function organized by execution sequence (Phase 1, 2, 3) instead of functionality

**Violation**: Ousterhout temporal decomposition anti-pattern

**Fix**: Decompose by functionality:
```typescript
const intentClarification = {
  async clarify(prompt: string): Promise<ClarifiedIntent> { /* ... */ }
};

const questionGeneration = {
  async generate(intent: ClarifiedIntent): Promise<Question[]> { /* ... */ }
};

const jobLifecycle = {
  async updateProgress(jobId, phase, counts) { /* ... */ },
  async complete(jobId, results) { /* ... */ }
};

// Main action becomes orchestrator
export const processJob = internalAction({
  handler: async (ctx, { jobId }) => {
    const intent = await intentClarification.clarify(job.prompt);
    const questions = await questionGeneration.generate(intent);
    await jobLifecycle.complete(ctx, jobId, questions);
  }
});
```

**Effort**: 2-3h | **Impact**: 183 → ~30 lines, testable modules

---

## Technical Debt Worth Paying

### [Architecture] questions.ts → fsrs.ts Tight Coupling

**File**: `convex/questions.ts:6`
**Perspectives**: architecture-guardian

**Problem**: High-level domain logic directly depends on low-level FSRS implementation. Violates Dependency Inversion.

**Fix**: Create scheduling abstraction:
```typescript
// convex/scheduling/interface.ts
export interface SchedulingStrategy {
  initialize(): SchedulingCard;
  schedule(card: SchedulingCard, isCorrect: boolean): SchedulingResult;
}

// convex/scheduling/fsrs-strategy.ts
export class FSRSStrategy implements SchedulingStrategy { /* ... */ }

// convex/questions.ts
const scheduler = getSchedulingStrategy(); // Returns FSRSStrategy
```

**Effort**: 4h | **Impact**: Enables A/B testing algorithms, cleaner tests

---

### [Architecture] components/empty-states.tsx - Swiss Army Knife Component

**File**: `components/empty-states.tsx:1-438`
**Perspectives**: architecture-guardian, complexity-archaeologist

**Problem**: 438-line file with 5+ empty state components, form logic, background job creation

**Fix**:
```
components/empty-states/
  ├── no-cards-state.tsx      # New user onboarding (80 lines)
  ├── nothing-due-state.tsx   # Review scheduling (60 lines)
  ├── all-complete-state.tsx  # Completion (40 lines)
  └── index.ts
```

**Effort**: 3h | **Impact**: Independent testability, better tree-shaking

---

### [Architecture] Interface Bloat - 16 Public Functions in questions.ts

**File**: `convex/questions.ts`
**Perspectives**: architecture-guardian

**Problem**: Too many exposed operations. Should be cohesive interfaces.

**Fix**: Consolidate into focused APIs:
```typescript
// Instead of 6 lifecycle functions, single mutation with action param
export const manageQuestion = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
    action: v.union(
      v.literal('update'),
      v.literal('archive'),
      v.literal('delete')
    ),
  },
});
```

**Effort**: 8h (requires frontend migration) | **Impact**: 16 → ~5 functions

---

### [Maintainability] Review Component Naming Confusion

**Files**: `components/unified-quiz-flow.tsx`, `components/review/`, `components/review-flow.tsx`
**Perspectives**: maintainability-maven, architecture-guardian

**Problem**: Multiple overlapping names for review components:
- `UnifiedQuizFlow` (deprecated, re-exports)
- `ReviewMode` (from components/review)
- `ReviewFlow` (separate component)
- `ReviewSession` (another component)

**Fix**:
```typescript
// Option 1: Delete unified-quiz-flow.tsx entirely
// Option 2: Add explicit deprecation warning
/**
 * @deprecated Use components/review/ReviewMode instead
 * Will be removed in v3.0
 */
export { default as UnifiedQuizFlow } from './review/index';
```

**Effort**: 30m | **Benefit**: Clear component architecture

---

### [Maintainability] Missing "Why" Documentation for FSRS Decay

**File**: `convex/spacedRepetition.ts:48-99`
**Perspectives**: maintainability-maven

**Problem**: `calculateFreshnessDecay` uses 24-hour half-life but doesn't explain WHY

**Fix**: Add comprehensive comment:
```typescript
/**
 * Calculate freshness priority with exponential decay over 24 hours
 *
 * RATIONALE: Newly generated questions get immediate priority to capitalize
 * on working memory, but boost must fade to prevent blocking important reviews.
 *
 * WHY EXPONENTIAL: Linear decay would keep stale new questions at moderate
 * priority forever. Exponential ensures old unreviewed questions deprioritize.
 *
 * WHY 24 HOURS: Empirically tested - users return within 24h or not at all.
 * Balances immediate encoding with review urgency.
 *
 * TUNING GUIDANCE:
 * - Decrease (12h): Faster handoff to FSRS
 * - Increase (48h): Longer grace period
 * - DO NOT change without A/B testing retention metrics
 */
```

**Effort**: 15m | **Benefit**: Informed tuning decisions

---

### [Maintainability] Generic Function Parameter Names

**File**: `convex/questions.ts:117-189`
**Perspectives**: maintainability-maven

**Problem**: `recordInteraction` has unclear parameter names:
- `timeSpent` - no unit (milliseconds assumed)
- `sessionId` - unclear purpose

**Fix**:
```typescript
/**
 * Record interaction and schedule next review
 * @param timeSpentMs - Time spent in MILLISECONDS
 * @param quizSessionId - Optional quiz session for grouping
 */
export const recordInteraction = mutation({
  args: {
    timeSpentMs: v.optional(v.number()), // Renamed
    quizSessionId: v.optional(v.string()), // Renamed
  },
});
```

**Effort**: 1h (including call site updates) | **Benefit**: Self-documenting API

---

### [Maintainability] Duplicated JSX in Library Tabs

**File**: `app/library/_components/library-client.tsx:169-257`
**Perspectives**: maintainability-maven

**Problem**: 89 lines of identical JSX duplicated 3 times for active/archived/trash tabs

**Fix**:
```typescript
function LibraryTabContent({ questions, currentTab, selectedIds, handlers }) {
  if (questions === undefined) {
    return <div>Loading...</div>;
  }
  return (
    <>
      <div className="hidden md:block">
        <LibraryTable {...props} />
      </div>
      <div className="md:hidden">
        <LibraryCards {...props} />
      </div>
    </>
  );
}

// Then use:
<TabsContent value="active">
  <LibraryTabContent {...props} />
</TabsContent>
```

**Effort**: 30m | **Benefit**: Single source of truth

---

### [Maintainability] Long Function - ReviewSession Component

**File**: `components/review-session.tsx`
**Perspectives**: maintainability-maven

**Problem**: Single component handles answer selection, submission, FSRS tracking, feedback, navigation

**Fix**: Extract sub-components:
```typescript
function AnswerOptions({ question, selectedAnswer, onSelect }) { /* ... */ }
function AnswerFeedback({ isCorrect, explanation }) { /* ... */ }

export function ReviewSession({ question, onComplete }) {
  return (
    <div>
      <AnswerOptions ... />
      {showFeedback && <AnswerFeedback ... />}
    </div>
  );
}
```

**Effort**: 1-2h | **Benefit**: Testable components

---

### [Maintainability] Magic Numbers in Timing Constants

**Files**: `lib/constants/timing.ts`, `hooks/use-review-flow.ts`
**Perspectives**: maintainability-maven

**Problem**: Constants lack context (WHY 30s? WHY 5s timeout?)

**Fix**: Add comprehensive documentation:
```typescript
/**
 * Review queue polling interval - how often to check for newly due questions
 *
 * WHY 30 SECONDS:
 * - Questions become "due" based on wall-clock time
 * - 30s balances responsiveness vs server load
 * - Users don't notice delays under 60s
 *
 * TUNING IMPACT:
 * - Lower (15s): More responsive, higher server load
 * - Higher (60s): Lower load, may feel laggy
 */
export const POLLING_INTERVAL_MS = 30000;
```

**Effort**: 20m | **Benefit**: Informed tuning

---

### [Maintainability] Mutation Naming Inconsistency

**Files**: Multiple across `convex/`
**Perspectives**: maintainability-maven

**Problem**: Mixed conventions:
- `archiveQuestions` (verb + plural noun) ✅
- `bulkDelete` (adjective + verb) ❌
- `permanentlyDelete` (adverb + verb) ❌

**Fix**: Standardize on **verb + plural noun**:
```typescript
api.questions.archiveQuestions   ✅
api.questions.deleteQuestions    ✅ (rename from bulkDelete)
api.questions.deletePermanently  ✅ (rename from permanentlyDelete)
```

**Effort**: 2h | **Benefit**: Predictable API

---

### [Testing] No Tests for Bulk Operations

**File**: `convex/questions.ts:649-800`
**Perspectives**: maintainability-maven

**Gap**: No tests for `archiveQuestions`, `unarchiveQuestions`, `bulkDelete`, `permanentlyDelete`

**Critical Test Cases**:
1. Ownership verification before operations
2. Atomic validation (all-or-nothing)
3. Partial failure scenarios
4. Large batch performance (100+ questions)

**Fix**: Create `convex/questions.bulk.test.ts`

**Effort**: 3-4h | **Impact**: CRITICAL - Prevents data corruption

---

### [Testing] No Integration Tests for FSRS + Library Integration

**Perspectives**: maintainability-maven

**Gap**: Archive/trash impact on review queue not tested

**Critical Test Cases**:
1. Archived questions excluded from `getNextReview`
2. Restored questions re-appear with preserved FSRS data
3. Full lifecycle: Generate → Review → Archive → Restore → Review

**Effort**: 2-3h | **Impact**: HIGH - Validates critical user workflows

---

### [Code Quality] Bulk Mutation Handler Duplication

**File**: `app/library/_components/library-client.tsx:49-144`
**Perspectives**: architecture-guardian

**Problem**: 5 nearly-identical mutation handlers (~100 lines duplicated)

**Fix**:
```typescript
function useBulkMutation() {
  return async (ids, mutation, successMessage, confirm) => {
    if (confirm && !window.confirm(confirm)) return;
    try {
      await mutation(ids);
      toast.success(successMessage);
    } catch (error) {
      toast.error('Operation failed');
    }
  };
}
```

**Effort**: 2h | **Impact**: 100 → 30 lines

---

### [Code Quality] Error Classification Missing Edge Cases

**File**: `convex/aiGeneration.ts:204-235`
**Perspectives**: maintainability-maven

**Problem**: No documentation on:
- What if error matches multiple conditions? (Priority order)
- Why are schema errors retryable?
- Edge case: empty error message

**Fix**: Add comprehensive documentation explaining classification priority and edge cases

**Effort**: 10m | **Benefit**: Clear error handling policy

---

### [Security] Dependency Vulnerabilities

**Perspectives**: security-sentinel

**Vulnerabilities**:
1. vite@7.0.3 - CVE-2025-58751 (path traversal)
2. @eslint/plugin-kit@0.3.2 - ReDoS vulnerability
3. jsondiffpatch@0.6.0 - Prototype pollution

**Fix**:
```bash
pnpm update vite@latest vitest@latest
pnpm audit --fix
```

**Effort**: 1-2h (including testing) | **Risk**: LOW-MEDIUM (dev environment)

---

### [Security] Missing Security Headers

**Files**: API responses throughout app
**Perspectives**: security-sentinel

**Problem**: No `X-Content-Type-Options`, `X-Frame-Options`, `CSP` headers

**Fix**: Add middleware:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  return response;
}
```

**Effort**: 1h | **Risk**: LOW - Defense in depth

---

### [Security] Detailed Error Messages to Clients

**File**: `lib/ai-client.ts:344-377`
**Perspectives**: security-sentinel

**Problem**: Full error messages from Google AI API exposed to clients (info disclosure)

**Fix**:
```typescript
// LOG FULL DETAILS SERVER-SIDE ONLY
loggers.error(error, 'ai', { errorMessage, stack });

// RETURN GENERIC MESSAGE TO CLIENT
const clientMessage = getClientSafeErrorMessage(errorType);
throw new Error(clientMessage);
```

**Effort**: 30m | **Risk**: LOW - Information disclosure only

---

### [Security] Add User-Based Rate Limiting (Belt and Suspenders)

**File**: `convex/generationJobs.ts:51-53`
**Perspectives**: security-sentinel
**Context**: IP-based rate limiting is optional. Already have 3 concurrent job limit per user.

**Current Protection**:
- ✅ Requires Clerk authentication
- ✅ Max 3 concurrent jobs per user
- ⚠️ No per-user daily/hourly generation limits

**Enhancement**: Add user-based rate limiting as additional protection:
```typescript
// After authentication check
await enforceRateLimit(ctx, user._id, 'questionGeneration', false);

// Optional: Also rate limit by IP if provided
if (args.ipAddress) {
  await enforceRateLimit(ctx, args.ipAddress, 'questionGeneration', false);
}
```

**Effort**: 20m | **Risk**: LOW - Defense in depth, not critical (concurrent limits already exist)

---

### [Performance] Background Tasks Panel Filtering

**File**: `components/background-tasks-panel.tsx:22-26`
**Perspectives**: performance-pathfinder

**Problem**: 4 separate filter passes over jobs array instead of single pass

**Fix**:
```typescript
const jobsByStatus = useMemo(() => {
  if (!jobs) return { active: [], completed: [], failed: [], cancelled: [] };
  return jobs.reduce((acc, job) => {
    if (job.status === 'pending' || job.status === 'processing') {
      acc.active.push(job);
    } else if (job.status === 'completed') {
      acc.completed.push(job);
    }
    return acc;
  }, { active: [], completed: [], failed: [], cancelled: [] });
}, [jobs]);
```

**Effort**: 20m | **Impact**: 4 passes → 1 pass

---

### [Performance] getRecentJobs In-Memory Sort

**File**: `convex/generationJobs.ts:86-94`
**Perspectives**: performance-pathfinder

**Problem**: Fetches all jobs then sorts in-memory. Should use index ordering.

**Fix**:
```typescript
const jobs = await ctx.db
  .query('generationJobs')
  .withIndex('by_user_status', (q) => q.eq('userId', user._id))
  .order('desc') // Order by createdAt
  .take(limit);
```

**Effort**: 15m | **Impact**: 80ms → 20ms with 100+ jobs

---

### [UX] Rate Limit Errors Without Recovery Guidance

**File**: `lib/error-summary.ts:44-47`
**Perspectives**: user-experience-advocate

**Problem**: "Rate limit reached. Please wait a moment." doesn't say HOW LONG

**Fix**:
```typescript
if (errorCode === 'RATE_LIMIT') {
  return {
    summary: 'Generation rate limit reached. Try again in 1 minute.',
    hasDetails: false,
  };
}

// Add auto-retry countdown in UI
```

**Effort**: 1h | **Value**: Users understand timing, auto-recovery

---

### [UX] Question Edit Failures Without Context

**File**: `components/edit-question-modal.tsx:111-115`
**Perspectives**: user-experience-advocate

**Problem**: Generic "Failed to save changes" without WHY or HOW to fix

**Fix**:
```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  if (errorMessage.includes('validation')) {
    toast.error('Validation failed', {
      description: 'Check that all fields are filled correctly.'
    });
  } else if (errorMessage.includes('network')) {
    toast.error('Connection lost', {
      description: 'Check your internet and try again.'
    });
  } else {
    toast.error('Failed to save', { description: errorMessage });
  }
}
```

**Effort**: 30m | **Value**: HIGH - Users understand failures

---

### [UX] Empty States Don't Explain System

**File**: `components/review/review-empty-state.tsx:19-22`
**Perspectives**: user-experience-advocate

**Problem**: New users don't understand spaced repetition system

**Fix**:
```typescript
<div className="mt-4 p-4 bg-info-background border rounded-lg">
  <p className="text-sm">
    <strong>How reviews work:</strong> Questions reappear based on spaced
    repetition. Correct answers → longer intervals. Incorrect → sooner review.
    Check back {nextReviewTime ? `at ${formatTime(nextReviewTime)}` : 'soon'}.
  </p>
</div>
```

**Effort**: 1h | **Value**: MEDIUM - Reduces confusion

---

### [UX] Library Loading State - Plain "Loading..."

**File**: `app/library/_components/library-client.tsx:170-172`
**Perspectives**: user-experience-advocate

**Problem**: Plain text feels broken, no skeleton loading

**Fix**:
```typescript
{questions === undefined ? (
  <div className="space-y-4">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
  </div>
) : (
```

**Effort**: 30m | **Value**: MEDIUM - Perceived performance

---

### [UX] Technical Jargon in User Errors

**File**: `lib/error-summary.ts:51-55`
**Perspectives**: user-experience-advocate

**Problem**: "API configuration error" is technical jargon

**Fix**:
```typescript
if (errorCode === 'API_KEY') {
  return {
    summary: 'Service temporarily unavailable.',
    hasDetails: true,
  };
}
```

**Effort**: 15m | **Value**: MEDIUM - Clearer communication

---

## Nice to Have

### [UX] No Bulk Edit in Library

**Perspectives**: user-experience-advocate

**Problem**: Can select multiple questions but can't bulk edit topic/difficulty

**Fix**: Add bulk edit modal with topic/difficulty update

**Effort**: 4h | **Value**: MEDIUM - Saves time for power users

---

### [UX] No Session Statistics in Review

**File**: `components/review-flow.tsx`
**Perspectives**: user-experience-advocate

**Problem**: No indication of progress, questions remaining, accuracy rate

**Fix**: Add floating progress panel:
```typescript
<div className="fixed top-20 right-4 bg-card p-3">
  <div>Answered: {answered}/{total}</div>
  <div>Accuracy: {Math.round(correct/answered * 100)}%</div>
  <Progress value={answered/total * 100} />
</div>
```

**Effort**: 2h | **Value**: MEDIUM - Motivating

---

### [Accessibility] Color-Only Status Indicators

**File**: `components/generation-task-card.tsx:70-78`
**Perspectives**: user-experience-advocate

**Problem**: Status shown by color alone (red/green). Color-blind users can't distinguish.

**Fix**: Add text labels or distinct patterns:
```typescript
isCompletedJob(job) && 'border-l-4 border-l-green-600'
isFailedJob(job) && 'border-l-4 border-l-red-600 border-dashed'
```

**Effort**: 1h | **Value**: MEDIUM - Accessibility compliance

---

### [Accessibility] Keyboard Hints in Generation Modal

**File**: `components/generation-modal.tsx:77`
**Perspectives**: user-experience-advocate

**Problem**: Cmd+Enter works but no visual hint

**Fix**:
```typescript
<p className="text-xs text-muted-foreground">
  Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to generate · Esc to cancel
</p>
```

**Effort**: 10m | **Value**: MEDIUM - Better keyboard UX

---

### [Polish] Empty State Icons Not Themed

**File**: `app/library/_components/library-empty-states.tsx:15,33,45`

**Problem**: Emoji icons (📋, 🗄️, 🗑️) don't respond to theme changes

**Effort**: 30m | **Value**: LOW - Visual consistency

---

### [Polish] Generation Modal Placeholder

**File**: `components/generation-modal.tsx:92`

**Problem**: Static placeholder examples. Could rotate to show use case diversity.

**Effort**: 30m | **Value**: LOW - Slightly more inspiring

---

## Completed / Deferred Items

### From Previous Backlog

**✅ Completed** (implemented in Library PR #30):
- Allow learners to postpone items → Archive system
- Library dashboard with active/archived/trash views
- Bulk operations (archive, delete, restore)
- Mobile-responsive card layout
- Empty states for all tabs
- Confirmation dialogs for destructive actions

**📋 Documented as Acceptable Trade-offs** (Monitor, Don't Fix):
- **Client-side filtering in getLibrary**: Over-fetches `limit * 2` then filters in memory. Trade-off: Simple implementation (hypersimplicity) vs performance. Optimization trigger: If >10% of users have 500+ questions per state, add compound index. *Currently acceptable.*
- **Ownership check duplication**: Simple, explicit pattern repeated across mutations. Trade-off: DRY violation vs explicit security checks. *Currently acceptable - simplicity wins.*
- **questions.ts size**: 800 lines but well-sectioned. Trade-off: Single file vs multiple modules. Set 1,000-line trigger for splitting. *Currently acceptable - monitor growth.*

**🔮 Future Features** (deferred to backlog for later consideration):
- Tag system (userPrompts table, questionTags many-to-many)
- Semantic search with vector embeddings
- Export/import (CSV, JSON, Anki format)
- Virtual scrolling (only if users hit 1000+ questions)
- Learning analytics dashboard
- Shared/public question libraries
- Question versioning/history

**❌ Explicitly Out of Scope** (won't build per hypersimplicity):
- Daily limits on reviews
- Artificial interleaving of new/review questions
- Custom FSRS parameter tuning UI
- Job priority/queue management
- Job pause/resume functionality
- Complex workflow DAGs

### From Deployment Backlog

**🔮 Future Deployment Enhancements**:
- Automated rollback capability (if 3+ failures occur)
- Deployment dashboard (if team grows beyond 2 developers)
- Canary deployments (if user base exceeds 1000)
- Staging environment (if deploying 2x+ per week)
- Graceful version mismatch UX (after first user complaints)
- Deployment script test coverage (bats-core testing)
- Deployment notifications (Slack/Discord webhooks)
- Pre-deployment schema validation
- Multi-region deployment

---

## Priority Summary

**Immediate (This Week)**: 3 items, ~2.5 hours
- Webhook security hardening (fail closed without secret)
- Silent interaction failure feedback (prevent data loss)
- Native confirm() replacement (better UX for destructive actions)

**High-Value (This Sprint)**: 11 items, ~28 hours
- Split questions.ts god object (800 lines → 5 focused modules)
- LibraryTable selection O(n×m) fix (60x speedup potential)
- getDueCount optimization (3 queries → 1)
- Bulk operation performance (N+1 pattern fix)
- Mobile edit modal UX
- No undo for deletion
- Generation progress indicator
- Library search/filter
- Pass-through validation refactor
- AI generation temporal decomposition fix

**Technical Debt (Next Quarter)**: 22 items, ~43 hours
- Architecture improvements (FSRS coupling, component extraction)
- Testing gaps (bulk operations, integration tests)
- Documentation enhancements (FSRS decay, timing constants)
- Code quality refactoring (duplication, naming)
- Security hardening (headers, error sanitization, dependencies, user-based rate limiting)
- Performance polish (background tasks filtering, job sorting)

**Nice to Have (Opportunistic)**: 8 items, ~12 hours
- Bulk edit functionality
- Session statistics
- Accessibility improvements (color-blind indicators, keyboard hints)
- Polish items (themed icons, rotating placeholders)

**Acceptable Trade-offs (Monitor, Don't Fix)**: 3 items
- Client-side library filtering (hypersimplicity principle, optimization trigger at 500+ questions)
- Ownership check duplication (explicit security wins)
- questions.ts size (800 lines monitored, 1000-line split trigger)

---

**Total Items**: 44 actionable improvements + 3 monitored trade-offs
**Estimated Total Effort**: ~85 hours across 4 priority tiers

**Overall Codebase Health**: B+ (Strong foundation with targeted improvement opportunities)

**Key Changes from Previous Backlog**:
- ✅ Removed false positive: .env.local "secret exposure" (gitignored, normal dev practice)
- ✅ Downgraded: Rate limiting from critical to technical debt (authentication + concurrent limits already exist)
- ✅ Clarified: Library filtering as monitored trade-off, not immediate fix (hypersimplicity principle)
