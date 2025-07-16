import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { initializeCard, cardToDb, scheduleNextReview } from "./fsrs";

// Helper to get authenticated user ID from session token
async function getAuthenticatedUserId(ctx: QueryCtx | MutationCtx, sessionToken: string | undefined) {
  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session");
  }

  return session.userId;
}

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
    
    // Initialize FSRS card for new questions
    const initialCard = initializeCard();
    const fsrsFields = cardToDb(initialCard);
    
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
          // Initialize FSRS fields with proper defaults
          ...fsrsFields,
        })
      )
    );
    
    return { questionIds, count: questionIds.length };
  },
});

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
    
    // Prepare updated stats
    const updatedStats = {
      attemptCount: question.attemptCount + 1,
      correctCount: question.correctCount + (args.isCorrect ? 1 : 0),
      lastAttemptedAt: Date.now(),
    };
    
    // Calculate FSRS scheduling
    const now = new Date();
    let fsrsFields: Partial<typeof question> = {};
    
    // If this is the first interaction and question has no FSRS state, initialize it
    if (!question.state) {
      const initialCard = initializeCard();
      const initialDbFields = cardToDb(initialCard);
      
      // Schedule the first review
      const { dbFields: scheduledFields } = scheduleNextReview(
        { ...question, ...initialDbFields },
        args.isCorrect,
        now
      );
      
      fsrsFields = scheduledFields;
    } else {
      // For subsequent reviews, use existing FSRS state
      const { dbFields: scheduledFields } = scheduleNextReview(question, args.isCorrect, now);
      fsrsFields = scheduledFields;
    }
    
    // Update question with both stats and FSRS fields
    await ctx.db.patch(args.questionId, {
      ...updatedStats,
      ...fsrsFields,
    });
    
    return { 
      success: true,
      nextReview: fsrsFields.nextReview ? new Date(fsrsFields.nextReview) : null,
      scheduledDays: fsrsFields.scheduledDays || 0,
      newState: fsrsFields.state || question.state || "new",
    };
  },
});

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
      const topic = args.topic;
      query = ctx.db
        .query("questions")
        .withIndex("by_user_topic", q => 
          q.eq("userId", userId).eq("topic", topic)
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

export const getQuizInteractionStats = query({
  args: {
    sessionToken: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    
    // Get all interactions for this session
    const interactions = await ctx.db
      .query("interactions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("context.sessionId"), args.sessionId))
      .collect();
    
    // Calculate stats
    const totalInteractions = interactions.length;
    const correctInteractions = interactions.filter(i => i.isCorrect).length;
    const uniqueQuestions = new Set(interactions.map(i => i.questionId)).size;
    
    return {
      totalInteractions,
      correctInteractions,
      uniqueQuestions,
      accuracy: totalInteractions > 0 ? correctInteractions / totalInteractions : 0,
    };
  },
});