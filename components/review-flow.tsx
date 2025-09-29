'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Calendar, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EditQuestionModal } from '@/components/edit-question-modal';
import { QuestionHistory } from '@/components/question-history';
import { ReviewQuestionDisplay } from '@/components/review-question-display';
import { ReviewEmptyState } from '@/components/review/review-empty-state';
import { ReviewErrorBoundary } from '@/components/review/review-error-boundary';
import { Button } from '@/components/ui/button';
import { QuizFlowSkeleton } from '@/components/ui/loading-skeletons';
import { useCurrentQuestion } from '@/contexts/current-question-context';
import type { Doc } from '@/convex/_generated/dataModel';
import { useReviewShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useQuestionMutations } from '@/hooks/use-question-mutations';
import { useQuizInteractions } from '@/hooks/use-quiz-interactions';
import { useReviewFlow } from '@/hooks/use-review-flow';

/**
 * Unified ReviewFlow component that combines ReviewMode + ReviewSession
 * Eliminates intermediate data transformations and prop drilling
 * Works directly with single questions from the review flow
 */
export function ReviewFlow() {
  // Get review state and handlers from custom hook
  const { phase, question, questionId, interactions, handlers } = useReviewFlow();

  // Use context for current question
  const { setCurrentQuestion } = useCurrentQuestion();

  // Local UI state for answer selection and feedback
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');

  // Combined feedback state to batch updates
  const [feedbackState, setFeedbackState] = useState<{
    showFeedback: boolean;
    nextReviewInfo: {
      nextReview: Date | null;
      scheduledDays: number;
    } | null;
  }>({
    showFeedback: false,
    nextReviewInfo: null,
  });

  const { trackAnswer } = useQuizInteractions();
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Edit/Delete functionality
  const [editModalOpen, setEditModalOpen] = useState(false);
  const { optimisticEdit, optimisticDelete } = useQuestionMutations();

  // Update context when current question changes
  useEffect(() => {
    if (question && questionId) {
      // Convert SimpleQuestion to a partial Doc<"questions"> format
      setCurrentQuestion({
        ...question,
        _id: questionId,
        type: question.type || 'multiple-choice',
      } as Doc<'questions'>);
    } else {
      setCurrentQuestion(undefined);
    }
  }, [question, questionId, setCurrentQuestion]);

  // Reset state when question changes
  useEffect(() => {
    if (questionId) {
      setSelectedAnswer('');
      setFeedbackState({
        showFeedback: false,
        nextReviewInfo: null,
      });
      setQuestionStartTime(Date.now());
    }
  }, [questionId]);

  const handleAnswerSelect = useCallback(
    (answer: string) => {
      if (feedbackState.showFeedback) return;
      setSelectedAnswer(answer);
    },
    [feedbackState.showFeedback]
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedAnswer || !question || !questionId) return;

    const isCorrect = selectedAnswer === question.correctAnswer;

    // Track interaction with FSRS scheduling (before showing feedback)
    const timeSpent = Date.now() - questionStartTime;
    const reviewInfo = await trackAnswer(
      questionId,
      selectedAnswer,
      isCorrect,
      timeSpent,
      sessionId
    );

    // Batch state updates into a single render
    setFeedbackState({
      showFeedback: true,
      nextReviewInfo: reviewInfo
        ? {
            nextReview: reviewInfo.nextReview,
            scheduledDays: reviewInfo.scheduledDays,
          }
        : null,
    });
  }, [selectedAnswer, question, questionId, questionStartTime, trackAnswer, sessionId]);

  const handleNext = useCallback(() => {
    // Tell the review flow we're done with this question
    handlers.onReviewComplete();

    // State will reset when new question arrives via useEffect
  }, [handlers]);

  // Edit handler
  const handleEdit = useCallback(() => {
    if (!question || !questionId) return;
    setEditModalOpen(true);
  }, [question, questionId]);

  // Delete handler with confirmation
  const handleDelete = useCallback(async () => {
    if (!question || !questionId) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this question? This action cannot be undone.'
    );

    if (confirmed) {
      const result = await optimisticDelete({ questionId });
      if (result.success) {
        toast.success('Question deleted');
        // Move to next question after delete
        handlers.onReviewComplete();
      }
    }
  }, [question, questionId, optimisticDelete, handlers]);

  // Handle save from edit modal - now supports all fields
  const handleSaveEdit = useCallback(
    async (updates: {
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }) => {
      if (!questionId) return;

      // Pass all fields including options and correctAnswer
      const result = await optimisticEdit({
        questionId,
        question: updates.question,
        topic: '', // We don't have topic in SimpleQuestion, using empty string
        explanation: updates.explanation,
        options: updates.options,
        correctAnswer: updates.correctAnswer,
      });

      if (result.success) {
        setEditModalOpen(false);
        toast.success('Question updated');
      }
    },
    [questionId, optimisticEdit]
  );

  // Wire up keyboard shortcuts
  useReviewShortcuts({
    onSelectAnswer: !feedbackState.showFeedback
      ? (index: number) => {
          if (question && question.options[index]) {
            handleAnswerSelect(question.options[index]);
          }
        }
      : undefined,
    onSubmit: !feedbackState.showFeedback && selectedAnswer ? handleSubmit : undefined,
    onNext: feedbackState.showFeedback ? handleNext : undefined,
    onEdit: handleEdit,
    onDelete: handleDelete,
    showingFeedback: feedbackState.showFeedback,
    canSubmit: !!selectedAnswer,
  });

  // Render based on phase
  if (phase === 'loading') {
    return (
      <div className="min-h-[400px] flex items-start justify-center">
        <QuizFlowSkeleton />
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="min-h-[400px] flex items-start justify-center">
        <ReviewEmptyState />
      </div>
    );
  }

  if (phase === 'reviewing' && question) {
    return (
      <div className="min-h-[400px] flex items-start justify-center">
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <article className="space-y-6">
            {/* Use memoized component for question display with error boundary */}
            <ReviewErrorBoundary
              fallbackMessage="Unable to display this question. Try refreshing or moving to the next question."
              onReset={() => {
                // Reset local state and try to move to next question
                setSelectedAnswer('');
                setFeedbackState({ showFeedback: false, nextReviewInfo: null });
                handlers.onReviewComplete();
              }}
            >
              <ReviewQuestionDisplay
                question={question}
                questionId={questionId}
                selectedAnswer={selectedAnswer}
                showFeedback={feedbackState.showFeedback}
                onAnswerSelect={handleAnswerSelect}
              />
            </ReviewErrorBoundary>

            <div className="space-y-3">
              {feedbackState.showFeedback &&
                (question.explanation ||
                  interactions.length > 0 ||
                  feedbackState.nextReviewInfo?.nextReview) && (
                  <div className="mt-4 space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50 animate-fadeIn">
                    {/* Explanation */}
                    {question.explanation && (
                      <p className="text-sm text-foreground/90">{question.explanation}</p>
                    )}

                    {/* Divider between explanation and other content */}
                    {question.explanation &&
                      (interactions.length > 0 || feedbackState.nextReviewInfo?.nextReview) && (
                        <hr className="border-border/30" />
                      )}

                    {/* Question History */}
                    {interactions.length > 0 && (
                      <QuestionHistory interactions={interactions} loading={false} />
                    )}

                    {/* Next Review - inline and subtle */}
                    {feedbackState.nextReviewInfo && feedbackState.nextReviewInfo.nextReview && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          Next review:{' '}
                          {feedbackState.nextReviewInfo.scheduledDays === 0
                            ? 'Today'
                            : feedbackState.nextReviewInfo.scheduledDays === 1
                              ? 'Tomorrow'
                              : `In ${feedbackState.nextReviewInfo.scheduledDays} days`}
                          {' at '}
                          {new Date(feedbackState.nextReviewInfo.nextReview).toLocaleTimeString(
                            'en-US',
                            {
                              hour: 'numeric',
                              minute: '2-digit',
                            }
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}

              {/* Action buttons for edit/delete */}
              <div className="flex items-center justify-between mt-6">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    className="text-muted-foreground hover:text-foreground"
                    title="Edit question (E)"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="text-muted-foreground hover:text-error"
                    title="Delete question (D)"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>

                {!feedbackState.showFeedback ? (
                  <Button onClick={handleSubmit} disabled={!selectedAnswer} size="lg">
                    Submit
                  </Button>
                ) : (
                  <Button onClick={handleNext} size="lg">
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </article>
        </div>

        {/* Edit Question Modal */}
        {question && questionId && (
          <EditQuestionModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            question={
              {
                _id: questionId,
                _creationTime: Date.now(),
                userId: '' as Doc<'questions'>['userId'], // Type assertion for missing field
                question: question.question,
                topic: '', // SimpleQuestion doesn't have topic
                difficulty: 'medium', // Default since not in SimpleQuestion
                type: question.type || 'multiple-choice',
                options: question.options,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation,
                generatedAt: Date.now(),
                attemptCount: 0, // Not available in SimpleQuestion
                correctCount: 0, // Not available in SimpleQuestion
              } as Doc<'questions'>
            }
            onSave={handleSaveEdit}
          />
        )}
      </div>
    );
  }

  // Fallback for unexpected states
  return null;
}
