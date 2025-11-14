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
import { buildInteractionContext } from './lib/interactionContext';
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
    const timestamp = Date.now();
    const scheduler = getScheduler();
    const now = new Date(timestamp);
    let fsrsFields: Partial<typeof question> = {};
    let scheduledDays: number | null = null;
    let nextReview: number | null = null;
    type FsrsState = 'new' | 'learning' | 'review' | 'relearning';
    let fsrsState: FsrsState | null = null;

    if (!question.state) {
      const initialDbFields = scheduler.initializeCard();
      const result = scheduler.scheduleNextReview(
        { ...question, ...initialDbFields } as Doc<'questions'>,
        args.isCorrect,
        now
      );

      fsrsFields = result.dbFields;
      scheduledDays = result.dbFields.scheduledDays ?? null;
      nextReview = result.dbFields.nextReview ?? null;
      fsrsState = (result.dbFields.state ?? 'new') as FsrsState;
    } else {
      const result = scheduler.scheduleNextReview(question, args.isCorrect, now);
      fsrsFields = result.dbFields;
      scheduledDays = result.dbFields.scheduledDays ?? null;
      nextReview = result.dbFields.nextReview ?? null;
      fsrsState = (result.dbFields.state ?? question.state ?? 'new') as FsrsState;
    }

    const interactionContext = buildInteractionContext({
      sessionId: args.sessionId,
      scheduledDays,
      nextReview,
      fsrsState,
    });

    await ctx.db.insert('interactions', {
      userId,
      questionId: args.questionId,
      userAnswer: args.userAnswer,
      isCorrect: args.isCorrect,
      attemptedAt: timestamp,
      sessionId: args.sessionId,
      timeSpent: args.timeSpent,
      context: interactionContext,
    });

    const updatedStats = {
      attemptCount: question.attemptCount + 1,
      correctCount: question.correctCount + (args.isCorrect ? 1 : 0),
      lastAttemptedAt: timestamp,
    };

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
