"use client";

import { useState, useEffect } from "react";
import { useSimplePoll } from "@/hooks/use-simple-poll";
import { useRenderTracker } from "@/hooks/use-render-tracker";
import { api } from "@/convex/_generated/api";
import { ReviewSession } from "@/components/review-session";
// ReviewReadyState removed - we go directly to questions
import { ReviewEmptyState } from "./review-empty-state";
import { QuizFlowSkeleton } from "@/components/ui/loading-skeletons";
import type { SimpleQuestion } from "@/types/questions";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type ReviewState = "loading" | "empty" | "quiz";

export function ReviewMode() {
  const [state, setState] = useState<ReviewState>("loading");
  const [reviewQuestion, setReviewQuestion] = useState<SimpleQuestion | null>(null);
  const [reviewQuestionId, setReviewQuestionId] = useState<Id<"questions"> | null>(null);
  const [reviewInteractions, setReviewInteractions] = useState<Doc<"interactions">[]>([]);
  const [isReviewing, setIsReviewing] = useState(false); // Lock to prevent updates during active review
  const [prevReviewId, setPrevReviewId] = useState<string | null>(null);

  // Query - use simple polling for time-sensitive review queries
  const { data: nextReview } = useSimplePoll(
    api.spacedRepetition.getNextReview,
    {},
    30000 // Poll every 30 seconds
  );

  // Add render tracking after all hooks
  useRenderTracker('ReviewMode', {
    state,
    reviewQuestionId,
    isReviewing,
    prevReviewId,
    nextReviewData: nextReview
  });

  useEffect(() => {
    // Track polling query execution vs actual data changes
    if (process.env.NODE_ENV === 'development') {
      console.log('[ReviewMode] useEffect triggered - polling query result:', {
        hasData: nextReview !== undefined,
        isNull: nextReview === null,
        questionId: nextReview?.question?._id,
        isReviewing,
        prevReviewId
      });
    }

    // Only update if we're not actively reviewing a question
    if (isReviewing) {
      return; // Don't update while user is reviewing
    }

    if (nextReview === undefined) {
      // Only show loading on initial load
      if (state === "loading" && !prevReviewId) {
        if (process.env.NODE_ENV === 'development') {
          console.time('ReviewMode.setState.loading');
        }
        setState("loading");
        if (process.env.NODE_ENV === 'development') {
          console.timeEnd('ReviewMode.setState.loading');
        }
      }
    } else if (nextReview === null) {
      if (process.env.NODE_ENV === 'development') {
        console.time('ReviewMode.setState.empty');
      }
      setState("empty");
      if (process.env.NODE_ENV === 'development') {
        console.timeEnd('ReviewMode.setState.empty');
      }
    } else {
      // Check if this is a new question
      const isNewQuestion = nextReview.question._id !== prevReviewId;

      if (isNewQuestion) {
        if (process.env.NODE_ENV === 'development') {
          // Mark performance when a new question loads
          performance.mark('review-question-loaded');
          console.log('[ReviewMode] New question loaded:', nextReview.question._id);
        }

        // Convert to quiz format for compatibility
        const question: SimpleQuestion = {
          question: nextReview.question.question,
          options: nextReview.question.options,
          correctAnswer: nextReview.question.correctAnswer,
          explanation: nextReview.question.explanation || ""
        };

        if (process.env.NODE_ENV === 'development') {
          console.time('ReviewMode.setState.quiz');
        }
        setReviewQuestion(question);
        setReviewQuestionId(nextReview.question._id);
        setReviewInteractions(nextReview.interactions || []);
        setState("quiz"); // Go directly to quiz, no ready state
        setIsReviewing(true); // Lock updates while reviewing this question
        setPrevReviewId(nextReview.question._id);
        if (process.env.NODE_ENV === 'development') {
          console.timeEnd('ReviewMode.setState.quiz');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('[ReviewMode] Poll executed but data unchanged - same question ID');
        }
      }
    }
  }, [nextReview, isReviewing, state, prevReviewId]);

  const handleReviewComplete = async () => {
    // Release lock to allow next question to load
    setIsReviewing(false);
    // Don't clear state immediately - keep showing current question until next one loads
    // This prevents the loading state flash between questions
  };


  return (
    <div className="min-h-[400px] flex items-start justify-center">
      {state === "loading" && <QuizFlowSkeleton />}

      {state === "empty" && <ReviewEmptyState />}

      {state === "quiz" && reviewQuestion && (
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <ReviewSession
            quiz={{
              topic: "Review Session",
              questions: [reviewQuestion],
              questionIds: reviewQuestionId ? [reviewQuestionId] : [],
              currentIndex: 0
            }}
            onComplete={handleReviewComplete}
            mode="review"
            questionHistory={reviewInteractions}
          />
        </div>
      )}
    </div>
  );
}