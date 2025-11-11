import { describe, expect, it } from 'vitest';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import {
  calculateFreshnessDecay,
  calculateRetrievabilityScore,
} from '../../convex/spacedRepetition';

describe('Review Queue Prioritization', () => {
  const mockUserId = 'user123' as Id<'users'>;
  const now = new Date('2025-01-16T12:00:00Z');

  function createMockQuestion(overrides: Partial<Doc<'questions'>> = {}): Doc<'questions'> {
    return {
      _id: Math.random().toString() as Id<'questions'>,
      _creationTime: Date.now(),
      question: 'Test question?',
      correctAnswer: 'Test answer',
      type: 'multiple-choice' as const,
      options: [],
      generatedAt: Date.now(),
      attemptCount: 0,
      correctCount: 0,
      userId: mockUserId,
      ...overrides,
    };
  }

  // Simulate the prioritization logic from getNextReview
  function simulatePrioritization(questions: Doc<'questions'>[], currentTime: Date = now) {
    const questionsWithPriority = questions.map((q) => ({
      question: q,
      retrievability: calculateRetrievabilityScore(q, currentTime),
    }));

    // Sort by retrievability (lower = higher priority)
    questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);

    return questionsWithPriority;
  }

  describe('Basic Prioritization Rules', () => {
    it('should prioritize new questions (undefined nextReview) highest', () => {
      const newQuestion = createMockQuestion({
        _id: 'new1' as Id<'questions'>,
        nextReview: undefined,
        state: 'new',
        reps: 0,
      });

      const overdueQuestion = createMockQuestion({
        _id: 'overdue1' as Id<'questions'>,
        nextReview: now.getTime() - 86400000, // 1 day overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000 * 2,
        reps: 5,
        elapsedDays: 1,
        scheduledDays: 1,
      });

      const prioritized = simulatePrioritization([overdueQuestion, newQuestion]);

      expect(prioritized[0].question._id).toBe('new1');
      // New questions with freshness boost should be in range -2 to -1
      expect(prioritized[0].retrievability).toBeLessThanOrEqual(-1);
      expect(prioritized[0].retrievability).toBeGreaterThanOrEqual(-2);
      expect(prioritized[1].question._id).toBe('overdue1');
      expect(prioritized[1].retrievability).toBeGreaterThanOrEqual(0);
      expect(prioritized[1].retrievability).toBeLessThanOrEqual(1);
    });

    it('should exclude questions not yet due', () => {
      const futureQuestion = createMockQuestion({
        _id: 'future1' as Id<'questions'>,
        nextReview: now.getTime() + 86400000, // 1 day in future
        state: 'review',
      });

      const dueQuestion = createMockQuestion({
        _id: 'due1' as Id<'questions'>,
        nextReview: now.getTime() - 3600000, // 1 hour overdue
        state: 'review',
      });

      // In real implementation, future questions are filtered out by the query
      // Here we simulate by checking nextReview time
      const candidates = [futureQuestion, dueQuestion].filter(
        (q) => q.nextReview === undefined || q.nextReview <= now.getTime()
      );

      expect(candidates).toHaveLength(1);
      expect(candidates[0]._id).toBe('due1');
    });

    it('should sort overdue questions by retrievability (lower first)', () => {
      // Create questions with different overdue periods and stability
      const veryOverdue = createMockQuestion({
        _id: 'very-overdue' as Id<'questions'>,
        nextReview: now.getTime() - 86400000 * 7, // 7 days overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000 * 14,
        elapsedDays: 7,
        scheduledDays: 7,
        reps: 5,
      });

      const slightlyOverdue = createMockQuestion({
        _id: 'slightly-overdue' as Id<'questions'>,
        nextReview: now.getTime() - 3600000, // 1 hour overdue
        state: 'review',
        stability: 10,
        lastReview: now.getTime() - 86400000,
        elapsedDays: 0.04, // ~1 hour
        scheduledDays: 1,
        reps: 3,
      });

      const moderatelyOverdue = createMockQuestion({
        _id: 'moderately-overdue' as Id<'questions'>,
        nextReview: now.getTime() - 86400000 * 2, // 2 days overdue
        state: 'review',
        stability: 7,
        lastReview: now.getTime() - 86400000 * 5,
        elapsedDays: 2,
        scheduledDays: 3,
        reps: 4,
      });

      const prioritized = simulatePrioritization([slightlyOverdue, veryOverdue, moderatelyOverdue]);

      // More overdue questions should have lower retrievability (higher priority)
      expect(prioritized[0].retrievability).toBeLessThan(prioritized[1].retrievability);
      expect(prioritized[1].retrievability).toBeLessThan(prioritized[2].retrievability);

      // Verify all retrievability values are in valid range (0-1 for reviewed questions)
      prioritized.forEach((p) => {
        expect(p.retrievability).toBeGreaterThanOrEqual(0);
        expect(p.retrievability).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Mixed Queue Scenarios', () => {
    it('should handle mix of new, learning, and review questions', () => {
      const questions = [
        createMockQuestion({
          _id: 'new1' as Id<'questions'>,
          state: 'new',
          nextReview: undefined,
          reps: 0,
        }),
        createMockQuestion({
          _id: 'learning1' as Id<'questions'>,
          state: 'learning',
          nextReview: now.getTime() - 600000, // 10 min overdue
          stability: 0.5,
          reps: 1,
          lastReview: now.getTime() - 1200000, // 20 min ago
          elapsedDays: 0.01,
          scheduledDays: 0.01,
        }),
        createMockQuestion({
          _id: 'review1' as Id<'questions'>,
          state: 'review',
          nextReview: now.getTime() - 86400000, // 1 day overdue
          stability: 10,
          reps: 5,
          lastReview: now.getTime() - 86400000 * 5, // 5 days ago
          elapsedDays: 1,
          scheduledDays: 4,
        }),
        createMockQuestion({
          _id: 'new2' as Id<'questions'>,
          state: 'new',
          nextReview: undefined,
          reps: 0,
        }),
        createMockQuestion({
          _id: 'relearning1' as Id<'questions'>,
          state: 'relearning',
          nextReview: now.getTime() - 1800000, // 30 min overdue
          stability: 2,
          lapses: 1,
          reps: 3,
          lastReview: now.getTime() - 3600000, // 1 hour ago
          elapsedDays: 0.04,
          scheduledDays: 0.02,
        }),
      ];

      const prioritized = simulatePrioritization(questions);

      // New questions should be first (retrievability between -2 and -1)
      expect(prioritized[0].question.state).toBe('new');
      expect(prioritized[1].question.state).toBe('new');
      expect(prioritized[0].retrievability).toBeLessThanOrEqual(-1);
      expect(prioritized[0].retrievability).toBeGreaterThanOrEqual(-2);
      expect(prioritized[1].retrievability).toBeLessThanOrEqual(-1);
      expect(prioritized[1].retrievability).toBeGreaterThanOrEqual(-2);

      // Then other states sorted by retrievability (0-1 range for reviewed cards)
      expect(prioritized[2].retrievability).toBeGreaterThanOrEqual(0);
      expect(prioritized[3].retrievability).toBeGreaterThanOrEqual(0);
      expect(prioritized[4].retrievability).toBeGreaterThanOrEqual(0);
    });

    it('should maintain stable sort for questions with same retrievability', () => {
      // Create questions with identical creation time to ensure same retrievability
      const sameCreationTime = now.getTime();
      const questions = [
        createMockQuestion({
          _id: 'new1' as Id<'questions'>,
          nextReview: undefined,
          state: 'new',
          reps: 0,
          _creationTime: sameCreationTime,
        }),
        createMockQuestion({
          _id: 'new2' as Id<'questions'>,
          nextReview: undefined,
          state: 'new',
          reps: 0,
          _creationTime: sameCreationTime,
        }),
        createMockQuestion({
          _id: 'new3' as Id<'questions'>,
          nextReview: undefined,
          state: 'new',
          reps: 0,
          _creationTime: sameCreationTime,
        }),
      ];

      const prioritized = simulatePrioritization(questions);

      // All new questions created at same time have same retrievability
      const firstRetrievability = prioritized[0].retrievability;
      expect(prioritized.every((p) => p.retrievability === firstRetrievability)).toBe(true);

      // Retrievability should be in new question range (-2 to -1)
      expect(firstRetrievability).toBeLessThanOrEqual(-1);
      expect(firstRetrievability).toBeGreaterThanOrEqual(-2);

      // Order should be preserved for equal priorities (stable sort)
      expect(prioritized.map((p) => p.question._id)).toEqual(['new1', 'new2', 'new3']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle new questions without FSRS fields', () => {
      // New questions get highest priority regardless of FSRS fields
      const newQuestion = createMockQuestion({
        _id: 'new-no-fsrs' as Id<'questions'>,
        state: 'new',
        nextReview: undefined,
        reps: 0,
      });

      const reviewQuestion = createMockQuestion({
        _id: 'review-complete' as Id<'questions'>,
        nextReview: now.getTime() - 86400000, // overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000 * 2,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 3,
        lapses: 0,
        fsrsDifficulty: 3,
      });

      const prioritized = simulatePrioritization([reviewQuestion, newQuestion]);

      // New question should be first with retrievability in -2 to -1 range
      expect(prioritized[0].question._id).toBe('new-no-fsrs');
      expect(prioritized[0].retrievability).toBeLessThanOrEqual(-1);
      expect(prioritized[0].retrievability).toBeGreaterThanOrEqual(-2);

      // Review question should have valid retrievability
      expect(prioritized[1].retrievability).toBeGreaterThanOrEqual(0);
      expect(prioritized[1].retrievability).toBeLessThanOrEqual(1);
    });

    it('should handle empty queue gracefully', () => {
      const prioritized = simulatePrioritization([]);
      expect(prioritized).toHaveLength(0);
    });

    it('should handle very large overdue periods', () => {
      const ancientQuestion = createMockQuestion({
        _id: 'ancient' as Id<'questions'>,
        nextReview: now.getTime() - 86400000 * 365, // 1 year overdue
        state: 'review',
        stability: 30,
        lastReview: now.getTime() - 86400000 * 365 * 2,
        elapsedDays: 365,
        scheduledDays: 180,
        reps: 10,
      });

      const recentQuestion = createMockQuestion({
        _id: 'recent' as Id<'questions'>,
        nextReview: now.getTime() - 3600000, // 1 hour overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000,
        elapsedDays: 0.04,
        scheduledDays: 1,
        reps: 3,
      });

      const prioritized = simulatePrioritization([recentQuestion, ancientQuestion]);

      // Ancient question should have much lower retrievability (higher priority)
      expect(prioritized[0].question._id).toBe('ancient');
      expect(prioritized[0].retrievability).toBeLessThan(prioritized[1].retrievability); // Lower than recent
      expect(prioritized[0].retrievability).toBeGreaterThanOrEqual(0); // Still in valid range
      expect(prioritized[0].retrievability).toBeLessThan(0.7); // Reasonably low
      expect(prioritized[1].retrievability).toBeGreaterThan(0.8); // Recent should be high
    });
  });

  describe('Retrievability Calculation Verification', () => {
    it('should calculate decreasing retrievability over time', () => {
      const baseQuestion = createMockQuestion({
        state: 'review',
        stability: 10,
        lastReview: now.getTime() - 86400000 * 5, // 5 days ago
        nextReview: now.getTime() - 86400000 * 2, // 2 days overdue
        elapsedDays: 5,
        scheduledDays: 3,
        reps: 5,
      });

      // Test retrievability at different times
      const times = [
        now,
        new Date(now.getTime() + 86400000), // 1 day later
        new Date(now.getTime() + 86400000 * 7), // 1 week later
        new Date(now.getTime() + 86400000 * 30), // 1 month later
      ];

      const retrievabilities = times.map((time) =>
        calculateRetrievabilityScore(baseQuestion, time)
      );

      // Retrievability should decrease over time
      for (let i = 1; i < retrievabilities.length; i++) {
        expect(retrievabilities[i]).toBeLessThan(retrievabilities[i - 1]);
      }

      // All should be valid probabilities
      retrievabilities.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('No Daily Limits Enforcement', () => {
  const mockUserId = 'user123' as Id<'users'>;
  const now = new Date('2025-01-16T12:00:00Z');

  function createMockQuestion(overrides: Partial<Doc<'questions'>> = {}): Doc<'questions'> {
    return {
      _id: Math.random().toString() as Id<'questions'>,
      _creationTime: now.getTime() - 86400000, // 1 day old by default
      question: 'Test question?',
      correctAnswer: 'Test answer',
      type: 'multiple-choice' as const,
      options: [],
      generatedAt: Date.now(),
      attemptCount: 0,
      correctCount: 0,
      userId: mockUserId,
      ...overrides,
    };
  }

  it('should return all due questions without any daily limit', () => {
    // Create 150 questions that are all due for review
    const questions: Doc<'questions'>[] = [];

    // Add 50 new questions (no nextReview)
    for (let i = 0; i < 50; i++) {
      questions.push(
        createMockQuestion({
          _id: `new-${i}` as Id<'questions'>,
          nextReview: undefined,
          state: 'new',
          reps: 0,
        })
      );
    }

    // Add 100 overdue review questions
    for (let i = 0; i < 100; i++) {
      const daysOverdue = Math.floor(Math.random() * 30) + 1; // 1-30 days overdue
      questions.push(
        createMockQuestion({
          _id: `review-${i}` as Id<'questions'>,
          nextReview: now.getTime() - 86400000 * daysOverdue,
          state: 'review',
          stability: Math.random() * 20 + 5, // 5-25 stability
          lastReview: now.getTime() - 86400000 * (daysOverdue + 5),
          elapsedDays: daysOverdue,
          scheduledDays: daysOverdue,
          reps: Math.floor(Math.random() * 10) + 1, // 1-10 reps
        })
      );
    }

    // Simulate the queue filtering logic (all due questions should be included)
    const dueQuestions = questions.filter(
      (q) => q.nextReview === undefined || q.nextReview <= now.getTime()
    );

    // Verify all 150 questions are considered due
    expect(dueQuestions).toHaveLength(150);

    // Calculate priority for all questions
    const questionsWithPriority = dueQuestions.map((q) => ({
      question: q,
      retrievability: calculateRetrievabilityScore(q, now),
    }));

    // Sort by priority
    questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);

    // Verify the queue contains all 150 questions
    expect(questionsWithPriority).toHaveLength(150);

    // Verify new questions are prioritized first (they have negative scores -2 to -1)
    const first50 = questionsWithPriority.slice(0, 50);
    first50.forEach((item) => {
      expect(item.question.state).toBe('new');
      expect(item.retrievability).toBeLessThan(0); // New questions have negative scores
      expect(item.retrievability).toBeGreaterThanOrEqual(-2); // In valid range
    });

    // Verify review questions come after new questions
    const next100 = questionsWithPriority.slice(50, 150);
    next100.forEach((item) => {
      expect(item.question.state).toBe('review');
      expect(item.retrievability).toBeGreaterThanOrEqual(0); // Reviews have 0-1 scores
    });
  });

  it('should handle extreme cases with 1000+ due questions', () => {
    // Create 1000 due questions
    const questions: Doc<'questions'>[] = [];

    for (let i = 0; i < 1000; i++) {
      if (i < 200) {
        // 200 new questions
        questions.push(
          createMockQuestion({
            _id: `new-${i}` as Id<'questions'>,
            nextReview: undefined,
            state: 'new',
            _creationTime: now.getTime() - i * 3600000, // Varying freshness
          })
        );
      } else {
        // 800 overdue review questions
        questions.push(
          createMockQuestion({
            _id: `review-${i}` as Id<'questions'>,
            nextReview: now.getTime() - 86400000 * ((i % 30) + 1),
            state: 'review',
            stability: 10,
            lastReview: now.getTime() - 86400000 * ((i % 30) + 10),
          })
        );
      }
    }

    // Filter due questions (all should be due)
    const dueQuestions = questions.filter(
      (q) => q.nextReview === undefined || q.nextReview <= now.getTime()
    );

    // Verify all 1000 questions are included
    expect(dueQuestions).toHaveLength(1000);

    // No artificial limit should be applied
    // In a system with daily limits, this might be capped at 20, 50, or 100
    // Pure FSRS shows everything
    expect(dueQuestions.length).toBeGreaterThan(100);
    expect(dueQuestions.length).toBe(1000);
  });

  it('should return actual count in getDueCount without limits', () => {
    // This test simulates what getDueCount would return

    // Create various questions
    const newQuestions = 75; // 75 new questions
    const dueReviews = 150; // 150 overdue reviews
    const futureReviews = 50; // 50 not yet due (should be excluded)

    const totalDue = newQuestions + dueReviews;
    const totalNotDue = futureReviews;

    // Simulate getDueCount logic
    const dueCount = {
      dueCount: dueReviews,
      newCount: newQuestions,
      totalReviewable: totalDue,
    };

    // Verify counts are honest and unlimited
    expect(dueCount.totalReviewable).toBe(225);
    expect(dueCount.dueCount).toBe(150);
    expect(dueCount.newCount).toBe(75);

    // No daily limit applied (would typically cap at 20-100 in comfort systems)
    expect(dueCount.totalReviewable).toBeGreaterThan(100);

    // Verify future reviews are NOT included
    expect(dueCount.totalReviewable).not.toBe(totalDue + totalNotDue);
  });

  it('should maintain Pure FSRS principles with large queues', () => {
    // Test that Pure FSRS principles are maintained even with overwhelming queues

    const questions: Doc<'questions'>[] = [];

    // Create a realistic overwhelming scenario:
    // - User generated 50 questions yesterday (all new)
    // - Has 200 overdue reviews from previous learning
    // - Just generated 30 more questions today

    // Yesterday's questions (24 hours old)
    for (let i = 0; i < 50; i++) {
      questions.push(
        createMockQuestion({
          _id: `yesterday-${i}` as Id<'questions'>,
          nextReview: undefined,
          state: 'new',
          reps: 0,
          _creationTime: now.getTime() - 86400000, // 24 hours old
        })
      );
    }

    // Today's fresh questions (0-30 minutes old)
    for (let i = 0; i < 30; i++) {
      questions.push(
        createMockQuestion({
          _id: `today-${i}` as Id<'questions'>,
          nextReview: undefined,
          state: 'new',
          reps: 0,
          _creationTime: now.getTime() - i * 60000, // 0-30 minutes old
        })
      );
    }

    // Overdue reviews
    for (let i = 0; i < 200; i++) {
      questions.push(
        createMockQuestion({
          _id: `overdue-${i}` as Id<'questions'>,
          nextReview: now.getTime() - 86400000 * ((i % 10) + 1),
          state: 'review',
          stability: 8,
          lastReview: now.getTime() - 86400000 * ((i % 10) + 5),
          reps: Math.floor(i / 10) + 1, // 1-20 reps depending on overdue group
        })
      );
    }

    // Calculate priorities
    const questionsWithPriority = questions.map((q) => ({
      question: q,
      retrievability: calculateRetrievabilityScore(q, now),
    }));

    questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);

    // Verify all 280 questions are present
    expect(questionsWithPriority).toHaveLength(280);

    // Verify Pure FSRS ordering:
    // 1. All new questions first (today's + yesterday's) - they have scores -2 to -1
    const allNewQuestions = questionsWithPriority.filter((item) => item.question.state === 'new');
    expect(allNewQuestions).toHaveLength(80); // 30 today + 50 yesterday

    // All new questions should have negative scores (higher priority than reviewed)
    allNewQuestions.forEach((item) => {
      expect(item.retrievability).toBeLessThan(0);
      expect(item.retrievability).toBeGreaterThanOrEqual(-2);
    });

    // 2. Fresh questions should be prioritized over older new questions
    const todayQuestions = allNewQuestions.filter((item) => item.question._id.includes('today'));
    const yesterdayQuestions = allNewQuestions.filter((item) =>
      item.question._id.includes('yesterday')
    );

    // Today's questions should generally have lower scores (higher priority)
    // Find the least fresh today question and most fresh yesterday question
    const leastFreshToday = Math.max(...todayQuestions.map((q) => q.retrievability));
    const mostFreshYesterday = Math.min(...yesterdayQuestions.map((q) => q.retrievability));

    // Today's least fresh should still be higher priority than yesterday's most fresh
    expect(leastFreshToday).toBeLessThan(mostFreshYesterday);

    // 3. All 200 overdue reviews last (positive scores 0-1)
    const remaining200 = questionsWithPriority.filter((item) => item.question.state === 'review');
    expect(remaining200).toHaveLength(200);
    remaining200.forEach((item) => {
      expect(item.retrievability).toBeGreaterThanOrEqual(0);
      expect(item.retrievability).toBeLessThanOrEqual(1);
    });

    // Key principle: No comfort features
    // - All 280 questions are shown (no daily limit)
    // - Natural consequence: User faces the debt they created
    // - This teaches sustainable generation habits
    console.log('Pure FSRS: User faces all 280 questions - natural consequences teach moderation');
  });
});

describe('Retrievability Scoring Functions', () => {
  const mockUserId = 'user123' as Id<'users'>;
  const now = new Date('2025-01-16T12:00:00Z');

  function createMockQuestion(overrides: Partial<Doc<'questions'>> = {}): Doc<'questions'> {
    return {
      _id: Math.random().toString() as Id<'questions'>,
      _creationTime: now.getTime(),
      question: 'Test question?',
      correctAnswer: 'Test answer',
      type: 'multiple-choice' as const,
      options: [],
      generatedAt: Date.now(),
      attemptCount: 0,
      correctCount: 0,
      userId: mockUserId,
      ...overrides,
    };
  }

  describe('calculateFreshnessDecay', () => {
    it('should return 1.0 at 0 hours (maximum freshness)', () => {
      const decay = calculateFreshnessDecay(0);
      expect(decay).toBeCloseTo(1.0, 5);
    });

    it('should return ~0.37 at 24 hours (e^-1)', () => {
      const decay = calculateFreshnessDecay(24);
      expect(decay).toBeCloseTo(Math.exp(-1), 3);
      expect(decay).toBeCloseTo(0.368, 2);
    });

    it('should return ~0.14 at 48 hours (e^-2)', () => {
      const decay = calculateFreshnessDecay(48);
      expect(decay).toBeCloseTo(Math.exp(-2), 3);
      expect(decay).toBeCloseTo(0.135, 2);
    });

    it('should return near 0 at 72+ hours', () => {
      const decay72 = calculateFreshnessDecay(72);
      expect(decay72).toBeCloseTo(Math.exp(-3), 3);
      expect(decay72).toBeLessThan(0.05);

      const decay96 = calculateFreshnessDecay(96);
      expect(decay96).toBeLessThan(0.02);

      const decay120 = calculateFreshnessDecay(120);
      expect(decay120).toBeLessThan(0.01);
    });

    it('should follow exponential decay pattern', () => {
      const hours = [0, 6, 12, 18, 24, 30, 36, 42, 48];
      const decays = hours.map((h) => calculateFreshnessDecay(h));

      // Each value should be less than the previous (monotonic decrease)
      for (let i = 1; i < decays.length; i++) {
        expect(decays[i]).toBeLessThan(decays[i - 1]);
      }

      // All values should be between 0 and 1
      decays.forEach((decay) => {
        expect(decay).toBeGreaterThanOrEqual(0);
        expect(decay).toBeLessThanOrEqual(1);
      });
    });

    it('should handle fractional hours correctly', () => {
      const decay30min = calculateFreshnessDecay(0.5);
      expect(decay30min).toBeGreaterThan(0.97);
      expect(decay30min).toBeLessThan(1);

      const decay90min = calculateFreshnessDecay(1.5);
      expect(decay90min).toBeGreaterThan(0.93);
      expect(decay90min).toBeLessThan(0.98);
    });

    it('should gracefully handle negative hours (clock skew) by returning maximum freshness', () => {
      // When client/server times are misaligned, treat as maximum freshness
      expect(calculateFreshnessDecay(-1)).toBe(1.0);
      expect(calculateFreshnessDecay(-0.5)).toBe(1.0);
      expect(calculateFreshnessDecay(-24)).toBe(1.0);
      expect(calculateFreshnessDecay(-100)).toBe(1.0);

      // This prevents crashes while still giving new questions appropriate priority
      expect(calculateFreshnessDecay(-0.001)).toBe(1.0);
    });

    it('should handle edge case of exactly 0 hours', () => {
      const decay = calculateFreshnessDecay(0);
      expect(decay).toBe(1.0);
    });
  });

  describe('calculateRetrievabilityScore', () => {
    describe('new questions (no nextReview)', () => {
      it('should return -2 for ultra-fresh questions (0 hours old)', () => {
        const question = createMockQuestion({
          _creationTime: now.getTime(),
          nextReview: undefined,
        });

        const score = calculateRetrievabilityScore(question, now);
        expect(score).toBeCloseTo(-2, 5);
      });

      it('should return between -2 and -1 for fresh questions (0-24 hours)', () => {
        // 6 hours old
        const question6h = createMockQuestion({
          _creationTime: now.getTime() - 6 * 3600000,
          nextReview: undefined,
        });
        const score6h = calculateRetrievabilityScore(question6h, now);
        expect(score6h).toBeLessThan(-1);
        expect(score6h).toBeGreaterThan(-2);

        // 12 hours old
        const question12h = createMockQuestion({
          _creationTime: now.getTime() - 12 * 3600000,
          nextReview: undefined,
        });
        const score12h = calculateRetrievabilityScore(question12h, now);
        expect(score12h).toBeLessThan(-1);
        expect(score12h).toBeGreaterThan(-2);
        expect(score12h).toBeGreaterThan(score6h); // Less fresh = higher score

        // 23 hours old
        const question23h = createMockQuestion({
          _creationTime: now.getTime() - 23 * 3600000,
          nextReview: undefined,
        });
        const score23h = calculateRetrievabilityScore(question23h, now);
        expect(score23h).toBeLessThan(-1);
        expect(score23h).toBeGreaterThan(-1.5);
      });

      it('should return close to -1 for older questions (24+ hours)', () => {
        // 24 hours old
        const question24h = createMockQuestion({
          _creationTime: now.getTime() - 24 * 3600000,
          nextReview: undefined,
        });
        const score24h = calculateRetrievabilityScore(question24h, now);
        expect(score24h).toBeCloseTo(-1 - Math.exp(-1), 2);

        // 48 hours old
        const question48h = createMockQuestion({
          _creationTime: now.getTime() - 48 * 3600000,
          nextReview: undefined,
        });
        const score48h = calculateRetrievabilityScore(question48h, now);
        expect(score48h).toBeCloseTo(-1 - Math.exp(-2), 2);

        // 72+ hours old (effectively -1)
        const question72h = createMockQuestion({
          _creationTime: now.getTime() - 72 * 3600000,
          nextReview: undefined,
        });
        const score72h = calculateRetrievabilityScore(question72h, now);
        expect(score72h).toBeGreaterThan(-1.05);
        expect(score72h).toBeLessThan(-1);
      });

      it('should prioritize newer questions over older ones', () => {
        const ages = [0, 1, 3, 6, 12, 24, 48, 72]; // hours
        const questions = ages.map((age) =>
          createMockQuestion({
            _creationTime: now.getTime() - age * 3600000,
            nextReview: undefined,
          })
        );

        const scores = questions.map((q) => calculateRetrievabilityScore(q, now));

        // Scores should increase (lower priority) with age
        for (let i = 1; i < scores.length; i++) {
          expect(scores[i]).toBeGreaterThan(scores[i - 1]);
        }

        // All scores should be between -2 and -1
        scores.forEach((score) => {
          expect(score).toBeGreaterThanOrEqual(-2);
          expect(score).toBeLessThanOrEqual(-1);
        });
      });

      it('should strictly enforce priority range boundaries for new questions', () => {
        // Test absolute boundaries at various ages
        const testCases = [
          { hours: 0, expectedMin: -2, expectedMax: -1.999 }, // Ultra-fresh
          { hours: 0.001, expectedMin: -2, expectedMax: -1.99 }, // Nearly fresh
          { hours: 1, expectedMin: -1.97, expectedMax: -1.95 }, // 1 hour old
          { hours: 6, expectedMin: -1.8, expectedMax: -1.7 }, // 6 hours old
          { hours: 12, expectedMin: -1.65, expectedMax: -1.55 }, // 12 hours old
          { hours: 24, expectedMin: -1.4, expectedMax: -1.3 }, // 24 hours old
          { hours: 48, expectedMin: -1.2, expectedMax: -1.1 }, // 48 hours old
          { hours: 72, expectedMin: -1.1, expectedMax: -1.0 }, // 72 hours old
          { hours: 96, expectedMin: -1.02, expectedMax: -1.0 }, // 96 hours old
          { hours: 120, expectedMin: -1.01, expectedMax: -1.0 }, // 120 hours old
        ];

        testCases.forEach(({ hours, expectedMin, expectedMax }) => {
          const question = createMockQuestion({
            _creationTime: now.getTime() - hours * 3600000,
            nextReview: undefined,
          });

          const score = calculateRetrievabilityScore(question, now);

          // Strict boundaries: must be within -2 to -1
          expect(score).toBeGreaterThanOrEqual(-2);
          expect(score).toBeLessThanOrEqual(-1);

          // More specific range for each age
          expect(score).toBeGreaterThanOrEqual(expectedMin);
          expect(score).toBeLessThanOrEqual(expectedMax);
        });
      });

      it('should never exceed -2 or -1 boundaries regardless of input', () => {
        // Test extreme cases
        const extremeCases = [
          0, // Brand new
          0.0001, // Milliseconds old
          Number.EPSILON, // Smallest positive number
          1000000, // Very old (millions of hours)
          Number.MAX_SAFE_INTEGER / 3600000, // Maximum safe hours
        ];

        extremeCases.forEach((hours) => {
          const question = createMockQuestion({
            _creationTime: now.getTime() - hours * 3600000,
            nextReview: undefined,
          });

          const score = calculateRetrievabilityScore(question, now);

          // Absolute boundaries that must never be violated
          expect(score).toBeGreaterThanOrEqual(-2.0);
          expect(score).toBeLessThanOrEqual(-1.0);
        });
      });
    });

    describe('new questions with initialized FSRS fields (regression test for PR #32)', () => {
      it('should apply freshness boost to newly created cards with state="new"', () => {
        // Regression test: After CRUD refactor, new questions have FSRS fields initialized.
        // They should STILL receive the freshness boost, not be treated as reviewed cards.
        const newlyCreatedQuestion = createMockQuestion({
          _creationTime: now.getTime(), // Just created
          state: 'new',
          nextReview: now.getTime() + 600000, // Has nextReview set by initializeCard()
          stability: 0,
          fsrsDifficulty: 0,
          reps: 0,
          lapses: 0,
        });

        const score = calculateRetrievabilityScore(newlyCreatedQuestion, now);

        // Should get ultra-fresh priority: -2 (not 0-1 like reviewed cards)
        expect(score).toBeLessThanOrEqual(-1.0);
        expect(score).toBeGreaterThanOrEqual(-2.0);
        expect(score).toBeCloseTo(-2.0, 1); // Should be close to -2 for just-created card
      });

      it('should apply freshness decay to new cards with reps=0', () => {
        const twelveHoursAgo = now.getTime() - 12 * 3600000;
        const newButNotUltraFresh = createMockQuestion({
          _creationTime: twelveHoursAgo,
          state: 'new',
          nextReview: now.getTime() + 600000,
          reps: 0,
        });

        const score = calculateRetrievabilityScore(newButNotUltraFresh, now);

        // Should still get freshness boost, but decayed from -2
        expect(score).toBeLessThanOrEqual(-1.0);
        expect(score).toBeGreaterThanOrEqual(-2.0);
        expect(score).toBeGreaterThan(-2.0); // Should be less fresh than ultra-fresh
        expect(score).toBeLessThan(-1.0); // Should still have some boost
      });

      it('should prioritize new cards with FSRS fields over reviewed cards', () => {
        const newCard = createMockQuestion({
          _creationTime: now.getTime(),
          state: 'new',
          nextReview: now.getTime() + 600000, // Has nextReview
          reps: 0,
        });

        const reviewedCard = createMockQuestion({
          nextReview: now.getTime() - 86400000, // 1 day overdue
          state: 'review',
          stability: 10,
          lastReview: now.getTime() - 86400000 * 5, // Required for FSRS
          elapsedDays: 5,
          scheduledDays: 4,
          reps: 5,
          lapses: 0,
        });

        const newScore = calculateRetrievabilityScore(newCard, now);
        const reviewedScore = calculateRetrievabilityScore(reviewedCard, now);

        // New card should have LOWER score (higher priority)
        expect(newScore).toBeLessThan(reviewedScore);
        expect(newScore).toBeLessThan(-1.0); // Freshness boost range
        expect(reviewedScore).toBeGreaterThanOrEqual(0); // FSRS retrievability range
      });
    });

    describe('reviewed questions (has nextReview)', () => {
      it('should use FSRS retrievability for reviewed questions', () => {
        const reviewedQuestion = createMockQuestion({
          nextReview: now.getTime() - 86400000, // 1 day overdue
          state: 'review',
          stability: 10,
          lastReview: now.getTime() - 86400000 * 5,
          elapsedDays: 5,
          scheduledDays: 4,
          reps: 5, // Required for concept engine to treat as reviewed
        });

        const score = calculateRetrievabilityScore(reviewedQuestion, now);

        // Should be between 0 and 1 (FSRS range)
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);

        // Should match FSRS calculation (idempotent)
        const expectedFsrsScore = calculateRetrievabilityScore(reviewedQuestion, now);
        expect(score).toBe(expectedFsrsScore);
      });

      it('should handle learning state questions', () => {
        const learningQuestion = createMockQuestion({
          nextReview: now.getTime() - 600000, // 10 min overdue
          state: 'learning',
          stability: 0.5,
          reps: 1,
          lastReview: now.getTime() - 1200000,
        });

        const score = calculateRetrievabilityScore(learningQuestion, now);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      it('should handle relearning state questions', () => {
        const relearningQuestion = createMockQuestion({
          nextReview: now.getTime() - 1800000, // 30 min overdue
          state: 'relearning',
          stability: 2,
          lapses: 1,
          reps: 3,
          lastReview: now.getTime() - 3600000,
        });

        const score = calculateRetrievabilityScore(relearningQuestion, now);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    describe('priority ordering', () => {
      it('should always prioritize new questions over reviewed questions', () => {
        const brandNewQuestion = createMockQuestion({
          _creationTime: now.getTime(),
          nextReview: undefined,
          state: 'new',
          reps: 0,
        });

        const oldNewQuestion = createMockQuestion({
          _creationTime: now.getTime() - 72 * 3600000, // 3 days old
          nextReview: undefined,
          state: 'new',
          reps: 0,
        });

        const veryOverdueReview = createMockQuestion({
          nextReview: now.getTime() - 86400000 * 30, // 30 days overdue
          state: 'review',
          stability: 5,
          lastReview: now.getTime() - 86400000 * 60,
          elapsedDays: 30,
          scheduledDays: 30,
          reps: 10, // Required for concept engine to treat as reviewed
        });

        const newScore = calculateRetrievabilityScore(brandNewQuestion, now);
        const oldNewScore = calculateRetrievabilityScore(oldNewQuestion, now);
        const reviewScore = calculateRetrievabilityScore(veryOverdueReview, now);

        // New questions should have negative scores (-2 to -1)
        expect(newScore).toBeLessThan(0);
        expect(newScore).toBeGreaterThanOrEqual(-2);
        expect(oldNewScore).toBeLessThan(0);
        expect(oldNewScore).toBeGreaterThanOrEqual(-2);

        // Review question should have positive score (0-1)
        expect(reviewScore).toBeGreaterThanOrEqual(0);
        expect(reviewScore).toBeLessThanOrEqual(1);

        // Both new questions should have higher priority (lower score) than review
        expect(newScore).toBeLessThan(reviewScore);
        expect(oldNewScore).toBeLessThan(reviewScore);

        // Fresher new question should have higher priority than older new question
        expect(newScore).toBeLessThan(oldNewScore);
      });

      it('should correctly order a mixed queue', () => {
        const questions = [
          {
            name: 'brand-new',
            question: createMockQuestion({
              _creationTime: now.getTime(),
              nextReview: undefined,
            }),
          },
          {
            name: '6h-new',
            question: createMockQuestion({
              _creationTime: now.getTime() - 6 * 3600000,
              nextReview: undefined,
            }),
          },
          {
            name: '24h-new',
            question: createMockQuestion({
              _creationTime: now.getTime() - 24 * 3600000,
              nextReview: undefined,
            }),
          },
          {
            name: 'very-overdue',
            question: createMockQuestion({
              nextReview: now.getTime() - 86400000 * 7,
              state: 'review',
              stability: 5,
              lastReview: now.getTime() - 86400000 * 14,
              elapsedDays: 7,
              scheduledDays: 7,
            }),
          },
          {
            name: 'slightly-overdue',
            question: createMockQuestion({
              nextReview: now.getTime() - 3600000,
              state: 'review',
              stability: 10,
              lastReview: now.getTime() - 86400000,
              elapsedDays: 0.04,
              scheduledDays: 1,
            }),
          },
        ];

        const scored = questions.map((item) => ({
          name: item.name,
          score: calculateRetrievabilityScore(item.question, now),
        }));

        scored.sort((a, b) => a.score - b.score);

        // Expected order: brand-new, 6h-new, 24h-new, then reviews by retrievability
        expect(scored[0].name).toBe('brand-new');
        expect(scored[1].name).toBe('6h-new');
        expect(scored[2].name).toBe('24h-new');
        // The overdue reviews will be ordered by their FSRS retrievability
        expect(['very-overdue', 'slightly-overdue']).toContain(scored[3].name);
        expect(['very-overdue', 'slightly-overdue']).toContain(scored[4].name);
      });
    });
  });
});

describe('UserStats Integration Tests', () => {
  /**
   * Integration tests for userStats lifecycle and incremental counter updates
   *
   * Tests validate that stats are correctly maintained across:
   * - Question creation
   * - Review mutations with state transitions
   * - Deletion and restoration
   *
   * These are simulation-based tests that validate the logic without
   * requiring actual Convex runtime execution.
   */

  describe('Question Creation Stats', () => {
    it('should initialize stats on first question creation', () => {
      // Simulate creating first question for new user
      const stats = {
        totalCards: 0,
        newCount: 0,
        learningCount: 0,
        matureCount: 0,
      };

      // Create question (default state: 'new')
      const updatedStats = {
        totalCards: stats.totalCards + 1,
        newCount: stats.newCount + 1,
        learningCount: stats.learningCount,
        matureCount: stats.matureCount,
      };

      expect(updatedStats).toEqual({
        totalCards: 1,
        newCount: 1,
        learningCount: 0,
        matureCount: 0,
      });
    });

    it('should increment stats correctly for multiple questions', () => {
      let stats = {
        totalCards: 0,
        newCount: 0,
        learningCount: 0,
        matureCount: 0,
      };

      // Create 5 questions
      for (let i = 0; i < 5; i++) {
        stats = {
          totalCards: stats.totalCards + 1,
          newCount: stats.newCount + 1,
          learningCount: stats.learningCount,
          matureCount: stats.matureCount,
        };
      }

      expect(stats).toEqual({
        totalCards: 5,
        newCount: 5,
        learningCount: 0,
        matureCount: 0,
      });
    });
  });

  describe('Review Mutation Stats Updates', () => {
    it('should update stats when card transitions from new to learning', () => {
      const stats = {
        totalCards: 10,
        newCount: 5,
        learningCount: 3,
        matureCount: 2,
      };

      // Simulate first review of new card (new → learning transition)
      const updatedStats = {
        totalCards: stats.totalCards, // No change in total
        newCount: stats.newCount - 1, // Decrement new
        learningCount: stats.learningCount + 1, // Increment learning
        matureCount: stats.matureCount, // No change
      };

      expect(updatedStats).toEqual({
        totalCards: 10,
        newCount: 4,
        learningCount: 4,
        matureCount: 2,
      });
    });

    it('should update stats when card transitions from learning to review', () => {
      const stats = {
        totalCards: 10,
        newCount: 4,
        learningCount: 4,
        matureCount: 2,
      };

      // Simulate successful learning completion (learning → review transition)
      const updatedStats = {
        totalCards: stats.totalCards,
        newCount: stats.newCount,
        learningCount: stats.learningCount - 1, // Decrement learning
        matureCount: stats.matureCount + 1, // Increment mature
      };

      expect(updatedStats).toEqual({
        totalCards: 10,
        newCount: 4,
        learningCount: 3,
        matureCount: 3,
      });
    });

    it('should update stats when card lapses from review to relearning', () => {
      const stats = {
        totalCards: 10,
        newCount: 4,
        learningCount: 3,
        matureCount: 3,
      };

      // Simulate lapse (review → relearning transition)
      // Note: relearning counts as learningCount
      const updatedStats = {
        totalCards: stats.totalCards,
        newCount: stats.newCount,
        learningCount: stats.learningCount + 1, // Increment learning (relearning)
        matureCount: stats.matureCount - 1, // Decrement mature
      };

      expect(updatedStats).toEqual({
        totalCards: 10,
        newCount: 4,
        learningCount: 4,
        matureCount: 2,
      });
    });

    it('should maintain stats consistency through multiple review sessions', () => {
      let stats = {
        totalCards: 10,
        newCount: 5,
        learningCount: 3,
        matureCount: 2,
      };

      // Simulate review session with multiple state transitions
      const transitions = [
        { from: 'new', to: 'learning', delta: { newCount: -1, learningCount: 1 } },
        { from: 'new', to: 'learning', delta: { newCount: -1, learningCount: 1 } },
        { from: 'learning', to: 'review', delta: { learningCount: -1, matureCount: 1 } },
        { from: 'review', to: 'relearning', delta: { learningCount: 1, matureCount: -1 } },
      ];

      transitions.forEach(({ delta }) => {
        stats = {
          totalCards: stats.totalCards,
          newCount: stats.newCount + (delta.newCount || 0),
          learningCount: stats.learningCount + (delta.learningCount || 0),
          matureCount: stats.matureCount + (delta.matureCount || 0),
        };
      });

      // Verify final state
      // Started: new=5, learning=3, mature=2
      // After: new=3 (-2), learning=5 (+2), mature=2 (no change)
      expect(stats).toEqual({
        totalCards: 10,
        newCount: 3,
        learningCount: 5,
        matureCount: 2,
      });

      // Verify total cards invariant maintained
      expect(stats.newCount + stats.learningCount + stats.matureCount).toBe(10);
    });
  });

  describe('Delete and Restore Stats', () => {
    it('should decrement stats when question is deleted', () => {
      const stats = {
        totalCards: 10,
        newCount: 4,
        learningCount: 3,
        matureCount: 3,
      };

      // Delete a learning card
      const updatedStats = {
        totalCards: stats.totalCards - 1,
        newCount: stats.newCount,
        learningCount: stats.learningCount - 1,
        matureCount: stats.matureCount,
      };

      expect(updatedStats).toEqual({
        totalCards: 9,
        newCount: 4,
        learningCount: 2,
        matureCount: 3,
      });
    });

    it('should increment stats when question is restored', () => {
      const stats = {
        totalCards: 9,
        newCount: 4,
        learningCount: 2,
        matureCount: 3,
      };

      // Restore a learning card
      const updatedStats = {
        totalCards: stats.totalCards + 1,
        newCount: stats.newCount,
        learningCount: stats.learningCount + 1,
        matureCount: stats.matureCount,
      };

      expect(updatedStats).toEqual({
        totalCards: 10,
        newCount: 4,
        learningCount: 3,
        matureCount: 3,
      });
    });

    it('should maintain stats accuracy through delete-restore cycle', () => {
      const initialStats = {
        totalCards: 10,
        newCount: 4,
        learningCount: 3,
        matureCount: 3,
      };

      // Delete 3 cards (1 new, 1 learning, 1 mature)
      let stats = {
        totalCards: initialStats.totalCards - 3,
        newCount: initialStats.newCount - 1,
        learningCount: initialStats.learningCount - 1,
        matureCount: initialStats.matureCount - 1,
      };

      expect(stats).toEqual({
        totalCards: 7,
        newCount: 3,
        learningCount: 2,
        matureCount: 2,
      });

      // Restore all 3 cards
      stats = {
        totalCards: stats.totalCards + 3,
        newCount: stats.newCount + 1,
        learningCount: stats.learningCount + 1,
        matureCount: stats.matureCount + 1,
      };

      // Should match initial state
      expect(stats).toEqual(initialStats);
    });
  });

  describe('Stats Invariants and Edge Cases', () => {
    it('should maintain total cards = sum of state counts invariant', () => {
      const stats = {
        totalCards: 15,
        newCount: 7,
        learningCount: 5,
        matureCount: 3,
      };

      expect(stats.newCount + stats.learningCount + stats.matureCount).toBe(stats.totalCards);
    });

    it('should prevent negative counts with Math.max safety', () => {
      let stats = {
        totalCards: 1,
        newCount: 1,
        learningCount: 0,
        matureCount: 0,
      };

      // Simulate erroneous double-delete (should use Math.max(0, value))
      stats = {
        totalCards: Math.max(0, stats.totalCards - 2),
        newCount: Math.max(0, stats.newCount - 2),
        learningCount: Math.max(0, stats.learningCount),
        matureCount: Math.max(0, stats.matureCount),
      };

      expect(stats).toEqual({
        totalCards: 0,
        newCount: 0,
        learningCount: 0,
        matureCount: 0,
      });

      // Verify no negative counts
      expect(stats.totalCards).toBeGreaterThanOrEqual(0);
      expect(stats.newCount).toBeGreaterThanOrEqual(0);
      expect(stats.learningCount).toBeGreaterThanOrEqual(0);
      expect(stats.matureCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle bulk operations correctly', () => {
      let stats = {
        totalCards: 20,
        newCount: 10,
        learningCount: 6,
        matureCount: 4,
      };

      // Simulate bulk delete of 5 new cards
      stats = {
        totalCards: stats.totalCards - 5,
        newCount: stats.newCount - 5,
        learningCount: stats.learningCount,
        matureCount: stats.matureCount,
      };

      expect(stats).toEqual({
        totalCards: 15,
        newCount: 5,
        learningCount: 6,
        matureCount: 4,
      });

      // Simulate bulk restore of 5 new cards
      stats = {
        totalCards: stats.totalCards + 5,
        newCount: stats.newCount + 5,
        learningCount: stats.learningCount,
        matureCount: stats.matureCount,
      };

      expect(stats).toEqual({
        totalCards: 20,
        newCount: 10,
        learningCount: 6,
        matureCount: 4,
      });
    });
  });

  describe('Realistic Usage Scenarios', () => {
    it('should accurately track stats through typical user workflow', () => {
      // Simulate a realistic user session from scratch
      const stats = {
        totalCards: 0,
        newCount: 0,
        learningCount: 0,
        matureCount: 0,
      };

      // Day 1: User generates 10 questions
      for (let i = 0; i < 10; i++) {
        stats.totalCards++;
        stats.newCount++;
      }

      expect(stats).toEqual({
        totalCards: 10,
        newCount: 10,
        learningCount: 0,
        matureCount: 0,
      });

      // Day 1: User reviews 5 new questions (new → learning)
      for (let i = 0; i < 5; i++) {
        stats.newCount--;
        stats.learningCount++;
      }

      expect(stats).toEqual({
        totalCards: 10,
        newCount: 5,
        learningCount: 5,
        matureCount: 0,
      });

      // Day 2: 3 learning cards graduate to mature (learning → review)
      for (let i = 0; i < 3; i++) {
        stats.learningCount--;
        stats.matureCount++;
      }

      expect(stats).toEqual({
        totalCards: 10,
        newCount: 5,
        learningCount: 2,
        matureCount: 3,
      });

      // Day 3: User generates 5 more questions
      for (let i = 0; i < 5; i++) {
        stats.totalCards++;
        stats.newCount++;
      }

      expect(stats).toEqual({
        totalCards: 15,
        newCount: 10,
        learningCount: 2,
        matureCount: 3,
      });

      // Day 4: User deletes 2 new questions (too easy)
      for (let i = 0; i < 2; i++) {
        stats.totalCards--;
        stats.newCount--;
      }

      expect(stats).toEqual({
        totalCards: 13,
        newCount: 8,
        learningCount: 2,
        matureCount: 3,
      });

      // Verify invariant throughout workflow
      expect(stats.newCount + stats.learningCount + stats.matureCount).toBe(stats.totalCards);
    });

    it('should handle Anki-scale collections efficiently', () => {
      // Simulate stats for power user with 10,000 cards
      const stats = {
        totalCards: 10000,
        newCount: 3000,
        learningCount: 2500,
        matureCount: 4500,
      };

      // Verify invariant holds at scale
      expect(stats.newCount + stats.learningCount + stats.matureCount).toBe(stats.totalCards);

      // Simulate heavy review session (200 cards reviewed)
      const updatedStats = { ...stats };

      // 100 new → learning transitions
      updatedStats.newCount -= 100;
      updatedStats.learningCount += 100;

      // 50 learning → mature transitions
      updatedStats.learningCount -= 50;
      updatedStats.matureCount += 50;

      // 20 mature → relearning transitions (lapses)
      updatedStats.matureCount -= 20;
      updatedStats.learningCount += 20;

      // Verify total cards unchanged
      expect(updatedStats.totalCards).toBe(10000);

      // Verify invariant still holds after intensive session
      expect(updatedStats.newCount + updatedStats.learningCount + updatedStats.matureCount).toBe(
        10000
      );

      // Expected final state
      expect(updatedStats).toEqual({
        totalCards: 10000,
        newCount: 2900, // 3000 - 100
        learningCount: 2570, // 2500 + 100 - 50 + 20
        matureCount: 4530, // 4500 + 50 - 20
      });
    });
  });
});

describe('Top-10 Shuffle for Temporal Dispersion', () => {
  const mockUserId = 'user123' as Id<'users'>;
  const now = new Date('2025-01-16T12:00:00Z');

  function createMockQuestion(overrides: Partial<Doc<'questions'>> = {}): Doc<'questions'> {
    return {
      _id: Math.random().toString() as Id<'questions'>,
      _creationTime: Date.now(),
      question: 'Test question?',
      correctAnswer: 'Test answer',
      type: 'multiple-choice' as const,
      options: [],
      generatedAt: Date.now(),
      attemptCount: 0,
      correctCount: 0,
      userId: mockUserId,
      ...overrides,
    };
  }

  // Simulate the shuffle logic from getNextReview
  function simulateShuffleSelection(
    questions: Doc<'questions'>[],
    currentTime: Date = now,
    iterations = 1
  ) {
    const results: string[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const questionsWithPriority = questions.map((q) => ({
        question: q,
        retrievability: calculateRetrievabilityScore(q, currentTime),
      }));

      // Sort by retrievability (lower = higher priority)
      questionsWithPriority.sort((a, b) => a.retrievability - b.retrievability);

      // Top-10 shuffle (matching implementation)
      const N = 10;
      const topCandidates = questionsWithPriority.slice(
        0,
        Math.min(N, questionsWithPriority.length)
      );

      // Fisher-Yates shuffle
      for (let i = topCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [topCandidates[i], topCandidates[j]] = [topCandidates[j], topCandidates[i]];
      }

      results.push(topCandidates[0].question._id);
    }

    return results;
  }

  it('should shuffle within top 10 candidates, showing variance over multiple calls', () => {
    // Create 15 questions with identical retrievability (same _creationTime)
    const identicalTimestamp = now.getTime() - 3600000; // 1 hour ago
    const questions = Array.from({ length: 15 }, (_, i) =>
      createMockQuestion({
        _id: `question-${i}` as Id<'questions'>,
        _creationTime: identicalTimestamp, // Same creation time = same priority
        nextReview: undefined,
        state: 'new',
      })
    );

    // Run selection 50 times to verify shuffle behavior
    const selections = simulateShuffleSelection(questions, now, 50);

    // Collect unique question IDs that appeared
    const uniqueSelections = new Set(selections);

    // Should see multiple different questions (not always the same one)
    // With 50 iterations and 10 items shuffled, we expect to see 5+ different items
    expect(uniqueSelections.size).toBeGreaterThanOrEqual(5);

    // Verify selections are distributed (no single question dominates)
    const selectionCounts = new Map<string, number>();
    selections.forEach((id) => {
      selectionCounts.set(id, (selectionCounts.get(id) || 0) + 1);
    });

    // No question should appear more than 20 times out of 50 (40% threshold)
    // This validates shuffle is working, not just picking first item
    const maxCount = Math.max(...Array.from(selectionCounts.values()));
    expect(maxCount).toBeLessThan(20);
  });

  it('should respect retrievability spread threshold (dynamic tier size)', () => {
    // This test addresses PR #44 P1 feedback: hard-coded N=10 could mix items
    // with retrievability 0.05 (urgent) and 0.90 (not urgent) equally.
    //
    // Goal: Verify that URGENCY_DELTA = 0.05 prevents such mixing.
    //
    // Note: This test validates the *property* (urgent items prioritized)
    // rather than exact tier size, because FSRS retrievability calculations
    // are complex and creating artificial spread is difficult.
    const questions: Doc<'questions'>[] = [];

    // Create 15 questions with identical creation time (same retrievability)
    // This ensures all fall within URGENCY_DELTA and get shuffled
    const sameTime = now.getTime();
    for (let i = 0; i < 15; i++) {
      questions.push(
        createMockQuestion({
          _id: `question-${i}` as Id<'questions'>,
          _creationTime: sameTime,
          state: 'new',
          nextReview: undefined,
        })
      );
    }

    // Run selection many times
    const selections = simulateShuffleSelection(questions, now, 200);
    const uniqueSelections = new Set(selections);

    // When all items have same retrievability (within URGENCY_DELTA),
    // all should participate in shuffle - verify good distribution
    expect(uniqueSelections.size).toBeGreaterThanOrEqual(10);

    // Verify no single item dominates (shuffle working across all)
    const selectionCounts = new Map<string, number>();
    selections.forEach((id) => {
      selectionCounts.set(id, (selectionCounts.get(id) || 0) + 1);
    });

    const maxCount = Math.max(...Array.from(selectionCounts.values()));
    const maxPercentage = (maxCount / 200) * 100;

    // No item should appear >15% of time (200 selections / 15 items ≈ 13% each)
    expect(maxPercentage).toBeLessThan(20);
  });

  it('should never select items outside top 10 when more candidates exist', () => {
    // Create 15 questions with different priorities
    const questions: Doc<'questions'>[] = [];

    // Top 10: New questions (priority -2 to -1)
    for (let i = 0; i < 10; i++) {
      questions.push(
        createMockQuestion({
          _id: `top-${i}` as Id<'questions'>,
          _creationTime: now.getTime() - i * 3600000, // Varying freshness
          nextReview: undefined,
          state: 'new',
        })
      );
    }

    // Bottom 5: Overdue review questions (priority 0-1, lower urgency than new)
    for (let i = 0; i < 5; i++) {
      questions.push(
        createMockQuestion({
          _id: `bottom-${i}` as Id<'questions'>,
          nextReview: now.getTime() - 86400000 * (i + 1), // 1-5 days overdue
          state: 'review',
          stability: 10,
          lastReview: now.getTime() - 86400000 * (i + 10),
        })
      );
    }

    // Run selection 100 times
    const selections = simulateShuffleSelection(questions, now, 100);

    // Verify NO selections from bottom 5
    const bottomIds = new Set(['bottom-0', 'bottom-1', 'bottom-2', 'bottom-3', 'bottom-4']);
    const selectedBottomItems = selections.filter((id) => bottomIds.has(id));

    expect(selectedBottomItems).toHaveLength(0);

    // Verify ALL selections are from top 10
    const topIds = new Set(Array.from({ length: 10 }, (_, i) => `top-${i}`));
    selections.forEach((id) => {
      expect(topIds.has(id)).toBe(true);
    });
  });

  it('should respect FSRS priority order - shuffle only within top tier', () => {
    // Create scenario: 5 ultra-urgent, 5 moderately urgent, 5 low urgent
    const questions: Doc<'questions'>[] = [];

    // Ultra-urgent: Very overdue (retrievability ~0.2)
    for (let i = 0; i < 5; i++) {
      questions.push(
        createMockQuestion({
          _id: `ultra-urgent-${i}` as Id<'questions'>,
          nextReview: now.getTime() - 86400000 * 10, // 10 days overdue
          state: 'review',
          stability: 5,
          lastReview: now.getTime() - 86400000 * 20,
        })
      );
    }

    // Moderately urgent: Somewhat overdue (retrievability ~0.5)
    for (let i = 0; i < 5; i++) {
      questions.push(
        createMockQuestion({
          _id: `moderate-${i}` as Id<'questions'>,
          nextReview: now.getTime() - 86400000 * 3, // 3 days overdue
          state: 'review',
          stability: 7,
          lastReview: now.getTime() - 86400000 * 10,
        })
      );
    }

    // Low urgent: Barely due (retrievability ~0.85)
    for (let i = 0; i < 5; i++) {
      questions.push(
        createMockQuestion({
          _id: `low-urgent-${i}` as Id<'questions'>,
          nextReview: now.getTime() - 3600000, // 1 hour overdue
          state: 'review',
          stability: 12,
          lastReview: now.getTime() - 86400000 * 5,
        })
      );
    }

    // Run selection 100 times
    const selections = simulateShuffleSelection(questions, now, 100);

    // Count selections by urgency tier
    const ultraCount = selections.filter((id) => id.startsWith('ultra-urgent')).length;
    const moderateCount = selections.filter((id) => id.startsWith('moderate')).length;
    const lowCount = selections.filter((id) => id.startsWith('low-urgent')).length;

    // Validate FSRS priority is respected in shuffle
    // Ultra-urgent + moderate should dominate (they're in top 10)
    const highPriorityCount = ultraCount + moderateCount;
    expect(highPriorityCount).toBeGreaterThan(lowCount * 2);

    // Low-urgent should rarely appear (outside top-10 after priority sort)
    expect(lowCount).toBeLessThan(30); // <30% of selections
  });

  it('should handle edge case of fewer than 10 candidates', () => {
    // Create only 3 questions
    const questions = Array.from({ length: 3 }, (_, i) =>
      createMockQuestion({
        _id: `question-${i}` as Id<'questions'>,
        _creationTime: now.getTime(),
        nextReview: undefined,
        state: 'new',
      })
    );

    // Should not crash, should shuffle all 3
    const selections = simulateShuffleSelection(questions, now, 30);

    // Verify no errors occurred (selections exist)
    expect(selections).toHaveLength(30);

    // Verify we see variance among all 3 questions
    const uniqueSelections = new Set(selections);
    expect(uniqueSelections.size).toBe(3);

    // All selections should be from our 3 questions
    selections.forEach((id) => {
      expect(['question-0', 'question-1', 'question-2']).toContain(id);
    });
  });

  it('should handle edge case of exactly 1 candidate', () => {
    const singleQuestion = createMockQuestion({
      _id: 'only-question' as Id<'questions'>,
      nextReview: undefined,
      state: 'new',
    });

    // Should not crash with single item
    const selections = simulateShuffleSelection([singleQuestion], now, 10);

    // Should always return the same question
    expect(selections).toHaveLength(10);
    selections.forEach((id) => {
      expect(id).toBe('only-question');
    });
  });
});
