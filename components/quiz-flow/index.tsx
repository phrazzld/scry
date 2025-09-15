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
export function UnifiedQuizFlow({ 
  topic = "general knowledge", 
  difficulty = "medium",
  mode = "quiz" 
}: UnifiedQuizFlowProps) {
  const { isSignedIn, user } = useUser();
  const sessionToken = isSignedIn ? user?.id : null;

  // Delegate to appropriate mode component
  if (mode === "review") {
    if (!sessionToken) {
      // Review mode requires authentication
      return (
        <div className="w-full max-w-2xl mx-auto p-4 text-center">
          <p className="text-muted-foreground">
            Please sign in to access review mode.
          </p>
        </div>
      );
    }
    return <ReviewMode sessionToken={sessionToken} />;
  }

  // Default to quiz mode
  return <QuizMode topic={topic} difficulty={difficulty} sessionToken={sessionToken} />;
}

// Default export for module
export default UnifiedQuizFlow;

// Re-export all components for external use
export { QuizMode } from "./quiz-mode";
export { ReviewMode } from "./review-mode";
export { QuizReadyState } from "./quiz-ready-state";
export { QuizGeneratingState } from "./quiz-generating-state";
export { QuizCompleteState } from "./quiz-complete-state";
export { ReviewReadyState } from "./review-ready-state";
export { ReviewEmptyState } from "./review-empty-state";
export { ReviewCompleteState } from "./review-complete-state";