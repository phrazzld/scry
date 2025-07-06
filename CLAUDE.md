# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scry is an AI-powered quiz generation and learning application built with Next.js 15. It uses Google Gemini for content generation and implements spaced repetition algorithms for optimized learning.

## Development Commands

```bash
# Install dependencies (MUST use pnpm)
pnpm install

# Run development server with Turbopack
pnpm dev

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

## Environment Setup

Create `.env.local` with these required variables:

```bash
# AI API key - NOTE: Code uses GOOGLE_AI_API_KEY despite .env.example showing OPENROUTER_API_KEY
GOOGLE_AI_API_KEY=your-google-ai-api-key

# Database connections
DATABASE_URL=postgresql://user:password@host:port/database
KV_URL=your-vercel-kv-url
```

## Architecture Overview

The application follows Next.js 15 App Router structure:

- **app/api/generate-quiz/**: API endpoint for AI quiz generation using Google Gemini 2.5 Flash
- **app/create/**: Quiz creation interface with topic selection and difficulty settings
- **components/**: React components split between business logic and UI primitives (shadcn/ui)
- **lib/ai-client.ts**: AI integration using Vercel AI SDK with Google provider
- **types/**: TypeScript types for quiz data structures

Key architectural decisions:
- Server-side API routes for AI interactions
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

## Database Schema

The project uses:
- PostgreSQL for primary data storage
- Vercel KV (Redis-compatible) for caching/sessions
- ts-fsrs library for spaced repetition algorithms

Note: Database migrations and schema are not yet implemented in the codebase.