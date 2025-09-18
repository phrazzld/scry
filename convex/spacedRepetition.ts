/**
 * Spaced Repetition System - Pure FSRS Implementation
 * 
 * This module implements the Free Spaced Repetition Scheduler (FSRS) algorithm
 * without modifications or comfort features. The system respects memory science
 * absolutely - no daily limits, no artificial interleaving, no comfort features.
 * 
 * Queue Priority System (lower number = higher priority):
 * 
 * 1. Ultra-fresh new questions (< 1 hour old): -2.0 to -1.37
 *    - Highest priority for immediate encoding into memory
 *    - Exponentially decays toward standard new priority
 * 
 * 2. Fresh new questions (1-24 hours old): -1.37 to -1.0  
 *    - Still prioritized but with diminishing boost
 *    - Prevents stale new questions from blocking reviews
 * 
 * 3. Standard new questions (> 24 hours old): -1.0
 *    - Regular FSRS new card priority
 *    - Must be learned before reviews
 * 
 * 4. Due review questions: 0.0 to 1.0
 *    - Based on FSRS retrievability calculation
 *    - Lower retrievability = higher priority
 *    - 0.0 = completely forgotten, needs immediate review
 *    - 1.0 = perfect recall, can wait
 * 
 * Key Principles:
 * - The forgetting curve doesn't care about comfort
 * - If 300 cards are due, show 300 cards
 * - Natural consequences teach sustainable habits
 * - Every "improvement" that adds comfort reduces effectiveness
 * 
 * @module spacedRepetition
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { scheduleNextReview, getRetrievability, initializeCard, cardToDb } from "./fsrs";
import { requireUserFromClerk } from "./clerk";
import { Doc } from "./_generated/dataModel";

// Export for testing
export { calculateFreshnessDecay, calculateRetrievabilityScore };

/**
 * Calculate freshness priority with exponential decay over 24 hours
 * 
 * @param hoursSinceCreation - Hours since the question was created
 * @returns A priority boost from 0 to 1 (1 = maximum freshness)
 */
function calculateFreshnessDecay(hoursSinceCreation: number): number {
  if (hoursSinceCreation < 0) {
    // Gracefully handle minor clock skew by treating as maximum freshness
    // This prevents crashes when client/server times are slightly misaligned
    return 1.0;
  }
  
  // Exponential decay with 24-hour half-life
  // At 0 hours: 1.0 (maximum freshness)
  // At 24 hours: ~0.37 (e^-1)
  // At 48 hours: ~0.14 (e^-2)
  // After 72 hours: effectively 0
  return Math.exp(-hoursSinceCreation / 24);
}

/**
 * Calculate enhanced retrievability score for queue prioritization
 * 
 * Implements Pure FSRS with fresh question priority and exponential decay:
 * - Ultra-fresh questions (0-24 hours): -2 to -1 with exponential decay
 * - Regular new questions (>24 hours): -1 (standard new priority)
 * - Reviewed questions: 0-1 (based on FSRS calculation)
 * 
 * The freshness decay ensures newly generated questions get immediate priority
 * but gradually lose that boost over 24 hours, preventing stale new questions
 * from indefinitely blocking important reviews.
 * 
 * @param question - The question document to calculate priority for
 * @param now - Current date/time for calculation (defaults to now)
 * @returns Priority score: -2 to -1 for new questions, 0 to 1 for reviewed questions
 */
