# TODO

## ACTIVE WORK

### Test MVP Functionality
- [ ] **Test core functionality manually**
  - Actions: Sign in, create quiz, take quiz, view history, check settings
  - Context: Ensure MVP functionality preserved after simplification
  - Verification: All core user flows work correctly

## QUIZ ARCHITECTURE REDESIGN - Individual Question Tracking
### Priority: HIGH
### Goal: Transform quiz system from bundled 5-question sessions to individual question persistence with granular interaction tracking
### Rationale: Every generated question is valuable content that should persist immediately, and every user interaction should be tracked

## PHASE 1: Database Schema Evolution [30 minutes]

- [x] **Add questions table to Convex schema**
  - File: `convex/schema.ts`
  - Action: Add after line 29 (before quizResults table)
  - Code:
    ```typescript
    questions: defineTable({
      userId: v.id("users"),
      topic: v.string(),
      difficulty: v.string(),
      question: v.string(),
      type: v.union(v.literal('multiple-choice'), v.literal('true-false')),
      options: v.array(v.string()),
      correctAnswer: v.string(),
      explanation: v.optional(v.string()),
      generatedAt: v.number(),
      // Denormalized fields for query performance
      attemptCount: v.number(), // Default: 0
      correctCount: v.number(), // Default: 0
      lastAttemptedAt: v.optional(v.number()),
    }).index("by_user", ["userId", "generatedAt"])
      .index("by_user_topic", ["userId", "topic", "generatedAt"])
      .index("by_user_unattempted", ["userId", "attemptCount"]),
    ```
  - Context: Core table for storing all generated questions with denormalized stats
  - Verification: `npx convex codegen` succeeds
  - **Complexity**: SIMPLE
  - **Started**: 2025-07-14 18:00
  - **Execution Log**:
    - [18:00] Starting task: Add questions table to Convex schema
    - [18:00] Read convex/schema.ts to understand current structure
    - [18:00] Found insertion point after magicLinks table (line 29)
    - [18:01] Added questions table definition with all required fields and indexes
    - [18:01] Running npx convex codegen to verify schema
    - [18:01] Codegen completed successfully - no errors
    - [18:01] Task completed - questions table added to schema

- [x] **Add interactions table to Convex schema**
  - File: `convex/schema.ts`
  - Action: Add after questions table definition
  - Code:
    ```typescript
    interactions: defineTable({
      userId: v.id("users"),
      questionId: v.id("questions"),
      userAnswer: v.string(),
      isCorrect: v.boolean(),
      attemptedAt: v.number(),
      timeSpent: v.optional(v.number()), // milliseconds
      context: v.optional(v.object({
        sessionId: v.optional(v.string()), // for grouping quiz attempts
        isRetry: v.optional(v.boolean()),
      })),
    }).index("by_user", ["userId", "attemptedAt"])
      .index("by_question", ["questionId", "attemptedAt"])
      .index("by_user_question", ["userId", "questionId"]),
    ```
  - Context: Tracks every answer attempt for analytics and progress tracking
  - Dependencies: Must be added after questions table
  - Verification: `npx convex codegen` succeeds
  - **Complexity**: SIMPLE
  - **Started**: 2025-07-14 18:02
  - **Execution Log**:
    - [18:02] Starting task: Add interactions table to Convex schema
    - [18:02] Read convex/schema.ts to find insertion point
    - [18:02] Found questions table successfully added at lines 30-46
    - [18:02] Need to add interactions table after questions, before quizResults
    - [18:03] Added interactions table definition with all required fields and indexes
    - [18:03] Table includes userId, questionId, userAnswer, isCorrect, attemptedAt, timeSpent, and context fields
    - [18:03] Added 3 indexes: by_user, by_question, by_user_question for efficient querying
    - [18:03] Running npx convex codegen to verify schema
    - [18:03] Codegen completed successfully - no errors
    - [18:03] Task completed - interactions table added to schema

