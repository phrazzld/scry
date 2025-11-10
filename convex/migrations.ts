import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { internalMutation, mutation, MutationCtx, query } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { upsertEmbeddingForQuestion } from './lib/embeddingHelpers';
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
 * Default batch size for topic field removal migration
 * Larger batch is safe since it's a simple field deletion operation
 */
const DEFAULT_TOPIC_REMOVAL_BATCH_SIZE = 500;

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
 * Statistics for topic field removal migration
 */
type TopicRemovalStats = {
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
    // Using function declaration for hoisting (called before declaration in loop)
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
 * Internal helper for topic removal migration
 * This migration removes the vestigial topic field that was removed
 * from the schema but still exists in older documents.
 */
async function removeTopicFromQuestionsInternal(
  ctx: MutationCtx,
  args: {
    batchSize?: number;
    dryRun?: boolean;
  }
): Promise<MigrationResult<TopicRemovalStats>> {
  const batchSize = args.batchSize || DEFAULT_TOPIC_REMOVAL_BATCH_SIZE;
  const dryRun = args.dryRun || false;

  const migrationLogger = createLogger({
    module: 'migrations',
    function: 'removeTopicFromQuestions',
  });

  const stats = {
    totalProcessed: 0,
    updated: 0,
    alreadyMigrated: 0,
    errors: 0,
  };

  try {
    migrationLogger.info('Starting migration with cursor-based pagination', {
      event: 'migration.topic-removal.start',
      batchSize,
      dryRun,
    });

    // Process all questions using cursor-based pagination
    // This scales safely to 10K+ questions without hitting Convex query limits
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
    // Using function declaration for hoisting (called before declaration in loop)
    async function processBatch(questions: typeof paginationResult.page) {
      for (const question of questions) {
        stats.totalProcessed++;

        // Check if question has topic field (use runtime check, not TypeScript)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const questionData = question as any;

        // Debug logging for first question
        if (stats.totalProcessed === 1) {
          migrationLogger.info('First question check', {
            hasTopicField: 'topic' in questionData,
            topicValue: questionData.topic,
            allKeys: Object.keys(questionData),
          });
        }

        // Check if the topic property exists (not just if it's undefined)
        if ('topic' in questionData) {
          if (!dryRun) {
            // Use replace to remove the field entirely
            // Convex doesn't have a built-in way to delete fields, so we reconstruct
            // IMPORTANT: Strip system fields (_id, _creationTime) before calling replace()
            // Convex's db.replace() rejects objects that include system fields
            const { topic: _topic, _id, _creationTime, ...questionWithoutTopic } = questionData;

            await ctx.db.replace(question._id, questionWithoutTopic);
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
      event: 'migration.topic-removal.complete',
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
      event: 'migration.topic-removal.error',
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
 * Remove topic field from all existing questions
 *
 * This migration removes the topic field from the questions table schema.
 * The topic field was removed in favor of prompt-based generation without
 * rigid topic categorization.
 *
 * Idempotent: Skips questions that don't have the topic field.
 * Safe: Field removal doesn't affect any other functionality.
 *
 * Usage:
 * ```typescript
 * // Dry run first to see what would be done
 * await convex.mutation(api.migrations.removeTopicFromQuestions, { dryRun: true });
 *
 * // Production run
 * await convex.mutation(api.migrations.removeTopicFromQuestions, {});
 * ```
 */
export const removeTopicFromQuestions = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<MigrationResult<TopicRemovalStats>> => {
    return await removeTopicFromQuestionsInternal(ctx, args);
  },
});

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
      // Using function declaration for hoisting (called before declaration in loop)
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
                dueNowCount: 0, // Will be backfilled by initializeDueNowCount migration
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

/**
 * Initialize dueNowCount field in userStats for badge reactivity
 *
 * Background: Time-filtered reactive queries don't work in Convex. When a card's nextReview
 * changes from "due now" to "future", Convex doesn't detect this affects queries filtering
 * on that index. Solution: Maintain time-aware counter updated by mutations.
 *
 * This migration backfills dueNowCount for all existing users by counting cards where
 * nextReview <= now (at migration time).
 */
export const initializeDueNowCount = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const now = Date.now();
    const migrationLogger = createLogger({
      module: 'migrations',
      function: 'initializeDueNowCount',
    });

    migrationLogger.info('Starting dueNowCount initialization migration', {
      event: 'migration.due-now-count.start',
      dryRun,
    });

    const stats = {
      totalUsers: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    const failures: Array<{ recordId: string; error: string }> = [];

    try {
      // Get all userStats records
      const allStats = await ctx.db.query('userStats').collect();
      stats.totalUsers = allStats.length;

      migrationLogger.info(`Found ${stats.totalUsers} userStats records to process`);

      for (const userStats of allStats) {
        try {
          // Count cards where nextReview <= now for this user
          const dueCards = await ctx.db
            .query('questions')
            .withIndex('by_user_next_review', (q) =>
              q.eq('userId', userStats.userId).lte('nextReview', now)
            )
            .filter((q) =>
              q.and(q.eq(q.field('deletedAt'), undefined), q.eq(q.field('archivedAt'), undefined))
            )
            .collect();

          const dueNowCount = dueCards.length;

          if (!dryRun) {
            await ctx.db.patch(userStats._id, { dueNowCount });
          }

          stats.updated++;

          if (stats.updated % 10 === 0) {
            migrationLogger.info(
              `Migration progress: ${stats.updated}/${stats.totalUsers} users processed`
            );
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          failures.push({
            recordId: userStats._id,
            error: error.message,
          });
          stats.errors++;
        }
      }

      migrationLogger.info('Migration completed', {
        event: 'migration.due-now-count.complete',
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
          ? `Dry run: Would update ${stats.updated} users`
          : status === 'completed'
            ? `Successfully initialized dueNowCount for ${stats.updated} users`
            : status === 'partial'
              ? `Partially completed: ${stats.updated} succeeded, ${stats.errors} failed`
              : `Migration failed: All ${stats.errors} attempts failed`,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      migrationLogger.error('Migration failed', {
        event: 'migration.due-now-count.error',
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

/**
 * Diagnostic query to check dueNowCount migration status
 */
export const checkDueNowCountMigration = query({
  args: {},
  handler: async (ctx) => {
    // No auth required - this is an admin diagnostic query
    const stats = await ctx.db.query('userStats').collect();
    const missing = stats.filter((s) => s.dueNowCount === undefined).length;

    return {
      total: stats.length,
      missing,
      migrated: stats.length - missing,
      complete: missing === 0,
    };
  },
});

/**
 * Statistics for embeddings migration
 */
type EmbeddingsMigrationStats = {
  totalProcessed: number;
  migrated: number; // Copied to questionEmbeddings
  cleaned: number; // Removed from questions table
  skipped: number;
  errors: number;
};

/**
 * Migration: Move embeddings from questions table to questionEmbeddings table
 *
 * **Phase 1 of 3-phase migration pattern:**
 * - Copies existing embeddings from questions.embedding to questionEmbeddings table
 * - Dual-writes during transition period (both tables populated)
 * - Phase 2: Remove embedding fields from questions schema after migration completes
 * - Phase 3: Remove backward compatibility dual-write code
 *
 * **Migration strategy:**
 * 1. Iterate through all questions that have embeddings
 * 2. Create corresponding record in questionEmbeddings table
 * 3. Preserve embedding vector and generation timestamp
 * 4. Duplicate userId for security filtering in vector search
 *
 * **Safety features:**
 * - Dry-run mode to preview changes
 * - Batch processing with progress logging
 * - Idempotent (safe to re-run)
 * - Validates embedding dimensions (768)
 * - Skips questions without embeddings
 *
 * @param dryRun - If true, only simulate the migration without making changes
 * @param batchSize - Number of questions to process per batch (default 100)
 */
export const migrateEmbeddingsToSeparateTable = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MigrationResult<EmbeddingsMigrationStats>> => {
    const dryRun = args.dryRun ?? false;
    const batchSize = args.batchSize ?? 100;

    const migrationLogger = createLogger({
      module: 'migrations',
      function: 'migrateEmbeddingsToSeparateTable',
    });

    migrationLogger.info('Migration started', {
      dryRun,
      batchSize,
    });

    const stats: EmbeddingsMigrationStats = {
      totalProcessed: 0,
      migrated: 0,
      cleaned: 0,
      skipped: 0,
      errors: 0,
    };

    // Use cursor-based pagination to avoid memory exhaustion
    // Streaming batches sequentially without loading entire table
    let cursor = null;
    let hasMore = true;

    migrationLogger.info('Starting cursor-based migration', {
      batchSize,
    });

    while (hasMore) {
      // Fetch next batch using cursor
      const page = await ctx.db.query('questions').paginate({
        cursor: cursor,
        numItems: batchSize,
      });

      hasMore = page.isDone === false;
      cursor = page.continueCursor;

      // Process this batch
      for (const question of page.page) {
        stats.totalProcessed++;

        // Runtime property check (not TypeScript type erasure)
        const hasEmbedding =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'embedding' in (question as any) && (question as any).embedding !== undefined;

        if (!hasEmbedding) {
          stats.skipped++;
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const embedding = (question as any).embedding as number[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const embeddingGeneratedAt = (question as any).embeddingGeneratedAt as number | undefined;

        // Validate embedding dimensions
        if (embedding.length !== 768) {
          migrationLogger.warn('Invalid embedding dimensions', {
            questionId: question._id,
            dimensions: embedding.length,
            expected: 768,
          });
          stats.errors++;
          continue;
        }

        // Check if embedding already exists in new table
        const existingEmbedding = await ctx.db
          .query('questionEmbeddings')
          .withIndex('by_question', (q) => q.eq('questionId', question._id))
          .first();

        if (!dryRun) {
          try {
            // Only create if doesn't exist in new table
            if (!existingEmbedding) {
              await upsertEmbeddingForQuestion(
                ctx,
                question._id,
                question.userId,
                embedding,
                embeddingGeneratedAt ?? Date.now()
              );
              stats.migrated++;
            } else {
              stats.skipped++;
            }

            // Always cleanup from questions table (even if already in new table)
            await ctx.db.patch(question._id, {
              embedding: undefined,
              embeddingGeneratedAt: undefined,
            });
            stats.cleaned++;
          } catch (error) {
            migrationLogger.error('Failed to migrate/cleanup embedding', {
              questionId: question._id,
              error: error instanceof Error ? error.message : String(error),
            });
            stats.errors++;
          }
        } else {
          // Dry run: count what would happen
          if (!existingEmbedding) {
            stats.migrated++;
          } else {
            stats.skipped++;
          }
          stats.cleaned++;
        }

        // Log progress every 100 records
        if (stats.totalProcessed % PROGRESS_LOG_INTERVAL === 0) {
          migrationLogger.info('Migration progress', {
            ...stats,
          });
        }
      }
    }

    const message = dryRun
      ? `Dry run completed: Would migrate ${stats.migrated} embeddings and clean ${stats.cleaned} from questions table (${stats.skipped} skipped, ${stats.errors} errors)`
      : `Migration completed: Migrated ${stats.migrated} embeddings and cleaned ${stats.cleaned} from questions table (${stats.skipped} skipped, ${stats.errors} errors)`;

    migrationLogger.info('Migration finished', {
      ...stats,
      message,
      dryRun,
    });

    return {
      status: stats.errors > 0 ? 'partial' : 'completed',
      dryRun,
      stats,
      message,
    };
  },
});

/**
 * Diagnostic query to check embeddings migration status
 *
 * Returns count of questions with embeddings that still need to be migrated.
 * After migration completes, this should return { remaining: 0 }.
 *
 * Uses sampling to avoid unbounded queries. When isApproximate=true, counts
 * are based on first 1000 records from each table.
 */
export const migrateEmbeddingsToSeparateTableDiagnostic = query({
  args: {},
  handler: async (ctx) => {
    const SAMPLE_LIMIT = 1000;

    // Sample questions to avoid unbounded query
    const allQuestions = await ctx.db.query('questions').take(SAMPLE_LIMIT);

    // Runtime property check (not TypeScript type erasure)

    const questionsWithEmbeddings = allQuestions.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q) => 'embedding' in (q as any) && (q as any).embedding !== undefined
    );

    // Sample embeddings in new table
    const embeddingsInNewTable = await ctx.db.query('questionEmbeddings').take(SAMPLE_LIMIT);
    const embeddingQuestionIds = new Set(embeddingsInNewTable.map((e) => e.questionId));

    // Count questions with embeddings but NOT in new table
    const needsMigration = questionsWithEmbeddings.filter(
      (q) => !embeddingQuestionIds.has(q._id) // O(1) lookup instead of O(n)!
    );

    return {
      questionsWithEmbeddings: questionsWithEmbeddings.length,
      embeddingsInNewTable: embeddingsInNewTable.length,
      remaining: needsMigration.length,
      complete: needsMigration.length === 0,
      isApproximate: allQuestions.length === SAMPLE_LIMIT,
    };
  },
});
