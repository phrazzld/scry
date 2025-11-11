/**
 * Question Interaction Recording + Scheduling
 *
 * Records user answer attempts and schedules next reviews via FSRS.
 * This is THE key integration point between questions and spaced repetition.
 * Hides stat update logic and scheduling calculations behind simple interface.
 *
 * Uses injected scheduler (via getScheduler()) to avoid direct FSRS coupling.
 */
import { v } from 'convex/values';
import { Doc } from './_generated/dataModel';
import { mutation } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { getScheduler } from './scheduling';

/**
 * Record user interaction and schedule next review
 *
 * Updates denormalized stats (attemptCount, correctCount) and calculates
 * next FSRS review time based on answer correctness.
 *
 * Handles first-time initialization of FSRS state automatically.
 */
export const recordInteraction = mutation({
  args: {
    questionId: v.id('questions'),
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
      throw new Error(`Question not found or unauthorized: ${args.questionId}`);
    }

    // Record interaction
    await ctx.db.insert('interactions', {
      userId,
      questionId: args.questionId,
      userAnswer: args.userAnswer,
      isCorrect: args.isCorrect,
      attemptedAt: Date.now(),
      sessionId: args.sessionId,
      timeSpent: args.timeSpent,
      context: args.sessionId ? { sessionId: args.sessionId } : undefined,
    });

    // Prepare updated stats
    const updatedStats = {
      attemptCount: question.attemptCount + 1,
      correctCount: question.correctCount + (args.isCorrect ? 1 : 0),
      lastAttemptedAt: Date.now(),
    };

    // Calculate FSRS scheduling using scheduler interface
    const scheduler = getScheduler();
    const now = new Date();
    let fsrsFields: Partial<typeof question> = {};

    // If this is the first interaction and question has no FSRS state, initialize it
    if (!question.state) {
      const initialDbFields = scheduler.initializeCard();

      // Schedule the first review
      // Merge with question doc because scheduleNextReview expects:
      // 1. userId field for logging/validation
      // 2. Full doc shape to safely compute next review
      // 3. Any existing partial FSRS fields to be overwritten (migration safety)
      const result = scheduler.scheduleNextReview(
        { ...question, ...initialDbFields } as Doc<'questions'>,
        args.isCorrect,
        now
      );

      fsrsFields = result.dbFields;
    } else {
      // For subsequent reviews, use existing FSRS state
      const result = scheduler.scheduleNextReview(question, args.isCorrect, now);
      fsrsFields = result.dbFields;
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
      newState: fsrsFields.state || question.state || 'new',
    };
  },
});
