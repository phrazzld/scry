### Convex DB Migration [Timeline: 1 week]

**Context**: Pre-release app with no users. Full rip-and-replace migration.

- [ ] **Phase 1: Setup Convex** [Day 1]
  * Delete all PostgreSQL/Prisma code
  * `pnpm remove prisma @prisma/client`
  * `pnpm add convex`
  * Initialize Convex project
  * Delete `prisma/` directory

- [ ] **Phase 2: Schema Definition** [Day 2]
  * Create `convex/schema.ts` with all models
  * Define indexes for queries
  * No data migration needed - fresh start

- [ ] **Phase 3: Auth Implementation** [Day 3-4]
  * Rip out NextAuth + PrismaAdapter
  * Implement Convex Auth with magic links
  * Much simpler than NextAuth adapter

- [ ] **Phase 4: Rewrite APIs** [Day 5-6]
  * Replace all Prisma queries with Convex functions
  * Delete all database connection code
  * Remove Vercel KV - use Convex for everything

- [ ] **Phase 5: Cleanup** [Day 7]
  * Delete all database config
  * Remove DATABASE_URL, KV_URL from env
  * Update docs and deployment scripts
  * Celebrate massive simplification


---

# Enhanced Specification

## Executive Summary

Complete replacement of PostgreSQL/Prisma with Convex DB. No migration needed - this is a pre-release app with zero users. We can delete all existing database code and start fresh with Convex.

## Current State Analysis

**What We Have:**
- Complex PostgreSQL + Prisma setup
- NextAuth with PrismaAdapter
- Vercel KV for caching
- Overly complex for a quiz app

**What We'll Have:**
- Single Convex dependency
- Built-in auth, storage, real-time
- 70% less configuration
- Instant real-time features

## Implementation Plan

### Day 1: Rip Out Old Stack

**Morning:**
```bash
# Remove all database dependencies
pnpm remove prisma @prisma/client @vercel/kv
pnpm remove @next-auth/prisma-adapter

# Delete database files
rm -rf prisma/
rm -rf app/api/auth/[...nextauth]/
```

**Afternoon:**
```bash
# Install Convex
pnpm add convex
npx convex init

# Set up project structure
mkdir convex
touch convex/schema.ts
touch convex/_generated.ts
```

### Day 2: Define Schema

**Convex Schema (`convex/schema.ts`):**
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    image: v.optional(v.string()),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    expiresAt: v.number(),
    token: v.string(),
  }).index("by_token", ["token"])
    .index("by_user", ["userId"]),

  quizResults: defineTable({
    userId: v.id("users"),
    topic: v.string(),
    difficulty: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    answers: v.array(v.object({
      questionId: v.string(),
      question: v.string(),
      userAnswer: v.string(),
      correctAnswer: v.string(),
      isCorrect: v.boolean(),
      options: v.array(v.string()),
    })),
    completedAt: v.number(),
  }).index("by_user", ["userId", "completedAt"]),
});
```

### Day 3-4: Authentication

**Simple Magic Link Implementation:**
```typescript
// convex/auth.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const sendMagicLink = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const token = crypto.randomUUID();
    await ctx.db.insert("magicLinks", {
      email,
      token,
      expiresAt: Date.now() + 3600000, // 1 hour
    });
    
    // Send email with token
    await sendEmail(email, token);
  },
});

export const verifyMagicLink = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db
      .query("magicLinks")
      .withIndex("by_token", q => q.eq("token", token))
      .first();
    
    if (!link || link.expiresAt < Date.now()) {
      throw new Error("Invalid or expired link");
    }
    
    // Create or update user
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", link.email))
      .first();
    
    const userId = user?._id || await ctx.db.insert("users", {
      email: link.email,
      emailVerified: Date.now(),
    });
    
    // Create session
    const sessionToken = crypto.randomUUID();
    await ctx.db.insert("sessions", {
      userId,
      token: sessionToken,
      expiresAt: Date.now() + 30 * 24 * 3600000, // 30 days
    });
    
    return { sessionToken, userId };
  },
});
```

### Day 5-6: API Rewrite

**Before (Prisma):**
```typescript
// app/api/quiz/complete/route.ts
const result = await prisma.quizResult.create({
  data: {
    userId: session.user.id,
    topic,
    score,
    // ... complex nested creates
  },
});
```

**After (Convex):**
```typescript
// convex/quiz.ts
export const completeQuiz = mutation({
  args: {
    topic: v.string(),
    score: v.number(),
    answers: v.array(v.object({...})),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    return await ctx.db.insert("quizResults", {
      userId,
      ...args,
      completedAt: Date.now(),
    });
  },
});

// app/api/quiz/complete/route.ts
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
await client.mutation(api.quiz.completeQuiz, { topic, score, answers });
```

### Day 7: Cleanup & Benefits

**Delete:**
- All Prisma configuration
- Database connection management
- Vercel KV setup
- Complex auth adapters
- Migration files

**Gain:**
- Real-time subscriptions everywhere
- Built-in optimistic updates
- Automatic TypeScript types
- Zero configuration deployment
- Built-in file storage

## Key Architectural Decisions

### Why This Approach Works

1. **No Users = No Migration**
   - Start fresh with clean schema
   - No data compatibility concerns
   - No downtime considerations

2. **Convex Advantages for Greenfield**
   - Faster development iteration
   - Built-in everything we need
   - Real-time as a first-class feature
   - Simpler deployment

3. **Simplified Stack**
   - One dependency vs many
   - No ORM complexity
   - No separate auth service
   - No cache layer needed

### What We're NOT Doing

- ❌ Dual database systems
- ❌ Data migration scripts
- ❌ Backwards compatibility
- ❌ Complex rollback plans
- ❌ Blue/green deployments

### What We ARE Doing

- ✅ Clean slate implementation
- ✅ Modern, simple architecture
- ✅ Real-time first design
- ✅ Minimal dependencies
- ✅ Fast iteration

## Success Metrics

**Week 1 Goals:**
- [ ] All database code replaced
- [ ] Authentication working
- [ ] Quiz features ported
- [ ] Real-time updates live
- [ ] 50% less code overall

**Developer Experience Wins:**
- No database migrations
- No connection pooling
- No cache invalidation
- Type-safe from DB to UI
- One command deployment

## Next Steps After Migration

**Immediate Benefits to Leverage:**
1. Add real-time quiz competitions
2. Live activity feed
3. Instant notifications
4. Collaborative features

**Future Simplifications:**
1. Remove all API routes (use Convex functions directly)
2. Implement optimistic UI updates
3. Add offline support with sync
4. Use Convex file storage for avatars

## Summary

This is a complete rip-and-replace migration. No backwards compatibility needed. Delete PostgreSQL/Prisma code, implement Convex, ship faster. The entire migration should take 1 week with a single developer.