import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import { createLogger } from './lib/logger';

// Migration status tracking
export const getMigrationStatus = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Add admin authentication check
    const migrationLogger = createLogger({ module: 'migrations', function: 'getMigrationStatus' });

    // Log the request for audit purposes
    migrationLogger.info('Migration status requested', {
      event: 'migration.status.request',
      sessionTokenPrefix: args.sessionToken.substring(0, 8) + '...',
    });

    // Future: Use ctx to query migration progress
    // const migrationLogs = await ctx.db.query("migrationLogs")...

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
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;
    const dryRun = args.dryRun || false;

    const stats = {
      totalProcessed: 0,
      questionsCreated: 0,
      interactionsCreated: 0,
      duplicateQuestions: 0,
      errors: [] as string[],
    };

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
        } catch (error) {
          stats.errors.push(`Error processing quiz ${quizResult._id}: ${(error as Error).message}`);
        }
      }

      return {
        success: true,
        dryRun,
        stats,
        message: dryRun
          ? 'Dry run completed - no data was modified'
          : 'Migration completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        dryRun,
        stats,
        error: (error as Error).message,
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
  handler: async (ctx, args) => {
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
          success: true,
          message: 'No migrated data found for this user',
          stats,
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
        success: true,
        dryRun,
        stats,
        message: dryRun
          ? 'Rollback dry run completed - no data was modified'
          : 'Rollback completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        dryRun,
        stats,
        error: (error as Error).message,
      };
    }
  },
});

/**
 * Count questions that still have the deprecated difficulty field
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
 * Remove deprecated difficulty field from all questions
 *
 * This migration removes the vestigial difficulty field that was removed
 * from the schema but still exists in older documents.
 */
export const removeDifficultyFromQuestions = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 500;
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
      // Get all questions in batches
      const allQuestions = await ctx.db.query('questions').take(batchSize);

      for (const question of allQuestions) {
        stats.totalProcessed++;

        // Check if question has difficulty field
        if ('difficulty' in question && question.difficulty !== undefined) {
          if (!dryRun) {
            // Use replace to remove the field entirely
            // Convex doesn't have a built-in way to delete fields, so we reconstruct
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { difficulty: _difficulty, ...questionWithoutDifficulty } = question;

            await ctx.db.replace(question._id, questionWithoutDifficulty);
          }
          stats.updated++;

          if (stats.updated % 100 === 0) {
            migrationLogger.info(`Migration progress: ${stats.updated} questions updated`);
          }
        } else {
          stats.alreadyMigrated++;
        }
      }

      migrationLogger.info('Migration completed', {
        event: 'migration.difficulty-removal.complete',
        dryRun,
        stats,
      });

      return {
        success: true,
        dryRun,
        stats,
        message: dryRun
          ? `Dry run: Would update ${stats.updated} questions, ${stats.alreadyMigrated} already migrated`
          : `Successfully updated ${stats.updated} questions, ${stats.alreadyMigrated} already migrated`,
      };
    } catch (error) {
      migrationLogger.error('Migration failed', {
        event: 'migration.difficulty-removal.error',
        error: (error as Error).message,
        stats,
      });

      return {
        success: false,
        dryRun,
        stats,
        error: (error as Error).message,
      };
    }
  },
});
