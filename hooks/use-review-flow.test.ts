import { describe, expect, it } from 'vitest';

import type { Id } from '../convex/_generated/dataModel';
import { reviewReducer } from './use-review-flow';

describe('reviewReducer', () => {
  describe('REVIEW_COMPLETE action', () => {
    it('should maintain reviewing phase with isTransitioning flag for optimistic UI', () => {
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
        isTransitioning: false,
      };

      // Act: Dispatch REVIEW_COMPLETE action
      const newState = reviewReducer(initialState, { type: 'REVIEW_COMPLETE' });

      // Assert: Verify optimistic UI state - stays in reviewing but releases lock and marks transitioning
      expect(newState.phase).toBe('reviewing');
      expect(newState.question).toBe(initialState.question); // Question retained for optimistic UI
      expect(newState.questionId).toBe(initialState.questionId); // Question ID retained
      expect(newState.interactions).toBe(initialState.interactions); // Interactions retained
      expect(newState.lockId).toBeNull(); // Lock released to allow new question
      expect(newState.isTransitioning).toBe(true); // Marked as transitioning
    });

    it('should handle REVIEW_COMPLETE even when state is already partially reset', () => {
      // Arrange: State with some fields already null
      const initialState = {
        phase: 'reviewing' as const,
        question: null,
        questionId: null,
        interactions: [],
        lockId: 'lock456',
        isTransitioning: false,
      };

      // Act: Dispatch REVIEW_COMPLETE action
      const newState = reviewReducer(initialState, { type: 'REVIEW_COMPLETE' });

      // Assert: Verify state stays in reviewing with transition flag and releases lock
      expect(newState.phase).toBe('reviewing');
      expect(newState.lockId).toBeNull();
      expect(newState.isTransitioning).toBe(true);
    });
  });

  describe('Data processing after REVIEW_COMPLETE', () => {
    it('should process data updates when receiving new question', () => {
      // This test verifies that the reducer accepts QUESTION_RECEIVED
      const stateInLoading = {
        phase: 'loading' as const,
        question: null,
        questionId: null,
        interactions: [],
        lockId: null,
        isTransitioning: false,
      };

      // The reducer should accept QUESTION_RECEIVED
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
      expect(newState.isTransitioning).toBe(false); // New question clears transitioning state
    });
  });

  describe('Optimistic UI transitions', () => {
    // Common test fixtures
    const mockQuestion = {
      _id: 'q1' as Id<'questions'>,
      question: 'Test question',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      topic: 'Test',
      difficulty: 'easy' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: 'user123',
    };

    const mockPayload = {
      question: mockQuestion,
      questionId: 'q1' as Id<'questions'>,
      interactions: [],
      lockId: 'lock123',
    };

    const reviewingState = {
      phase: 'reviewing' as const,
      question: mockQuestion,
      questionId: 'q1' as Id<'questions'>,
      interactions: [],
      lockId: 'lock123',
      isTransitioning: false,
    };

    it('should set isTransitioning when REVIEW_COMPLETE dispatched', () => {
      const state = {
        ...reviewingState,
        isTransitioning: false,
      };
      const newState = reviewReducer(state, { type: 'REVIEW_COMPLETE' });

      expect(newState.isTransitioning).toBe(true);
      expect(newState.phase).toBe('reviewing');
      expect(newState.lockId).toBeNull();
    });

    it('should clear isTransitioning when QUESTION_RECEIVED', () => {
      const state = {
        ...reviewingState,
        isTransitioning: true,
      };
      const newState = reviewReducer(state, {
        type: 'QUESTION_RECEIVED',
        payload: mockPayload,
      });

      expect(newState.isTransitioning).toBe(false);
      expect(newState.phase).toBe('reviewing');
    });

    it('should clear isTransitioning when LOAD_START', () => {
      const state = {
        ...reviewingState,
        isTransitioning: true,
      };
      const newState = reviewReducer(state, { type: 'LOAD_START' });

      expect(newState.isTransitioning).toBe(false);
      expect(newState.phase).toBe('loading');
    });

    it('should clear isTransitioning when LOAD_EMPTY', () => {
      const state = {
        ...reviewingState,
        isTransitioning: true,
      };
      const newState = reviewReducer(state, { type: 'LOAD_EMPTY' });

      expect(newState.isTransitioning).toBe(false);
      expect(newState.phase).toBe('empty');
    });
  });
});
