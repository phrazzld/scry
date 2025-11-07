/**
 * Spaced Repetition System - Pure FSRS Implementation
 *
 * This module implements the Free Spaced Repetition Scheduler (FSRS) algorithm
 * without modifications or comfort features. The system respects memory science
 * absolutely - no daily limits, no artificial interleaving, no comfort features.
 *
 * Queue Priority System (lower number = higher priority):
 *
 * 1. Ultra-fresh new questions (< 1 hour old): -2.0 to -1.37
 *    - Highest priority for immediate encoding into memory
 *    - Exponentially decays toward standard new priority
 *
 * 2. Fresh new questions (1-24 hours old): -1.37 to -1.0
 *    - Still prioritized but with diminishing boost
 *    - Prevents stale new questions from blocking reviews
 *
 * 3. Standard new questions (> 24 hours old): -1.0
 *    - Regular FSRS new card priority
 *    - Must be learned before reviews
 *
 * 4. Due review questions: 0.0 to 1.0
 *    - Based on FSRS retrievability calculation
 *    - Lower retrievability = higher priority
 *    - 0.0 = completely forgotten, needs immediate review
 *    - 1.0 = perfect recall, can wait
 *
 * Key Principles:
 * - The forgetting curve doesn't care about comfort
 * - If 300 cards are due, show 300 cards
 * - Natural consequences teach sustainable habits
 * - Every "improvement" that adds comfort reduces effectiveness
 *
 * @module spacedRepetition
 */

import { v } from 'convex/values';

import { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { calculateStateTransitionDelta, updateStatsCounters } from './lib/userStatsHelpers';
import { getScheduler } from './scheduling';

// Export for testing
export { calculateFreshnessDecay, calculateRetrievabilityScore };

/**
 * Calculate freshness priority with exponential decay over 24 hours
 *
 * @param hoursSinceCreation - Hours since the question was created
 * @returns A priority boost from 0 to 1 (1 = maximum freshness)
 */
function calculateFreshnessDecay(hoursSinceCreation: number): number {
  if (hoursSinceCreation < 0) {
    // Gracefully handle minor clock skew by treating as maximum freshness
    // This prevents crashes when client/server times are slightly misaligned
    return 1.0;
  }

  // Exponential decay with 24-hour half-life
  // At 0 hours: 1.0 (maximum freshness)
  // At 24 hours: ~0.37 (e^-1)
  // At 48 hours: ~0.14 (e^-2)
  // After 72 hours: effectively 0
  return Math.exp(-hoursSinceCreation / 24);
}

/**
 * Calculate enhanced retrievability score for queue prioritization
 *
 * Implements Pure FSRS with fresh question priority and exponential decay:
 * - Ultra-fresh questions (0-24 hours): -2 to -1 with exponential decay
 * - Regular new questions (>24 hours): -1 (standard new priority)
 * - Reviewed questions: 0-1 (based on FSRS calculation)
 *
 * The freshness decay ensures newly generated questions get immediate priority
 * but gradually lose that boost over 24 hours, preventing stale new questions
 * from indefinitely blocking important reviews.
 *
 * @param question - The question document to calculate priority for
 * @param now - Current date/time for calculation (defaults to now)
 * @returns Priority score: -2 to -1 for new questions, 0 to 1 for reviewed questions
 */
function calculateRetrievabilityScore(question: Doc<'questions'>, now: Date = new Date()): number {
  // Check if question has never been reviewed
  // Note: After CRUD refactor, new questions have FSRS fields initialized on creation,
  // so we check state === 'new' instead of relying solely on undefined nextReview.
  // This ensures newly created cards still receive the -2 to -1 freshness boost.
  if (question.state === 'new' || question.nextReview === undefined || question.reps === 0) {
    // New question - apply freshness decay
    const hoursSinceCreation = (now.getTime() - question._creationTime) / 3600000;

    // Calculate freshness boost (1.0 at creation, decays to ~0 after 72 hours)
    const freshnessBoost = calculateFreshnessDecay(hoursSinceCreation);

    // Map freshness to priority range: -2 (ultra-fresh) to -1 (standard new)
    // freshnessBoost of 1.0 gives -2, freshnessBoost of 0 gives -1
    return -1 - freshnessBoost;
  }

  // Reviewed question - use scheduler interface for algorithm-agnostic retrievability
  const scheduler = getScheduler();
  return scheduler.getRetrievability(question, now);
}

/**
 * Schedule next review for a question based on user's answer
 *
 * This mutation is the primary integration point for Scry's automatic rating system.
 * It combines interaction recording with FSRS scheduling using a simplified approach
 * where users only indicate correct/incorrect rather than rating their confidence.
 *
 * Automatic Rating Flow:
 * 1. User answers question (correct/incorrect)
 * 2. This mutation records the interaction
 * 3. Automatically converts isCorrect to FSRS rating (Good/Again)
 * 4. Calculates next review time using FSRS algorithm
 * 5. Returns scheduling info for immediate display to user
 *
 * This approach eliminates the traditional 4-button rating system (Again/Hard/Good/Easy)
 * in favor of a streamlined binary choice, making reviews faster and more mobile-friendly.
 */
export const scheduleReview = mutation({
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
      throw new Error('Question not found or unauthorized');
    }

    // Record interaction first
    await ctx.db.insert('interactions', {
      userId,
      questionId: args.questionId,
      userAnswer: args.userAnswer,
      isCorrect: args.isCorrect,
      attemptedAt: Date.now(),
      timeSpent: args.timeSpent,
      context: args.sessionId ? { sessionId: args.sessionId } : undefined,
    });

    // Update denormalized stats on question
    const updatedStats = {
      attemptCount: question.attemptCount + 1,
      correctCount: question.correctCount + (args.isCorrect ? 1 : 0),
      lastAttemptedAt: Date.now(),
    };

    // Calculate FSRS scheduling
    const now = new Date();

    // If this is the first interaction and question has no FSRS state, initialize it
    if (!question.state) {
      const oldState = question.state; // undefined for new cards
      const scheduler = getScheduler();
      const initialDbFields = scheduler.initializeCard();

      // Schedule the first review
      const result = scheduler.scheduleNextReview(
        { ...question, ...initialDbFields },
        args.isCorrect,
        now
      );
      const scheduledFields = result.dbFields;

      // Update question with both stats and FSRS fields
      await ctx.db.patch(args.questionId, {
        ...updatedStats,
        ...scheduledFields,
      });

      // Update userStats counters (incremental bandwidth optimization)
      const newState = scheduledFields.state;
      const deltas = calculateStateTransitionDelta(oldState, newState);

      // Track time-based due count for badge reactivity
      // New cards (undefined oldNextReview) are always considered "due"
      const nowMs = Date.now();
      const newNextReview = scheduledFields.nextReview;

      if (newNextReview !== undefined) {
        // First review: card transitions from "always due" to scheduled
        const isDueNow = newNextReview <= nowMs;
        if (!isDueNow) {
          // Card scheduled in future, decrement due count
          if (deltas) {
            deltas.dueNowCount = (deltas.dueNowCount || 0) - 1;
          } else {
            // No state change, but still need to update dueNowCount
            await updateStatsCounters(ctx, userId, { dueNowCount: -1 });
            return {
              success: true,
              nextReview: scheduledFields.nextReview || null,
              scheduledDays: scheduledFields.scheduledDays || 0,
              newState: scheduledFields.state || 'new',
            };
          }
        }
        // If isDueNow is true (immediate re-review), dueNowCount stays same
      }

      if (deltas) {
        await updateStatsCounters(ctx, userId, deltas);
      }

      return {
        success: true,
        nextReview: scheduledFields.nextReview || null,
        scheduledDays: scheduledFields.scheduledDays || 0,
        newState: scheduledFields.state || 'new',
      };
    }

    // For subsequent reviews, use existing FSRS state
    const oldState = question.state; // Capture state before scheduling
    const scheduler = getScheduler();
    const result = scheduler.scheduleNextReview(question, args.isCorrect, now);
    const scheduledFields = result.dbFields;

    // Update question with both stats and FSRS fields
    await ctx.db.patch(args.questionId, {
      ...updatedStats,
      ...scheduledFields,
    });

    // Update userStats counters (incremental bandwidth optimization)
    const newState = scheduledFields.state || question.state;
    const deltas = calculateStateTransitionDelta(oldState, newState);

    // Track time-based due count for badge reactivity
    // Detect when nextReview crosses the "due now" boundary
    const oldNextReview = question.nextReview;
    const newNextReview = scheduledFields.nextReview;
    const nowMs = Date.now();

    if (oldNextReview !== undefined && newNextReview !== undefined) {
      const wasDue = oldNextReview <= nowMs;
      const isDueNow = newNextReview <= nowMs;

      if (wasDue && !isDueNow) {
        // Card moved from due to not-due (answered correctly, scheduled future)
        if (deltas) {
          deltas.dueNowCount = (deltas.dueNowCount || 0) - 1;
        } else {
          // No state change, but still need to update dueNowCount
          await updateStatsCounters(ctx, userId, { dueNowCount: -1 });
          return {
            success: true,
            nextReview: scheduledFields.nextReview || null,
            scheduledDays: scheduledFields.scheduledDays || 0,
            newState: scheduledFields.state || question.state || 'new',
          };
        }
      } else if (!wasDue && isDueNow) {
        // Card moved from not-due to due (rare: manual reschedule or immediate lapse)
        if (deltas) {
          deltas.dueNowCount = (deltas.dueNowCount || 0) + 1;
        } else {
          await updateStatsCounters(ctx, userId, { dueNowCount: 1 });
          return {
            success: true,
            nextReview: scheduledFields.nextReview || null,
            scheduledDays: scheduledFields.scheduledDays || 0,
            newState: scheduledFields.state || question.state || 'new',
          };
        }
      }
      // If both wasDue and isDue are same, dueNowCount doesn't change
    }

    if (deltas) {
      await updateStatsCounters(ctx, userId, deltas);
    }

    return {
      success: true,
      nextReview: scheduledFields.nextReview || null,
      scheduledDays: scheduledFields.scheduledDays || 0,
      newState: scheduledFields.state || question.state || 'new',
    };
  },
});

