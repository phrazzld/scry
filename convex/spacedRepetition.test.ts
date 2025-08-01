import { describe, it, expect } from 'vitest';
import { getRetrievability } from './fsrs';
import type { Doc, Id } from './_generated/dataModel';

describe('Review Queue Prioritization', () => {
  const mockUserId = 'user123' as Id<"users">;
  const now = new Date('2025-01-16T12:00:00Z');
  
  function createMockQuestion(overrides: Partial<Doc<"questions">> = {}): Doc<"questions"> {
    return {
      _id: Math.random().toString() as Id<"questions">,
      _creationTime: Date.now(),
      question: 'Test question?',
      correctAnswer: 'Test answer',
      type: 'multiple-choice' as const,
      options: [],
      generatedAt: Date.now(),
      difficulty: 'medium',
      topic: 'testing',
      attemptCount: 0,
      correctCount: 0,
      userId: mockUserId,
      ...overrides
    };
  }

  // Simulate the prioritization logic from getNextReview
  function simulatePrioritization(questions: Doc<"questions">[], currentTime: Date = now) {
    const questionsWithPriority = questions.map(q => ({
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
        _id: 'new1' as Id<"questions">,
        nextReview: undefined,
        state: 'new' 
      });
      
      const overdueQuestion = createMockQuestion({ 
        _id: 'overdue1' as Id<"questions">,
        nextReview: now.getTime() - 86400000, // 1 day overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000 * 2
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
        _id: 'future1' as Id<"questions">,
        nextReview: now.getTime() + 86400000, // 1 day in future
        state: 'review'
      });
      
      const dueQuestion = createMockQuestion({
        _id: 'due1' as Id<"questions">,
        nextReview: now.getTime() - 3600000, // 1 hour overdue
        state: 'review'
      });
      
      // In real implementation, future questions are filtered out by the query
      // Here we simulate by checking nextReview time
      const candidates = [futureQuestion, dueQuestion].filter(q => 
        q.nextReview === undefined || q.nextReview <= now.getTime()
      );
      
      expect(candidates).toHaveLength(1);
      expect(candidates[0]._id).toBe('due1');
    });

    it('should sort overdue questions by retrievability (lower first)', () => {
      // Create questions with different overdue periods and stability
      const veryOverdue = createMockQuestion({
        _id: 'very-overdue' as Id<"questions">,
        nextReview: now.getTime() - 86400000 * 7, // 7 days overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000 * 14,
        elapsedDays: 7,
        scheduledDays: 7
      });
      
      const slightlyOverdue = createMockQuestion({
        _id: 'slightly-overdue' as Id<"questions">,
        nextReview: now.getTime() - 3600000, // 1 hour overdue
        state: 'review',
        stability: 10,
        lastReview: now.getTime() - 86400000,
        elapsedDays: 0.04, // ~1 hour
        scheduledDays: 1
      });
      
      const moderatelyOverdue = createMockQuestion({
        _id: 'moderately-overdue' as Id<"questions">,
        nextReview: now.getTime() - 86400000 * 2, // 2 days overdue
        state: 'review',
        stability: 7,
        lastReview: now.getTime() - 86400000 * 5,
        elapsedDays: 2,
        scheduledDays: 3
      });
      
      const prioritized = simulatePrioritization([
        slightlyOverdue, 
        veryOverdue, 
        moderatelyOverdue
      ]);
      
      // More overdue questions should have lower retrievability (higher priority)
      expect(prioritized[0].retrievability).toBeLessThan(prioritized[1].retrievability);
      expect(prioritized[1].retrievability).toBeLessThan(prioritized[2].retrievability);
      
      // Verify all retrievability values are in valid range
      prioritized.forEach(p => {
        expect(p.retrievability).toBeGreaterThanOrEqual(0);
        expect(p.retrievability).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Mixed Queue Scenarios', () => {
    it('should handle mix of new, learning, and review questions', () => {
      const questions = [
        createMockQuestion({
          _id: 'new1' as Id<"questions">,
          state: 'new',
          nextReview: undefined
        }),
        createMockQuestion({
          _id: 'learning1' as Id<"questions">,
          state: 'learning',
          nextReview: now.getTime() - 600000, // 10 min overdue
          stability: 0.5,
          reps: 1,
          lastReview: now.getTime() - 1200000, // 20 min ago
          elapsedDays: 0.01,
          scheduledDays: 0.01
        }),
        createMockQuestion({
          _id: 'review1' as Id<"questions">,
          state: 'review',
          nextReview: now.getTime() - 86400000, // 1 day overdue
          stability: 10,
          reps: 5,
          lastReview: now.getTime() - 86400000 * 5, // 5 days ago
          elapsedDays: 1,
          scheduledDays: 4
        }),
        createMockQuestion({
          _id: 'new2' as Id<"questions">,
          state: 'new',
          nextReview: undefined
        }),
        createMockQuestion({
          _id: 'relearning1' as Id<"questions">,
          state: 'relearning',
          nextReview: now.getTime() - 1800000, // 30 min overdue
          stability: 2,
          lapses: 1,
          reps: 3,
          lastReview: now.getTime() - 3600000, // 1 hour ago
          elapsedDays: 0.04,
          scheduledDays: 0.02
        })
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
        createMockQuestion({ _id: 'new1' as Id<"questions">, nextReview: undefined }),
        createMockQuestion({ _id: 'new2' as Id<"questions">, nextReview: undefined }),
        createMockQuestion({ _id: 'new3' as Id<"questions">, nextReview: undefined })
      ];
      
      const prioritized = simulatePrioritization(questions);
      
      // All new questions have -1 retrievability
      expect(prioritized.every(p => p.retrievability === -1)).toBe(true);
      
      // Order should be preserved for equal priorities
      expect(prioritized.map(p => p.question._id)).toEqual(['new1', 'new2', 'new3']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle new questions without FSRS fields', () => {
      // New questions get highest priority regardless of FSRS fields
      const newQuestion = createMockQuestion({
        _id: 'new-no-fsrs' as Id<"questions">,
        state: 'new',
        nextReview: undefined // Will get -1 priority
      });
      
      const reviewQuestion = createMockQuestion({
        _id: 'review-complete' as Id<"questions">,
        nextReview: now.getTime() - 86400000, // overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000 * 2,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 3,
        lapses: 0,
        fsrsDifficulty: 3
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
        _id: 'ancient' as Id<"questions">,
        nextReview: now.getTime() - 86400000 * 365, // 1 year overdue
        state: 'review',
        stability: 30,
        lastReview: now.getTime() - 86400000 * 365 * 2,
        elapsedDays: 365,
        scheduledDays: 180
      });
      
      const recentQuestion = createMockQuestion({
        _id: 'recent' as Id<"questions">,
        nextReview: now.getTime() - 3600000, // 1 hour overdue
        state: 'review',
        stability: 5,
        lastReview: now.getTime() - 86400000,
        elapsedDays: 0.04,
        scheduledDays: 1
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
        reps: 5
      });
      
      // Test retrievability at different times
      const times = [
        now,
        new Date(now.getTime() + 86400000), // 1 day later
        new Date(now.getTime() + 86400000 * 7), // 1 week later
        new Date(now.getTime() + 86400000 * 30), // 1 month later
      ];
      
      const retrievabilities = times.map(time => 
        getRetrievability(baseQuestion, time)
      );
      
      // Retrievability should decrease over time
      for (let i = 1; i < retrievabilities.length; i++) {
        expect(retrievabilities[i]).toBeLessThan(retrievabilities[i - 1]);
      }
      
      // All should be valid probabilities
      retrievabilities.forEach(r => {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      });
    });
  });
});