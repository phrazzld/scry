'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useDataHash } from '@/hooks/use-data-hash';
import { useSimplePoll } from '@/hooks/use-simple-poll';
import { LOADING_TIMEOUT_MS, POLLING_INTERVAL_MS } from '@/lib/constants/timing';
import type { SimpleQuestion } from '@/types/questions';

// State machine definition
interface ReviewModeState {
  phase: 'loading' | 'empty' | 'reviewing' | 'error';
  question: SimpleQuestion | null;
  questionId: Id<'questions'> | null;
  interactions: Doc<'interactions'>[];
  lockId: string | null; // Prevents polling from switching questions mid-review
  isTransitioning: boolean; // Indicates we're waiting for next question (optimistic UI)
  errorMessage?: string; // Error message for timeout or other issues
}

// Action types for state machine
type ReviewAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_EMPTY' }
  | { type: 'LOAD_TIMEOUT' }
  | {
      type: 'QUESTION_RECEIVED';
      payload: {
        question: SimpleQuestion;
        questionId: Id<'questions'>;
        interactions: Doc<'interactions'>[];
        lockId: string;
      };
    }
  | { type: 'REVIEW_COMPLETE' }
  | { type: 'IGNORE_UPDATE'; reason: string };

// Initial state
const initialState: ReviewModeState = {
  phase: 'loading',
  question: null,
  questionId: null,
  interactions: [],
  lockId: null,
  isTransitioning: false,
};

// Reducer function to manage state transitions
export function reviewReducer(state: ReviewModeState, action: ReviewAction): ReviewModeState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, phase: 'loading', isTransitioning: false };

    case 'LOAD_EMPTY':
      return {
        ...state,
        phase: 'empty',
        question: null,
        questionId: null,
        interactions: [],
        lockId: null,
        isTransitioning: false,
        errorMessage: undefined,
      };

    case 'LOAD_TIMEOUT':
      return {
        ...state,
        phase: 'error',
        errorMessage:
          'Loading is taking longer than expected. Please refresh the page to try again.',
      };

    case 'QUESTION_RECEIVED':
      return {
        phase: 'reviewing',
        question: action.payload.question,
        questionId: action.payload.questionId,
        interactions: action.payload.interactions,
        lockId: action.payload.lockId,
        isTransitioning: false, // Clear transitioning state
        errorMessage: undefined,
      };

    case 'REVIEW_COMPLETE':
      // Optimistic UI: Keep current question visible during transition
      // This prevents flicker by maintaining layout stability while next question loads
      // Only release lock to allow new question to load
      return {
        ...state,
        phase: 'reviewing', // Stay in reviewing phase
        lockId: null, // Release lock so new question can load
        isTransitioning: true, // Mark as transitioning for UI feedback
      };

    case 'IGNORE_UPDATE':
      // No state change
      return state;

    default:
      return state;
  }
}

/**
 * Custom hook that encapsulates all review flow business logic
 * Separates data fetching, state management, and event handling from presentation
 *
 * @returns Object containing review state and handlers
 */