/**
 * Get the next question to review based on FSRS retrievability
 *
 * This query implements Pure FSRS queue prioritization:
 * 1. Fetches all due reviews and new questions
 * 2. Calculates priority score for each (see calculateRetrievabilityScore)
 * 3. Returns the highest priority question (lowest score)
 *
 * No daily limits, no artificial ordering - just pure memory science.
 * The question that most needs review appears first, always.
 */
export const getNextReview = query({
  args: {
    _refreshTimestamp: v.optional(v.number()), // For periodic refresh
  },

  handler: async (ctx, _args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = new Date();

    // First, try to get questions that are due for review (excluding deleted and archived)
    const dueQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user_next_review', (q) =>
        q.eq('userId', userId).lte('nextReview', now.getTime())
      )
      .filter((q) =>
        q.and(q.eq(q.field('deletedAt'), undefined), q.eq(q.field('archivedAt'), undefined))
      )
      .take(25); // Reduced from 100: fetch top 25 most urgent due cards (77% bandwidth reduction)

    // Also get questions without nextReview (new questions, excluding deleted and archived)
    // Limit to small sample since new cards have equal priority (no retrievability yet)
    const newQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('nextReview'), undefined),
          q.eq(q.field('deletedAt'), undefined),
          q.eq(q.field('archivedAt'), undefined)
        )
      )
      .take(5); // Reduced from 10: fetch top 5 new cards (50% bandwidth reduction)

    // Combine both sets
    const allCandidates = [...dueQuestions, ...newQuestions];

    if (allCandidates.length === 0) {
      return null; // No questions to review
    }

    // Calculate retrievability score for each question
    const questionsWithPriority = allCandidates.map((q) => ({
      question: q,
      retrievability: calculateRetrievabilityScore(q, now),
    }));

    // Sort by retrievability (lower = higher priority)
    questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);

    // Dynamic urgency tier shuffle for temporal dispersion
    // Rationale: Only shuffle items with similar retrievability (within threshold).
    // Prevents temporal clustering (same _creationTime → same priority)
    // while strictly respecting FSRS priority (never shuffles across urgency gaps).
    // Learning science: Interleaving improves retention vs. blocked practice.
    //
    // Dynamic threshold (vs hard-coded N=10) ensures FSRS compliance:
    // - If top 3 items have retrievability 0.05-0.08 (similar), shuffle all 3
    // - If item 1 is 0.05 but item 10 is 0.90 (very different), only shuffle similar items
    // - Prevents most urgent cards being shown only 10% of time due to wide spread
    const URGENCY_DELTA = 0.05; // Only shuffle within 5% retrievability spread
    const urgentTier = [];
    const baseRetrievability = questionsWithPriority[0].retrievability;

    // Build urgentTier: all items within URGENCY_DELTA of most urgent item
    // Note: retrievability is sorted ascending (lower = higher priority)
    // For negative scores (new questions), baseRetrievability is most negative (e.g., -2.0)
    // We want items where abs(retrievability - baseRetrievability) <= URGENCY_DELTA
    for (const item of questionsWithPriority) {
      const spread = Math.abs(item.retrievability - baseRetrievability);
      if (spread <= URGENCY_DELTA) {
        urgentTier.push(item);
      } else {
        break; // Stop when urgency gap too large (list is sorted)
      }
    }

    // Fisher-Yates shuffle: O(N) unbiased random permutation
    // Loop stops at i > 0 (not i >= 0) because position 0 doesn't need selection:
    // it participates in swaps via j selection from remaining positions
    // Uses Math.random() for non-deterministic shuffle (different order each session)
    // vs shuffleWithSeed (deterministic, reproducible for testing)
    // Tradeoff: sacrifices reproducibility for variety, acceptable for UX diversity
    for (let i = urgentTier.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [urgentTier[i], urgentTier[j]] = [urgentTier[j], urgentTier[i]];
    }

    const nextQuestion = urgentTier[0].question;

    // Get interaction history for this question
    // Bandwidth optimization: Limit to 10 most recent interactions instead of all
    // Rationale: FSRS scheduling only needs recent performance trend, not full history
    // Impact: 90% reduction for mature cards (50+ interactions → 10 interactions)
    const interactions = await ctx.db
      .query('interactions')
      .withIndex('by_user_question', (q) =>
        q.eq('userId', userId).eq('questionId', nextQuestion._id)
      )
      .order('desc')
      .take(10);

    return {
      question: nextQuestion,
      interactions,
      attemptCount: nextQuestion.attemptCount,
      correctCount: nextQuestion.correctCount,
      successRate:
        nextQuestion.attemptCount > 0
          ? nextQuestion.correctCount / nextQuestion.attemptCount
          : null,
      serverTime: now.getTime(), // Server's current time for accurate "New" badge display
    };
  },
});

