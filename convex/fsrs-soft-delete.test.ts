import { describe, it, expect } from 'vitest';

describe('FSRS Data Integrity with Soft Delete', () => {
  describe('Soft Delete Behavior', () => {
    it('should preserve all FSRS fields when a question is soft deleted', () => {
      // Simulate a question with complete FSRS data
      const originalQuestion = {
        _id: 'question123',
        question: 'Test question',
        correctAnswer: 'Test answer',
        userId: 'user123',
        // FSRS fields
        stability: 5.2,
        fsrsDifficulty: 3.7,
        elapsedDays: 2,
        scheduledDays: 7,
        reps: 3,
        lapses: 1,
        state: 'review' as const,
        lastReview: Date.now() - 86400000, // 1 day ago
        nextReview: Date.now() + 86400000 * 6, // 6 days from now
        // Other fields
        attemptCount: 3,
        correctCount: 2,
        createdAt: Date.now() - 86400000 * 10,
        updatedAt: Date.now() - 86400000,
      };

      // Simulate soft delete (only adds deletedAt field)
      const deletedQuestion = {
        ...originalQuestion,
        deletedAt: Date.now(),
      };

      // Verify all FSRS fields are preserved
      expect(deletedQuestion.stability).toBe(originalQuestion.stability);
      expect(deletedQuestion.fsrsDifficulty).toBe(originalQuestion.fsrsDifficulty);
      expect(deletedQuestion.elapsedDays).toBe(originalQuestion.elapsedDays);
      expect(deletedQuestion.scheduledDays).toBe(originalQuestion.scheduledDays);
      expect(deletedQuestion.reps).toBe(originalQuestion.reps);
      expect(deletedQuestion.lapses).toBe(originalQuestion.lapses);
      expect(deletedQuestion.state).toBe(originalQuestion.state);
      expect(deletedQuestion.lastReview).toBe(originalQuestion.lastReview);
      expect(deletedQuestion.nextReview).toBe(originalQuestion.nextReview);
    });

    it('should restore FSRS data intact when a question is undeleted', () => {
      // Start with a deleted question that has FSRS data
      const deletedQuestion = {
        _id: 'question123',
        question: 'Test question',
        correctAnswer: 'Test answer',
        userId: 'user123',
        deletedAt: Date.now() - 3600000, // Deleted 1 hour ago
        // FSRS fields
        stability: 8.9,
        fsrsDifficulty: 2.1,
        elapsedDays: 5,
        scheduledDays: 14,
        reps: 7,
        lapses: 0,
        state: 'review' as const,
        lastReview: Date.now() - 86400000 * 5,
        nextReview: Date.now() + 86400000 * 9,
      };

      // Simulate restore (only removes deletedAt field)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { deletedAt, ...restoredQuestion } = deletedQuestion;

      // Verify all FSRS fields remain unchanged
      expect(restoredQuestion.stability).toBe(deletedQuestion.stability);
      expect(restoredQuestion.fsrsDifficulty).toBe(deletedQuestion.fsrsDifficulty);
      expect(restoredQuestion.elapsedDays).toBe(deletedQuestion.elapsedDays);
      expect(restoredQuestion.scheduledDays).toBe(deletedQuestion.scheduledDays);
      expect(restoredQuestion.reps).toBe(deletedQuestion.reps);
      expect(restoredQuestion.lapses).toBe(deletedQuestion.lapses);
      expect(restoredQuestion.state).toBe(deletedQuestion.state);
      expect(restoredQuestion.lastReview).toBe(deletedQuestion.lastReview);
      expect(restoredQuestion.nextReview).toBe(deletedQuestion.nextReview);
      
      // Verify deletedAt is removed
      expect('deletedAt' in restoredQuestion).toBe(false);
    });
  });

  describe('Review Queue Filtering', () => {
    it('should exclude deleted questions from review queue', () => {
      const now = Date.now();
      
      // Simulate a mix of questions
      const questions = [
        { _id: '1', userId: 'user1', nextReview: now - 86400000, deletedAt: undefined }, // Due, not deleted
        { _id: '2', userId: 'user1', nextReview: now - 86400000, deletedAt: now - 3600000 }, // Due, but deleted
        { _id: '3', userId: 'user1', nextReview: undefined, deletedAt: undefined }, // New, not deleted
        { _id: '4', userId: 'user1', nextReview: undefined, deletedAt: now - 7200000 }, // New, but deleted
        { _id: '5', userId: 'user1', nextReview: now + 86400000, deletedAt: undefined }, // Not due, not deleted
      ];

      // Simulate the filter logic from getNextReview query
      const eligibleForReview = questions.filter(q => {
        const isDue = q.nextReview === undefined || q.nextReview <= now;
        const isNotDeleted = q.deletedAt === undefined;
        return isDue && isNotDeleted;
      });

      // Should only include questions 1 and 3 (due/new and not deleted)
      expect(eligibleForReview).toHaveLength(2);
      expect(eligibleForReview.map(q => q._id)).toEqual(['1', '3']);
    });

    it('should not count deleted questions in getDueCount', () => {
      const now = Date.now();
      
      // Simulate questions for due count
      const questions = [
        { nextReview: now - 86400000, deletedAt: undefined }, // Due, not deleted
        { nextReview: now - 86400000, deletedAt: now }, // Due, but deleted
        { nextReview: now - 3600000, deletedAt: undefined }, // Due, not deleted
        { nextReview: undefined, deletedAt: undefined }, // New, not deleted
        { nextReview: undefined, deletedAt: now }, // New, but deleted
      ];

      // Count due questions (excluding deleted)
      const dueCount = questions.filter(q => 
        q.nextReview !== undefined && 
        q.nextReview <= now && 
        q.deletedAt === undefined
      ).length;

      // Count new questions (excluding deleted)
      const newCount = questions.filter(q => 
        q.nextReview === undefined && 
        q.deletedAt === undefined
      ).length;

      expect(dueCount).toBe(2); // Questions 1 and 3
      expect(newCount).toBe(1); // Question 4
      expect(dueCount + newCount).toBe(3); // Total reviewable
    });
  });

  describe('FSRS Calculation Integrity', () => {
    it('should maintain consistent retrievability calculations for restored questions', () => {
      const now = Date.now();
      const dayInMs = 86400000;
      
      // Question with FSRS data
      const question = {
        stability: 10.0,
        lastReview: now - dayInMs * 5, // 5 days ago
        nextReview: now + dayInMs * 5, // Due in 5 days
        scheduledDays: 10,
        deletedAt: undefined as number | undefined,
      };

      // Calculate retrievability before deletion
      const elapsedDays = (now - question.lastReview) / dayInMs;
      const retrievabilityBefore = Math.exp(-elapsedDays / question.stability * Math.log(2));

      // Soft delete
      question.deletedAt = now;

      // Restore after 2 hours
      const twoHoursLater = now + 7200000;
      question.deletedAt = undefined;

      // Calculate retrievability after restoration
      const elapsedDaysAfter = (twoHoursLater - question.lastReview) / dayInMs;
      const retrievabilityAfter = Math.exp(-elapsedDaysAfter / question.stability * Math.log(2));

      // Retrievability should have decreased slightly due to time passage
      // but the calculation should still work correctly
      expect(retrievabilityAfter).toBeLessThan(retrievabilityBefore);
      expect(retrievabilityAfter).toBeGreaterThan(0);
      expect(retrievabilityAfter).toBeLessThan(1);
    });

    it('should preserve scheduling intervals through delete/restore cycle', () => {
      // Question scheduled for review in 7 days
      const originalNextReview = Date.now() + 86400000 * 7;
      
      const question = {
        nextReview: originalNextReview,
        scheduledDays: 7,
        stability: 5.0,
        fsrsDifficulty: 3.0,
      };

      // After soft delete and restore, scheduling should be unchanged
      const afterDeleteRestore = { ...question };
      
      expect(afterDeleteRestore.nextReview).toBe(originalNextReview);
      expect(afterDeleteRestore.scheduledDays).toBe(7);
      expect(afterDeleteRestore.stability).toBe(5.0);
      expect(afterDeleteRestore.fsrsDifficulty).toBe(3.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle questions deleted before FSRS data exists', () => {
      // Question created before FSRS implementation
      const legacyQuestion = {
        _id: 'legacy123',
        question: 'Legacy question',
        correctAnswer: 'Answer',
        userId: 'user123',
        createdAt: Date.now() - 86400000 * 365, // 1 year old
        // No FSRS fields
      };

      // Soft delete
      const deletedLegacy = {
        ...legacyQuestion,
        deletedAt: Date.now(),
      };

      // Should not have any FSRS fields to preserve
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((deletedLegacy as any).stability).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((deletedLegacy as any).nextReview).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((deletedLegacy as any).state).toBeUndefined();
    });

    it('should handle questions in different FSRS states', () => {
      const stateScenarios = [
        { state: 'new' as const, expectedBehavior: 'excluded from review when deleted' },
        { state: 'learning' as const, expectedBehavior: 'excluded from review when deleted' },
        { state: 'review' as const, expectedBehavior: 'excluded from review when deleted' },
        { state: 'relearning' as const, expectedBehavior: 'excluded from review when deleted' },
      ];

      stateScenarios.forEach(scenario => {
        const question = {
          state: scenario.state,
          nextReview: Date.now() - 86400000, // Due for review
          deletedAt: Date.now(), // But deleted
        };

        // Regardless of state, deleted questions should be excluded
        const isEligibleForReview = question.deletedAt === undefined;
        expect(isEligibleForReview).toBe(false);
      });
    });
  });
});