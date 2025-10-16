# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scry is an AI-powered quiz generation and learning application built with Next.js 15 and Convex. It uses Google Gemini for content generation, Convex for the backend database and authentication, and implements spaced repetition algorithms for optimized learning.

## Development Commands

```bash
# Install dependencies (MUST use pnpm)
pnpm install

# Run development server with Turbopack
pnpm dev

# Start Convex development server (in separate terminal)
npx convex dev

# Build for production
pnpm build

# Run production server
pnpm start

# Run linting
pnpm lint

# Generate static assets
pnpm assets:generate
pnpm assets:generate-all  # Verbose mode with all assets
```

## Deployment

### Vercel Deployment

```bash
# Project linking and environment management
vercel link                    # Link local project to Vercel project
vercel env pull .env.local     # Pull environment variables locally
vercel env ls                  # List all environment variables
vercel env add VAR_NAME        # Add new environment variable
vercel env rm VAR_NAME         # Remove environment variable

# Deployment commands
vercel                         # Deploy to preview environment
vercel --prod                  # Deploy to production
vercel logs --prod            # View production logs
vercel logs --prod --follow   # Stream real-time logs
```

### Convex Deployment

```bash
# Deploy Convex functions to production
npx convex deploy

# Set environment variables in Convex dashboard
# Required: RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_APP_URL
```

**Important Notes:**
- Always use `npx convex dev` to ensure deployment to correct instance
- Check Convex dashboard logs to verify deployments succeeded
- Actions that make external API calls must use `internalAction` not `action`
- Schedule actions using `internal.module.functionName` not `api.module.functionName`

## Environment Setup

### Critical: Vercel vs Convex Environment Variables

**Vercel and Convex maintain SEPARATE environment variable systems.** Setting a variable in one does NOT automatically sync to the other. This is a common source of production deployment issues.

**Architecture:**
- **Vercel** (Next.js frontend/API routes): Reads from Vercel environment variables
- **Convex** (Backend functions): Reads from Convex environment variables
- These are SEPARATE systems running in different infrastructures

### ⚠️ CRITICAL: Preview Deployment Architecture (Free Tier Limitation)

**ON CONVEX FREE TIER, PREVIEW DEPLOYMENTS SHARE THE PRODUCTION CONVEX BACKEND.**

This is the #1 source of configuration errors. Here's what this means:

```
┌─────────────────────────────────────────┐
│ Vercel Preview (Next.js Frontend)      │
│ - Different URL per PR branch          │
│ - Isolated frontend deployment         │
└──────────────┬──────────────────────────┘
               │
               │ HTTP requests to Convex
               ▼
┌─────────────────────────────────────────┐
│ Convex PRODUCTION Backend (SHARED!)    │
│ - SINGLE backend for all previews      │
│ - Uses PRODUCTION environment variables │
│ - Affects PRODUCTION data               │
│ - Missing API keys break EVERYTHING    │
└─────────────────────────────────────────┘
```

**What This Means For You:**
1. **API Configuration Affects Everything**: If `GOOGLE_AI_API_KEY` is missing/invalid in Convex production, BOTH preview AND production fail
2. **No Environment Isolation**: Can't test with different API keys in preview
3. **Shared Database**: Preview mutations modify production data (be careful!)
4. **Single Point of Failure**: One misconfigured env var breaks all environments

**Why This Happens:**
- Convex free tier only provides: 1 production deployment + 1 dev deployment per developer
- Preview Convex deployments require Convex Pro ($25/month)
- Our build script (`scripts/vercel-build.sh`) only deploys Next.js for previews, not Convex

**Solution Options:**
1. **Accept Free Tier Limitations** (Current): Understand that preview = production backend
2. **Upgrade to Convex Pro** ($25/mo): Get isolated preview Convex deployments with separate environment variables
3. **Test in Dev Deployment**: Use `npx convex dev` for testing instead of preview URLs

