'use client';

import { ReviewSession } from '@/components/review-session';
import { QuizFlowSkeleton } from '@/components/ui/loading-skeletons';
import { useReviewFlow } from '@/hooks/use-review-flow';
import { ReviewEmptyState } from './review-empty-state';

/**
 * Pure presentation component for review mode
 * All business logic is handled by useReviewFlow hook
 * This component only handles rendering based on the state
 */
export function ReviewMode() {
  // Get review state and handlers from custom hook
  const {
    phase,
    question,
    conceptId,
    phrasingId,
    legacyQuestionId,
    interactions,
    errorMessage,
    handlers,
  } = useReviewFlow();

  // Pure render based on state
  return (
    <div className="min-h-[400px] flex items-start justify-center">
      {phase === 'loading' && <QuizFlowSkeleton />}

      {phase === 'empty' && <ReviewEmptyState />}

      {phase === 'error' && (
        <div className="w-full max-w-2xl px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              {errorMessage || 'Something went wrong'}
            </h3>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}

      {phase === 'reviewing' && question && (
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <ReviewSession
            question={question}
            conceptId={conceptId || undefined}
            phrasingId={phrasingId || undefined}
            questionId={legacyQuestionId || undefined}
            onComplete={handlers.onReviewComplete}
            mode="review"
            questionHistory={interactions}
          />
        </div>
      )}
    </div>
  );
}