- [x] **Run Convex codegen to update types**
  - Command: `npx convex codegen`
  - Context: Generate TypeScript types for new tables
  - Dependencies: Both schema changes must be complete
  - Verification: Check `convex/_generated/dataModel.d.ts` includes new types
  - **Complexity**: SIMPLE
  - **Started**: 2025-07-14 19:23
  - **Execution Log**:
    - [19:23] Starting task: Run Convex codegen to update types
    - [19:23] Schema changes already complete (questions and interactions tables added)
    - [19:23] Running npx convex codegen command
    - [19:23] Command executed successfully, TypeScript typecheck running
    - [19:23] Verifying generated types in dataModel.d.ts
    - [19:24] Generated files updated: api.js, dataModel.d.ts, server.d.ts, server.js
    - [19:24] TypeScript compilation successful - no errors
    - [19:24] Task completed - types generated for questions and interactions tables

## PHASE 2: Backend Infrastructure [45 minutes]

- [x] **Create questions.ts mutations file**
  - File: `convex/questions.ts` (new file)
  - Action: Create with authentication helper import
  - Initial content:
    ```typescript
    import { v } from "convex/values";
    import { mutation, query } from "./_generated/server";
    import { getAuthenticatedUserId } from "./auth";
    ```
  - Context: Centralized location for all question-related backend logic
  - Verification: File created and imports resolve
  - **Complexity**: SIMPLE
  - **Started**: 2025-07-14 19:25
  - **Execution Log**:
    - [19:25] Starting task: Create questions.ts mutations file
    - [19:25] Creating new file convex/questions.ts with authentication imports
    - [19:25] File created successfully at convex/questions.ts
    - [19:25] Verifying imports resolve correctly
    - [19:26] Fixed import issue - added getAuthenticatedUserId helper function directly
    - [19:26] TypeScript compilation successful - file ready for mutations
    - [19:26] Task completed - questions.ts created with auth helper

- [x] **Implement saveGeneratedQuestions mutation**
  - File: `convex/questions.ts`
  - Action: Add mutation after imports
  - Code:
    ```typescript
    export const saveGeneratedQuestions = mutation({
      args: {
        sessionToken: v.string(),
        topic: v.string(),
        difficulty: v.string(),
        questions: v.array(v.object({
          question: v.string(),
          type: v.optional(v.union(v.literal('multiple-choice'), v.literal('true-false'))),
          options: v.array(v.string()),
          correctAnswer: v.string(),
          explanation: v.optional(v.string()),
        })),
      },
      handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
        
        const questionIds = await Promise.all(
          args.questions.map(q => 
            ctx.db.insert("questions", {
              userId,
              topic: args.topic,
              difficulty: args.difficulty,
              question: q.question,
              type: q.type || 'multiple-choice',
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              generatedAt: Date.now(),
              attemptCount: 0,
              correctCount: 0,
            })
          )
        );
        
        return { questionIds, count: questionIds.length };
      },
    });
    ```
  - Context: Batch saves all generated questions with user association
  - Verification: Deploy with `npx convex dev` and check function list
  - **Complexity**: SIMPLE
  - **Started**: 2025-07-14 19:27
  - **Execution Log**:
    - [19:27] Starting task: Implement saveGeneratedQuestions mutation
    - [19:27] Reading current questions.ts file to understand structure
    - [19:27] Added saveGeneratedQuestions mutation after getAuthenticatedUserId helper
    - [19:27] Mutation accepts sessionToken, topic, difficulty, and questions array
    - [19:27] Running npx convex codegen to verify TypeScript compilation
    - [19:28] TypeScript compilation successful - mutation ready for deployment
    - [19:28] Task completed - saveGeneratedQuestions mutation implemented