**Preventing Configuration Issues:**
- Always validate Convex production environment variables before deployment
- Use health check endpoint: `curl https://your-preview.vercel.app/api/health/preview`
- Run validation script: `./scripts/validate-env-vars.sh production`
- Test API keys locally before committing changes

**Variable Distribution:**

| Variable | Vercel | Convex | Purpose |
|----------|--------|--------|---------|
| `GOOGLE_AI_API_KEY` | ❌ | ✅ | Used by `convex/aiGeneration.ts` for quiz generation |
| `RESEND_API_KEY` | ❌ | ✅ | Used by Convex for sending magic link emails |
| `EMAIL_FROM` | ❌ | ✅ | From address for emails |
| `NEXT_PUBLIC_APP_URL` | ❌ | ✅ | Application URL for magic links |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ | ❌ | Frontend needs to know Convex backend URL |
| `CONVEX_DEPLOY_KEY` | ✅ | ❌ | Vercel build needs to deploy Convex |
| `CLERK_*` | ✅ | ❌ | Frontend authentication configuration |

**Setting Environment Variables:**

```bash
# Set Convex variables (for backend functions)
npx convex env set GOOGLE_AI_API_KEY "your-key" --prod
npx convex env set RESEND_API_KEY "your-key" --prod
npx convex env set EMAIL_FROM "noreply@scry.study" --prod
npx convex env set NEXT_PUBLIC_APP_URL "https://www.scry.study" --prod

# Set Vercel variables (for frontend/build)
vercel env add NEXT_PUBLIC_CONVEX_URL production
vercel env add CONVEX_DEPLOY_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add CLERK_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
```

**Local Development:**

Create `.env.local` with these required variables:

```bash
# Convex Backend URL (dev: amicable-lobster, prod: uncommon-axolotl)
NEXT_PUBLIC_CONVEX_URL="https://amicable-lobster-935.convex.cloud"

# Application URL for magic links (port 3002 since 3000 is taken)
NEXT_PUBLIC_APP_URL="http://localhost:3002"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# AI API key for quiz generation (ALSO set in Convex!)
GOOGLE_AI_API_KEY="AIzaSy..."

# Email service configuration (ALSO set in Convex!)
RESEND_API_KEY="re_..."
EMAIL_FROM="Scry <noreply@scry.study>"

# Convex deployment (automatically set by `npx convex dev`)
CONVEX_DEPLOYMENT=dev:amicable-lobster-935
```

**Note:** In development, Convex reads from `.env.local` via `npx convex dev`. In production, Convex reads from its own dashboard environment variables.

## Architecture Overview

The application follows Next.js 15 App Router structure with Convex backend:

- **app/**: Next.js 15 App Router pages and layouts
- **components/**: React components split between business logic and UI primitives (shadcn/ui)
- **convex/**: Backend functions and schema definitions (modular architecture)
  - **schema.ts**: Database schema with users, sessions, questions, interactions, quizResults, generationJobs
  - **auth.ts**: Magic link authentication mutations
  - **scheduling.ts**: Scheduling abstraction (IScheduler interface + FSRS implementation)
  - **questionsCrud.ts**: Question CRUD operations (create, update, soft delete, restore)
  - **questionsBulk.ts**: Bulk operations (archive, unarchive, delete, restore, permanent delete)
  - **questionsInteractions.ts**: Answer recording with automatic FSRS scheduling
  - **questionsLibrary.ts**: Library queries (browse, filter, stats)
  - **questionsRelated.ts**: AI-powered related question generation
  - **spacedRepetition.ts**: Spaced repetition system (queue, reviews, Pure FSRS)
  - **generationJobs.ts**: Background job CRUD and lifecycle management
  - **aiGeneration.ts**: AI generation processing with streaming
  - **cron.ts**: Scheduled tasks (cleanup, maintenance)
  - **lib/validation.ts**: Shared validation helpers (atomic bulk operations)
- **lib/ai-client.ts**: AI integration using Vercel AI SDK with Google provider
- **lib/constants/**: Configuration constants (jobs, timing, UI)
- **types/**: TypeScript types for quiz data structures

Key architectural decisions:
- Convex for all backend needs (database, auth, real-time, background jobs)
- Magic link authentication instead of OAuth
- **Background job system** for non-blocking AI generation
- React Hook Form with Zod for type-safe form validation
- Radix UI primitives wrapped with custom styling
- Tailwind CSS v4 for styling with CSS variables
- **Individual question persistence**: Each generated question is saved immediately (not bundled in sessions)
- **Granular interaction tracking**: Every answer attempt is recorded with timing and accuracy data
- **Streaming generation**: Questions saved incrementally as they're generated

## Key Development Patterns

This project follows the Leyline development philosophy:

1. **Simplicity Above All**: Avoid over-engineering. Choose the simplest solution that solves the problem completely.
2. **Explicit Over Implicit**: Make behavior obvious. No magic or hidden functionality.
3. **Automation**: Treat repetitive manual tasks as bugs. Automate everything feasible.
4. **Type Safety**: Strict TypeScript with no `any` types. Use Zod for runtime validation.

When implementing features:
- Prefer server-side processing for AI operations
- Use proper error boundaries and loading states
- Follow existing component patterns in the codebase
- Maintain consistency with the minimal, clean UI design

## Backend-First Development Workflow

When implementing features that require new backend mutations or queries, follow this strict order to prevent frontend-backend contract mismatches:

### Checklist for Backend-Requiring Features

1. **Backend First**: Implement mutation/query in `convex/`
   - Define args schema with `v.object({ ... })`
   - Implement handler with proper auth and validation
   - Follow atomic validation pattern for bulk operations
   - Add JSDoc comments explaining purpose and edge cases

2. **Generate Types**: Ensure types are current
   - Verify `npx convex dev` is running and sees your changes
   - Wait for "Convex functions ready!" message in terminal
   - Confirm `convex/_generated/api.d.ts` contains new function

3. **Frontend Second**: Use mutation/query in components
   - Import from generated API: `import { api } from '@/convex/_generated/api'`
   - Use with Convex hooks: `useMutation(api.module.function)`
   - TypeScript autocomplete should show your new function

4. **Type Check**: Verify before committing
   - Run `pnpm build` or `pnpm exec tsc --noEmit`
   - Fix any type errors before staging changes
   - Pre-commit hook will enforce this automatically

5. **Test Integration**: Manual end-to-end test
   - Test happy path in development environment
   - Test error cases (auth failures, invalid data)
   - Verify loading states and error messages

### Anti-Pattern: Frontend-First (Causes Runtime Errors)

❌ **Don't do this:**
```typescript
// Writing frontend code first, assuming backend exists
const restore = useMutation(api.questions.restoreQuestions); // DOESN'T EXIST YET!
```

This compiles but fails at runtime with "Could not find public function" error.

✅ **Do this instead:**
1. Implement `restoreQuestions` in `convex/questions.ts`
2. Wait for type generation
3. Then use in frontend

### Mutation Pairs Require Both Implementations

When implementing undo patterns:
- ✅ Implement both action and undo mutations BEFORE writing frontend code
- ✅ Test both directions work (archive → unarchive, delete → restore)
- ✅ Add contract tests to prevent future regressions

## Confirmation Patterns

### Destructive Actions

Use `useConfirmation()` hook for irreversible actions:

```typescript
import { useConfirmation } from '@/hooks/use-confirmation';

const confirm = useConfirmation();
const confirmed = await confirm({
  title: 'Permanent action?',
  description: 'This cannot be undone.',
  variant: 'destructive',
  requireTyping: 'DELETE', // For truly irreversible actions
});
if (confirmed) {
  await destructiveAction();
}
```

### Reversible Actions

Use `useUndoableAction()` hook for soft deletes and archives:

```typescript
import { useUndoableAction } from '@/hooks/use-undoable-action';

const undoableAction = useUndoableAction();
await undoableAction({
  action: () => archiveItem(id),
  message: 'Item archived',
  undo: () => unarchiveItem(id),
});
```

### When to Use Which

- **Permanent delete from trash** → `useConfirmation()` with `requireTyping`
- **Soft delete to trash** → `useUndoableAction()`
- **Archive/unarchive** → `useUndoableAction()`
- **Any truly irreversible action** → `useConfirmation()` with `variant: 'destructive'`

### Key Features

- **Queue management**: Multiple confirmations handled FIFO (no race conditions)
- **Focus restoration**: Focus returns to trigger element after dialog closes
- **Keyboard accessible**: Escape cancels, Tab cycles, Enter confirms
- **Mobile-friendly**: 44x44px touch targets, theme-consistent
- **Type-to-confirm**: Prevents accidental permanent deletion

## Core Principles: Hypersimplicity and Pure Memory Science

### The Hypersimple Truth

Scry implements **Pure FSRS** without comfort features or artificial limits. We respect memory science absolutely:

```typescript
// NEVER do this - comfort features corrupt the algorithm
if (dueToday > dailyLimit) postpone(excess)  // ❌ Wrong
if (consecutiveNew >= 3) injectReview()       // ❌ Wrong

// ALWAYS do this - pure algorithm
if (isDue) reviewNow()                        // ✅ Correct
return questions.sort(by: fsrsPriority)[0]    // ✅ Correct
```

### Non-Negotiable Rules

1. **No Daily Limits**: If 300 cards are due, show 300 cards. The forgetting curve doesn't care about comfort.
2. **No Artificial Interleaving**: Don't inject reviews to "break up" new questions. Trust FSRS.
3. **No Comfort Features**: Every attempt to make it "easier" makes it worse.
4. **Natural Feedback Loops**: If someone generates 50 questions, they face 50 new questions. This teaches sustainable habits.
5. **Brutal Honesty**: Show real counts, real progress, real learning debt.

### Why This Matters

- **Memory science is precise**: The Ebbinghaus forgetting curve has optimal timing. Any deviation reduces effectiveness.
- **Comfort features are lies**: They make users feel better while learning worse.
- **Natural consequences teach**: Overwhelming yourself with generations? You'll learn to generate sustainably.
- **Simplicity scales**: No complex logic means no bugs, no confusion, no maintenance burden.

### Implementation Checklist

Before implementing ANY queue/scheduling feature, ask:
- Does this respect raw FSRS calculations? If no, **don't do it**.
- Does this add comfort at the expense of learning? If yes, **don't do it**.
- Does this add complexity to "improve" the experience? If yes, **don't do it**.
- Is this the simplest possible solution? If no, **simplify it**.

## AI Integration

The quiz generation system:
- Uses Google Gemini 2.5 Flash model via Vercel AI SDK
- Generates structured quiz data with JSON schema validation
- Dynamically determines question count based on topic complexity
- **Questions persist individually** upon generation (not just quiz results)
- Each answer attempt is tracked with timing and accuracy

## Background Question Generation

Scry uses a **background job system** for non-blocking AI question generation. This provides real-time progress tracking and supports cancellation without blocking the UI.

### System Architecture

**Components:**
- `convex/generationJobs.ts` - Job CRUD operations and lifecycle management
- `convex/aiGeneration.ts` - AI generation processing with streaming
- `lib/constants/jobs.ts` - Configuration constants
- `components/background-tasks-badge.tsx` - Navbar indicator for active jobs
- `components/background-tasks-panel.tsx` - Side panel showing all jobs
- `components/generation-task-card.tsx` - Individual job status card

**Database Schema:**
The `generationJobs` table tracks each generation request:
```typescript
{
  userId: Id<"users">,
  prompt: string,
  status: "pending" | "processing" | "completed" | "failed" | "cancelled",
  phase: "clarifying" | "generating" | "finalizing",
  questionsGenerated: number,
  questionsSaved: number,
  estimatedTotal?: number,
  topic?: string,
  questionIds: Id<"questions">[],
  durationMs?: number,
  errorMessage?: string,
  errorCode?: string,
  retryable?: boolean,
  createdAt: number,
  startedAt?: number,
  completedAt?: number,
  ipAddress?: string
}
```

### Creating Jobs

**From UI Components:**
```typescript
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const createJob = useMutation(api.generationJobs.createJob);

// In your component
await createJob({ prompt: userInput });
```

**Entry Points:**
- `GenerationModal` - Main modal triggered by navbar "Generate" button
- `NoCardsEmptyState` - First-time user onboarding
- `NothingDueEmptyState` - When no reviews are due

### Monitoring Progress

**BackgroundTasksBadge** (in navbar):
- Shows count of active jobs (`pending` or `processing`)
- Badge appears automatically when jobs are active
- Click to open BackgroundTasksPanel

**BackgroundTasksPanel** (slide-out):
- Lists recent 20 jobs
- Shows real-time progress for processing jobs
- Displays completion status and error messages
- Allows cancellation of pending/processing jobs

**Real-Time Updates:**
Jobs use Convex's reactive queries - UI updates automatically as:
- Job status changes (pending → processing → completed)
- Questions are saved incrementally during generation
- Progress percentages update in real-time

### Job Lifecycle

1. **Creation**: User submits prompt → `createJob` mutation validates and schedules job
2. **Clarification**: AI clarifies intent and estimates question count
3. **Generation**: Streams questions incrementally, saving as they arrive
4. **Completion**: Job marked as completed with topic and question IDs

**Cancellation:**
- User can cancel `pending` or `processing` jobs
- Partial results are preserved (questions already saved remain)
- Job status updated to `cancelled` with partial questionIds

**Error Handling:**
Jobs classify errors for appropriate retry behavior:
- `RATE_LIMIT` (retryable: true) - Hit AI API rate limits
- `API_KEY` (retryable: false) - Invalid/missing API key
- `NETWORK` (retryable: true) - Temporary network issues
- `UNKNOWN` (retryable: false) - Unclassified errors

### Configuration & Limits

**File:** `lib/constants/jobs.ts`

```typescript
export const JOB_CONFIG = {
  MAX_CONCURRENT_PER_USER: 3,      // Prevent resource exhaustion
  MAX_PROMPT_LENGTH: 5000,         // Character limit for prompts
  MIN_PROMPT_LENGTH: 3,            // Minimum viable prompt
  COMPLETED_JOB_RETENTION_DAYS: 7, // Auto-delete after 7 days
  FAILED_JOB_RETENTION_DAYS: 30,   // Keep longer for debugging
};
```

**Rate Limiting:**
Generation jobs respect global rate limiting (configured in `convex/rateLimit.ts`) to prevent API abuse.

### Cleanup & Maintenance

**Automated Cleanup:**
A daily cron job (`convex/cron.ts`) runs at 3 AM UTC to delete old jobs:
- Completed jobs: removed after 7 days
- Failed jobs: removed after 30 days

**Manual Cleanup:**
The `cleanup` internal mutation can be triggered manually if needed:
```bash
# From Convex dashboard Functions tab
internal.generationJobs.cleanup()
```

### Backend API Reference

**Public Mutations (require authentication):**
- `createJob({ prompt })` - Create new generation job
- `cancelJob({ jobId })` - Cancel pending/processing job

**Public Queries:**
- `getRecentJobs({ limit? })` - Get user's recent jobs (default 20)
- `getJobById({ jobId })` - Get specific job with ownership check

**Internal Mutations (called by actions/crons):**
- `updateProgress({ jobId, phase?, questionsGenerated?, ... })` - Update job progress
- `completeJob({ jobId, topic, questionIds, durationMs })` - Mark job complete
- `failJob({ jobId, errorMessage, errorCode, retryable })` - Mark job failed
- `cleanup()` - Delete old completed/failed jobs

**Internal Actions:**
- `aiGeneration.processJob({ jobId })` - Main generation orchestrator

### Best Practices

1. **Never block the UI**: Jobs run in background, modal/forms close immediately
2. **Show immediate feedback**: Toast notification confirms job creation
3. **Guide to monitoring**: Direct users to Background Tasks panel
4. **Preserve partial work**: Cancellation saves already-generated questions
5. **Respect rate limits**: Enforce concurrent job limits per user
6. **Clean up regularly**: Automated cron prevents database bloat

## Convex Mutations: Reversible Operations

### Mutation Pairs (Action ↔ Undo)

The application implements reversible operations using mutation pairs. Every action mutation MUST have a corresponding undo mutation implemented in the backend.

| Action | Mutation | Effect | Undo | Mutation | Effect |
|--------|----------|--------|------|----------|--------|
| Archive | `archiveQuestions` | Sets `archivedAt: now` | Unarchive | `unarchiveQuestions` | Clears `archivedAt` |
| Soft Delete | `bulkDelete` | Sets `deletedAt: now` | Restore | `restoreQuestions` | Clears `deletedAt` |
| Hard Delete | `permanentlyDelete` | Removes from DB | ❌ None | - | **Irreversible** |

### Critical Rule: Mutation Symmetry

**Before implementing undo UI pattern:**
1. ✅ Verify BOTH mutations exist in `convex/questionsBulk.ts`
2. ✅ Test both forward and reverse operations manually
3. ✅ Add contract tests in `tests/api-contract.test.ts`

**Common failure mode:** Implementing frontend undo assuming backend mutation exists, discovering at runtime the mutation is missing. Pre-commit hooks and contract tests prevent this.

### Mutation Implementation Pattern

**File:** `convex/questionsBulk.ts`

Standard pattern for all bulk mutations (using shared validation helper):

```typescript
export const operationName = mutation({
  args: { questionIds: v.array(v.id('questions')) },
  handler: async (ctx, args) => {
    // 1. Auth
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // 2. Atomic validation via shared helper
    await validateBulkOwnership(ctx, userId, args.questionIds);

    // 3. Execute mutations in parallel
    await Promise.all(
      args.questionIds.map((id) => ctx.db.patch(id, { /* changes */ }))
    );

    return { count: args.questionIds.length };
  },
});
```

**Why atomic validation?** Prevents partial failures - either ALL operations succeed or ALL fail. No orphaned state. The `validateBulkOwnership()` helper (in `convex/lib/validation.ts`) eliminates ~140 lines of duplication across bulk operations.

## Testing

**Important**: No testing framework is currently configured. When adding tests:
- Consider setting up Vitest for unit tests
- Use Playwright for E2E tests (MCP server already configured)
- Follow testability principles from Leyline philosophy

## Database & Authentication

The project uses Convex for all backend needs:

### Database Schema (convex/schema.ts)
- **users**: User accounts with email, name, avatar
- **sessions**: Authentication sessions with tokens
- **magicLinks**: Temporary magic link tokens for auth
- **questions**: Individual quiz questions with denormalized stats (attemptCount, correctCount)
- **interactions**: User answer attempts with timing and accuracy tracking
- **quizResults**: Completed quiz sessions with detailed answers and scores

### Authentication Flow
1. User enters email
2. Magic link sent via Resend
3. User clicks link to verify
4. Session created for 30 days
5. Session token stored in localStorage

### Data Access
- All data access through Convex mutations/queries
- Real-time subscriptions available
- Type-safe from database to UI

## Real-Time Updates with Convex

**Important Discovery**: Convex provides automatic real-time updates via WebSockets out of the box!

### How Convex Reactivity Works
- **Automatic Updates**: When data changes in the database, all subscribed queries automatically re-run
- **No Polling Needed**: New questions appear instantly when inserted (< 100ms typically)
- **WebSocket-Based**: Convex uses WebSockets under the hood for push-based updates
- **Dependency Tracking**: Convex tracks what data each query reads and updates when it changes

### Our Implementation
- **Removed**: Custom event system (`questions-generated` events) - not needed!
- **Removed**: Aggressive 1-second polling after generation - Convex handles this!
- **Kept**: Minimal 60-second polling for time-based conditions only
  - Questions becoming "due" as time passes requires periodic checks
  - The condition `.lte("nextReview", now.getTime())` depends on current time
  - Future optimization: Use Convex scheduled functions to eliminate this too

### Key Insight
We were treating Convex like a traditional database that needs polling, when it's actually a **reactive database** that pushes updates automatically. This means:
- New questions appear instantly after generation
- No manual refresh needed
- No custom events needed
- Significantly reduced server load

## Spaced Repetition System

Scry implements **Pure FSRS** (Free Spaced Repetition Scheduler) without modifications or comfort features:

### Automatic Rating Approach

The system automatically determines review ratings based on answer correctness, eliminating the need for manual user input:

**Rating Mapping:**
- **Correct Answer** → `Rating.Good` (3) - Indicates successful recall with normal difficulty
- **Incorrect Answer** → `Rating.Again` (1) - Indicates failed recall, needs immediate review

**Benefits of Automatic Rating:**
1. **Simplified UX**: Users focus on answering questions, not rating their confidence
2. **Consistent Scheduling**: Removes subjective bias from the spaced repetition algorithm
3. **Faster Reviews**: No additional interaction required after answering
4. **Mobile-Friendly**: Single-tap answers work perfectly on touch devices

**Future Enhancements:**
- Time-based rating: Fast correct answers could map to `Rating.Easy` (4)
- Difficulty adjustment: Consistently easy/hard questions could adjust the FSRS difficulty parameter
- Partial credit: Multiple-choice questions could use `Rating.Hard` (2) for close answers

### FSRS Integration

**Key Components:**
- **convex/fsrs.ts**: Core FSRS utilities and rating calculation (low-level implementation)
- **convex/scheduling.ts**: IScheduler interface + FsrsScheduler implementation (dependency injection)
- **convex/spacedRepetition.ts**: Mutations and queries for review scheduling
- **convex/questionsInteractions.ts**: Answer recording with automatic FSRS scheduling

**Scheduling Flow:**
1. User answers a question (correct/incorrect)
2. `recordInteraction` mutation is called with `isCorrect` flag
3. `calculateRatingFromCorrectness` maps boolean to FSRS rating
4. FSRS algorithm calculates next review time based on:
   - Current card state (new/learning/review/relearning)
   - Answer correctness (via automatic rating)
   - Previous review history
   - Stability and difficulty parameters
5. Next review time is stored and displayed to user

**Review Queue Prioritization:**
- New questions: `retrievability = -1` (highest priority)
- Due questions: `retrievability = 0 to 1` (lower = higher priority)
- Future questions: Excluded from queue until due

### Real-Time Updates

The review queue uses a polling mechanism to handle time-based updates:
- **usePollingQuery** hook adds timestamp parameter to force re-evaluation
- Review page polls every 30 seconds for responsive updates
- Dashboard indicator polls every 60 seconds
- Questions automatically appear when they become due

### Backend API Reference

#### Mutations

**`spacedRepetition.scheduleReview`**
```typescript
// Primary mutation for recording interactions with automatic FSRS scheduling
scheduleReview({
  sessionToken: string,
  questionId: Id<"questions">,
  userAnswer: string,
  isCorrect: boolean,
  timeSpent?: number,
  sessionId?: string,
}) => {
  success: boolean,
  nextReview: Date | null,
  scheduledDays: number,
  newState: "new" | "learning" | "review" | "relearning"
}
```

**`questions.recordInteraction`** (Enhanced for FSRS)
```typescript
// Records interaction and triggers FSRS scheduling if user is authenticated
recordInteraction({
  questionId: Id<"questions">,
  userAnswer: string,
  isCorrect: boolean,
  attemptedAt?: number,
  timeSpent?: number,
  sessionToken?: string,
  sessionId?: string,
}) => {
  interactionId: Id<"interactions">,
  nextReview?: Date,
  scheduledDays?: number,
  newState?: string
}
```

#### Queries

**`spacedRepetition.getNextReview`**
```typescript
// Returns the highest priority question for review based on FSRS retrievability
getNextReview({
  sessionToken: string,
  _refreshTimestamp?: number, // For polling updates
}) => {
  question: Doc<"questions">,
  interactions: Doc<"interactions">[],
  attemptCount: number,
  correctCount: number,
  successRate: number | null
} | null
```

**`spacedRepetition.getDueCount`**
```typescript
// Returns count of questions ready for review
getDueCount({
  sessionToken: string,
  _refreshTimestamp?: number, // For polling updates
}) => {
  dueCount: number,     // Questions past their review time
  newCount: number,     // Questions never reviewed
  totalReviewable: number
}
```

### Frontend Component Patterns

#### Unified Quiz/Review Flow

The `UnifiedQuizFlow` component demonstrates the pattern for dual-mode quiz/review interfaces:

```typescript
// Usage example
<UnifiedQuizFlow 
  mode="review"              // "quiz" | "review"
  topic="JavaScript"         // For quiz mode
  difficulty="medium"        // For quiz mode
