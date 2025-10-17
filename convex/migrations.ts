import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation, mutation, MutationCtx, query } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { createLogger } from './lib/logger';

/**
 * Default batch size for quiz results migration
 * Smaller batch due to nested processing (question + interaction creation per answer)
 */
const DEFAULT_QUIZ_MIGRATION_BATCH_SIZE = 100;

/**
 * Default batch size for difficulty field removal migration
 * Larger batch is safe since it's a simple field deletion operation
 */
const DEFAULT_DIFFICULTY_REMOVAL_BATCH_SIZE = 500;

/**
 * Log progress every N records during migration
 * Provides feedback without overwhelming logs
 */
const PROGRESS_LOG_INTERVAL = 100;

/**
 * Standard result type for all migrations
 * Provides consistent interface for success/failure handling
 */
type MigrationResult<TStats = Record<string, number>> = {
  /** Migration completion status */
  status: 'completed' | 'partial' | 'failed';
  /** Whether dry-run mode was enabled */
  dryRun: boolean;
  /** Migration-specific statistics */
  stats: TStats;
  /** Detailed failures for retry (only present if failures occurred) */
  failures?: Array<{
    recordId: string;
    error: string;
  }>;
  /** Human-readable status message */
  message: string;
};

/**
 * Statistics for difficulty field removal migration
 */
type DifficultyRemovalStats = {
  totalProcessed: number;
  updated: number;
  alreadyMigrated: number;
  errors: number;
};

/**
 * Statistics for quiz results to questions migration
 */
type QuizMigrationStats = {
  totalProcessed: number;
  questionsCreated: number;
  interactionsCreated: number;
  duplicateQuestions: number;
  failed: number;
};

/**
 * Statistics for rollback operations
 */
type RollbackStats = {
  questionsDeleted: number;
  interactionsDeleted: number;
  quizResultsReset: number;
};

/**
 * Statistics for userStats initialization migration
 */
type UserStatsInitStats = {
  totalUsers: number;
  initialized: number;
  alreadyExist: number;
  errors: number;
};

/**
 * Get migration status (placeholder for future implementation)
 *
 * This is a stub function that will be implemented when migration tracking
 * is needed. Currently returns hardcoded placeholder values.
 *
 * Future implementation should:
 * - Add admin authentication check
 * - Query actual migration logs from database
 * - Return real-time migration progress
 */
export const getMigrationStatus = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const migrationLogger = createLogger({ module: 'migrations', function: 'getMigrationStatus' });

    migrationLogger.info('Migration status requested', {
      event: 'migration.status.request',
      sessionTokenPrefix: args.sessionToken.substring(0, 8) + '...',
    });

    // Placeholder return - will be replaced with actual migration tracking
    return {
      status: 'ready',
      totalQuizResults: 0,
      migratedCount: 0,
      questionsCreated: 0,
      interactionsCreated: 0,
      errors: [],
    };
  },
});

