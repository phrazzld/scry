"use client";

import { useEffect, useReducer, useRef } from "react";
import { useSimplePoll } from "@/hooks/use-simple-poll";
import { useRenderTracker } from "@/hooks/use-render-tracker";
import { api } from "@/convex/_generated/api";
import { ReviewSession } from "@/components/review-session";
import { ReviewEmptyState } from "./review-empty-state";
import { QuizFlowSkeleton } from "@/components/ui/loading-skeletons";
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
function reviewReducer(state: ReviewModeState, action: ReviewAction): ReviewModeState {
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
      // Clear lock but keep showing current question
      return { ...state, lockId: null };

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

export function ReviewMode() {
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

  // Add render tracking after all hooks
  useRenderTracker('ReviewMode', {
    phase: state.phase,
    questionId: state.questionId,
    lockId: state.lockId,
    nextReviewData: nextReview
  });

  useEffect(() => {
    // Track polling query execution vs actual data changes
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[ReviewMode] useEffect triggered - polling query result:', {
        hasData: nextReview !== undefined,
        isNull: nextReview === null,
        questionId: nextReview?.question?._id,
        currentLockId: state.lockId,
        lastQuestionId: lastQuestionIdRef.current
      });
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

        // Update ref to track this question
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
  }, [nextReview, state.lockId, state.phase]);

  const handleReviewComplete = async () => {
    // Release lock to allow next question to load
    dispatch({ type: 'REVIEW_COMPLETE' });
    // Don't clear state immediately - keep showing current question until next one loads
    // This prevents the loading state flash between questions
  };

  return (
    <div className="min-h-[400px] flex items-start justify-center">
      {state.phase === "loading" && <QuizFlowSkeleton />}

      {state.phase === "empty" && <ReviewEmptyState />}

      {state.phase === "reviewing" && state.question && (
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <ReviewSession
            quiz={{
              topic: "Review Session",
              questions: [state.question],
              questionIds: state.questionId ? [state.questionId] : [],
              currentIndex: 0
            }}
            onComplete={handleReviewComplete}
            mode="review"
            questionHistory={state.interactions}
          />
        </div>
      )}
    </div>
  );
}