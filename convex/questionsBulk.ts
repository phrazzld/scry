/**
 * Bulk Question Operations
 *
 * Multi-question mutations for archive, delete, restore workflows.
 * Hides atomic transaction patterns and ownership verification complexity.
 * All operations follow atomic validation: fetch ALL, validate ALL, mutate ALL.
 *
 * This ensures either all operations succeed or all fail - no partial states.
 */
import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { trackEvent } from './lib/analytics';
import { deleteEmbeddingForQuestion } from './lib/embeddingHelpers';
import { updateStatsCounters } from './lib/userStatsHelpers';
import { validateBulkOwnership } from './lib/validation';

/**
 * Archive multiple questions (bulk operation)
 *
 * Sets archivedAt timestamp to postpone questions without deleting them.
 * Archived questions are hidden from active review but preserved for later.
 */
export const archiveQuestions = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Atomic validation via shared helper
    await validateBulkOwnership(ctx, userId, args.questionIds);

    // All validations passed - execute mutations in parallel
    await Promise.all(
      args.questionIds.map((id) =>
        ctx.db.patch(id, {
          archivedAt: now,
          updatedAt: now,
        })
      )
    );

    trackEvent('Question Archived', {
      userId: String(userId),
      questionCount: args.questionIds.length,
      source: 'manual',
    });

    return { archived: args.questionIds.length };
  },
});

/**
 * Unarchive multiple questions (bulk operation)
 *
 * Clears archivedAt timestamp to return questions to active review queue.
 */
export const unarchiveQuestions = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Atomic validation via shared helper
    await validateBulkOwnership(ctx, userId, args.questionIds);

    // All validations passed - execute mutations in parallel
    await Promise.all(
      args.questionIds.map((id) =>
        ctx.db.patch(id, {
          archivedAt: undefined,
          updatedAt: now,
        })
      )
    );

    trackEvent('Question Restored', {
      userId: String(userId),
      questionCount: args.questionIds.length,
      source: 'manual',
    });

    return { unarchived: args.questionIds.length };
  },
});

/**
 * Bulk soft delete questions
 *
 * Marks multiple questions as deleted but preserves them in database
 * for recovery. Preserves all FSRS data and history.
 */
export const bulkDelete = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Atomic validation via shared helper (also fetches questions for stats)
    const questions = await validateBulkOwnership(ctx, userId, args.questionIds);

    // All validations passed - execute mutations in parallel
    await Promise.all(
      args.questionIds.map((id) =>
        ctx.db.patch(id, {
          deletedAt: now,
          updatedAt: now,
        })
      )
    );

    // Update userStats: Decrement counters for deleted questions (incremental bandwidth optimization)
    let totalDecrement = 0;
    let newDecrement = 0;
    let learningDecrement = 0;
    let matureDecrement = 0;

    for (const question of questions) {
      totalDecrement++;
      if (!question.state || question.state === 'new') {
        newDecrement++;
      } else if (question.state === 'learning' || question.state === 'relearning') {
        learningDecrement++;
      } else if (question.state === 'review') {
        matureDecrement++;
      }
    }

    await updateStatsCounters(ctx, userId, {
      totalCards: -totalDecrement,
      newCount: -newDecrement,
      learningCount: -learningDecrement,
      matureCount: -matureDecrement,
    });

    trackEvent('Question Deleted', {
      userId: String(userId),
      questionCount: args.questionIds.length,
      source: 'manual',
    });

    return { deleted: args.questionIds.length };
  },
});

/**
 * Restore questions from trash (undo soft delete)
 *
 * Clears the deletedAt timestamp, moving questions back from trash to active state.
 * This is the inverse operation of bulkDelete, enabling undo functionality.
 * Preserves all FSRS data and history.
 */
export const restoreQuestions = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Atomic validation via shared helper (also fetches questions for stats)
    const questions = await validateBulkOwnership(ctx, userId, args.questionIds);

    // All validations passed - execute mutations in parallel
    await Promise.all(
      args.questionIds.map((id) =>
        ctx.db.patch(id, {
          deletedAt: undefined, // Clear soft delete
          updatedAt: now,
        })
      )
    );

    // Update userStats: Increment counters for restored questions (incremental bandwidth optimization)
    let totalIncrement = 0;
    let newIncrement = 0;
    let learningIncrement = 0;
    let matureIncrement = 0;

    for (const question of questions) {
      totalIncrement++;
      if (!question.state || question.state === 'new') {
        newIncrement++;
      } else if (question.state === 'learning' || question.state === 'relearning') {
        learningIncrement++;
      } else if (question.state === 'review') {
        matureIncrement++;
      }
    }

    await updateStatsCounters(ctx, userId, {
      totalCards: totalIncrement,
      newCount: newIncrement,
      learningCount: learningIncrement,
      matureCount: matureIncrement,
    });

    trackEvent('Question Restored', {
      userId: String(userId),
      questionCount: args.questionIds.length,
      source: 'manual',
    });

    return { restored: args.questionIds.length };
  },
});

/**
 * Permanently delete questions (irreversible)
 *
 * Actually removes questions from the database. This operation cannot be undone.
 * Should only be called from trash view with explicit user confirmation.
 */
export const permanentlyDelete = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Atomic validation via shared helper (also fetches questions for stats)
    const questions = await validateBulkOwnership(ctx, userId, args.questionIds);

    // Delete associated embeddings from questionEmbeddings table
    await Promise.all(args.questionIds.map((id) => deleteEmbeddingForQuestion(ctx, id)));

    // All validations passed - execute deletions in parallel
    await Promise.all(args.questionIds.map((id) => ctx.db.delete(id)));

    // Update userStats: Decrement counters only for questions not already soft-deleted
    // (soft-deleted questions were already decremented by bulkDelete)
    let totalDecrement = 0;
    let newDecrement = 0;
    let learningDecrement = 0;
    let matureDecrement = 0;

    for (const question of questions) {
      // Only decrement if NOT already soft-deleted
      if (!question.deletedAt) {
        totalDecrement++;
        if (!question.state || question.state === 'new') {
          newDecrement++;
        } else if (question.state === 'learning' || question.state === 'relearning') {
          learningDecrement++;
        } else if (question.state === 'review') {
          matureDecrement++;
        }
      }
    }

    // Only update if there are non-deleted questions to decrement
    if (totalDecrement > 0) {
      await updateStatsCounters(ctx, userId, {
        totalCards: -totalDecrement,
        newCount: -newDecrement,
        learningCount: -learningDecrement,
        matureCount: -matureDecrement,
      });
    }

    trackEvent('Question Deleted', {
      userId: String(userId),
      questionCount: args.questionIds.length,
      source: 'manual',
    });

    return { permanentlyDeleted: args.questionIds.length };
  },
});
