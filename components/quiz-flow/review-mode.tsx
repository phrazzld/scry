"use client";

import { useState, useEffect } from "react";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { api } from "@/convex/_generated/api";
import { QuizSessionManager } from "@/components/quiz-session-manager";
import { QuestionHistory } from "@/components/question-history";
import { ReviewReadyState } from "./review-ready-state";
import { ReviewEmptyState } from "./review-empty-state";
import { ReviewCompleteState } from "./review-complete-state";
import { QuizFlowSkeleton } from "@/components/ui/loading-skeletons";
import type { SimpleQuestion } from "@/types/quiz";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type ReviewState = "loading" | "empty" | "ready" | "quiz" | "complete";

export function ReviewMode() {
  const [state, setState] = useState<ReviewState>("loading");
  const [reviewQuestion, setReviewQuestion] = useState<SimpleQuestion | null>(null);
  const [reviewQuestionId, setReviewQuestionId] = useState<Id<"questions"> | null>(null);
  const [reviewInteractions, setReviewInteractions] = useState<Doc<"interactions">[]>([]);

  // Queries - use polling for time-sensitive review queries
  const nextReview = usePollingQuery(
    api.spacedRepetition.getNextReview,
    {},
    30000 // Poll every 30 seconds
  );

  const dueCount = usePollingQuery(
    api.spacedRepetition.getDueCount,
    {},
    30000 // Poll every 30 seconds
  );

  useEffect(() => {
    if (nextReview === undefined) {
      setState("loading");
    } else if (nextReview === null) {
      setState("empty");
    } else {
      // Convert to quiz format for compatibility
      const question: SimpleQuestion = {
        question: nextReview.question.question,
        options: nextReview.question.options,
        correctAnswer: nextReview.question.correctAnswer,
        explanation: nextReview.question.explanation || ""
      };
      setReviewQuestion(question);
      setReviewQuestionId(nextReview.question._id);
      setReviewInteractions(nextReview.interactions || []);
      setState("ready");
    }
  }, [nextReview]);

  const handleReviewComplete = async () => {
    setState("complete");
  };

  const startNextReview = () => {
    // Reset all state to trigger a fresh review load
    setState("loading");
    setReviewQuestion(null);
    setReviewQuestionId(null);
    setReviewInteractions([]);
    // The useEffect will automatically update when nextReview changes
    // No need for window.location.reload()
  };

  return (
    <div className="min-h-[400px] flex items-start justify-center">
      {state === "loading" && <QuizFlowSkeleton />}

      {state === "empty" && <ReviewEmptyState />}

      {state === "ready" && reviewQuestion && (
        <ReviewReadyState
          dueCount={dueCount?.totalReviewable ?? 0}
          questionPreview={reviewQuestion.question.substring(0, 100) + "..."}
          onStart={() => setState("quiz")}
        />
      )}

      {state === "quiz" && reviewQuestion && (
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          {reviewInteractions && (
            <QuestionHistory
              interactions={reviewInteractions}
              loading={false}
            />
          )}

          <QuizSessionManager
            quiz={{
              topic: "Review Session",
              questions: [reviewQuestion],
              questionIds: reviewQuestionId ? [reviewQuestionId] : [],
              currentIndex: 0,
              score: 0
            }}
            onComplete={handleReviewComplete}
          />
        </div>
      )}

      {state === "complete" && (
        <ReviewCompleteState
          remainingReviews={(dueCount?.totalReviewable ?? 1) - 1}
          onNextReview={startNextReview}
        />
      )}
    </div>
  );
}