// Main migration function - should be called by admin only
export const migrateQuizResultsToQuestions = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<MigrationResult<QuizMigrationStats>> => {
    const batchSize = args.batchSize || DEFAULT_QUIZ_MIGRATION_BATCH_SIZE;
    const dryRun = args.dryRun || false;

    const stats = {
      totalProcessed: 0,
      questionsCreated: 0,
      interactionsCreated: 0,
      duplicateQuestions: 0,
      failed: 0,
    };

    // Track failures with details for retry
    const failures: Array<{ recordId: string; error: string }> = [];

    try {
      // Get all quiz results (in production, this should be paginated)
      const quizResults = await ctx.db.query('quizResults').take(batchSize);

      for (const quizResult of quizResults) {
        try {
          // Skip if already has a sessionId (already migrated)
          if (quizResult.sessionId && quizResult.sessionId.startsWith('migrated_')) {
            continue;
          }

          // Generate a sessionId for this quiz result
          const sessionId = quizResult.sessionId || `migrated_${quizResult._id.substring(0, 8)}`;

          // Process each answer in the quiz result
          for (const answer of quizResult.answers) {
            // Check if a similar question already exists for this user
            const existingQuestion = await ctx.db
              .query('questions')
              .withIndex('by_user', (q) => q.eq('userId', quizResult.userId))
              .filter((q) =>
                q.and(
                  q.eq(q.field('topic'), quizResult.topic),
                  q.eq(q.field('question'), answer.question),
                  q.eq(q.field('correctAnswer'), answer.correctAnswer)
                )
              )
              .first();

            let questionId: Id<'questions'>;

            if (existingQuestion) {
              // Question already exists, use its ID
              questionId = existingQuestion._id;
              stats.duplicateQuestions++;

              // Update the denormalized stats if not in dry run
              if (!dryRun) {
                await ctx.db.patch(questionId, {
                  attemptCount: existingQuestion.attemptCount + 1,
                  correctCount: existingQuestion.correctCount + (answer.isCorrect ? 1 : 0),
                  lastAttemptedAt: quizResult.completedAt,
                });
              }
            } else {
              // Create new question
              if (!dryRun) {
                questionId = await ctx.db.insert('questions', {
                  userId: quizResult.userId,
                  topic: quizResult.topic,
                  question: answer.question,
                  type: answer.type || 'multiple-choice',
                  options: answer.options,
                  correctAnswer: answer.correctAnswer,
                  explanation: undefined,
                  generatedAt: quizResult.completedAt, // Best approximation
                  attemptCount: 1,
                  correctCount: answer.isCorrect ? 1 : 0,
                  lastAttemptedAt: quizResult.completedAt,
                });
                stats.questionsCreated++;
              } else {
                // In dry run, generate a fake ID
                questionId =
                  `dry_run_${Math.random().toString(36).substring(7)}` as Id<'questions'>;
                stats.questionsCreated++;
              }
            }

            // Create interaction record
            if (!dryRun && questionId && !questionId.toString().startsWith('dry_run_')) {
              await ctx.db.insert('interactions', {
                userId: quizResult.userId,
                questionId: questionId,
                userAnswer: answer.userAnswer,
                isCorrect: answer.isCorrect,
                attemptedAt: quizResult.completedAt,
                timeSpent: undefined, // Not available in old data
                context: {
                  sessionId: sessionId,
                  isRetry: false,
                },
              });
              stats.interactionsCreated++;
            } else if (dryRun) {
              stats.interactionsCreated++;
            }
          }

          // Mark the quiz result as migrated by updating its sessionId
          if (!dryRun) {
            await ctx.db.patch(quizResult._id, {
              sessionId: sessionId,
            });
          }

          stats.totalProcessed++;
        } catch (err) {
          // Handle error with proper type checking
          const error = err instanceof Error ? err : new Error(String(err));

          failures.push({
            recordId: quizResult._id,
            error: error.message,
          });
          stats.failed++;
        }
      }

      // Determine migration status based on failures
      const status =
        failures.length === 0
          ? ('completed' as const)
          : failures.length === stats.totalProcessed
            ? ('failed' as const)
            : ('partial' as const);

      return {
        status,
        dryRun,
        stats,
        failures: failures.length > 0 ? failures : undefined,
        message: dryRun
          ? `Dry run: Would process ${stats.totalProcessed} quizzes (${stats.failed} errors)`
          : status === 'completed'
            ? `Successfully migrated ${stats.totalProcessed} quiz results`
            : status === 'partial'
              ? `Partially completed: ${stats.totalProcessed - stats.failed} succeeded, ${stats.failed} failed`
              : `Migration failed: All ${stats.failed} attempts failed`,
      };
    } catch (err) {
      // Handle catastrophic migration failure
      const error = err instanceof Error ? err : new Error(String(err));

      return {
        status: 'failed' as const,
        dryRun,
        stats,
        failures: [
          {
            recordId: 'N/A',
            error: error.message,
          },
        ],
        message: `Migration failed: ${error.message}`,
      };
    }
  },
});

// Helper function to check if a quiz result has been migrated
export const isQuizResultMigrated = mutation({
  args: {
    quizResultId: v.id('quizResults'),
  },
  handler: async (ctx, args) => {
    const quizResult = await ctx.db.get(args.quizResultId);
    if (!quizResult) return false;

    return quizResult.sessionId?.startsWith('migrated_') || false;
  },
});

