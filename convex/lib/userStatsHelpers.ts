/**
 * User Statistics Helper Functions
 *
 * Incremental counter updates for userStats table to avoid O(N) collection scans.
 * Updated atomically on card state transitions (reviews, creation, deletion, restoration).
 *
 * Design:
 * - Pure functions that take ctx and userId
 * - Handle missing stats records (new users)
 * - Prevent negative counts with Math.max(0, value)
 * - Apply deltas atomically in single transaction
 */

import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

/**
 * Card state type matching schema
 */
type CardState = 'new' | 'learning' | 'review' | 'relearning';

/**
 * Delta object for stat counter updates
 * Positive values = increment, negative values = decrement
 */
export interface StatDeltas {
  totalCards?: number;
  newCount?: number;
  learningCount?: number;
  matureCount?: number; // 'review' state
  dueNowCount?: number; // Cards where nextReview <= now (time-aware for reactivity)
  nextReviewTime?: number;
}

/**
 * Update user statistics counters incrementally
 *
 * Applies deltas to existing stats or initializes if missing (new user case).
 * Uses Math.max(0, value) to prevent negative counts from accumulating errors.
 *
 * @param ctx Mutation context
 * @param userId User ID to update stats for
 * @param deltas Counter changes to apply (positive = increment, negative = decrement)
 *
 * @example
 * // Card transitioned from 'learning' to 'review'
 * await updateStatsCounters(ctx, userId, {
 *   learningCount: -1,
 *   matureCount: 1,
 * });
 *
 * @example
 * // New card created
 * await updateStatsCounters(ctx, userId, {
 *   totalCards: 1,
 *   newCount: 1,
 * });
 */
export async function updateStatsCounters(
  ctx: MutationCtx,
  userId: Id<'users'>,
  deltas: StatDeltas
): Promise<void> {
  // Fetch existing stats
  const existingStats = await ctx.db
    .query('userStats')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();

  // Calculate new values with deltas applied
  // Use Math.max(0, value) to prevent negative counts
  const newStats = {
    userId,
    totalCards: Math.max(0, (existingStats?.totalCards ?? 0) + (deltas.totalCards ?? 0)),
    newCount: Math.max(0, (existingStats?.newCount ?? 0) + (deltas.newCount ?? 0)),
    learningCount: Math.max(0, (existingStats?.learningCount ?? 0) + (deltas.learningCount ?? 0)),
    matureCount: Math.max(0, (existingStats?.matureCount ?? 0) + (deltas.matureCount ?? 0)),
    dueNowCount: Math.max(0, (existingStats?.dueNowCount ?? 0) + (deltas.dueNowCount ?? 0)),
    nextReviewTime:
      deltas.nextReviewTime !== undefined ? deltas.nextReviewTime : existingStats?.nextReviewTime,
    lastCalculated: Date.now(),
  };

  if (existingStats) {
    // Update existing record
    // Note: Cannot patch userId (immutable field), so destructure it out
    const { userId: _userId, ...patchFields } = newStats;
    await ctx.db.patch(existingStats._id, patchFields);
  } else {
    // Initialize new record (new user case)
    await ctx.db.insert('userStats', newStats);
  }
}

/**
 * Calculate delta for card state transition
 *
 * Returns stat deltas when a card changes state (e.g., 'learning' → 'review').
 * Handles all state transitions including null/undefined (new cards).
 *
 * @param oldState Previous card state (undefined for new cards)
 * @param newState New card state after transition
 * @returns Stat deltas to apply, or null if no change
 *
 * @example
 * const oldState = 'learning';
 * const newState = 'review';
 * const deltas = calculateStateTransitionDelta(oldState, newState);
 * // Returns: { learningCount: -1, matureCount: 1 }
 */
export function calculateStateTransitionDelta(
  oldState: CardState | undefined,
  newState: CardState | undefined
): StatDeltas | null {
  // No state change
  if (oldState === newState) {
    return null;
  }

  const deltas: StatDeltas = {};

  // Decrement old state counter
  if (oldState === 'new') {
    deltas.newCount = -1;
  } else if (oldState === 'learning' || oldState === 'relearning') {
    deltas.learningCount = -1;
  } else if (oldState === 'review') {
    deltas.matureCount = -1;
  }

  // Increment new state counter
  if (newState === 'new') {
    deltas.newCount = 1;
  } else if (newState === 'learning' || newState === 'relearning') {
    deltas.learningCount = 1;
  } else if (newState === 'review') {
    deltas.matureCount = 1;
  }

  return deltas;
}
