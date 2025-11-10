'use client';

import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { useShuffledOptions } from '@/hooks/use-shuffled-options';
import { cn } from '@/lib/utils';
import type { SimpleQuestion } from '@/types/questions';

interface ReviewQuestionDisplayProps {
  question: SimpleQuestion;
  questionId?: Id<'questions'> | Id<'phrasings'> | null;
  selectedAnswer: string;
  showFeedback: boolean;
  onAnswerSelect: (answer: string) => void;
}

/**
 * Pure component for rendering a quiz question with answer options
 * Memoized to prevent unnecessary re-renders when parent state changes
 * Only re-renders when question ID, selected answer, or feedback state changes
 *
 * Answer options are shuffled deterministically based on questionId + userId
 * to prevent the correct answer from always appearing in the same position
 */
function ReviewQuestionDisplayComponent({
  question,
  questionId,
  selectedAnswer,
  showFeedback,
  onAnswerSelect,
}: ReviewQuestionDisplayProps) {
  // Shuffle options deterministically based on questionId + userId
  const shuffledOptions = useShuffledOptions(question.options, questionId);

  return (
    <>
      <h2 className="text-xl font-semibold">{question.question}</h2>

      <div className="space-y-3">
        {question.type === 'true-false' ? (
          // True/False specific layout
          <div className="grid grid-cols-2 gap-4">
            {shuffledOptions.map((option, index) => (
              <button
                key={index}
                data-testid={`answer-option-${index}`}
                onClick={() => onAnswerSelect(option)}
                className={cn(
                  // Base styles
                  'p-6 rounded-lg border-2 transition-all font-medium',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  // Default state
                  'border-input hover:bg-accent/50 hover:border-accent',
                  // Selected state
                  selectedAnswer === option &&
                    !showFeedback && ['border-info-border bg-info-background text-info'],
                  // Feedback state - correct answer
                  showFeedback &&
                    option === question.correctAnswer && [
                      'border-success-border bg-success-background text-success',
                    ],
                  // Feedback state - wrong answer selected
                  showFeedback &&
                    selectedAnswer === option &&
                    option !== question.correctAnswer && [
                      'border-error-border bg-error-background text-error',
                    ]
                )}
                disabled={showFeedback}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <span className="text-lg">{option}</span>
                  {showFeedback && option === question.correctAnswer && (
                    <CheckCircle className="h-6 w-6 text-success animate-scaleIn" />
                  )}
                  {showFeedback &&
                    selectedAnswer === option &&
                    option !== question.correctAnswer && (
                      <XCircle className="h-6 w-6 text-error animate-scaleIn" />
                    )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          // Multiple choice layout
          shuffledOptions.map((option, index) => (
            <button
              key={index}
              data-testid={`answer-option-${index}`}
              onClick={() => onAnswerSelect(option)}
              className={cn(
                // Base styles
                'w-full text-left p-4 rounded-lg border transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                // Default state
                'border-input hover:bg-accent/50 hover:border-accent',
                // Selected state
                selectedAnswer === option &&
                  !showFeedback && ['border-info-border bg-info-background'],
                // Feedback state - correct answer
                showFeedback &&
                  option === question.correctAnswer && [
                    'border-success-border bg-success-background',
                  ],
                // Feedback state - wrong answer selected
                showFeedback &&
                  selectedAnswer === option &&
                  option !== question.correctAnswer && ['border-error-border bg-error-background']
              )}
              disabled={showFeedback}
            >
              <div className="flex items-center justify-between">
                <span>{option}</span>
                {showFeedback && option === question.correctAnswer && (
                  <CheckCircle className="h-5 w-5 text-success animate-scaleIn" />
                )}
                {showFeedback && selectedAnswer === option && option !== question.correctAnswer && (
                  <XCircle className="h-5 w-5 text-error animate-scaleIn" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}

// Custom comparison function for React.memo
// Only re-render if specific props change that affect the display
function areEqual(
  prevProps: ReviewQuestionDisplayProps,
  nextProps: ReviewQuestionDisplayProps
): boolean {
  // Re-render if question ID changes (new question)
  if (prevProps.questionId !== nextProps.questionId) {
    return false;
  }

  // Re-render if selected answer changes
  if (prevProps.selectedAnswer !== nextProps.selectedAnswer) {
    return false;
  }

  // Re-render if feedback state changes
  if (prevProps.showFeedback !== nextProps.showFeedback) {
    return false;
  }

  // Re-render if the question text itself changes (shouldn't happen in practice)
  if (prevProps.question.question !== nextProps.question.question) {
    return false;
  }

  // Don't re-render for any other prop changes
  return true;
}

// Export memoized component with custom comparison
export const ReviewQuestionDisplay = React.memo(ReviewQuestionDisplayComponent, areEqual);