/>
```

Key patterns:
- Single component handles both quiz generation and spaced repetition reviews
- Mode switching determines data source (AI generation vs getNextReview query)
- Review mode displays `QuestionHistory` component for each question
- Automatic empty state handling when no reviews available

#### Polling for Time-Based Updates

The `usePollingQuery` hook pattern enables real-time updates for time-sensitive queries:

```typescript
// Usage in components
const nextReview = usePollingQuery(
  api.spacedRepetition.getNextReview,
  sessionToken ? { sessionToken } : "skip",
  30000 // Poll every 30 seconds
);

const dueCount = usePollingQuery(
  api.spacedRepetition.getDueCount,
  sessionToken ? { sessionToken } : "skip",
  60000 // Poll every minute
);
```

Pattern implementation:
- Adds `_refreshTimestamp` parameter to force query re-evaluation
- Configurable polling intervals based on use case
- Automatic cleanup on unmount
- TypeScript-safe with proper type inference

#### Review Indicator Pattern

The `ReviewIndicator` component shows due count with real-time updates:

```typescript
// Dashboard integration
<ReviewIndicator className="mb-4" />

// Pattern features:
// - Shows due count badge
// - Quick start button for immediate review
// - Loading and error states
// - Auto-updates via polling
```

#### Question History Display

The `QuestionHistory` component pattern for showing previous attempts:

```typescript
<QuestionHistory 
  interactions={interactions}  // Array of user interactions
  className="mt-4"
