import { describe, expect, it } from 'vitest';

import type { Doc, Id } from './_generated/dataModel';
import { getRetrievability } from './fsrs';
import { calculateFreshnessDecay, calculateRetrievabilityScore } from './spacedRepetition';

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
      topic: 'testing',
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
      retrievability: q.nextReview === undefined ? -1 : getRetrievability(q, currentTime),
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
      });

      const overdueQuestion = createMockQuestion({
        _id: 'overdue1' as Id<'questions'>,
        nextReview: now.getTime() - 86400000, // 1 day overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000 * 2,
      });

      const prioritized = simulatePrioritization([overdueQuestion, newQuestion]);

      expect(prioritized[0].question._id).toBe('new1');
      expect(prioritized[0].retrievability).toBe(-1);
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
      });

      const slightlyOverdue = createMockQuestion({
        _id: 'slightly-overdue' as Id<'questions'>,
        nextReview: now.getTime() - 3600000, // 1 hour overdue
        state: 'review',
        stability: 10,
        lastReview: now.getTime() - 86400000,
        elapsedDays: 0.04, // ~1 hour
        scheduledDays: 1,
      });

      const moderatelyOverdue = createMockQuestion({
        _id: 'moderately-overdue' as Id<'questions'>,
        nextReview: now.getTime() - 86400000 * 2, // 2 days overdue
        state: 'review',
        stability: 7,
        lastReview: now.getTime() - 86400000 * 5,
        elapsedDays: 2,
        scheduledDays: 3,
      });

      const prioritized = simulatePrioritization([slightlyOverdue, veryOverdue, moderatelyOverdue]);

      // More overdue questions should have lower retrievability (higher priority)
      expect(prioritized[0].retrievability).toBeLessThan(prioritized[1].retrievability);
      expect(prioritized[1].retrievability).toBeLessThan(prioritized[2].retrievability);

      // Verify all retrievability values are in valid range
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

      // New questions should be first (retrievability = -1)
      expect(prioritized[0].question.state).toBe('new');
      expect(prioritized[1].question.state).toBe('new');
      expect(prioritized[0].retrievability).toBe(-1);
      expect(prioritized[1].retrievability).toBe(-1);

      // Then other states sorted by retrievability
      expect(prioritized[2].retrievability).toBeGreaterThanOrEqual(0);
      expect(prioritized[3].retrievability).toBeGreaterThanOrEqual(0);
      expect(prioritized[4].retrievability).toBeGreaterThanOrEqual(0);
    });

    it('should maintain stable sort for questions with same retrievability', () => {
      const questions = [
        createMockQuestion({ _id: 'new1' as Id<'questions'>, nextReview: undefined }),
        createMockQuestion({ _id: 'new2' as Id<'questions'>, nextReview: undefined }),
        createMockQuestion({ _id: 'new3' as Id<'questions'>, nextReview: undefined }),
      ];

      const prioritized = simulatePrioritization(questions);

      // All new questions have -1 retrievability
      expect(prioritized.every((p) => p.retrievability === -1)).toBe(true);

      // Order should be preserved for equal priorities
      expect(prioritized.map((p) => p.question._id)).toEqual(['new1', 'new2', 'new3']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle new questions without FSRS fields', () => {
      // New questions get highest priority regardless of FSRS fields
      const newQuestion = createMockQuestion({
        _id: 'new-no-fsrs' as Id<'questions'>,
        state: 'new',
        nextReview: undefined, // Will get -1 priority
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

      // New question should be first with -1 retrievability
      expect(prioritized[0].question._id).toBe('new-no-fsrs');
      expect(prioritized[0].retrievability).toBe(-1);

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
      });

      const recentQuestion = createMockQuestion({
        _id: 'recent' as Id<'questions'>,
        nextReview: now.getTime() - 3600000, // 1 hour overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000,
        elapsedDays: 0.04,
        scheduledDays: 1,
      });

      const prioritized = simulatePrioritization([recentQuestion, ancientQuestion]);

      // Ancient question should have much lower retrievability (higher priority)
      expect(prioritized[0].question._id).toBe('ancient');
      expect(prioritized[0].retrievability).toBeLessThan(prioritized[1].retrievability); // Lower than recent
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

      const retrievabilities = times.map((time) => getRetrievability(baseQuestion, time));

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
      topic: 'testing',
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

    // Verify new questions are prioritized first
    const first50 = questionsWithPriority.slice(0, 50);
    first50.forEach((item) => {
      expect(item.question.state).toBe('new');
      expect(item.retrievability).toBeLessThan(0); // New questions have negative scores
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
          _creationTime: now.getTime() - 86400000, // 24 hours old
        })
      );
    }

    // Today's fresh questions (0-1 hours old)
    for (let i = 0; i < 30; i++) {
      questions.push(
        createMockQuestion({
          _id: `today-${i}` as Id<'questions'>,
          nextReview: undefined,
          state: 'new',
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
    // 1. Today's fresh questions first (highest priority due to freshness)
    const first30 = questionsWithPriority.slice(0, 30);
    first30.forEach((item) => {
      expect(item.question._id).toContain('today');
      expect(item.retrievability).toBeLessThan(-1.5); // Very fresh = very low score
    });

    // 2. Yesterday's questions next (still new but less fresh)
    const next50 = questionsWithPriority.slice(30, 80);
    next50.forEach((item) => {
      expect(item.question._id).toContain('yesterday');
      expect(item.retrievability).toBeGreaterThan(-1.5);
      expect(item.retrievability).toBeLessThan(0);
    });

    // 3. All 200 overdue reviews last (even though they're overdue)
    const remaining200 = questionsWithPriority.slice(80, 280);
    expect(remaining200).toHaveLength(200);
    remaining200.forEach((item) => {
      expect(item.question.state).toBe('review');
      expect(item.retrievability).toBeGreaterThanOrEqual(0);
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
      topic: 'testing',
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

    describe('reviewed questions (has nextReview)', () => {
      it('should use FSRS retrievability for reviewed questions', () => {
        const reviewedQuestion = createMockQuestion({
          nextReview: now.getTime() - 86400000, // 1 day overdue
          state: 'review',
          stability: 10,
          lastReview: now.getTime() - 86400000 * 5,
          elapsedDays: 5,
          scheduledDays: 4,
        });

        const score = calculateRetrievabilityScore(reviewedQuestion, now);

        // Should be between 0 and 1 (FSRS range)
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);

        // Should match FSRS calculation
        const expectedFsrsScore = getRetrievability(reviewedQuestion, now);
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
        });

        const oldNewQuestion = createMockQuestion({
          _creationTime: now.getTime() - 72 * 3600000, // 3 days old
          nextReview: undefined,
        });

        const veryOverdueReview = createMockQuestion({
          nextReview: now.getTime() - 86400000 * 30, // 30 days overdue
          state: 'review',
          stability: 5,
          lastReview: now.getTime() - 86400000 * 60,
          elapsedDays: 30,
          scheduledDays: 30,
        });

        const newScore = calculateRetrievabilityScore(brandNewQuestion, now);
        const oldNewScore = calculateRetrievabilityScore(oldNewQuestion, now);
        const reviewScore = calculateRetrievabilityScore(veryOverdueReview, now);

        // New questions should have negative scores
        expect(newScore).toBeLessThan(0);
        expect(oldNewScore).toBeLessThan(0);

        // Review question should have positive score
        expect(reviewScore).toBeGreaterThanOrEqual(0);

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
