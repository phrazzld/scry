# Convex Backend

This directory contains all Convex backend functions and schema definitions.

## Structure

- `schema.ts` - Database schema definitions
- `auth.ts` - Authentication mutations and queries
- `emailActions.ts` - Email sending action (uses Resend API)
- `quiz.ts` - Quiz-related mutations and queries
- `debug.ts` - Debug utilities (dev only)
- `_generated/` - Auto-generated types (created by Convex CLI)

## Development Setup

### Quick Start

```bash
# Install dependencies
pnpm install

# Start both Next.js and Convex dev servers
pnpm dev

# Or run them separately:
pnpm dev:next    # Next.js dev server only
pnpm dev:convex  # Convex dev server only
```

### Environment Configuration

Ensure your `.env.local` file contains:
```
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### Available Scripts

- `pnpm dev` - Start both servers concurrently (recommended)
- `pnpm convex:deploy` - Deploy to production
- `pnpm convex:init` - Initialize Convex connection

## Features

- **Hot Reloading**: Changes to functions auto-reload without restart
- **Type Generation**: TypeScript types auto-generated from schema
- **Real-time Subscriptions**: All queries support live updates
- **Type Safety**: Full type safety from database to UI

## Using Convex in Components

```typescript
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

// Query data (reactive)
const user = useQuery(api.auth.getCurrentUser)

// Call mutations
const sendMagicLink = useMutation(api.auth.sendMagicLink)
await sendMagicLink({ email: 'user@example.com' })
```

## Actions vs Mutations

### Important: External API Calls
Convex mutations cannot make external HTTP calls. Use actions instead:

```typescript
// ❌ Wrong - mutation making external call
export const sendEmail = mutation({
  handler: async (ctx, args) => {
    // This will fail!
    await fetch('https://api.resend.com/...')
  }
})

// ✅ Correct - use action for external calls
export const sendEmail = internalAction({
  handler: async (ctx, args) => {
    // This works!
    await fetch('https://api.resend.com/...')
  }
})

// ✅ Schedule action from mutation
export const triggerEmail = mutation({
  handler: async (ctx, args) => {
    // Schedule the action to run
    await ctx.scheduler.runAfter(0, internal.emails.sendEmail, args)
  }
})
```

### Key Rules:
1. Use `internalAction` for actions only called from backend
2. Schedule actions using `internal.module.function` not `api.module.function`
3. Actions are not automatically retried - add your own retry logic if needed

## Troubleshooting

- **Connection Issues**: Check `NEXT_PUBLIC_CONVEX_URL` is correct
- **Type Errors**: Restart Convex dev server to regenerate types
- **Hot Reload Issues**: Ensure both dev servers are running
- **Action Not Executing**: Check logs for scheduling errors, ensure using `internal` reference
- **Deployment Issues**: Use `npx convex dev` to ensure deploying to correct instance