/>

// Features:
// - Expandable/collapsible for many attempts
// - Success rate calculation
// - Time spent per attempt
// - Visual indicators for correct/incorrect
```

### Integration Patterns

#### Answer Submission with Automatic Scheduling

```typescript
// In quiz session manager or similar component
const { trackAnswer } = useQuizInteractions();

const result = await trackAnswer({
  questionId,
  userAnswer,
  isCorrect,
  timeSpent
});

// Display next review time
if (result?.nextReview) {
  showReviewScheduled(result.nextReview, result.scheduledDays);
}
```

#### Empty State Handling

```typescript
// Pattern for review queue empty states
if (!nextReview && flowState === "empty") {
  return <AllReviewsCompleteEmptyState />;
}

// Available empty state components:
// - NoQuestionsEmptyState
// - AllReviewsCompleteEmptyState
// - ReviewsCompleteWithCount
// - CustomEmptyState
```

### Database Schema Extensions

Questions table includes FSRS fields:
```typescript
questions: {
  // ... existing fields ...
  
  // FSRS scheduling fields
  nextReview?: number,        // Timestamp of next review
  stability?: number,         // Memory stability parameter
  fsrsDifficulty?: number,    // Card difficulty (0-10)
  elapsedDays?: number,       // Days since last review
  scheduledDays?: number,     // Days until next review
  reps?: number,              // Total review count
  lapses?: number,            // Failed review count
  state?: "new" | "learning" | "review" | "relearning",
  lastReview?: number,        // Timestamp of last review
}

// Index for efficient review queries
.index("by_user_next_review", ["userId", "nextReview"])
```