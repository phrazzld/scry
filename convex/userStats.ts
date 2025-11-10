/**
 * User Statistics Management
 *
 * Functions for maintaining and reconciling cached userStats.
 * Handles drift detection and automatic correction.
 */

import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { internalMutation } from './_generated/server';
import { createLogger } from './lib/logger';

const QUESTION_BATCH_SIZE = 200;
const USER_SAMPLE_FALLBACK_LIMIT = 200;

/**
 * Reconcile userStats for drift detection and auto-correction
 *
 * Samples users, recalculates stats from source (questions table),
 * compares with cached userStats, and fixes drift if detected.
 *
 * Scheduled to run daily at 3 AM UTC via cron.
 *
 * @param sampleSize - Number of random users to check (default: 100)
 * @param driftThreshold - Number of cards difference to consider drift (default: 5)
 */
export const reconcileUserStats = internalMutation({
  args: {
    sampleSize: v.optional(v.number()),
    driftThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sampleSize = args.sampleSize ?? 100;
    const driftThreshold = args.driftThreshold ?? 5;

    const logger = createLogger({
      module: 'userStats',
      function: 'reconcileUserStats',
    });

    logger.info('Reconciliation started', {
      event: 'user-stats.reconcile.start',
      sampleSize,
      driftThreshold,
    });

    const stats = {
      usersSampled: 0,
      usersChecked: 0,
      driftDetected: 0,
      corrected: 0,
      errors: 0,
    };

    try {
      const sampledUsers = await sampleUsersForReconciliation(ctx, sampleSize);

      if (sampledUsers.length === 0) {
        logger.info('No users to reconcile');
        return { stats, message: 'No users found' };
      }

      stats.usersSampled = sampledUsers.length;

      for (const user of sampledUsers) {
        stats.usersChecked++;

        try {
          // Get cached stats
          const cachedStats = await ctx.db
            .query('userStats')
            .withIndex('by_user', (q) => q.eq('userId', user._id))
            .first();

          // Recalculate stats via paginated question scan
          const actualStats = await recalculateUserStatsFromQuestions(ctx, user._id);

          // Check for drift
          if (cachedStats) {
            const totalDrift = Math.abs(cachedStats.totalCards - actualStats.totalCards);
            const newDrift = Math.abs(cachedStats.newCount - actualStats.newCount);
            const learningDrift = Math.abs(cachedStats.learningCount - actualStats.learningCount);
            const matureDrift = Math.abs(cachedStats.matureCount - actualStats.matureCount);

            const maxDrift = Math.max(totalDrift, newDrift, learningDrift, matureDrift);

            if (maxDrift > driftThreshold) {
              stats.driftDetected++;

              logger.warn('Drift detected', {
                event: 'user-stats.drift.detected',
                userId: user._id,
                userEmail: user.email,
                drift: {
                  total: totalDrift,
                  new: newDrift,
                  learning: learningDrift,
                  mature: matureDrift,
                },
                cached: cachedStats,
                actual: actualStats,
              });

              // Auto-fix drift by updating cached stats
              await ctx.db.patch(cachedStats._id, {
                totalCards: actualStats.totalCards,
                newCount: actualStats.newCount,
                learningCount: actualStats.learningCount,
                matureCount: actualStats.matureCount,
                nextReviewTime: actualStats.nextReviewTime,
                lastCalculated: Date.now(),
              });

              stats.corrected++;

              logger.info('Drift corrected', {
                event: 'user-stats.drift.corrected',
                userId: user._id,
              });
            }
          } else if (actualStats.totalCards > 0) {
            // User has questions but no stats - initialize
            await ctx.db.insert('userStats', {
              userId: user._id,
              ...actualStats,
              dueNowCount: 0, // Initialize to 0, will be updated by review mutations
              lastCalculated: Date.now(),
            });

            stats.corrected++;

            logger.info('Missing stats initialized', {
              event: 'user-stats.missing.initialized',
              userId: user._id,
              stats: actualStats,
            });
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          stats.errors++;

          logger.error('Error reconciling user', {
            event: 'user-stats.reconcile.error',
            userId: user._id,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      logger.info('Reconciliation completed', {
        event: 'user-stats.reconcile.complete',
        stats,
      });

      return {
        stats,
        message:
          stats.driftDetected > 0
            ? `Detected and corrected drift for ${stats.corrected} of ${stats.usersChecked} users`
            : `All ${stats.usersChecked} users have accurate stats`,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      logger.error('Reconciliation failed', {
        event: 'user-stats.reconcile.failed',
        error: error.message,
        stack: error.stack,
        stats,
      });

      throw error;
    }
  },
});

type QuestionStats = {
  totalCards: number;
  newCount: number;
  learningCount: number;
  matureCount: number;
  nextReviewTime?: number;
};

function getUserCreatedAt(user: Doc<'users'>): number {
  return user.createdAt ?? user._creationTime ?? Date.now();
}

async function sampleUsersForReconciliation(
  ctx: MutationCtx,
  sampleSize: number,
  randomFn: () => number = Math.random
): Promise<Array<Doc<'users'>>> {
  if (sampleSize <= 0) {
    return [];
  }

  const firstUser = await ctx.db.query('users').withIndex('by_creation_time').order('asc').first();

  if (!firstUser) {
    return [];
  }

  const lastUser = await ctx.db.query('users').withIndex('by_creation_time').order('desc').first();

  if (!lastUser) {
    return [firstUser];
  }

  const minTimestamp = getUserCreatedAt(firstUser);
  const maxTimestamp = getUserCreatedAt(lastUser);
  const range = Math.max(1, maxTimestamp - minTimestamp + 1);
  const randomOffset = Math.floor(randomFn() * range);
  const pivot = minTimestamp + randomOffset;

  const sampled: Array<Doc<'users'>> = [];
  const seen = new Set<string>();

  const forwardChunk = await ctx.db
    .query('users')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex('by_creation_time', (q: any) => q.gte('createdAt', pivot))
    .order('asc')
    .take(sampleSize);
  appendUsers(sampled, forwardChunk, seen, sampleSize);

  if (sampled.length < sampleSize) {
    const wrapChunk = await ctx.db
      .query('users')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex('by_creation_time', (q: any) => q.lt('createdAt', pivot))
      .order('asc')
      .take(sampleSize - sampled.length);
    appendUsers(sampled, wrapChunk, seen, sampleSize);
  }

  if (sampled.length < sampleSize) {
    const fallbackChunk = await ctx.db
      .query('users')
      .withIndex('by_creation_time')
      .order('asc')
      .take(Math.min(USER_SAMPLE_FALLBACK_LIMIT, sampleSize - sampled.length));
    appendUsers(sampled, fallbackChunk, seen, sampleSize);
  }

  if (sampled.length === 0) {
    return [firstUser];
  }

  return sampled.slice(0, sampleSize);
}

function appendUsers(
  target: Array<Doc<'users'>>,
  source: Array<Doc<'users'>>,
  seen: Set<string>,
  max: number
) {
  for (const doc of source) {
    if (seen.has(doc._id)) {
      continue;
    }
    target.push(doc);
    seen.add(doc._id);
    if (target.length >= max) {
      break;
    }
  }
}

async function recalculateUserStatsFromQuestions(
  ctx: MutationCtx,
  userId: Id<'users'>
): Promise<QuestionStats> {
  const accumulator: QuestionStats = {
    totalCards: 0,
    newCount: 0,
    learningCount: 0,
    matureCount: 0,
    nextReviewTime: undefined,
  };

  const questionQuery = ctx.db
    .query('questions')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((q: any) => q.eq(q.field('deletedAt'), undefined))
    .order('asc');

  let paginationResult = await questionQuery.paginate({
    numItems: QUESTION_BATCH_SIZE,
    cursor: null,
  });
  applyQuestionsToAccumulator(paginationResult.page, accumulator);

  while (!paginationResult.isDone) {
    paginationResult = await questionQuery.paginate({
      numItems: QUESTION_BATCH_SIZE,
      cursor: paginationResult.continueCursor,
    });
    applyQuestionsToAccumulator(paginationResult.page, accumulator);
  }

  return accumulator;
}

function applyQuestionsToAccumulator(
  questions: Array<Doc<'questions'>>,
  accumulator: QuestionStats
) {
  for (const question of questions) {
    accumulator.totalCards++;

    if (!question.state || question.state === 'new') {
      accumulator.newCount++;
    } else if (question.state === 'learning' || question.state === 'relearning') {
      accumulator.learningCount++;
    } else if (question.state === 'review') {
      accumulator.matureCount++;
    }

    if (question.nextReview) {
      if (
        accumulator.nextReviewTime === undefined ||
        question.nextReview < accumulator.nextReviewTime
      ) {
        accumulator.nextReviewTime = question.nextReview;
      }
    }
  }
}

export const __test = {
  sampleUsersForReconciliation,
  recalculateUserStatsFromQuestions,
  applyQuestionsToAccumulator,
  QUESTION_BATCH_SIZE,
};
