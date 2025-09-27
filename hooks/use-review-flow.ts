"use client";

import { useEffect, useReducer, useRef, useCallback } from "react";
import { useSimplePoll } from "@/hooks/use-simple-poll";
import { useDataHash } from "@/hooks/use-data-hash";
import { api } from "@/convex/_generated/api";
import type { SimpleQuestion } from "@/types/questions";
import type { Id, Doc } from "@/convex/_generated/dataModel";

// State machine definition
interface ReviewModeState {
  phase: 'loading' | 'empty' | 'reviewing';
  question: SimpleQuestion | null;
  questionId: Id<"questions"> | null;
  interactions: Doc<"interactions">[];
  lockId: string | null; // Unique ID per question to prevent race conditions
}

// Action types for state machine
type ReviewAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_EMPTY' }
  | { type: 'QUESTION_RECEIVED'; payload: {
      question: SimpleQuestion;
      questionId: Id<"questions">;
      interactions: Doc<"interactions">[];
      lockId: string;
    }}
  | { type: 'REVIEW_COMPLETE' }
  | { type: 'IGNORE_UPDATE'; reason: string };

// Initial state
const initialState: ReviewModeState = {
  phase: 'loading',
  question: null,
  questionId: null,
  interactions: [],
  lockId: null
};

// Reducer function to manage state transitions
export function reviewReducer(state: ReviewModeState, action: ReviewAction): ReviewModeState {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`[ReviewMode Reducer] Action: ${action.type}`, action);
  }

  switch (action.type) {
    case 'LOAD_START':
      return { ...state, phase: 'loading' };

    case 'LOAD_EMPTY':
      return {
        ...state,
        phase: 'empty',
        question: null,
        questionId: null,
        interactions: [],
        lockId: null
      };

    case 'QUESTION_RECEIVED':
      return {
        phase: 'reviewing',
        question: action.payload.question,
        questionId: action.payload.questionId,
        interactions: action.payload.interactions,
        lockId: action.payload.lockId
      };

    case 'REVIEW_COMPLETE':
      // Reset full state to ensure clean transition even when same question returns
      // This is critical for FSRS immediate re-review scenarios (incorrect answers)
      return {
        ...state,
        phase: 'loading',
        question: null,
        questionId: null,
        interactions: [],
        lockId: null
      };

    case 'IGNORE_UPDATE':
      // No state change, just log in development
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log(`[ReviewMode] Update ignored: ${action.reason}`);
      }
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

  // Query - use simple polling for time-sensitive review queries
  const { data: nextReview } = useSimplePoll(
    api.spacedRepetition.getNextReview,
    {},
    30000 // Poll every 30 seconds
  );

  // Check if data has actually changed to prevent unnecessary renders
  const { hasChanged: dataHasChanged } = useDataHash(nextReview, 'ReviewMode.nextReview');

  // Process polling data and update state
  useEffect(() => {
    // Track polling query execution vs actual data changes
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[ReviewMode] useEffect triggered - polling query result:', {
        hasData: nextReview !== undefined,
        isNull: nextReview === null,
        questionId: nextReview?.question?._id,
        currentLockId: state.lockId,
        lastQuestionId: lastQuestionIdRef.current,
        dataHasChanged
      });
    }

    // If data hasn't actually changed, skip processing (unless transitioning from loading)
    // Special case: after REVIEW_COMPLETE, we need to process even if same question returns
    if (!dataHasChanged && state.phase !== 'loading') {
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
      if (state.phase === "loading" && !lastQuestionIdRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.time('ReviewMode.dispatch.LOAD_START');
        }
        dispatch({ type: 'LOAD_START' });
        if (process.env.NODE_ENV === 'development') {
          console.timeEnd('ReviewMode.dispatch.LOAD_START');
        }
      }
    } else if (nextReview === null) {
      if (process.env.NODE_ENV === 'development') {
        console.time('ReviewMode.dispatch.LOAD_EMPTY');
      }
      dispatch({ type: 'LOAD_EMPTY' });
      if (process.env.NODE_ENV === 'development') {
        console.timeEnd('ReviewMode.dispatch.LOAD_EMPTY');
      }
    } else {
      // Check if this is a new question
      const isNewQuestion = nextReview.question._id !== lastQuestionIdRef.current;

      if (isNewQuestion) {
        if (process.env.NODE_ENV === 'development') {
          // Mark performance when a new question loads
          performance.mark('review-question-loaded');
          // eslint-disable-next-line no-console
          console.log('[ReviewMode] New question loaded:', nextReview.question._id);
        }

        // Convert to quiz format for compatibility
        const question: SimpleQuestion = {
          question: nextReview.question.question,
          options: nextReview.question.options,
          correctAnswer: nextReview.question.correctAnswer,
          explanation: nextReview.question.explanation || ""
        };

        // Generate unique lock ID for this question
        const lockId = `${nextReview.question._id}-${Date.now()}`;

        if (process.env.NODE_ENV === 'development') {
          console.time('ReviewMode.dispatch.QUESTION_RECEIVED');
        }

        dispatch({
          type: 'QUESTION_RECEIVED',
          payload: {
            question,
            questionId: nextReview.question._id,
            interactions: nextReview.interactions || [],
            lockId
          }
        });

        // Update last question ID even if it's the same (immediate re-review case)
        // This ensures UI resets properly when incorrect answers trigger immediate review
        lastQuestionIdRef.current = nextReview.question._id;

        if (process.env.NODE_ENV === 'development') {
          console.timeEnd('ReviewMode.dispatch.QUESTION_RECEIVED');
        }
      } else {
        dispatch({
          type: 'IGNORE_UPDATE',
          reason: 'Poll executed but data unchanged - same question ID'
        });
      }
    }
  }, [nextReview, state.lockId, state.phase, dataHasChanged]);

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
    handlers: {
      onReviewComplete: handleReviewComplete
    }
  };
}