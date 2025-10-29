import { Rating, State } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Doc, Id } from './_generated/dataModel';
import {
  calculateRatingFromCorrectness,
  cardToDb,
  dbToCard,
  getRetrievability,
  initializeCard,
  isDue,
  scheduleNextReview,
} from './fsrs';

describe('FSRS Automatic Rating Calculation', () => {
  describe('calculateRatingFromCorrectness', () => {
    it('should return Rating.Good (3) for correct answers', () => {
      const rating = calculateRatingFromCorrectness(true);
      expect(rating).toBe(Rating.Good);
      expect(rating).toBe(3);
    });

    it('should return Rating.Again (1) for incorrect answers', () => {
      const rating = calculateRatingFromCorrectness(false);
      expect(rating).toBe(Rating.Again);
      expect(rating).toBe(1);
    });

    it('should handle edge cases consistently', () => {
      // Test with various truthy/falsy values that might occur
      expect(calculateRatingFromCorrectness(true)).toBe(Rating.Good);
      expect(calculateRatingFromCorrectness(false)).toBe(Rating.Again);

      // TypeScript should prevent these, but good to be explicit
      expect(calculateRatingFromCorrectness(Boolean(1))).toBe(Rating.Good);
      expect(calculateRatingFromCorrectness(Boolean(0))).toBe(Rating.Again);
    });
  });

  describe('scheduleNextReview', () => {
    let mockQuestion: Doc<'questions'>;
    const fixedDate = new Date('2025-01-16T12:00:00Z');

    beforeEach(() => {
      // Create a mock question with FSRS fields
      mockQuestion = {
        _id: '123' as Id<'questions'>,
        _creationTime: Date.now(),
        question: 'Test question?',
        correctAnswer: 'Test answer',
        type: 'multiple-choice' as const,
        options: [],
        generatedAt: Date.now(),
        attemptCount: 0,
        correctCount: 0,
        userId: 'user123' as Id<'users'>,
        // FSRS fields
        nextReview: fixedDate.getTime(),
        state: 'new',
        stability: 0,
        fsrsDifficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        lastReview: undefined,
      };
    });

    it('should apply correct rating for correct answer', () => {
      const result = scheduleNextReview(mockQuestion, true, fixedDate);

      // Should use Rating.Good internally
      expect(result.updatedCard.reps).toBe(1);
      expect(result.updatedCard.state).not.toBe(State.New);

      // Should schedule for future review
      expect(result.dbFields.nextReview).toBeGreaterThan(fixedDate.getTime());
    });

    it('should apply correct rating for incorrect answer', () => {
      const result = scheduleNextReview(mockQuestion, false, fixedDate);

      // Should use Rating.Again internally
      expect(result.updatedCard.lapses).toBe(0); // New card doesn't increase lapses
      expect(result.updatedCard.state).toBe(State.Learning);

      // Should schedule for sooner review than correct answer
      const correctResult = scheduleNextReview(mockQuestion, true, fixedDate);
      expect(result.dbFields.nextReview).toBeLessThan(correctResult.dbFields.nextReview!);
    });

    it('should handle cards in different states appropriately', () => {
      // Test with a card in review state
      const reviewQuestion: Doc<'questions'> = {
        ...mockQuestion,
        state: 'review',
        reps: 5,
        stability: 10,
        nextReview: fixedDate.getTime() - 86400000, // 1 day overdue
      };

      const correctResult = scheduleNextReview(reviewQuestion, true, fixedDate);
      const incorrectResult = scheduleNextReview(reviewQuestion, false, fixedDate);

      // Incorrect answer should result in relearning state
      expect(incorrectResult.updatedCard.state).toBe(State.Relearning);
      expect(incorrectResult.updatedCard.lapses).toBe(1);

      // Correct answer should maintain review state
      expect(correctResult.updatedCard.state).toBe(State.Review);
      expect(correctResult.updatedCard.lapses).toBe(0);
    });

    it('should produce consistent results for the same inputs', () => {
      // Test deterministic behavior
      const result1 = scheduleNextReview(mockQuestion, true, fixedDate);
      const result2 = scheduleNextReview(mockQuestion, true, fixedDate);

      expect(result1.dbFields.nextReview).toBe(result2.dbFields.nextReview);
      expect(result1.dbFields.stability).toBe(result2.dbFields.stability);
      expect(result1.dbFields.fsrsDifficulty).toBe(result2.dbFields.fsrsDifficulty);
    });
  });

  describe('Card conversion functions', () => {
    it('should initialize new cards correctly', () => {
      const card = initializeCard();

      expect(card.state).toBe(State.New);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.stability).toBe(0);
      expect(card.difficulty).toBe(0);
    });

    it('should convert between DB and Card formats bidirectionally', () => {
      const question: Doc<'questions'> = {
        _id: '123' as Id<'questions'>,
        _creationTime: Date.now(),
        question: 'Test?',
        correctAnswer: 'Test',
        options: [],
        attemptCount: 1,
        correctCount: 1,
        userId: 'user123' as Id<'users'>,
        type: 'multiple-choice' as const,
        generatedAt: Date.now(),
        nextReview: Date.now() + 86400000,
        state: 'review',
        stability: 5.5,
        fsrsDifficulty: 3.2,
        elapsedDays: 2,
        scheduledDays: 1,
        reps: 3,
        lapses: 0,
        lastReview: Date.now(),
      };

      const card = dbToCard(question);
      const dbFields = cardToDb(card);

      // Verify key fields are preserved
      expect(dbFields.nextReview).toBe(question.nextReview);
      expect(dbFields.stability).toBe(question.stability);
      expect(dbFields.fsrsDifficulty).toBe(question.fsrsDifficulty);
      expect(dbFields.reps).toBe(question.reps);
      expect(dbFields.lapses).toBe(question.lapses);
      expect(dbFields.state).toBe(question.state);
    });

    it('should handle missing FSRS fields gracefully', () => {
      const questionWithoutFsrs: Doc<'questions'> = {
        _id: '123' as Id<'questions'>,
        _creationTime: Date.now(),
        question: 'Test?',
        correctAnswer: 'Test',
        options: [],
        attemptCount: 0,
        correctCount: 0,
        userId: 'user123' as Id<'users'>,
        type: 'multiple-choice' as const,
        generatedAt: Date.now(),
      };

      const card = dbToCard(questionWithoutFsrs);

      // Should return a new card
      expect(card.state).toBe(State.New);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
    });
  });

  describe('Retrievability and due status', () => {
    const now = new Date('2025-01-16T12:00:00Z');

    it('should calculate retrievability correctly', () => {
      const wellLearnedQuestion: Doc<'questions'> = {
        _id: '123' as Id<'questions'>,
        _creationTime: Date.now(),
        question: 'Test?',
        correctAnswer: 'Test',
        options: [],
        attemptCount: 10,
        correctCount: 9,
        userId: 'user123' as Id<'users'>,
        type: 'multiple-choice' as const,
        generatedAt: Date.now(),
        nextReview: now.getTime() + 86400000 * 7, // 7 days in future
        state: 'review',
        stability: 30,
        fsrsDifficulty: 2,
        elapsedDays: 0,
        scheduledDays: 7,
        reps: 10,
        lapses: 1,
        lastReview: now.getTime(),
      };

      const retrievability = getRetrievability(wellLearnedQuestion, now);

      // Should be high (close to 1) for recently reviewed card
      expect(retrievability).toBeGreaterThan(0.9);
      expect(retrievability).toBeLessThanOrEqual(1);
    });

    it('should identify due questions correctly', () => {
      const overdueQuestion: Doc<'questions'> = {
        _id: '123' as Id<'questions'>,
        _creationTime: Date.now(),
        question: 'Test?',
        correctAnswer: 'Test',
        options: [],
        attemptCount: 5,
        correctCount: 3,
        userId: 'user123' as Id<'users'>,
        type: 'multiple-choice' as const,
        generatedAt: Date.now(),
        nextReview: now.getTime() - 86400000, // 1 day overdue
        state: 'review',
        stability: 5,
        fsrsDifficulty: 3,
        elapsedDays: 2,
        scheduledDays: 1,
        reps: 5,
        lapses: 2,
        lastReview: now.getTime() - 86400000 * 2,
      };

      const futureQuestion: Doc<'questions'> = {
        ...overdueQuestion,
        nextReview: now.getTime() + 86400000, // 1 day in future
      };

      const newQuestion: Doc<'questions'> = {
        ...overdueQuestion,
        nextReview: undefined,
        state: 'new',
      };

      expect(isDue(overdueQuestion, now)).toBe(true);
      expect(isDue(futureQuestion, now)).toBe(false);
      expect(isDue(newQuestion, now)).toBe(true); // New questions are always due
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle extreme time values', () => {
      const question: Doc<'questions'> = {
        _id: '123' as Id<'questions'>,
        _creationTime: Date.now(),
        question: 'Test?',
        correctAnswer: 'Test',
        options: [],
        attemptCount: 0,
        correctCount: 0,
        userId: 'user123' as Id<'users'>,
        type: 'multiple-choice' as const,
        generatedAt: Date.now(),
        nextReview: 0, // Very old timestamp
        state: 'new',
        stability: 0,
        fsrsDifficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
      };

      const farFuture = new Date('2030-01-01');
      const result = scheduleNextReview(question, true, farFuture);

      // Should still produce valid results
      expect(result.dbFields.nextReview).toBeGreaterThan(farFuture.getTime());
      expect(result.updatedCard.state).not.toBe(State.New);
    });

    it('should maintain data integrity through multiple reviews', () => {
      let question: Doc<'questions'> = {
        _id: '123' as Id<'questions'>,
        _creationTime: Date.now(),
        question: 'Test?',
        correctAnswer: 'Test',
        options: [],
        attemptCount: 0,
        correctCount: 0,
        userId: 'user123' as Id<'users'>,
        type: 'multiple-choice' as const,
        generatedAt: Date.now(),
        state: 'new',
      };

      const baseTime = new Date('2025-01-01');

      // Simulate multiple review cycles
      for (let i = 0; i < 5; i++) {
        const isCorrect = i !== 2; // Fail on third attempt
        const reviewTime = new Date(baseTime.getTime() + i * 86400000 * 7); // Weekly reviews

        const result = scheduleNextReview(question, isCorrect, reviewTime);

        // Update question with new FSRS fields
        question = {
          ...question,
          ...result.dbFields,
        } as Doc<'questions'>;

        // Verify data consistency
        expect(result.dbFields.nextReview).toBeDefined();
        expect(result.dbFields.state).toBeDefined();
        expect(result.dbFields.reps).toBeGreaterThanOrEqual(i);
      }

      // After 5 reviews (1 incorrect), should have appropriate state
      expect(question.reps).toBeGreaterThanOrEqual(4);
      expect(question.lapses).toBeGreaterThanOrEqual(1);
    });
  });

  describe('FSRS Scheduling Intervals', () => {
    const fixedDate = new Date('2025-01-16T12:00:00Z');

    function createMockQuestion(overrides: Partial<Doc<'questions'>> = {}): Doc<'questions'> {
      return {
        _id: '123' as Id<'questions'>,
        _creationTime: Date.now(),
        question: 'Test question?',
        correctAnswer: 'Test answer',
        type: 'multiple-choice' as const,
        options: [],
        generatedAt: Date.now(),
        attemptCount: 0,
        correctCount: 0,
        userId: 'user123' as Id<'users'>,
        ...overrides,
      };
    }

    function getIntervalInMinutes(fromTime: number, toTime: number): number {
      return Math.round((toTime - fromTime) / (1000 * 60));
    }

    function getIntervalInDays(fromTime: number, toTime: number): number {
      return (toTime - fromTime) / (1000 * 60 * 60 * 24);
    }

    it('should schedule first review within minutes for new cards', () => {
      const newQuestion = createMockQuestion({ state: 'new' });

      // First correct answer
      const result = scheduleNextReview(newQuestion, true, fixedDate);
      const intervalMinutes = getIntervalInMinutes(
        fixedDate.getTime(),
        result.dbFields.nextReview!
      );

      // FSRS typically schedules new cards for review within 1-10 minutes
      expect(intervalMinutes).toBeGreaterThan(0);
      expect(intervalMinutes).toBeLessThanOrEqual(10);
      expect(result.updatedCard.state).toBe(State.Learning);
    });

    it('should schedule very short interval after first incorrect answer', () => {
      const newQuestion = createMockQuestion({ state: 'new' });

      // First incorrect answer
      const result = scheduleNextReview(newQuestion, false, fixedDate);
      const intervalMinutes = getIntervalInMinutes(
        fixedDate.getTime(),
        result.dbFields.nextReview!
      );

      // Failed cards should be reviewed again within 1-5 minutes
      expect(intervalMinutes).toBeGreaterThan(0);
      expect(intervalMinutes).toBeLessThanOrEqual(5);
      expect(result.updatedCard.state).toBe(State.Learning);
    });

    it('should increase intervals progressively for consecutive correct answers', () => {
      let question = createMockQuestion({ state: 'new' });
      const intervals: number[] = [];
      let currentTime = fixedDate;

      // Simulate 5 consecutive correct reviews
      for (let i = 0; i < 5; i++) {
        const result = scheduleNextReview(question, true, currentTime);
        const intervalDays = getIntervalInDays(currentTime.getTime(), result.dbFields.nextReview!);
        intervals.push(intervalDays);

        // Update question with new FSRS fields for next iteration
        question = { ...question, ...result.dbFields } as Doc<'questions'>;
        currentTime = new Date(result.dbFields.nextReview!);
      }

      // Verify intervals are increasing
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
      }

      // Verify reasonable progression (roughly exponential growth)
      expect(intervals[0]).toBeLessThan(1); // First interval < 1 day
      expect(intervals[intervals.length - 1]).toBeGreaterThan(1); // Last interval > 1 day
    });

    it('should reset to short intervals after incorrect answer in review state', () => {
      const reviewQuestion = createMockQuestion({
        state: 'review',
        stability: 10,
        reps: 5,
        nextReview: fixedDate.getTime() - 86400000, // 1 day overdue
        lastReview: fixedDate.getTime() - 86400000 * 3,
      });

      const result = scheduleNextReview(reviewQuestion, false, fixedDate);
      const intervalDays = getIntervalInDays(fixedDate.getTime(), result.dbFields.nextReview!);

      // After failing a review card, interval should be much shorter than before
      expect(intervalDays).toBeLessThan(1); // Less than 1 day
      expect(result.updatedCard.state).toBe(State.Relearning);
      expect(result.updatedCard.lapses).toBe(1);
    });

    it('should maintain reasonable maximum intervals', () => {
      // Simulate a well-learned card
      const wellLearnedQuestion = createMockQuestion({
        state: 'review',
        stability: 50,
        reps: 20,
        lapses: 0,
        nextReview: fixedDate.getTime(),
        lastReview: fixedDate.getTime() - 86400000 * 30, // 30 days ago
      });

      const result = scheduleNextReview(wellLearnedQuestion, true, fixedDate);
      const intervalDays = getIntervalInDays(fixedDate.getTime(), result.dbFields.nextReview!);

      // Even well-learned cards shouldn't exceed 365 days (as per DEFAULT_FSRS_PARAMS)
      expect(intervalDays).toBeGreaterThan(30); // Should be longer than previous
      expect(intervalDays).toBeLessThanOrEqual(365); // But not exceed maximum
    });

    it('should handle overdue cards appropriately', () => {
      const overdueDays = 7;
      const overdueQuestion = createMockQuestion({
        state: 'review',
        stability: 5,
        reps: 3,
        nextReview: fixedDate.getTime() - 86400000 * overdueDays, // 7 days overdue
        lastReview: fixedDate.getTime() - 86400000 * 10,
      });

      // Test correct answer on overdue card
      const correctResult = scheduleNextReview(overdueQuestion, true, fixedDate);
      const correctIntervalDays = getIntervalInDays(
        fixedDate.getTime(),
        correctResult.dbFields.nextReview!
      );

      // Test incorrect answer on overdue card
      const incorrectResult = scheduleNextReview(overdueQuestion, false, fixedDate);
      const incorrectIntervalDays = getIntervalInDays(
        fixedDate.getTime(),
        incorrectResult.dbFields.nextReview!
      );

      // Correct answer should still result in reasonable interval
      expect(correctIntervalDays).toBeGreaterThan(1);
      // Incorrect answer should reset to short interval
      expect(incorrectIntervalDays).toBeLessThan(1);
    });

    it('should produce consistent interval patterns for same inputs', () => {
      const question = createMockQuestion({ state: 'new' });
      const intervals: number[] = [];

      // Run the same sequence twice
      for (let run = 0; run < 2; run++) {
        let tempQuestion = { ...question };
        let tempTime = fixedDate;

        for (let i = 0; i < 3; i++) {
          const result = scheduleNextReview(tempQuestion, true, tempTime);
          if (run === 0) {
            intervals.push(result.dbFields.nextReview!);
          } else {
            // Second run should produce identical intervals
            expect(result.dbFields.nextReview).toBe(intervals[i]);
          }
          tempQuestion = { ...tempQuestion, ...result.dbFields } as Doc<'questions'>;
          tempTime = new Date(result.dbFields.nextReview!);
        }
      }
    });

    it('should handle learning phase progression appropriately', () => {
      let question = createMockQuestion({ state: 'new' });
      const results: Array<{ interval: number; state: string }> = [];
      let currentTime = fixedDate;

      // Simulate learning phase with mixed results
      const answers = [true, true, false, true, true, true];

      for (const isCorrect of answers) {
        const result = scheduleNextReview(question, isCorrect, currentTime);
        const intervalMinutes = getIntervalInMinutes(
          currentTime.getTime(),
          result.dbFields.nextReview!
        );

        results.push({
          interval: intervalMinutes,
          state: result.dbFields.state!,
        });

        question = { ...question, ...result.dbFields } as Doc<'questions'>;
        currentTime = new Date(result.dbFields.nextReview!);
      }

      // Verify learning progression
      // After incorrect answer (index 2), interval should be shorter
      expect(results[3].interval).toBeLessThan(results[1].interval);

      // Eventually should graduate to review state
      const finalStates = results.map((r) => r.state);
      expect(finalStates).toContain('review');
    });

    it('should calculate appropriate intervals based on difficulty', () => {
      // Test with different difficulty levels - need proper FSRS card state
      const easyQuestion = createMockQuestion({
        state: 'review',
        stability: 10,
        fsrsDifficulty: 1, // Easy
        reps: 5,
        elapsedDays: 10,
        scheduledDays: 10,
        lastReview: fixedDate.getTime() - 86400000 * 10,
        nextReview: fixedDate.getTime(),
      });

      const hardQuestion = createMockQuestion({
        state: 'review',
        stability: 10,
        fsrsDifficulty: 8, // Very Hard (scale is typically 0-10)
        reps: 5,
        elapsedDays: 10,
        scheduledDays: 10,
        lastReview: fixedDate.getTime() - 86400000 * 10,
        nextReview: fixedDate.getTime(),
      });

      const easyResult = scheduleNextReview(easyQuestion, true, fixedDate);
      const hardResult = scheduleNextReview(hardQuestion, true, fixedDate);

      const easyInterval = getIntervalInDays(fixedDate.getTime(), easyResult.dbFields.nextReview!);
      const hardInterval = getIntervalInDays(fixedDate.getTime(), hardResult.dbFields.nextReview!);

      // With more extreme difficulty difference and proper card state,
      // intervals should differ, or at least not favor hard questions
      expect(easyInterval).toBeGreaterThanOrEqual(hardInterval);

      // Also verify that difficulty is preserved
      expect(easyResult.dbFields.fsrsDifficulty).toBeLessThan(hardResult.dbFields.fsrsDifficulty!);
    });
  });
});