- [x] **Implement recordInteraction mutation**
  - File: `convex/questions.ts`
  - Action: Add after saveGeneratedQuestions
  - Code:
    ```typescript
    export const recordInteraction = mutation({
      args: {
        sessionToken: v.string(),
        questionId: v.id("questions"),
        userAnswer: v.string(),
        isCorrect: v.boolean(),
        timeSpent: v.optional(v.number()),
        sessionId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
        
        // Verify user owns this question
        const question = await ctx.db.get(args.questionId);
        if (!question || question.userId !== userId) {
          throw new Error("Question not found or unauthorized");
        }
        
        // Record interaction
        await ctx.db.insert("interactions", {
          userId,
          questionId: args.questionId,
          userAnswer: args.userAnswer,
          isCorrect: args.isCorrect,
          attemptedAt: Date.now(),
          timeSpent: args.timeSpent,
          context: args.sessionId ? { sessionId: args.sessionId } : undefined,
        });
        
        // Update denormalized stats on question
        await ctx.db.patch(args.questionId, {
          attemptCount: question.attemptCount + 1,
          correctCount: question.correctCount + (args.isCorrect ? 1 : 0),
          lastAttemptedAt: Date.now(),
        });
        
        return { success: true };
      },
    });
    ```
  - Context: Records each answer attempt and updates question stats
  - Dependencies: questions table must exist
  - Verification: Function appears in Convex dashboard
  - **Complexity**: SIMPLE
  - **Started**: 2025-07-14 19:28
  - **Execution Log**:
    - [19:28] Starting task: Implement recordInteraction mutation
    - [19:28] Reading current questions.ts file to append new mutation
    - [19:29] Added recordInteraction mutation after saveGeneratedQuestions
    - [19:29] Mutation validates user ownership and records interactions
    - [19:29] Updates denormalized stats (attemptCount, correctCount, lastAttemptedAt)
    - [19:29] Running npx convex codegen to verify TypeScript compilation
    - [19:29] TypeScript compilation successful - mutation ready for deployment
    - [19:29] Task completed - recordInteraction mutation implemented

- [x] **Create getUserQuestions query**
  - File: `convex/questions.ts`
  - Action: Add query for fetching user's questions
  - Code:
    ```typescript
    export const getUserQuestions = query({
      args: {
        sessionToken: v.string(),
        topic: v.optional(v.string()),
        onlyUnattempted: v.optional(v.boolean()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
        
        let query = ctx.db
          .query("questions")
          .withIndex("by_user", q => q.eq("userId", userId));
        
        if (args.topic) {
          query = ctx.db
            .query("questions")
            .withIndex("by_user_topic", q => 
              q.eq("userId", userId).eq("topic", args.topic)
            );
        }
        
        if (args.onlyUnattempted) {
          query = ctx.db
            .query("questions")
            .withIndex("by_user_unattempted", q => 
              q.eq("userId", userId).eq("attemptCount", 0)
            );
        }
        
        const questions = await query
          .order("desc")
          .take(args.limit || 50);
        
        return questions;
      },
    });
    ```
  - Context: Flexible query for dashboard and quiz selection
  - Verification: Test query in Convex dashboard
  - **Complexity**: SIMPLE
  - **Started**: 2025-07-14 19:30
  - **Execution Log**:
    - [19:30] Starting task: Create getUserQuestions query
    - [19:30] Reading current questions.ts file to append new query
    - [19:30] Added getUserQuestions query after recordInteraction mutation
    - [19:30] Query supports filtering by topic, unattempted status, and limit
    - [19:30] Running npx convex codegen to verify TypeScript compilation
    - [19:31] TypeScript compilation successful - query ready for deployment
    - [19:31] Task completed - getUserQuestions query implemented

## PHASE 3: API Layer Updates [30 minutes]

- [ ] **Update generate-quiz API to save questions**
  - File: `app/api/generate-quiz/route.ts`
  - Action: Import Convex client after line 5
  - Code:
    ```typescript
    import { ConvexHttpClient } from "convex/browser";
    import { api } from "@/convex/_generated/api";
    
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    ```
  - Context: Need Convex client to save questions server-side
  - Verification: Import resolves without errors

- [ ] **Add session token handling to generate-quiz**
  - File: `app/api/generate-quiz/route.ts`
  - Action: Update request schema after line 7
  - Code:
    ```typescript
    const requestSchema = z.object({
      topic: z.string().min(3).max(500),
      difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
      sessionToken: z.string().optional(), // Add this line
    })
    ```
  - Context: Accept session token for authenticated saves
  - Verification: Schema validates with session token

- [ ] **Implement question saving in generate-quiz**
  - File: `app/api/generate-quiz/route.ts`
  - Action: Add after line 52 (after generateQuizWithAI call)
  - Code:
    ```typescript
    // Save questions if user is authenticated
    let savedQuestionIds: string[] = [];
    if (validationResult.data.sessionToken) {
      try {
        const result = await convex.mutation(api.questions.saveGeneratedQuestions, {
          sessionToken: validationResult.data.sessionToken,
          topic,
          difficulty,
          questions,
        });
        savedQuestionIds = result.questionIds;
        
        logger.info({
          event: 'api.generate-quiz.questions-saved',
          count: result.count,
          topic,
        }, 'Questions saved to database');
      } catch (error) {
        logger.warn({
          event: 'api.generate-quiz.save-error',
          error: (error as Error).message,
        }, 'Failed to save questions, continuing anyway');
      }
    }
    ```
  - Context: Save questions but don't fail if unauthenticated
  - Dependencies: Convex mutation must be deployed
  - Verification: Check Convex logs for saves

