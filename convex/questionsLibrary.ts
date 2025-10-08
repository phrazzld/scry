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
 * Returns questions filtered by view (active/archived/trash) with derived stats.
 * Active: not archived and not deleted
 * Archived: archived but not deleted
 * Trash: deleted (regardless of archive state)
 */
export const getLibrary = query({
  args: {
    view: v.union(v.literal('active'), v.literal('archived'), v.literal('trash')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const limit = args.limit || 500;

    // Query all user questions, ordered by most recent
    let questions = await ctx.db
      .query('questions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit * 2); // Over-fetch to account for filtering

    // Filter based on view
    questions = questions.filter((q) => {
      const isArchived = !!q.archivedAt;
      const isDeleted = !!q.deletedAt;

      switch (args.view) {
        case 'active':
          return !isArchived && !isDeleted;
        case 'archived':
          return isArchived && !isDeleted;
        case 'trash':
          return isDeleted;
        default:
          return false;
      }
    });

    // Take only requested limit after filtering
    questions = questions.slice(0, limit);

    // Add derived stats to each question
    return questions.map((q) => ({
      ...q,
      failedCount: q.attemptCount - q.correctCount,
      successRate: q.attemptCount > 0 ? Math.round((q.correctCount / q.attemptCount) * 100) : null,
    }));
  },
});

/**
 * Get recent topics ordered by usage frequency
 *
 * Returns most frequently used topics for quick generation autocomplete.
 * Excludes deleted questions from topic counting.
 */
export const getRecentTopics = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Query user's recent questions (not deleted)
    const recentQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc') // Most recent first
      .take(100); // Get enough to find unique topics

    // Filter out deleted questions and extract unique topics
    const topicCounts = new Map<string, number>();

    for (const question of recentQuestions) {
      // Skip deleted questions
      if (question.deletedAt) continue;

      // Skip questions without topics
      if (!question.topic) continue;

      // Count occurrences of each topic
      const count = topicCounts.get(question.topic) || 0;
      topicCounts.set(question.topic, count + 1);
    }

    // Convert to array, sort by frequency (most used topics first), then take limit
    const topics = Array.from(topicCounts.entries())
      .sort(([, a], [, b]) => b - a) // Sort by count descending
      .slice(0, args.limit || 5) // Take top 5 by default
      .map(([topic]) => topic); // Extract just the topic names

    return topics;
  },
});

/**
 * Query questions with flexible filters
 *
 * Optimizes index selection based on provided filters.
 * Supports filtering by topic, attempt status, and deletion state.
 */
export const getUserQuestions = query({
  args: {
    topic: v.optional(v.string()),
    onlyUnattempted: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    includeDeleted: v.optional(v.boolean()), // Option to include deleted questions
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Choose the most selective index based on filters provided
    let query;

    // If topic is specified, use the topic index (most selective)
    if (args.topic) {
      const topic = args.topic;
      query = ctx.db
        .query('questions')
        .withIndex('by_user_topic', (q) => q.eq('userId', userId).eq('topic', topic));
    }
    // If only unattempted filter is specified, use that index
    else if (args.onlyUnattempted) {
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
    if (args.topic && args.onlyUnattempted) {
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
