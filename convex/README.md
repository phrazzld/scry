# Convex Backend

This directory contains all Convex backend functions and schema definitions.

## Structure

- `schema.ts` - Database schema definitions
- `auth.ts` - Authentication mutations and queries
- `quiz.ts` - Quiz-related mutations and queries
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

## Troubleshooting

- **Connection Issues**: Check `NEXT_PUBLIC_CONVEX_URL` is correct
- **Type Errors**: Restart Convex dev server to regenerate types
- **Hot Reload Issues**: Ensure both dev servers are running