- [ ] **Return question IDs in API response**
  - File: `app/api/generate-quiz/route.ts`
  - Action: Update response JSON after line 67
  - Code:
    ```typescript
    return new Response(
      JSON.stringify({ 
        questions,
        topic,
        difficulty,
        questionIds: savedQuestionIds, // Add this line
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' }
      }
    )
    ```
  - Context: Frontend needs IDs to track interactions
  - Verification: Response includes questionIds array

## PHASE 4: Frontend Integration [45 minutes]

- [ ] **Update quiz-flow to pass session token**
  - File: `components/quiz-flow.tsx`
  - Action: Modify generateQuiz function after line 31
  - Code: Add session token to request body
    ```typescript
    const generateQuiz = async () => {
      try {
        const sessionToken = localStorage.getItem('scry_session_token'); // Add this
        const response = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            topic, 
            difficulty,
            sessionToken, // Add this
          }),
        })
    ```
  - Context: Pass auth token for server-side saves
  - Verification: Network tab shows token in request

- [ ] **Store question IDs in quiz state**
  - File: `components/quiz-flow.tsx`
  - Action: Update SimpleQuiz type in types/quiz.ts first
  - Code in `types/quiz.ts`:
    ```typescript
    export interface SimpleQuiz {
      topic: string
      questions: SimpleQuestion[]
      questionIds?: string[] // Add this
      currentIndex: number
      score: number
    }
    ```
  - Then update quiz-flow.tsx after line 44:
    ```typescript
    const simpleQuiz: SimpleQuiz = {
      topic,
      questions: data.questions,
      questionIds: data.questionIds, // Add this
      currentIndex: 0,
      score: 0
    }
    ```
  - Context: Need IDs to record interactions
  - Verification: State includes question IDs

- [ ] **Create quiz interaction tracking hook**
  - File: `hooks/use-quiz-interactions.ts` (new file)
  - Action: Create custom hook for interaction tracking
  - Code:
    ```typescript
    import { useMutation } from "convex/react";
    import { api } from "@/convex/_generated/api";
    import { useCallback } from "react";
    
    export function useQuizInteractions() {
      const recordInteraction = useMutation(api.questions.recordInteraction);
      
      const trackAnswer = useCallback(async (
        questionId: string,
        userAnswer: string,
        isCorrect: boolean,
        timeSpent?: number,
        sessionId?: string
      ) => {
        const sessionToken = localStorage.getItem('scry_session_token');
        if (!sessionToken || !questionId) return;
        
        try {
          await recordInteraction({
            sessionToken,
            questionId,
            userAnswer,
            isCorrect,
            timeSpent,
            sessionId,
          });
        } catch (error) {
          console.error('Failed to track interaction:', error);
        }
      }, [recordInteraction]);
      
      return { trackAnswer };
    }
    ```
  - Context: Reusable hook for tracking quiz interactions
  - Verification: Hook compiles without errors

- [ ] **Integrate interaction tracking in QuizSessionManager**
  - File: `components/quiz-session-manager.tsx`
  - Action: Import and use interaction hook
  - Add import after line 8:
    ```typescript
    import { useQuizInteractions } from '@/hooks/use-quiz-interactions';
    ```
  - Add hook usage after line 20:
    ```typescript
    const { trackAnswer } = useQuizInteractions();
    const [sessionId] = useState(() => Math.random().toString(36).substring(7));
    const [questionStartTime, setQuestionStartTime] = useState(Date.now());
    ```
  - Context: Track each answer submission
  - Dependencies: Hook must be created first
  - Verification: No TypeScript errors