export function useReviewFlow() {
  // Single state machine instead of 6 separate state variables
  const [state, dispatch] = useReducer(reviewReducer, initialState);

  // Use ref to track the last seen question ID
  const lastQuestionIdRef = useRef<string | null>(null);

  // Use ref for loading timeout
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Query - use simple polling for time-sensitive review queries
  const { data: nextReview } = useSimplePoll(
    api.spacedRepetition.getNextReview,
    {},
    POLLING_INTERVAL_MS
  );

  // Check if data has actually changed to prevent unnecessary renders
  const { hasChanged: dataHasChanged } = useDataHash(nextReview);

  // Set up loading timeout (5 seconds)
  // Triggers for both initial loading and optimistic transitions
  useEffect(() => {
    if (state.phase === 'loading' || state.isTransitioning) {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Set new timeout
      loadingTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'LOAD_TIMEOUT' });
      }, LOADING_TIMEOUT_MS);
    } else {
      // Clear timeout when not loading/transitioning
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }

    return () => {
      // Cleanup on unmount
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [state.phase, state.isTransitioning]);

  // Process polling data and update state
  useEffect(() => {
    // If data hasn't actually changed, skip processing (unless transitioning from loading)
    // Special case: after REVIEW_COMPLETE, we need to process even if same question returns
    if (!dataHasChanged && state.phase !== 'loading' && !state.isTransitioning) {
      dispatch({ type: 'IGNORE_UPDATE', reason: 'Data unchanged from previous poll' });
      return;
    }

    // If there's an active lock (user is reviewing), ignore updates
    if (state.lockId) {
      dispatch({ type: 'IGNORE_UPDATE', reason: 'User is actively reviewing' });
      return;
    }

    if (nextReview === undefined) {
      // Only show loading on initial load
      if (state.phase === 'loading' && !lastQuestionIdRef.current) {
        dispatch({ type: 'LOAD_START' });
      }
    } else if (nextReview === null) {
      dispatch({ type: 'LOAD_EMPTY' });
    } else {
      // Check if this is a new question
      const isNewQuestion = nextReview.question._id !== lastQuestionIdRef.current;

      if (isNewQuestion) {
        if (process.env.NODE_ENV === 'development') {
          // Mark performance when a new question loads
          performance.mark('review-question-loaded');
        }

        // Convert to quiz format for compatibility
        const question: SimpleQuestion = {
          question: nextReview.question.question,
          options: nextReview.question.options,
          correctAnswer: nextReview.question.correctAnswer,
          explanation: nextReview.question.explanation || '',
        };

        // Generate unique lock ID for this question
        const lockId = `${nextReview.question._id}-${Date.now()}`;

        dispatch({
          type: 'QUESTION_RECEIVED',
          payload: {
            question,
            questionId: nextReview.question._id,
            interactions: nextReview.interactions || [],
            lockId,
          },
        });

        // Update last question ID even if it's the same (immediate re-review case)
        // This ensures UI resets properly when incorrect answers trigger immediate review
        lastQuestionIdRef.current = nextReview.question._id;
      } else {
        // Same question returned
        if (state.isTransitioning) {
          // Treat as full question receipt to re-establish lock protection
          // This is critical for FSRS re-review: lock prevents polling from
          // replacing question while user is mid-review

          // Convert to quiz format for compatibility
          const question: SimpleQuestion = {
            question: nextReview.question.question,
            options: nextReview.question.options,
            correctAnswer: nextReview.question.correctAnswer,
            explanation: nextReview.question.explanation || '',
          };

          // Generate new lock ID to protect re-review session
          const lockId = `${nextReview.question._id}-${Date.now()}`;

          dispatch({
            type: 'QUESTION_RECEIVED',
            payload: {
              question,
              questionId: nextReview.question._id,
              interactions: nextReview.interactions || [],
              lockId, // New lock protects re-review session
            },
          });

          // Note: lastQuestionIdRef stays unchanged, so this is still detected
          // as "same question" on next poll (important for deduplication)
        } else {
          dispatch({
            type: 'IGNORE_UPDATE',
            reason: 'Poll executed but data unchanged - same question ID',
          });
        }
      }
    }
  }, [nextReview, state.lockId, state.phase, state.isTransitioning, dataHasChanged]);

  // Memoized handler for review completion
  const handleReviewComplete = useCallback(async () => {
    // Release lock and reset state for clean transition to next question
    dispatch({ type: 'REVIEW_COMPLETE' });
    // Intentional loading state provides visual feedback during transitions,
    // especially important for FSRS immediate re-review of incorrect answers
  }, []);

  // Return stable object with all necessary data and handlers
  return {
    phase: state.phase,
    question: state.question,
    questionId: state.questionId,
    interactions: state.interactions,
    isTransitioning: state.isTransitioning,
    errorMessage: state.errorMessage,
    handlers: {
      onReviewComplete: handleReviewComplete,
    },
  };
}
