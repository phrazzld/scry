import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { scheduleNextReview, getRetrievability, initializeCard, cardToDb } from "./fsrs";

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

/**
 * Schedule next review for a question based on user's answer
 * 
 * This mutation is the primary integration point for Scry's automatic rating system.
 * It combines interaction recording with FSRS scheduling using a simplified approach
 * where users only indicate correct/incorrect rather than rating their confidence.
 * 
 * Automatic Rating Flow:
 * 1. User answers question (correct/incorrect)
 * 2. This mutation records the interaction
 * 3. Automatically converts isCorrect to FSRS rating (Good/Again)
 * 4. Calculates next review time using FSRS algorithm
 * 5. Returns scheduling info for immediate display to user
 * 
 * This approach eliminates the traditional 4-button rating system (Again/Hard/Good/Easy)
 * in favor of a streamlined binary choice, making reviews faster and more mobile-friendly.
 */
export const scheduleReview = mutation({
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
    
    // Record interaction first
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
    const updatedStats = {
      attemptCount: question.attemptCount + 1,
      correctCount: question.correctCount + (args.isCorrect ? 1 : 0),
      lastAttemptedAt: Date.now(),
    };
    
    // Calculate FSRS scheduling
    const now = new Date();
    
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
      
      // Update question with both stats and FSRS fields
      await ctx.db.patch(args.questionId, {
        ...updatedStats,
        ...scheduledFields,
      });
      
      return {
        success: true,
        nextReview: scheduledFields.nextReview || null,
        scheduledDays: scheduledFields.scheduledDays || 0,
        newState: scheduledFields.state || "new",
      };
    }
    
    // For subsequent reviews, use existing FSRS state
    const { dbFields: scheduledFields } = scheduleNextReview(question, args.isCorrect, now);
    
    // Update question with both stats and FSRS fields
    await ctx.db.patch(args.questionId, {
      ...updatedStats,
      ...scheduledFields,
    });
    
    return {
      success: true,
      nextReview: scheduledFields.nextReview || null,
      scheduledDays: scheduledFields.scheduledDays || 0,
      newState: scheduledFields.state || question.state || "new",
    };
  },
});

/**
 * Get the next question to review based on FSRS retrievability
 * Returns the highest priority question (lowest retrievability or new)
 */
export const getNextReview = query({
  args: {
    sessionToken: v.string(),
    _refreshTimestamp: v.optional(v.number()), // For periodic refresh
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    const now = new Date();
    
    // First, try to get questions that are due for review (excluding deleted)
    const dueQuestions = await ctx.db
      .query("questions")
      .withIndex("by_user_next_review", q => 
        q.eq("userId", userId)
         .lte("nextReview", now.getTime())
      )
      .filter(q => q.eq(q.field("deletedAt"), undefined))
      .take(100); // Get a batch to sort by retrievability
    
    // Also get questions without nextReview (new questions, excluding deleted)
    const newQuestions = await ctx.db
      .query("questions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => 
        q.and(
          q.eq(q.field("nextReview"), undefined),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .take(10);
    
    // Combine both sets
    const allCandidates = [...dueQuestions, ...newQuestions];
    
    if (allCandidates.length === 0) {
      return null; // No questions to review
    }
    
    // For new questions (no nextReview), assign lowest retrievability (highest priority)
    // For due questions, calculate actual retrievability
    const questionsWithPriority = allCandidates.map(q => ({
      question: q,
      retrievability: q.nextReview === undefined ? -1 : getRetrievability(q, now),
    }));
    
    // Sort by retrievability (lower = higher priority)
    questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);
    
    // Return the highest priority question
    const nextQuestion = questionsWithPriority[0].question;
    
    // Get interaction history for this question
    const interactions = await ctx.db
      .query("interactions")
      .withIndex("by_user_question", q => 
        q.eq("userId", userId)
         .eq("questionId", nextQuestion._id)
      )
      .order("desc")
      .collect();
    
    return {
      question: nextQuestion,
      interactions,
      attemptCount: nextQuestion.attemptCount,
      correctCount: nextQuestion.correctCount,
      successRate: nextQuestion.attemptCount > 0 
        ? nextQuestion.correctCount / nextQuestion.attemptCount 
        : null,
    };
  },
});

/**
 * Get count of questions due for review
 */
export const getDueCount = query({
  args: {
    sessionToken: v.string(),
    _refreshTimestamp: v.optional(v.number()), // For periodic refresh
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    const now = Date.now();
    
    // Count questions that are due (excluding deleted)
    const dueQuestions = await ctx.db
      .query("questions")
      .withIndex("by_user_next_review", q => 
        q.eq("userId", userId)
         .lte("nextReview", now)
      )
      .filter(q => q.eq(q.field("deletedAt"), undefined))
      .collect();
    
    // Count new questions (no nextReview set, excluding deleted)
    const newQuestions = await ctx.db
      .query("questions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => 
        q.and(
          q.eq(q.field("nextReview"), undefined),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .collect();
    
    return {
      dueCount: dueQuestions.length,
      newCount: newQuestions.length,
      totalReviewable: dueQuestions.length + newQuestions.length,
    };
  },
});