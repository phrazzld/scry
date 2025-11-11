'use client';

import { useState } from 'react';
import { ArrowRight, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { QuestionHistory } from '@/components/question-history';
import { Button } from '@/components/ui/button';
import type { Doc } from '@/convex/_generated/dataModel';
import { useQuizInteractions } from '@/hooks/use-quiz-interactions';
import { useShuffledOptions } from '@/hooks/use-shuffled-options';
import { cn } from '@/lib/utils';
import type { SimpleQuestion } from '@/types/questions';

interface ReviewSessionProps {
  question: SimpleQuestion;
  conceptId?: string;
  phrasingId?: string;
  questionId?: string; // Legacy question ID for edit/delete contexts
  onComplete: (
    answers: Array<{ userAnswer: string; isCorrect: boolean }>,
    sessionId: string
  ) => void;
  mode?: 'quiz' | 'review';
  questionHistory?: Doc<'interactions'>[]; // History of previous attempts for review mode
}

export function ReviewSession({
  question,
  conceptId,
  phrasingId,
  questionId,
  onComplete,
  mode = 'quiz',
  questionHistory,
}: ReviewSessionProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [nextReviewInfo, setNextReviewInfo] = useState<{
    nextReview: Date | null;
    scheduledDays: number;
  } | null>(null);

  const { trackAnswer } = useQuizInteractions();
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [questionStartTime] = useState(Date.now());

  // Shuffle options deterministically based on phrasing/question id + userId
  const shuffledOptions = useShuffledOptions(question.options, phrasingId ?? questionId ?? null);

  const isCorrect = selectedAnswer === question.correctAnswer;

  const handleAnswerSelect = (answer: string) => {
    if (showFeedback) return;
    setSelectedAnswer(answer);
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) return;

    setShowFeedback(true);

    // Track interaction if we have concept + phrasing IDs
    if (conceptId && phrasingId) {
      const timeSpent = Date.now() - questionStartTime;
      const reviewInfo = await trackAnswer(
        conceptId,
        phrasingId,
        selectedAnswer,
        isCorrect,
        timeSpent,
        sessionId
      );

      if (reviewInfo) {
        setNextReviewInfo({
          nextReview: reviewInfo.nextReview,
          scheduledDays: reviewInfo.scheduledDays,
        });
      }
    }
  };

  const handleNext = () => {
    // Since we're dealing with a single question, always complete
    const finalAnswers = [
      {
        questionId: questionId ?? phrasingId,
        userAnswer: selectedAnswer,
        isCorrect,
        timeTaken: Date.now() - questionStartTime,
      },
    ];
    onComplete(finalAnswers, sessionId);
  };

  return (
    <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <article className="space-y-6">
        <h2 className="text-xl font-semibold">{question.question}</h2>

        <div className="space-y-3">
          {question.type === 'true-false' ? (
            // True/False specific layout
            <div className="grid grid-cols-2 gap-4">
              {shuffledOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
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
                onClick={() => handleAnswerSelect(option)}
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
                  {showFeedback &&
                    selectedAnswer === option &&
                    option !== question.correctAnswer && (
                      <XCircle className="h-5 w-5 text-error animate-scaleIn" />
                    )}
                </div>
              </button>
            ))
          )}

          {showFeedback &&
            (question.explanation ||
              (mode === 'review' && questionHistory) ||
              nextReviewInfo?.nextReview) && (
              <div className="mt-4 space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50 animate-fadeIn">
                {/* Explanation */}
                {question.explanation && (
                  <p className="text-sm text-foreground/90">{question.explanation}</p>
                )}

                {/* Divider between explanation and other content */}
                {question.explanation &&
                  ((mode === 'review' && questionHistory) || nextReviewInfo?.nextReview) && (
                    <hr className="border-border/30" />
                  )}

                {/* Question History - simplified styling */}
                {mode === 'review' && questionHistory && (
                  <QuestionHistory interactions={questionHistory} loading={false} />
                )}

                {/* Next Review - inline and subtle */}
                {nextReviewInfo && nextReviewInfo.nextReview && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      Next review:{' '}
                      {nextReviewInfo.scheduledDays === 0
                        ? 'Today'
                        : nextReviewInfo.scheduledDays === 1
                          ? 'Tomorrow'
                          : `In ${nextReviewInfo.scheduledDays} days`}
                      {' at '}
                      {new Date(nextReviewInfo.nextReview).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}

          <div className="flex justify-end mt-6">
            {!showFeedback ? (
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
  );
}