// Function to rollback migration for a specific user (for testing/recovery)
export const rollbackMigrationForUser = internalMutation({
  args: {
    userId: v.id('users'),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<MigrationResult<RollbackStats>> => {
    const dryRun = args.dryRun || true; // Default to dry run for safety

    const stats = {
      questionsDeleted: 0,
      interactionsDeleted: 0,
      quizResultsReset: 0,
    };

    try {
      // Find all migrated quiz results for this user
      const migratedQuizResults = await ctx.db
        .query('quizResults')
        .withIndex('by_user', (q) => q.eq('userId', args.userId))
        .filter((q) => q.neq(q.field('sessionId'), undefined))
        .collect();

      const migratedSessionIds = migratedQuizResults
        .filter((qr) => qr.sessionId?.startsWith('migrated_'))
        .map((qr) => qr.sessionId!);

      if (migratedSessionIds.length === 0) {
        return {
          status: 'completed' as const,
          dryRun,
          stats,
          message: 'No migrated data found for this user',
        };
      }

      // Delete interactions created from migration
      const interactions = await ctx.db
        .query('interactions')
        .withIndex('by_user', (q) => q.eq('userId', args.userId))
        .collect();

      for (const interaction of interactions) {
        if (
          interaction.context?.sessionId &&
          migratedSessionIds.includes(interaction.context.sessionId)
        ) {
          if (!dryRun) {
            await ctx.db.delete(interaction._id);
          }
          stats.interactionsDeleted++;
        }
      }

      // Reset sessionId on quiz results
      for (const quizResult of migratedQuizResults) {
        if (quizResult.sessionId?.startsWith('migrated_')) {
          if (!dryRun) {
            await ctx.db.patch(quizResult._id, {
              sessionId: undefined,
            });
          }
          stats.quizResultsReset++;
        }
      }

      // Note: We don't delete questions as they might be used by other non-migrated interactions

      return {
        status: 'completed' as const,
        dryRun,
        stats,
        message: dryRun
          ? 'Rollback dry run completed - no data was modified'
          : 'Rollback completed successfully',
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      return {
        status: 'failed' as const,
        dryRun,
        stats,
        failures: [
          {
            recordId: args.userId,
            error: error.message,
          },
        ],
        message: `Rollback failed: ${error.message}`,
      };
    }
  },
});

/**
 * Count questions that still have the deprecated difficulty field
 * @returns Statistics about questions with difficulty field
 */
export const countQuestionsWithDifficulty = query({
  args: {},
  handler: async (ctx) => {
    const allQuestions = await ctx.db.query('questions').collect();
    const questionsWithDifficulty = allQuestions.filter(
      (q) => 'difficulty' in q && q.difficulty !== undefined
    );

    return {
      total: allQuestions.length,
      withDifficulty: questionsWithDifficulty.length,
      percentage:
        allQuestions.length > 0
          ? ((questionsWithDifficulty.length / allQuestions.length) * 100).toFixed(2)
          : '0',
    };
  },
});

/**
 * Public wrapper to run difficulty removal migration
 * Requires authenticated admin user via Clerk
 *
 * @security Admin-only access controlled via ADMIN_EMAILS environment variable
 *
 * Setup:
 * 1. Add ADMIN_EMAILS to Convex environment variables in dashboard
 * 2. Set value to comma-separated list: "admin@example.com,ops@example.com"
 * 3. Ensure you're authenticated via Clerk when calling this mutation
 *
 * Usage:
 * ```typescript
 * // Dry run first
 * await convex.mutation(api.migrations.runDifficultyRemoval, { dryRun: true });
 *
 * // Production run
 * await convex.mutation(api.migrations.runDifficultyRemoval, {});
 * ```
 *
 * Audit: All migration attempts (authorized and unauthorized) are logged with user details
 */
export const runDifficultyRemoval = mutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Require authenticated user
    const user = await requireUserFromClerk(ctx);

    // Check if user is admin (via environment variable)
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim());

    if (!adminEmails.includes(user.email)) {
      const migrationLogger = createLogger({
        module: 'migrations',
        function: 'runDifficultyRemoval',
      });

      migrationLogger.warn('Unauthorized migration attempt', {
        event: 'migration.unauthorized',
        userId: user._id,
        userEmail: user.email,
      });

      throw new Error('Unauthorized: Admin access required');
    }

    const migrationLogger = createLogger({
      module: 'migrations',
      function: 'runDifficultyRemoval',
    });

    // Log who ran the migration for audit trail
    migrationLogger.info('Migration started by admin', {
      event: 'migration.difficulty-removal.start',
      userId: user._id,
      userEmail: user.email,
      dryRun: args.dryRun || false,
    });

    return await removeDifficultyFromQuestionsInternal(ctx, {
      batchSize: args.batchSize,
      dryRun: args.dryRun,
    });
  },
});

