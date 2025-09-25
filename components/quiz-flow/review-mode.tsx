"use client";

import { useState, useEffect } from "react";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { api } from "@/convex/_generated/api";
import { QuizSessionManager } from "@/components/quiz-session-manager";
// ReviewReadyState removed - we go directly to questions
import { ReviewEmptyState } from "./review-empty-state";
import { ReviewCompleteState } from "./review-complete-state";
import { QuizFlowSkeleton } from "@/components/ui/loading-skeletons";
import type { SimpleQuestion } from "@/types/quiz";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type ReviewState = "loading" | "empty" | "quiz" | "complete";

export function ReviewMode() {
  const [state, setState] = useState<ReviewState>("loading");
  const [reviewQuestion, setReviewQuestion] = useState<SimpleQuestion | null>(null);
  const [reviewQuestionId, setReviewQuestionId] = useState<Id<"questions"> | null>(null);
  const [reviewInteractions, setReviewInteractions] = useState<Doc<"interactions">[]>([]);
  const [isReviewing, setIsReviewing] = useState(false); // Lock to prevent updates during active review

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
    // Only update if we're not actively reviewing a question
    if (isReviewing) {
      return; // Don't update while user is reviewing
    }

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
      setState("quiz"); // Go directly to quiz, no ready state
      setIsReviewing(true); // Lock updates while reviewing this question
    }
  }, [nextReview, isReviewing]);

  const handleReviewComplete = async () => {
    // Check if there are more reviews
    if ((dueCount?.totalReviewable ?? 0) > 1) {
      // More reviews available - load the next one immediately
      setIsReviewing(false); // Release lock to allow next question to load
      setState("loading");
      setReviewQuestion(null);
      setReviewQuestionId(null);
      setReviewInteractions([]);
    } else {
      // No more reviews
      setState("complete");
    }
  };

  const startNextReview = () => {
    // Reset all state to trigger a fresh review load
    setIsReviewing(false); // Release lock for next question
    setState("loading");
    setReviewQuestion(null);
    setReviewQuestionId(null);
    setReviewInteractions([]);
  };

  return (
    <div className="min-h-[400px] flex items-start justify-center">
      {state === "loading" && <QuizFlowSkeleton />}

      {state === "empty" && <ReviewEmptyState />}

      {state === "quiz" && reviewQuestion && (
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <QuizSessionManager
            quiz={{
              topic: "Review Session",
              questions: [reviewQuestion],
              questionIds: reviewQuestionId ? [reviewQuestionId] : [],
              currentIndex: 0,
              score: 0
            }}
            onComplete={handleReviewComplete}
            mode="review"
            questionHistory={reviewInteractions}
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