/**
 * Get count of questions due for review
 *
 * Returns the REAL count - no limits, no filtering, no comfort.
 * This is your actual learning debt:
 * - newCount: Questions never reviewed (highest priority)
 * - dueCount: Questions past their optimal review time
 * - totalReviewable: The truth about what needs review
 *
 * Bandwidth optimization: Hybrid approach for correctness + efficiency
 * - New cards: Use cached newCount from userStats (time-agnostic, always due)
 * - Due cards: Query time-filtered learning/mature cards (nextReview <= now)
 * - Impact: 75-95% bandwidth reduction (vs 99.996% with pure cache)
 * - Rationale: userStats counters are state-based, NOT time-aware
 *
 * Note: Originally attempted pure O(1) cache lookup, but Codex review (PR #53)
 * correctly identified that learningCount + matureCount counts ALL cards in those
 * states, not just cards where nextReview <= now. This hybrid approach maintains
 * API correctness while achieving significant bandwidth savings.
 */
export const getDueCount = query({
  args: {},

  handler: async (ctx) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Get cached stats - fully reactive via mutation updates
    // No time-filtered queries needed: dueNowCount is maintained by scheduleReview
    const stats = await ctx.db
      .query('userStats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    if (!stats) {
      console.warn(
        'Missing userStats for user',
        userId,
        '- returning zeros. This may indicate reconciliation failure.'
      );
    }

    // Use time-aware cached counters (updated by scheduleReview mutations)
    // This enables true Convex reactivity: when scheduleReview updates userStats,
    // this query automatically re-runs via WebSocket (no polling needed)
    const dueNowCount = stats?.dueNowCount || 0;
    const newCount = stats?.newCount || 0;

    // New cards are always due, so dueNowCount already includes them.
    // Subtract them out to keep dueCount aligned with "review" cards only.
    const reviewDueCount = Math.max(dueNowCount - newCount, 0);

    return {
      dueCount: reviewDueCount,
      newCount,
      totalReviewable: reviewDueCount + newCount,
    };
  },
});

