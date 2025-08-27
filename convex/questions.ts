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

/**
 * Record a user's interaction with a question and automatically schedule next review
 * 
 * This mutation integrates Scry's automatic rating system directly into the interaction
 * recording process. When a user answers a question, we automatically:
 * 1. Record the interaction with timing and correctness data
 * 2. Update denormalized statistics on the question
 * 3. Calculate and apply FSRS scheduling using automatic rating
 * 
 * The automatic rating approach means users never see traditional confidence buttons
 * (Again/Hard/Good/Easy). Instead, the system infers the appropriate rating from
 * whether they answered correctly or not.
 * 
 * @returns Scheduling information including next review time for immediate display
 */
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
      nextReview: fsrsFields.nextReview || null,
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
    includeDeleted: v.optional(v.boolean()), // Option to include deleted questions
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
    
    let questions = await query
      .order("desc")
      .take(args.limit || 50);
    
    // Filter out soft-deleted questions by default
    if (!args.includeDeleted) {
      questions = questions.filter(q => !q.deletedAt);
    }
    
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

/**
 * Update a question (creator-only)
 * 
 * Allows the question creator to update question content, but preserves
 * FSRS data and interaction history to maintain learning integrity.
 */
export const updateQuestion = mutation({
  args: {
    sessionToken: v.string(),
    questionId: v.id("questions"),
    question: v.optional(v.string()),
    topic: v.optional(v.string()),
    explanation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    
    // 2. Verify ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== userId) {
      throw new Error("Question not found or unauthorized");
    }
    
    // 3. Check if already deleted
    if (question.deletedAt) {
      throw new Error("Cannot update deleted question");
    }
    
    // 4. Input validation
    if (args.question !== undefined && args.question.trim().length === 0) {
      throw new Error("Question cannot be empty");
    }
    
    if (args.topic !== undefined && args.topic.trim().length === 0) {
      throw new Error("Topic cannot be empty");
    }
    
    // 5. Build update fields (only non-answer fields to preserve integrity)
    const updateFields: Partial<typeof question> = {};
    if (args.question !== undefined) updateFields.question = args.question;
    if (args.topic !== undefined) updateFields.topic = args.topic;
    if (args.explanation !== undefined) updateFields.explanation = args.explanation;
    
    // 6. Update with timestamp
    await ctx.db.patch(args.questionId, {
      ...updateFields,
      updatedAt: Date.now(),
    });
    
    return { 
      success: true, 
      questionId: args.questionId,
      message: "Question updated successfully"
    };
  },
});

/**
 * Soft delete a question (creator-only)
 * 
 * Marks the question as deleted but preserves it in the database
 * to maintain FSRS history and enable potential restoration.
 */
export const softDeleteQuestion = mutation({
  args: {
    sessionToken: v.string(),
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    
    // 2. Verify ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== userId) {
      throw new Error("Question not found or unauthorized");
    }
    
    // 3. Check if already deleted
    if (question.deletedAt) {
      throw new Error("Question is already deleted");
    }
    
    // 4. Soft delete with timestamp
    await ctx.db.patch(args.questionId, {
      deletedAt: Date.now(),
    });
    
    return { 
      success: true, 
      questionId: args.questionId,
      message: "Question deleted successfully"
    };
  },
});

/**
 * Restore a soft-deleted question (creator-only)
 * 
 * Allows users to undo a deletion within the recovery window.
 */
export const restoreQuestion = mutation({
  args: {
    sessionToken: v.string(),
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    
    // 2. Verify ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== userId) {
      throw new Error("Question not found or unauthorized");
    }
    
    // 3. Check if deleted
    if (!question.deletedAt) {
      throw new Error("Question is not deleted");
    }
    
    // 4. Restore by removing deletedAt
    await ctx.db.patch(args.questionId, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });
    
    return { 
      success: true, 
      questionId: args.questionId,
      message: "Question restored successfully"
    };
  },
});