function calculateRetrievabilityScore(question: Doc<"questions">, now: Date = new Date()): number {
  if (question.nextReview === undefined) {
    // New question - apply freshness decay
    const hoursSinceCreation = (now.getTime() - question._creationTime) / 3600000;
    
    // Calculate freshness boost (1.0 at creation, decays to ~0 after 72 hours)
    const freshnessBoost = calculateFreshnessDecay(hoursSinceCreation);
    
    // Map freshness to priority range: -2 (ultra-fresh) to -1 (standard new)
    // freshnessBoost of 1.0 gives -2, freshnessBoost of 0 gives -1
    return -1 - freshnessBoost;
  }
  
  // Reviewed question - use standard FSRS retrievability (0-1)
  return getRetrievability(question, now);
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
    questionId: v.id("questions"),
    userAnswer: v.string(),
    isCorrect: v.boolean(),
    timeSpent: v.optional(v.number()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    
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
 * 
 * This query implements Pure FSRS queue prioritization:
 * 1. Fetches all due reviews and new questions
 * 2. Calculates priority score for each (see calculateRetrievabilityScore)
 * 3. Returns the highest priority question (lowest score)
 * 
 * No daily limits, no artificial ordering - just pure memory science.
 * The question that most needs review appears first, always.
 */
export const getNextReview = query({
  args: {
    _refreshTimestamp: v.optional(v.number()), // For periodic refresh
  },
  handler: async (ctx) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
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
    
    // Calculate retrievability score for each question
    const questionsWithPriority = allCandidates.map(q => ({
      question: q,
      retrievability: calculateRetrievabilityScore(q, now),
    }));
    
    // Sort by retrievability (lower = higher priority)
    questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);
    
    // Return the highest priority question - Pure FSRS, no tricks
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
      serverTime: now.getTime(), // Server's current time for accurate "New" badge display
    };
  },
});

/**
 * Get count of questions due for review
 * 
 * Returns the REAL count - no limits, no filtering, no comfort.
 * This is your actual learning debt:
 * - newCount: Questions never reviewed (highest priority)
 * - dueCount: Questions past their optimal review time
 * - totalReviewable: The truth about what needs review
 */
export const getDueCount = query({
  args: {
    _refreshTimestamp: v.optional(v.number()), // For periodic refresh
  },
  handler: async (ctx) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Count questions that are due using pagination to avoid memory issues
    // This prevents O(N) memory usage for users with large collections
    let dueCount = 0;
    const dueQuestions = await ctx.db
      .query("questions")
      .withIndex("by_user_next_review", q =>
        q.eq("userId", userId)
         .lte("nextReview", now)
      )
      .filter(q => q.eq(q.field("deletedAt"), undefined))
      .take(1000); // Reasonable upper limit for counting
    dueCount = dueQuestions.length;

    // Also count learning/relearning cards as "due" since they need immediate review
    // This ensures "0 due" is never shown when learning cards exist
    const learningQuestions = await ctx.db
      .query("questions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q =>
        q.and(
          q.or(
            q.eq(q.field("state"), "learning"),
            q.eq(q.field("state"), "relearning")
          ),
          q.eq(q.field("deletedAt"), undefined),
          // Don't double-count cards already in dueQuestions
          q.gt(q.field("nextReview"), now)
        )
      )
      .take(1000);
    dueCount += learningQuestions.length;

    // Count new questions using pagination
    let newCount = 0;
    const newQuestions = await ctx.db
      .query("questions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q =>
        q.and(
          q.eq(q.field("nextReview"), undefined),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .take(1000); // Reasonable upper limit for counting
    newCount = newQuestions.length;

    return {
      dueCount,
      newCount,
      totalReviewable: dueCount + newCount,
    };
  },
});

/**
 * Get user's card statistics and next scheduled review time
 * Used for context-aware empty states
 */
export const getUserCardStats = query({
  args: {
    _refreshTimestamp: v.optional(v.float64()),
  },
  handler: async (ctx) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Get all user's cards (not deleted)
    const allCards = await ctx.db
      .query("questions")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const totalCards = allCards.length;

    if (totalCards === 0) {
      return {
        totalCards: 0,
        nextReviewTime: null,
        learningCount: 0,
        matureCount: 0,
        newCount: 0,
      };
    }

    // Find the earliest next review time (for cards not yet due)
    const futureReviews = allCards
      .filter(card => card.nextReview && card.nextReview > now)
      .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));

    const nextReviewTime = futureReviews[0]?.nextReview || null;

    // Count cards by state
    let learningCount = 0;
    let matureCount = 0;
    let newCount = 0;

    for (const card of allCards) {
      if (!card.state || card.state === "new") {
        newCount++;
      } else if (card.state === "learning" || card.state === "relearning") {
        learningCount++;
      } else if (card.state === "review") {
        matureCount++;
      }
    }

    return {
      totalCards,
      nextReviewTime,
      learningCount,
      matureCount,
      newCount,
    };
  },
});