"use client";

import { useReviewFlow } from "@/hooks/use-review-flow";
import { useRenderTracker } from "@/hooks/use-render-tracker";
import { ReviewSession } from "@/components/review-session";
import { ReviewEmptyState } from "./review-empty-state";
import { QuizFlowSkeleton } from "@/components/ui/loading-skeletons";

/**
 * Pure presentation component for review mode
 * All business logic is handled by useReviewFlow hook
 * This component only handles rendering based on the state
 */
export function ReviewMode() {
  // Get review state and handlers from custom hook
  const { phase, question, questionId, interactions, handlers } = useReviewFlow();

  // Add render tracking for performance monitoring
  useRenderTracker('ReviewMode', {
    phase,
    questionId
  });

  // Pure render based on state
  return (
    <div className="min-h-[400px] flex items-start justify-center">
      {phase === "loading" && <QuizFlowSkeleton />}

      {phase === "empty" && <ReviewEmptyState />}

      {phase === "reviewing" && question && (
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <ReviewSession
            quiz={{
              topic: "Review Session",
              questions: [question],
              questionIds: questionId ? [questionId] : [],
              currentIndex: 0
            }}
            onComplete={handlers.onReviewComplete}
            mode="review"
            questionHistory={interactions}
          />
        </div>
      )}
    </div>
  );
}