/**
 * Get user's card statistics and next scheduled review time
 * Used for context-aware empty states
 *
 * Bandwidth optimization: O(1) query using cached userStats table
 * instead of O(N) collection scan. Updated incrementally on card state changes.
 */
export const getUserCardStats = query({
  args: {
    _refreshTimestamp: v.optional(v.float64()),
  },

  handler: async (ctx, _args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Query cached stats (O(1) vs O(N) collection scan)
    const stats = await ctx.db
      .query('userStats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    // Return default stats if no record exists (new user case)
    if (!stats) {
      return {
        totalCards: 0,
        nextReviewTime: null,
        learningCount: 0,
        matureCount: 0,
        newCount: 0,
      };
    }

    return {
      totalCards: stats.totalCards,
      nextReviewTime: stats.nextReviewTime ?? null,
      learningCount: stats.learningCount,
      matureCount: stats.matureCount,
      newCount: stats.newCount,
    };
  },
});

/**
 * @deprecated Use getUserCardStats instead (reads from cached userStats table)
 * This function performs O(N) collection scan and will be removed after migration
 */
export const getUserCardStats_DEPRECATED = query({
  args: {
    _refreshTimestamp: v.optional(v.float64()),
  },

  handler: async (ctx, _args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Get all user's cards (not deleted)
    const allCards = await ctx.db
      .query('questions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('deletedAt'), undefined))
      .collect();

    const totalCards = allCards.length;

    if (totalCards === 0) {
      return {
        totalCards: 0,
        nextReviewTime: null,
        learningCount: 0,
        matureCount: 0,
        newCount: 0,
      };
    }

    // Find the earliest next review time (for cards not yet due)
    const futureReviews = allCards
      .filter((card) => card.nextReview && card.nextReview > now)
      .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));

    const nextReviewTime = futureReviews[0]?.nextReview || null;

    // Count cards by state
    let learningCount = 0;
    let matureCount = 0;
    let newCount = 0;

    for (const card of allCards) {
      if (!card.state || card.state === 'new') {
        newCount++;
      } else if (card.state === 'learning' || card.state === 'relearning') {
        learningCount++;
      } else if (card.state === 'review') {
        matureCount++;
      }
    }

    return {
      totalCards,
      nextReviewTime,
      learningCount,
      matureCount,
      newCount,
    };
  },
});
