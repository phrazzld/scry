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

Create `.env.local` with these required variables:

```bash
# Google AI API key for quiz generation
GOOGLE_AI_API_KEY=your-google-ai-api-key

# Convex deployment URL (from Convex dashboard)
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Email configuration (for magic links)
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@yourdomain.com

# Optional: Application URL for magic links
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Architecture Overview

The application follows Next.js 15 App Router structure with Convex backend:

- **app/api/generate-quiz/**: API endpoint for AI quiz generation using Google Gemini
- **app/api/quiz/complete/**: API endpoint for saving quiz results to Convex
- **app/create/**: Quiz creation interface with topic selection and difficulty settings
- **components/**: React components split between business logic and UI primitives (shadcn/ui)
- **convex/**: Backend functions and schema definitions
  - **schema.ts**: Database schema with users, sessions, questions, interactions, quizResults tables
  - **auth.ts**: Magic link authentication mutations
  - **quiz.ts**: Quiz completion and history queries
  - **questions.ts**: Individual question persistence and interaction tracking
- **lib/ai-client.ts**: AI integration using Vercel AI SDK with Google provider
- **types/**: TypeScript types for quiz data structures

Key architectural decisions:
- Convex for all backend needs (database, auth, real-time)
- Magic link authentication instead of OAuth
- Server-side API routes only for AI generation
- React Hook Form with Zod for type-safe form validation
- Radix UI primitives wrapped with custom styling
- Tailwind CSS v4 for styling with CSS variables
- **Individual question persistence**: Each generated question is saved immediately (not bundled in sessions)
- **Granular interaction tracking**: Every answer attempt is recorded with timing and accuracy data

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

## AI Integration

The quiz generation system:
- Uses Google Gemini 2.5 Flash model via Vercel AI SDK
- Generates structured quiz data with JSON schema validation
- Supports difficulty levels: easy, medium, hard
- Creates 5 questions per quiz with 4 answer options each
- **Questions persist individually** upon generation (not just quiz results)
- Each answer attempt is tracked with timing and accuracy

API endpoint pattern: `/api/generate-quiz` accepts POST with topic, difficulty, and optional sessionToken for authenticated saves.

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

## Spaced Repetition System

Scry implements a sophisticated spaced repetition system using the FSRS (Free Spaced Repetition Scheduler) algorithm:

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
- **convex/fsrs.ts**: Core FSRS utilities and rating calculation
- **convex/spacedRepetition.ts**: Mutations and queries for review scheduling
- **convex/questions.ts**: Integration with question recording

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