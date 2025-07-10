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
  - **schema.ts**: Database schema with users, sessions, quizResults tables
  - **auth.ts**: Magic link authentication mutations
  - **quiz.ts**: Quiz completion and history queries
- **lib/ai-client.ts**: AI integration using Vercel AI SDK with Google provider
- **types/**: TypeScript types for quiz data structures

Key architectural decisions:
- Convex for all backend needs (database, auth, real-time)
- Magic link authentication instead of OAuth
- Server-side API routes only for AI generation
- React Hook Form with Zod for type-safe form validation
- Radix UI primitives wrapped with custom styling
- Tailwind CSS v4 for styling with CSS variables

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

API endpoint pattern: `/api/generate-quiz` accepts POST with topic and difficulty.

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
- **quizResults**: Completed quiz data with detailed answers

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