/**
 * Question Library Queries
 *
 * Browsing and filtering questions for library dashboard.
 * Hides index selection optimization, client-side filtering patterns,
 * and derived stat calculations.
 *
 * Key queries:
 * - getLibrary: Main library view with active/archived/trash filtering
 * - getRecentTopics: Frequently used topics for quick generation
 * - getUserQuestions: Flexible filtering by topic/attempts
 * - getQuizInteractionStats: Session-based statistics
 */
import { v } from 'convex/values';

import { query } from './_generated/server';
import { requireUserFromClerk } from './clerk';

/**
 * Get questions for library view with filtering by state
 *
 * Returns paginated questions filtered by view (active/archived/trash) with derived stats.
 * Active: not archived and not deleted
 * Archived: archived but not deleted
 * Trash: deleted (regardless of archive state)
 *
 * Uses cursor-based pagination for efficient large collection navigation.
 */
export const getLibrary = query({
  args: {
    view: v.union(v.literal('active'), v.literal('archived'), v.literal('trash')),
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Validate and clamp pageSize to prevent excessive bandwidth usage (10-100 items)
    const pageSize = Math.min(Math.max(args.pageSize ?? 50, 10), 100);

    // Query user questions with pagination
    // Bandwidth optimization: Use compound index for DB-level filtering + cursor pagination
    let paginationResult;

    switch (args.view) {
      case 'active':
        // Active: not archived AND not deleted
        paginationResult = await ctx.db
          .query('questions')
          .withIndex('by_user_active', (q) =>
            q.eq('userId', userId).eq('deletedAt', undefined).eq('archivedAt', undefined)
          )
          .order('desc')
          .paginate({ numItems: pageSize, cursor: args.cursor ?? null });
        break;

      case 'archived':
        // Archived: has archivedAt AND not deleted
        // Note: Use by_user index with filter since archivedAt can be any timestamp
        paginationResult = await ctx.db
          .query('questions')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .filter((q) =>
            q.and(q.neq(q.field('archivedAt'), undefined), q.eq(q.field('deletedAt'), undefined))
          )
          .order('desc')
          .paginate({ numItems: pageSize, cursor: args.cursor ?? null });
        break;

      case 'trash':
        // Trash: has deletedAt (regardless of archivedAt)
        paginationResult = await ctx.db
          .query('questions')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .filter((q) => q.neq(q.field('deletedAt'), undefined))
          .order('desc')
          .paginate({ numItems: pageSize, cursor: args.cursor ?? null });
        break;

      default:
        paginationResult = {
          page: [],
          continueCursor: null,
          isDone: true,
        };
    }

    // Add derived stats to each question
    const questionsWithStats = paginationResult.page.map((q) => ({
      ...q,
      failedCount: q.attemptCount - q.correctCount,
      successRate: q.attemptCount > 0 ? Math.round((q.correctCount / q.attemptCount) * 100) : null,
    }));

    return {
      results: questionsWithStats,
      continueCursor: paginationResult.continueCursor,
      isDone: paginationResult.isDone,
    };
  },
});

/**
 * Query questions with flexible filters
 *
 * Optimizes index selection based on provided filters.
 * Supports filtering by attempt status and deletion state.
 */
export const getUserQuestions = query({
  args: {
    onlyUnattempted: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    includeDeleted: v.optional(v.boolean()), // Option to include deleted questions
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Choose the most selective index based on filters provided
    let query;

    // If only unattempted filter is specified, use that index
    if (args.onlyUnattempted) {
      query = ctx.db
        .query('questions')
        .withIndex('by_user_unattempted', (q) => q.eq('userId', userId).eq('attemptCount', 0));
    }
    // Otherwise use the basic user index
    else {
      query = ctx.db.query('questions').withIndex('by_user', (q) => q.eq('userId', userId));
    }

    let questions = await query.order('desc').take(args.limit || 50);

    // Apply additional filters in memory
    // If topic index was used but unattempted filter also requested, apply it here
    if (args.onlyUnattempted) {
      questions = questions.filter((q) => q.attemptCount === 0);
    }

    // Filter out soft-deleted questions by default
    if (!args.includeDeleted) {
      questions = questions.filter((q) => !q.deletedAt);
    }

    return questions;
  },
});

/**
 * Get interaction statistics for a quiz session
 *
 * Returns aggregated stats (accuracy, unique questions, etc.) for a session ID.
 * Used for post-quiz summaries and progress tracking.
 */
export const getQuizInteractionStats = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Get all interactions for this session
    const interactions = await ctx.db
      .query('interactions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('context.sessionId'), args.sessionId))
      .collect();

    // Calculate stats
    const totalInteractions = interactions.length;
    const correctInteractions = interactions.filter((i) => i.isCorrect).length;
    const uniqueQuestions = new Set(interactions.map((i) => i.questionId)).size;

    return {
      totalInteractions,
      correctInteractions,
      uniqueQuestions,
      accuracy: totalInteractions > 0 ? correctInteractions / totalInteractions : 0,
    };
  },
});
