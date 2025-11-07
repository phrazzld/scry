/**
 * User Statistics Management
 *
 * Functions for maintaining and reconciling cached userStats.
 * Handles drift detection and automatic correction.
 */

import { v } from 'convex/values';

import { internalMutation } from './_generated/server';
import { createLogger } from './lib/logger';

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
      usersChecked: 0,
      driftDetected: 0,
      corrected: 0,
      errors: 0,
    };

    try {
      // Get all users and sample randomly
      const allUsers = await ctx.db.query('users').collect();

      if (allUsers.length === 0) {
        logger.info('No users to reconcile');
        return { stats, message: 'No users found' };
      }

      // Sample random users (or all if fewer than sampleSize)
      const sampled = allUsers
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(sampleSize, allUsers.length));

      for (const user of sampled) {
        stats.usersChecked++;

        try {
          // Get cached stats
          const cachedStats = await ctx.db
            .query('userStats')
            .withIndex('by_user', (q) => q.eq('userId', user._id))
            .first();

          // Recalculate stats from source
          const questions = await ctx.db
            .query('questions')
            .withIndex('by_user', (q) => q.eq('userId', user._id))
            .filter((q) => q.eq(q.field('deletedAt'), undefined))
            .collect();

          let newCount = 0;
          let learningCount = 0;
          let matureCount = 0;
          let earliestNextReview: number | undefined = undefined;

          for (const question of questions) {
            if (!question.state || question.state === 'new') {
              newCount++;
            } else if (question.state === 'learning' || question.state === 'relearning') {
              learningCount++;
            } else if (question.state === 'review') {
              matureCount++;
            }

            if (question.nextReview) {
              if (!earliestNextReview || question.nextReview < earliestNextReview) {
                earliestNextReview = question.nextReview;
              }
            }
          }

          const actualStats = {
            totalCards: questions.length,
            newCount,
            learningCount,
            matureCount,
            nextReviewTime: earliestNextReview,
          };

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
