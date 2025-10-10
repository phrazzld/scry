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

    // Atomic validation via shared helper
    await validateBulkOwnership(ctx, userId, args.questionIds);

    // All validations passed - execute mutations in parallel
    await Promise.all(
      args.questionIds.map((id) =>
        ctx.db.patch(id, {
          deletedAt: now,
          updatedAt: now,
        })
      )
    );

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

    // Atomic validation via shared helper
    await validateBulkOwnership(ctx, userId, args.questionIds);

    // All validations passed - execute mutations in parallel
    await Promise.all(
      args.questionIds.map((id) =>
        ctx.db.patch(id, {
          deletedAt: undefined, // Clear soft delete
          updatedAt: now,
        })
      )
    );

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

    // Atomic validation via shared helper
    await validateBulkOwnership(ctx, userId, args.questionIds);

    // All validations passed - execute deletions in parallel
    await Promise.all(args.questionIds.map((id) => ctx.db.delete(id)));

    return { permanentlyDeleted: args.questionIds.length };
  },
});
