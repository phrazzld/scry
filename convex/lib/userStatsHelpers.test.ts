import { describe, expect, it, vi } from 'vitest';

import type { Id } from '../_generated/dataModel';
import { calculateStateTransitionDelta, updateStatsCounters } from './userStatsHelpers';

/**
 * Unit tests for userStats helper functions
 *
 * Tests focus on validating:
 * - Incremental counter updates (positive/negative deltas)
 * - Handling missing stats records (new user initialization)
 * - Negative count prevention (Math.max safety)
 * - Multiple delta application
 * - State transition delta calculations
 *
 * These tests validate the helper algorithms without requiring
 * actual Convex runtime execution.
 */

describe('userStatsHelpers', () => {
  describe('calculateStateTransitionDelta', () => {
    it('should return null when state does not change', () => {
      expect(calculateStateTransitionDelta('new', 'new')).toBeNull();
      expect(calculateStateTransitionDelta('learning', 'learning')).toBeNull();
      expect(calculateStateTransitionDelta('review', 'review')).toBeNull();
      expect(calculateStateTransitionDelta(undefined, undefined)).toBeNull();
    });

    it('should decrement old state and increment new state on transition', () => {
      const result = calculateStateTransitionDelta('learning', 'review');
      expect(result).toEqual({
        learningCount: -1,
        matureCount: 1,
      });
    });

    it('should handle transition from new to learning', () => {
      const result = calculateStateTransitionDelta('new', 'learning');
      expect(result).toEqual({
        newCount: -1,
        learningCount: 1,
      });
    });

    it('should handle transition from review to relearning', () => {
      const result = calculateStateTransitionDelta('review', 'relearning');
      expect(result).toEqual({
        matureCount: -1,
        learningCount: 1, // relearning counts as learning
      });
    });

    it('should handle transition from undefined (new card) to new state', () => {
      const result = calculateStateTransitionDelta(undefined, 'new');
      expect(result).toEqual({
        newCount: 1,
      });
    });

    it('should handle all state transitions correctly', () => {
      // Test comprehensive transition matrix
      const transitions: Array<{
        from: 'new' | 'learning' | 'review' | 'relearning' | undefined;
        to: 'new' | 'learning' | 'review' | 'relearning' | undefined;
        expected: ReturnType<typeof calculateStateTransitionDelta>;
      }> = [
        { from: 'new', to: 'learning', expected: { newCount: -1, learningCount: 1 } },
        { from: 'learning', to: 'review', expected: { learningCount: -1, matureCount: 1 } },
        { from: 'review', to: 'relearning', expected: { matureCount: -1, learningCount: 1 } },
        { from: 'relearning', to: 'review', expected: { learningCount: -1, matureCount: 1 } },
        { from: undefined, to: 'new', expected: { newCount: 1 } },
      ];

      transitions.forEach(({ from, to, expected }) => {
        expect(calculateStateTransitionDelta(from, to)).toEqual(expected);
      });
    });
  });

  describe('updateStatsCounters', () => {
    it('should increment counters correctly', async () => {
      // Mock Convex context
      const existingStats = {
        _id: 'stats123' as Id<'userStats'>,
        _creationTime: Date.now(),
        userId: 'user123' as Id<'users'>,
        totalCards: 10,
        newCount: 5,
        learningCount: 3,
        matureCount: 2,
        nextReviewTime: undefined,
        lastCalculated: Date.now(),
      };

      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingStats),
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue(undefined),
      };

      const mockCtx = {
        db: mockDb,
      } as any;

      await updateStatsCounters(mockCtx, 'user123' as Id<'users'>, {
        totalCards: 1,
        newCount: 1,
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        'stats123',
        expect.objectContaining({
          totalCards: 11,
          newCount: 6,
          learningCount: 3,
          matureCount: 2,
        })
      );
    });

    it('should decrement counters correctly', async () => {
      const existingStats = {
        _id: 'stats123' as Id<'userStats'>,
        _creationTime: Date.now(),
        userId: 'user123' as Id<'users'>,
        totalCards: 10,
        newCount: 5,
        learningCount: 3,
        matureCount: 2,
        nextReviewTime: undefined,
        lastCalculated: Date.now(),
      };

      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingStats),
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue(undefined),
      };

      const mockCtx = {
        db: mockDb,
      } as any;

      await updateStatsCounters(mockCtx, 'user123' as Id<'users'>, {
        totalCards: -1,
        learningCount: -1,
        matureCount: 1,
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        'stats123',
        expect.objectContaining({
          totalCards: 9,
          newCount: 5,
          learningCount: 2,
          matureCount: 3,
        })
      );
    });

    it('should prevent negative counts with Math.max safety', async () => {
      const existingStats = {
        _id: 'stats123' as Id<'userStats'>,
        _creationTime: Date.now(),
        userId: 'user123' as Id<'users'>,
        totalCards: 2,
        newCount: 1,
        learningCount: 1,
        matureCount: 0,
        nextReviewTime: undefined,
        lastCalculated: Date.now(),
      };

      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingStats),
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue(undefined),
      };

      const mockCtx = {
        db: mockDb,
      } as any;

      // Try to decrement beyond zero
      await updateStatsCounters(mockCtx, 'user123' as Id<'users'>, {
        totalCards: -5,
        newCount: -3,
        learningCount: -2,
        matureCount: -1,
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        'stats123',
        expect.objectContaining({
          totalCards: 0, // Math.max(0, 2 - 5) = 0
          newCount: 0, // Math.max(0, 1 - 3) = 0
          learningCount: 0, // Math.max(0, 1 - 2) = 0
          matureCount: 0, // Math.max(0, 0 - 1) = 0
        })
      );
    });

    it('should handle missing stats record (new user)', async () => {
      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null), // No existing stats
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue('newStatsId' as Id<'userStats'>),
      };

      const mockCtx = {
        db: mockDb,
      } as any;

      await updateStatsCounters(mockCtx, 'newuser456' as Id<'users'>, {
        totalCards: 1,
        newCount: 1,
      });

      // Should insert new record, not patch
      expect(mockDb.insert).toHaveBeenCalledWith(
        'userStats',
        expect.objectContaining({
          userId: 'newuser456',
          totalCards: 1,
          newCount: 1,
          learningCount: 0,
          matureCount: 0,
        })
      );
      expect(mockDb.patch).not.toHaveBeenCalled();
    });

    it('should apply multiple deltas correctly', async () => {
      const existingStats = {
        _id: 'stats123' as Id<'userStats'>,
        _creationTime: Date.now(),
        userId: 'user123' as Id<'users'>,
        totalCards: 10,
        newCount: 5,
        learningCount: 3,
        matureCount: 2,
        nextReviewTime: undefined,
        lastCalculated: Date.now(),
      };

      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingStats),
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue(undefined),
      };

      const mockCtx = {
        db: mockDb,
      } as any;

      // Apply complex delta: card created, then transitioned learning → review
      await updateStatsCounters(mockCtx, 'user123' as Id<'users'>, {
        totalCards: 1, // +1 card
        learningCount: -1, // -1 from learning
        matureCount: 1, // +1 to mature
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        'stats123',
        expect.objectContaining({
          totalCards: 11, // 10 + 1
          newCount: 5, // unchanged
          learningCount: 2, // 3 - 1
          matureCount: 3, // 2 + 1
        })
      );
    });

    it('should update nextReviewTime when provided', async () => {
      const existingStats = {
        _id: 'stats123' as Id<'userStats'>,
        _creationTime: Date.now(),
        userId: 'user123' as Id<'users'>,
        totalCards: 10,
        newCount: 5,
        learningCount: 3,
        matureCount: 2,
        nextReviewTime: undefined,
        lastCalculated: Date.now(),
      };

      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingStats),
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue(undefined),
      };

      const mockCtx = {
        db: mockDb,
      } as any;

      const nextReviewTime = Date.now() + 3600000; // 1 hour from now

      await updateStatsCounters(mockCtx, 'user123' as Id<'users'>, {
        nextReviewTime,
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        'stats123',
        expect.objectContaining({
          nextReviewTime,
        })
      );
    });

    it('should preserve existing nextReviewTime when not provided', async () => {
      const existingNextReview = Date.now() + 7200000;
      const existingStats = {
        _id: 'stats123' as Id<'userStats'>,
        _creationTime: Date.now(),
        userId: 'user123' as Id<'users'>,
        totalCards: 10,
        newCount: 5,
        learningCount: 3,
        matureCount: 2,
        nextReviewTime: existingNextReview,
        lastCalculated: Date.now(),
      };

      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingStats),
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue(undefined),
      };

      const mockCtx = {
        db: mockDb,
      } as any;

      await updateStatsCounters(mockCtx, 'user123' as Id<'users'>, {
        totalCards: 1,
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        'stats123',
        expect.objectContaining({
          nextReviewTime: existingNextReview, // Preserved
        })
      );
    });
  });
});
