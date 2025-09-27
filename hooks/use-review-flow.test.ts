import { describe, expect, it } from 'vitest';

import type { Id } from '../convex/_generated/dataModel';
import { reviewReducer } from './use-review-flow';

describe('reviewReducer', () => {
  describe('REVIEW_COMPLETE action', () => {
    it('should reset full state to loading phase when review is complete', () => {
      // Arrange: Set up initial state with active question in reviewing phase
      const initialState = {
        phase: 'reviewing' as const,
        question: {
          _id: 'q1' as Id<'questions'>,
          question: 'What is the NATO phonetic alphabet for S?',
          options: ['Sierra', 'Snake', 'Sugar', 'Solar'],
          correctAnswer: 'Sierra',
          topic: 'NATO Alphabet',
          difficulty: 'easy' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          userId: 'user123',
        },
        questionId: 'q1' as Id<'questions'>,
        interactions: [
          {
            _id: 'i1' as Id<'interactions'>,
            _creationTime: Date.now(),
            questionId: 'q1' as Id<'questions'>,
            userAnswer: 'Snake',
            isCorrect: false,
            attemptedAt: Date.now(),
            userId: 'user123' as Id<'users'>,
          },
        ],
        lockId: 'lock123',
      };

      // Act: Dispatch REVIEW_COMPLETE action
      const newState = reviewReducer(initialState, { type: 'REVIEW_COMPLETE' });

      // Assert: Verify full state reset
      expect(newState.phase).toBe('loading');
      expect(newState.question).toBeNull();
      expect(newState.questionId).toBeNull();
      expect(newState.interactions).toEqual([]);
      expect(newState.lockId).toBeNull();
    });

    it('should handle REVIEW_COMPLETE even when state is already partially reset', () => {
      // Arrange: State with some fields already null
      const initialState = {
        phase: 'reviewing' as const,
        question: null,
        questionId: null,
        interactions: [],
        lockId: 'lock456',
      };

      // Act: Dispatch REVIEW_COMPLETE action
      const newState = reviewReducer(initialState, { type: 'REVIEW_COMPLETE' });

      // Assert: Verify state transitions to loading
      expect(newState.phase).toBe('loading');
      expect(newState.lockId).toBeNull();
    });
  });

  describe('Data processing after REVIEW_COMPLETE', () => {
    it('should process data updates when phase is loading (after REVIEW_COMPLETE)', () => {
      // This test verifies that the condition check allows processing when transitioning from loading
      const stateInLoading = {
        phase: 'loading' as const,
        question: null,
        questionId: null,
        interactions: [],
        lockId: null,
      };

      // The reducer should accept QUESTION_RECEIVED when in loading phase
      const questionReceivedAction = {
        type: 'QUESTION_RECEIVED' as const,
        payload: {
          question: {
            _id: 'q2' as Id<'questions'>,
            question: 'New question after review complete',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            topic: 'Test',
            difficulty: 'medium' as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            userId: 'user123',
          },
          questionId: 'q2' as Id<'questions'>,
          interactions: [],
          lockId: 'newLock',
        },
      };

      const newState = reviewReducer(stateInLoading, questionReceivedAction);

      // Should successfully transition to reviewing with new question
      expect(newState.phase).toBe('reviewing');
      expect(newState.question).toBeDefined();
      expect(newState.questionId).toBe('q2' as Id<'questions'>);
    });
  });
});