/**
 * Internal helper for difficulty removal migration
 * This migration removes the vestigial difficulty field that was removed
 * from the schema but still exists in older documents.
 */
async function removeDifficultyFromQuestionsInternal(
  ctx: MutationCtx,
  args: {
    batchSize?: number;
    dryRun?: boolean;
  }
): Promise<MigrationResult<DifficultyRemovalStats>> {
  const batchSize = args.batchSize || DEFAULT_DIFFICULTY_REMOVAL_BATCH_SIZE;
  const dryRun = args.dryRun || false;

  const migrationLogger = createLogger({
    module: 'migrations',
    function: 'removeDifficultyFromQuestions',
  });

  const stats = {
    totalProcessed: 0,
    updated: 0,
    alreadyMigrated: 0,
    errors: 0,
  };

  try {
    // Process all questions using cursor-based pagination
    let paginationResult = await ctx.db.query('questions').paginate({
      numItems: batchSize,
      cursor: null,
    });

    // Process first batch
    await processBatch(paginationResult.page);

    // Continue processing remaining batches
    while (!paginationResult.isDone) {
      paginationResult = await ctx.db.query('questions').paginate({
        numItems: batchSize,
        cursor: paginationResult.continueCursor,
      });

      await processBatch(paginationResult.page);
    }

    // Helper function to process a batch of questions
    async function processBatch(questions: typeof paginationResult.page) {
      for (const question of questions) {
        stats.totalProcessed++;

        // Check if question has difficulty field
        if ('difficulty' in question && question.difficulty !== undefined) {
          if (!dryRun) {
            // Use replace to remove the field entirely
            // Convex doesn't have a built-in way to delete fields, so we reconstruct
            // IMPORTANT: Strip system fields (_id, _creationTime) before calling replace()
            // Convex's db.replace() rejects objects that include system fields
            const {
              difficulty: _difficulty,
              _id,
              _creationTime,
              ...questionWithoutDifficulty
            } = question;

            await ctx.db.replace(question._id, questionWithoutDifficulty);
          }
          stats.updated++;

          if (stats.updated % PROGRESS_LOG_INTERVAL === 0) {
            migrationLogger.info(`Migration progress: ${stats.updated} questions updated`);
          }
        } else {
          stats.alreadyMigrated++;
        }
      }

      // Log batch completion
      migrationLogger.info('Batch completed', {
        event: dryRun ? 'migration.dry-run.batch' : 'migration.batch',
        batchSize: questions.length,
        totalProcessed: stats.totalProcessed,
        updated: stats.updated,
        alreadyMigrated: stats.alreadyMigrated,
      });
    }

    migrationLogger.info('Migration completed', {
      event: 'migration.difficulty-removal.complete',
      dryRun,
      stats,
    });

    return {
      status: 'completed' as const,
      dryRun,
      stats,
      message: dryRun
        ? `Dry run: Would update ${stats.updated} questions, ${stats.alreadyMigrated} already migrated`
        : `Successfully updated ${stats.updated} questions, ${stats.alreadyMigrated} already migrated`,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    migrationLogger.error('Migration failed', {
      event: 'migration.difficulty-removal.error',
      error: error.message,
      stack: error.stack,
      stats,
    });

    return {
      status: 'failed' as const,
      dryRun,
      stats,
      failures: [
        {
          recordId: 'N/A',
          error: error.message,
        },
      ],
      message: `Migration failed: ${error.message}`,
    };
  }
}

/**
 * Initialize userStats for all existing users
 *
 * This migration creates userStats records for existing users by counting
 * their questions by state. New users after this migration will have stats
 * initialized automatically when they create their first question.
 *
 * Idempotent: Skips users who already have userStats records.
 * Processes users in batches to avoid memory issues.
 *
 * Usage:
 * ```typescript
 * // Dry run first to see what would be done
 * await convex.mutation(api.migrations.initializeUserStats, { dryRun: true });
 *
 * // Production run
 * await convex.mutation(api.migrations.initializeUserStats, {});
 * ```
 */
export const initializeUserStats = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<MigrationResult<UserStatsInitStats>> => {
    const batchSize = args.batchSize || 10; // Small batches to avoid memory issues
    const dryRun = args.dryRun || false;

    const migrationLogger = createLogger({
      module: 'migrations',
      function: 'initializeUserStats',
    });

    const stats = {
      totalUsers: 0,
      initialized: 0,
      alreadyExist: 0,
      errors: 0,
    };

    const failures: Array<{ recordId: string; error: string }> = [];

    try {
      // Process all users using cursor-based pagination
      let paginationResult = await ctx.db.query('users').paginate({
        numItems: batchSize,
        cursor: null,
      });

      // Process first batch
      await processBatch(paginationResult.page);

      // Continue processing remaining batches
      while (!paginationResult.isDone) {
        paginationResult = await ctx.db.query('users').paginate({
          numItems: batchSize,
          cursor: paginationResult.continueCursor,
        });

        await processBatch(paginationResult.page);
      }

      // Helper function to process a batch of users
      async function processBatch(users: typeof paginationResult.page) {
        for (const user of users) {
          stats.totalUsers++;

          try {
            // Check if userStats already exists
            const existingStats = await ctx.db
              .query('userStats')
              .withIndex('by_user', (q) => q.eq('userId', user._id))
              .first();

            if (existingStats) {
              stats.alreadyExist++;
              continue;
            }

            // Count questions by state (excluding deleted)
            const questions = await ctx.db
              .query('questions')
              .withIndex('by_user', (q) => q.eq('userId', user._id))
              .filter((q) => q.eq(q.field('deletedAt'), undefined))
              .collect();

            // Calculate stats from questions
            let newCount = 0;
            let learningCount = 0;
            let matureCount = 0;
            let earliestNextReview: number | undefined = undefined;

            for (const question of questions) {
              // Count by state
              if (!question.state || question.state === 'new') {
                newCount++;
              } else if (question.state === 'learning' || question.state === 'relearning') {
                learningCount++;
              } else if (question.state === 'review') {
                matureCount++;
              }

              // Track earliest nextReview time
              if (question.nextReview) {
                if (!earliestNextReview || question.nextReview < earliestNextReview) {
                  earliestNextReview = question.nextReview;
                }
              }
            }

            // Insert userStats record
            if (!dryRun) {
              await ctx.db.insert('userStats', {
                userId: user._id,
                totalCards: questions.length,
                newCount,
                learningCount,
                matureCount,
                nextReviewTime: earliestNextReview,
                lastCalculated: Date.now(),
              });
            }

            stats.initialized++;

            if (stats.initialized % 10 === 0) {
              migrationLogger.info(`Migration progress: ${stats.initialized} users initialized`);
            }
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            failures.push({
              recordId: user._id,
              error: error.message,
            });
            stats.errors++;
          }
        }

        // Log batch completion
        migrationLogger.info('Batch completed', {
          event: dryRun
            ? 'migration.user-stats-init.batch.dry-run'
            : 'migration.user-stats-init.batch',
          batchSize: users.length,
          totalUsers: stats.totalUsers,
          initialized: stats.initialized,
          alreadyExist: stats.alreadyExist,
        });
      }

      migrationLogger.info('Migration completed', {
        event: 'migration.user-stats-init.complete',
        dryRun,
        stats,
      });

      const status =
        failures.length === 0
          ? ('completed' as const)
          : failures.length === stats.totalUsers
            ? ('failed' as const)
            : ('partial' as const);

      return {
        status,
        dryRun,
        stats,
        failures: failures.length > 0 ? failures : undefined,
        message: dryRun
          ? `Dry run: Would initialize ${stats.initialized} users, ${stats.alreadyExist} already exist`
          : status === 'completed'
            ? `Successfully initialized userStats for ${stats.initialized} users`
            : status === 'partial'
              ? `Partially completed: ${stats.initialized} succeeded, ${stats.errors} failed`
              : `Migration failed: All ${stats.errors} attempts failed`,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      migrationLogger.error('Migration failed', {
        event: 'migration.user-stats-init.error',
        error: error.message,
        stack: error.stack,
        stats,
      });

      return {
        status: 'failed' as const,
        dryRun,
        stats,
        failures: [
          {
            recordId: 'N/A',
            error: error.message,
          },
        ],
        message: `Migration failed: ${error.message}`,
      };
    }
  },
});