- [ ] **Track interactions on answer submission**
  - File: `components/quiz-session-manager.tsx`
  - Action: Modify handleAnswer function
  - Find handleAnswer function and add after isCorrect calculation:
    ```typescript
    // Track interaction if we have question IDs
    if (quiz.questionIds && quiz.questionIds[quiz.currentIndex]) {
      const timeSpent = Date.now() - questionStartTime;
      await trackAnswer(
        quiz.questionIds[quiz.currentIndex],
        answer,
        isCorrect,
        timeSpent,
        sessionId
      );
    }
    ```
  - Also update when moving to next question:
    ```typescript
    setQuestionStartTime(Date.now()); // Reset timer for next question
    ```
  - Context: Record every answer with timing data
  - Verification: Check Convex dashboard for interactions

## PHASE 5: Dashboard Updates [30 minutes]

- [ ] **Create individual questions view component**
  - File: `components/quiz-questions-grid.tsx` (new file)
  - Action: Create component for displaying questions
  - Initial structure:
    ```typescript
    'use client'
    
    import { useQuery } from "convex/react";
    import { api } from "@/convex/_generated/api";
    import { Card } from "@/components/ui/card";
    import { Badge } from "@/components/ui/badge";
    import { useState } from "react";
    
    export function QuizQuestionsGrid() {
      const [filter, setFilter] = useState<'all' | 'unattempted'>('all');
      // Implementation continues...
    }
    ```
  - Context: Show questions as cards with attempt status
  - Verification: Component renders without errors

- [ ] **Add questions tab to dashboard**
  - File: `app/dashboard/page.tsx`
  - Action: Import and add questions grid
  - Add import after line 2:
    ```typescript
    import { QuizQuestionsGrid } from '@/components/quiz-questions-grid'
    ```
  - Add tab system in JSX
  - Context: Let users see all their questions
  - Verification: Dashboard shows questions tab

- [ ] **Update quiz history to show interaction count**
  - File: `components/quiz-history-views.tsx`
  - Action: Add interaction stats to quiz cards
  - Context: Show how many individual questions were attempted
  - Note: May need to create a migration for old data
  - Verification: History shows enhanced stats

## PHASE 6: Data Migration [20 minutes]

- [ ] **Create migration script for existing quizResults**
  - File: `scripts/migrate-quiz-results.ts` (new file)
  - Action: Script to convert old quiz results to questions/interactions
  - Context: Preserve existing user data in new format
  - Implementation: Query all quizResults, create questions and interactions
  - Verification: Script compiles and dry-run works

- [ ] **Add migration Convex function**
  - File: `convex/migrations.ts` (new file)
  - Action: Convex mutation for data migration
  - Context: Run migration within Convex for data consistency
  - Verification: Function deploys successfully

- [ ] **Document migration process**
  - File: `docs/quiz-architecture-migration.md` (new file)
  - Action: Document the migration steps and rollback plan
  - Include: Data mapping, verification steps, rollback procedure
  - Context: Ensure safe production migration
  - Verification: Clear documentation exists

## PHASE 7: Cleanup and Optimization [15 minutes]

- [ ] **Add database indexes for common queries**
  - File: `convex/schema.ts`
  - Action: Review and optimize indexes based on query patterns
  - Context: Ensure performant queries at scale
  - Verification: Queries use indexes (check Convex dashboard)

- [ ] **Update types and remove old interfaces**
  - File: `types/quiz.ts`
  - Action: Add new types for questions and interactions
  - Clean up any obsolete types after migration
  - Context: Maintain type safety throughout app
  - Verification: No TypeScript errors

- [ ] **Update documentation**
  - File: `README.md` and `CLAUDE.md`
  - Action: Document new architecture and data model
  - Context: Keep docs in sync with implementation
  - Verification: Docs accurately reflect new system

## SUCCESS CRITERIA
- [ ] Questions persist immediately upon generation
- [ ] Every answer attempt is tracked with timing
- [ ] Users can see all their questions in dashboard
- [ ] Old quiz results are migrated successfully
- [ ] No regression in existing functionality
- [ ] Performance remains fast with indexes
- [ ] Clear migration path for production

## CRITICAL FILES TO PRESERVE (Preview Deployments)
- `lib/environment.ts` - Server-side environment detection
- `lib/environment-client.ts` - Client-side environment detection  
- `app/api/auth/send-magic-link/route.ts` - Environment-aware magic links
- `app/api/health/preview/route.ts` - Preview deployment health checks
- `docs/preview-deployment-*.md` - Debugging documentation
- Environment fields in `convex/schema.ts` (sessions.environment, magicLinks.environment)
- Environment validation in `convex/auth.ts`