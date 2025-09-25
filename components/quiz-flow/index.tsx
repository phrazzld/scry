"use client";

import { useUser } from "@clerk/nextjs";
import { QuizMode } from "./quiz-mode";
import { ReviewMode } from "./review-mode";

interface UnifiedQuizFlowProps {
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  mode?: "quiz" | "review";
}

/**
 * Unified quiz flow component that handles both quiz and review modes.
 * Delegates to specialized components based on mode.
 *
 * Component breakdown:
 * - QuizMode: Handles quiz generation and completion (114 lines)
 * - ReviewMode: Handles spaced repetition reviews (109 lines)
 * - State components: Small, focused UI components (<50 lines each)
 *
 * Total: Reduced from 385 lines to <40 lines in main component
 */
export default function UnifiedQuizFlow({
  topic = "general knowledge",
  difficulty = "medium",
  mode = "quiz"
}: UnifiedQuizFlowProps) {
  const { isSignedIn } = useUser();

  // Delegate to appropriate mode component
  if (mode === "review") {
    if (!isSignedIn) {
      // Review mode requires authentication
      return (
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-muted-foreground">
            Please sign in to access review mode.
          </p>
        </div>
      );
    }
    return <ReviewMode />;
  }

  // Default to quiz mode
  return <QuizMode topic={topic} difficulty={difficulty} />;
}

// Re-export all components for external use
export { QuizMode } from "./quiz-mode";
export { ReviewMode } from "./review-mode";
export { QuizReadyState } from "./quiz-ready-state";
export { QuizGeneratingState } from "./quiz-generating-state";
export { QuizCompleteState } from "./quiz-complete-state";
// ReviewReadyState removed - we go directly to questions
export { ReviewEmptyState } from "./review-empty-state";
export { ReviewCompleteState } from "./review-complete-state";