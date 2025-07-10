# Convex TypeScript Configuration

## Overview

This project is configured for full type safety with Convex, providing:
- Auto-generated types from schema
- Type-safe queries and mutations
- Proper IDE autocomplete
- Compile-time type checking

## Type Imports

### Basic Usage

```typescript
// Import from centralized types file
import { User, Session, QuizResult, UserId } from '@/convex/types'

// Import Convex utilities
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
```

### Document Types

```typescript
// Use Doc<T> for generic document types
import { Doc, Id } from '@/convex/_generated/dataModel'

// Example usage
const user: Doc<'users'> = await ctx.db.get(userId)
const quizId: Id<'quizResults'> = quiz._id
```

## Type Safety Features

### Queries with Full Types

```typescript
// In components
const user = useQuery(api.auth.getCurrentUser)
// user is typed as User | null | undefined

const quizHistory = useQuery(api.quiz.getQuizHistory, { limit: 10 })
// quizHistory is typed as QuizResult[] | undefined
```

### Mutations with Type Checking

```typescript
const sendMagicLink = useMutation(api.auth.sendMagicLink)

// TypeScript will error if wrong arguments
await sendMagicLink({ 
  email: 'user@example.com' // ✅ Correct
  // emailAddress: '...' // ❌ Would error
})
```

### Schema-Driven Types

All types are automatically derived from `convex/schema.ts`:

```typescript
// Changes to schema automatically update types
defineTable({
  email: v.string(),
  name: v.optional(v.string()),
  // Adding a field here updates User type everywhere
})
```

## Best Practices

1. **Always import from type files**
   ```typescript
   // Good
   import { User } from '@/convex/types'
   
   // Avoid
   import { Doc } from '@/convex/_generated/dataModel'
   const user: Doc<'users'> = ...
   ```

2. **Use specific ID types**
   ```typescript
   // Good
   function getUser(userId: UserId) { ... }
   
   // Less clear
   function getUser(userId: Id<'users'>) { ... }
   ```

3. **Let TypeScript infer when possible**
   ```typescript
   // Let useQuery infer the return type
   const user = useQuery(api.auth.getCurrentUser)
   
   // No need to explicitly type
   const user: User | null | undefined = useQuery(...)
   ```

## Troubleshooting

### Types not updating?
1. Restart Convex dev server: `pnpm dev:convex`
2. Restart TypeScript server in VS Code: `Cmd+Shift+P` → "Restart TS Server"
3. Check for errors in `convex/schema.ts`

### Import errors?
1. Ensure paths are correct in `tsconfig.json`
2. Check that `_generated` folder exists
3. Run `pnpm convex:init` if needed

### Type conflicts?
1. Check for duplicate type definitions
2. Ensure using consistent imports
3. Verify schema matches expected types