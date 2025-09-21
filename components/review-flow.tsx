"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionHistory } from "@/components/question-history";
import { NoCardsEmptyState, NothingDueEmptyState } from "@/components/empty-states";
import { CheckCircle, XCircle, Loader2, Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { getPollingInterval } from "@/lib/smart-polling";
import { toast } from "sonner";
import { useReviewShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { EditQuestionModal } from "@/components/edit-question-modal";
import { SignIn } from "@clerk/nextjs";
import { triggerHaptic, triggerSuccessHaptic, triggerErrorHaptic } from "@/lib/haptic";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClerkAppearance } from "@/hooks/use-clerk-appearance";

interface ReviewQuestion {
  question: Doc<"questions">;
  interactions: Doc<"interactions">[];
  attemptCount: number;
  correctCount: number;
  successRate: number | null;
  serverTime?: number; // Server's current time for accurate "New" badge display
}

interface ReviewFeedback {
  isCorrect: boolean;
  nextReview: number | null;
  scheduledDays: number;
  timeSpentSeconds: number;
}

// Daily counter helper functions (localStorage-based, replaces session concept)
const getDailyCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toISOString().split('T')[0];
  const key = `scry:daily-count:${today}`;
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored, 10) : 0;
};

const incrementDailyCount = (): number => {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toISOString().split('T')[0];
  const key = `scry:daily-count:${today}`;
  const newCount = getDailyCount() + 1;
  localStorage.setItem(key, newCount.toString());
  // Clean up old daily counts (keep last 7 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey?.startsWith('scry:daily-count:')) {
      const dateStr = storageKey.replace('scry:daily-count:', '');
      if (dateStr < cutoff.toISOString().split('T')[0]) {
        localStorage.removeItem(storageKey);
      }
    }
  }
  return newCount;
};

const formatSeconds = (totalSeconds: number): string => {
  if (totalSeconds <= 60) {
    return `${Math.max(totalSeconds, 1)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
};

const formatNextReviewWindow = (scheduledDays: number, nextReview: number | null): string => {
  if (nextReview) {
    return formatDistanceToNow(new Date(nextReview), { addSuffix: true });
  }

  if (scheduledDays === 0) {
    return "Later today";
  }

  if (scheduledDays === 1) {
    return "In 1 day";
  }

  return `In ${scheduledDays} days`;
};

/**
 * Main review flow component for spaced repetition learning
 * 
 * Implements Pure FSRS queue prioritization with:
 * - Real-time polling for newly generated questions
 * - Dynamic polling intervals (1s aggressive → 30s normal)
 * - Fresh question priority with exponential decay
 * - No daily limits or comfort features
 * 
 * Features:
 * - Automatic question prioritization based on FSRS algorithm
 * - Question history tracking with success rates
 * - Question editing and deletion capabilities
 * - Segmented progress bar showing new vs due questions
 * - Keyboard shortcuts for navigation
 * 
 * @returns Review interface with question cards and progress tracking
 */
export function ReviewFlow() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const clerkAppearance = useClerkAppearance();
  const [currentQuestion, setCurrentQuestion] = useState<ReviewQuestion | null>(null);
  const [nextQuestion, setNextQuestion] = useState<ReviewQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showingFeedback, setShowingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // const [dailyCount, setDailyCount] = useState(getDailyCount); // Removed for minimal design
  // const [isMutating, setIsMutating] = useState(false); // Not needed anymore
  const [shouldStartReview, setShouldStartReview] = useState(false); // Trigger review after generation
  // Track deleted questions for undo functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [deletedQuestions, setDeletedQuestions] = useState<Set<string>>(new Set());
  
  // Smart polling for time-based updates only (questions becoming due over time)
  // Convex handles data changes automatically via real-time subscriptions
  // Dynamically adjust polling based on when next card is due
  const [pollingInterval, setPollingInterval] = useState(60000); // Default 1 minute
  
  // Queries with minimal polling for time-based updates
  // New questions will appear automatically via Convex reactivity
  const currentReview = usePollingQuery(
    api.spacedRepetition.getNextReview,
    isSignedIn ? {} : "skip",
    pollingInterval
  );

  // Get user's card statistics for context-aware empty states
  const cardStats = usePollingQuery(
    api.spacedRepetition.getUserCardStats,
    isSignedIn ? {} : "skip",
    pollingInterval
  );
  
  // Pre-fetch next review when we have a current question
  const nextReview = usePollingQuery(
    api.spacedRepetition.getNextReview,
    currentQuestion && isSignedIn ? {} : "skip",
    pollingInterval
  );
  
  // Mutations
  const scheduleReview = useMutation(api.spacedRepetition.scheduleReview);
  const updateQuestion = useMutation(api.questions.updateQuestion);
  const deleteQuestion = useMutation(api.questions.softDeleteQuestion);
  const restoreQuestion = useMutation(api.questions.restoreQuestion);
  
  // Set initial question or auto-start after generation
  useEffect(() => {
    if (!currentReview || showingFeedback) {
      return;
    }

    setCurrentQuestion((prev) => {
      const needsInitialQuestion = !prev || shouldStartReview;
      const isDifferentQuestion = prev?.question._id !== currentReview.question._id;

      if (needsInitialQuestion || isDifferentQuestion) {
        setQuestionStartTime(Date.now());
        return currentReview;
      }

      const interactionsChanged =
        prev.interactions.length !== currentReview.interactions.length ||
        prev.interactions.some((interaction, index) => {
          const nextInteraction = currentReview.interactions[index];
          if (!nextInteraction) return true;
          return (
            interaction._id !== nextInteraction._id ||
            interaction.isCorrect !== nextInteraction.isCorrect ||
            interaction.userAnswer !== nextInteraction.userAnswer ||
            interaction.attemptedAt !== nextInteraction.attemptedAt ||
            interaction.timeSpent !== nextInteraction.timeSpent
          );
        });

      const questionContentChanged =
        prev.question.question !== currentReview.question.question ||
        prev.question.correctAnswer !== currentReview.question.correctAnswer ||
        prev.question.explanation !== currentReview.question.explanation ||
        prev.question.options.length !== currentReview.question.options.length ||
        prev.question.options.some((option, index) => option !== currentReview.question.options[index]);

      const progressChanged =
        prev.attemptCount !== currentReview.attemptCount ||
        prev.correctCount !== currentReview.correctCount ||
        prev.successRate !== currentReview.successRate ||
        prev.serverTime !== currentReview.serverTime;

      if (interactionsChanged || questionContentChanged || progressChanged) {
        return {
          ...prev,
          ...currentReview,
        };
      }

      return prev;
    });

    if (shouldStartReview) {
      setShouldStartReview(false);
    }
  }, [currentReview, showingFeedback, shouldStartReview]);
  
  // Broadcast current question for generation context
  useEffect(() => {
    const event = new CustomEvent('review-question-changed', {
      detail: { question: currentQuestion?.question || null }
    });
    window.dispatchEvent(event);
  }, [currentQuestion]);

  // Update polling interval based on next due time
  useEffect(() => {
    // Calculate optimal polling interval based on when next card is due
    const nextDueTime = cardStats?.nextReviewTime || null;
    const newInterval = getPollingInterval(nextDueTime);

    // Only update if interval has changed significantly (avoid unnecessary re-renders)
    setPollingInterval((currentInterval) => {
      if (Math.abs(newInterval - currentInterval) > 1000) {
        return newInterval;
      }
      return currentInterval;
    });
  }, [cardStats?.nextReviewTime]);

  // Sync daily count on mount and when date changes
  useEffect(() => {
    // Check daily count on component mount and focus
    const syncDailyCount = () => {
      // setDailyCount(getDailyCount()); // Not needed with new minimal design
    };

    syncDailyCount();
    window.addEventListener('focus', syncDailyCount);

    return () => {
      window.removeEventListener('focus', syncDailyCount);
    };
  }, []);
  
  // Listen for generation success from navbar modal
  useEffect(() => {
    const handleStartReview = () => {
      setShouldStartReview(true);
    };

    window.addEventListener('start-review-after-generation', handleStartReview);
    return () => window.removeEventListener('start-review-after-generation', handleStartReview);
  }, []);
  
  // Pre-fetch next question
  useEffect(() => {
    if (nextReview === undefined) {
      return;
    }

    if (nextReview === null) {
      setNextQuestion(null);
      return;
    }

    if (
      currentQuestion &&
      nextReview.question._id === currentQuestion.question._id
    ) {
      // Avoid storing the same card as both current and next.
      return;
    }

    setNextQuestion((prev) => {
      if (prev?.question._id === nextReview.question._id) {
        return prev;
      }
      return nextReview;
    });
  }, [nextReview, currentQuestion]);

  useEffect(() => {
    if (!currentQuestion) {
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
    }
  }, [currentQuestion]);
  
  // Advance to next question
  const advanceToNext = useCallback(() => {
    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      setNextQuestion(null);
      setSelectedAnswer("");
      setShowingFeedback(false);
      setFeedback(null);
      setQuestionStartTime(Date.now());
    } else {
      // No more questions
      setCurrentQuestion(null);
      setShowingFeedback(false);
    }
  }, [nextQuestion]);
  
  // Handle answer submission
  const handleSubmit = useCallback(async () => {
    if (!currentQuestion || !selectedAnswer || !isSignedIn || isAnswering) return;

    setIsAnswering(true);
    const isCorrect = selectedAnswer === currentQuestion.question.correctAnswer;
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

    // Trigger haptic feedback based on answer correctness
    if (isCorrect) {
      triggerSuccessHaptic();
    } else {
      triggerErrorHaptic();
    }

    try {
      const result = await scheduleReview({
        questionId: currentQuestion.question._id,
        userAnswer: selectedAnswer,
        isCorrect,
        timeSpent,
      });

      setFeedback({
        isCorrect,
        nextReview: result.nextReview,
        scheduledDays: result.scheduledDays,
        timeSpentSeconds: timeSpent,
      });

      setShowingFeedback(true);
      incrementDailyCount(); // Track daily count in localStorage
      // setDailyCount(newCount); // Not needed with new minimal design
      
    } catch (error) {
      console.error("Failed to submit review:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit review";
      toast.error("Unable to save your answer", {
        description: errorMessage
      });
    } finally {
      setIsAnswering(false);
    }
  }, [currentQuestion, selectedAnswer, isSignedIn, isAnswering, questionStartTime, scheduleReview]);
  
  // Handle delete with undo
  const resetQuestionState = useCallback(() => {
    setCurrentQuestion(null);
    setNextQuestion(null);
    setSelectedAnswer("");
    setShowingFeedback(false);
    setFeedback(null);
    setQuestionStartTime(Date.now());
  }, []);

  const handleDelete = useCallback(async (questionId: string): Promise<boolean> => {
    if (!isSignedIn) return false;

    // setIsMutating(true); // Not needed anymore

    try {
      // Mark as deleted in local state
      setDeletedQuestions(prev => new Set(prev).add(questionId));
      
      // Perform soft delete
      await deleteQuestion({
        questionId
      });
      
      // Set up auto-remove from deleted set after 5 seconds
      const undoTimeoutRef = { current: null as NodeJS.Timeout | null };
      
      // Show toast with undo button
      toast("Question deleted", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              // Restore the question
              await restoreQuestion({
                questionId
              });
              
              // Remove from deleted set
              setDeletedQuestions(prev => {
                const next = new Set(prev);
                next.delete(questionId);
                return next;
              });
              
              // Refresh to show restored question
              router.refresh();
              
              // Clear the timeout
              if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
            } catch (error) {
              console.error("Failed to restore question:", error);
              toast.error("Unable to restore question");
            }
          }
        },
        onAutoClose: () => {
          // Remove from deleted set when toast expires
          setDeletedQuestions(prev => {
            const next = new Set(prev);
            next.delete(questionId);
            return next;
          });
        }
      });
      
      // Set timeout to match toast duration
      undoTimeoutRef.current = setTimeout(() => {
        setDeletedQuestions(prev => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
      }, 5000);

      return true;
    } catch (error) {
      console.error("Failed to delete question:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete question";

      // Remove from local deleted state since operation failed
      setDeletedQuestions(prev => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });

      toast.error("Unable to delete question", {
        description: errorMessage
      });
      return false;
    } finally {
      // setIsMutating(false); // Not needed anymore
    }
  }, [isSignedIn, deleteQuestion, restoreQuestion, router]);

  const confirmDelete = useCallback(async () => {
    if (!currentQuestion) return;

    setIsDeleting(true);
    const didDelete = await handleDelete(currentQuestion.question._id);

    if (didDelete) {
      resetQuestionState();
      setIsDeleteDialogOpen(false);
      setIsEditModalOpen(false);
    }

    setIsDeleting(false);
  }, [currentQuestion, handleDelete, resetQuestionState]);
  
  // Enhanced keyboard shortcuts for power users
  const { showHelp, setShowHelp, shortcuts } = useReviewShortcuts({
    onSelectAnswer: (index) => {
      if (currentQuestion?.question.options[index]) {
        setSelectedAnswer(currentQuestion.question.options[index]);
        triggerHaptic(); // Subtle feedback on selection
      }
    },
    onSubmit: handleSubmit,
    onNext: advanceToNext,
    onEdit: () => {
      if (currentQuestion) {
        setIsEditModalOpen(true);
      }
    },
    onDelete: () => {
      if (currentQuestion) {
        setIsDeleteDialogOpen(true);
      }
    },
    onUndo: () => {
      // Implement undo logic if there's a recent deletion
      toast.info('Undo not available');
    },
    showingFeedback,
    isAnswering,
    canSubmit: !!selectedAnswer,
  });
  
  // Handle saving edits from modal
  const handleEditSave = useCallback(async (updates: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }) => {
    if (!isSignedIn || !currentQuestion) return;
    
    await updateQuestion({
      questionId: currentQuestion.question._id,
      question: updates.question,
      options: updates.options,
      correctAnswer: updates.correctAnswer,
      explanation: updates.explanation
    });
    
    // Update local state to reflect changes
    setCurrentQuestion({
      ...currentQuestion,
      question: {
        ...currentQuestion.question,
        ...updates
      }
    });
  }, [isSignedIn, currentQuestion, updateQuestion]);
  
  
  // Loading state
  if (!isSignedIn) {
    return (
      <div className="flex w-full flex-1 items-center justify-center px-4 py-8">
        <SignIn routing="hash" appearance={clerkAppearance} />
      </div>
    );
  }
  
  if (currentReview === undefined) {
    return (
      <div className="flex w-full flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-12 pb-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Empty state
  if (!currentQuestion && !showingFeedback) {
    // Check if user has any cards at all
    if (cardStats?.totalCards === 0) {
      return (
        <div className="flex w-full flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl">
            <NoCardsEmptyState
              onGenerationSuccess={() => {
                // Trigger immediate review of newly generated questions
                setShouldStartReview(true);
              }}
            />
          </div>
        </div>
      );
    }

    // User has cards but nothing is due
    if (!currentReview && cardStats) {
      return (
        <div className="flex w-full flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl">
            <NothingDueEmptyState
              nextReviewTime={cardStats.nextReviewTime}
              stats={{
                learningCount: cardStats.learningCount,
                totalCards: cardStats.totalCards,
                newCount: cardStats.newCount,
              }}
              onContinueLearning={() => {
                // Trigger immediate review when learning cards are imminent
                setShouldStartReview(true);
              }}
            />
          </div>
        </div>
      );
    }

    // Fallback (should not happen, but just in case)
    return (
      <div className="flex w-full flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <NoCardsEmptyState />
        </div>
      </div>
    );
  }
  
  // Review interface
  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-4">
      {/* Question card */}
      {currentQuestion && (
        <Card className="group animate-fadeIn shadow-lg border-0">
          <CardHeader className="pb-4 pt-4 space-y-4">
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsEditModalOpen(true)}
                aria-label="Edit question"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit question</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsDeleteDialogOpen(true)}
                aria-label="Delete question"
                className="text-error hover:text-error/80 hover:bg-error-background"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete question</span>
              </Button>
            </div>
            <CardTitle className="text-2xl font-semibold text-left leading-tight px-4">
              {currentQuestion.question.question}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            {/* Answer options */}
            <div className="space-y-2">
              {currentQuestion.question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (!showingFeedback) {
                      setSelectedAnswer(option);
                      triggerHaptic(); // Subtle feedback on selection
                    }
                  }}
                  disabled={showingFeedback || isAnswering}
                  className={`
                    w-full text-left p-5 rounded-xl border-2 transition-all text-base
                    ${selectedAnswer === option 
                      ? showingFeedback
                        ? feedback?.isCorrect && option === currentQuestion.question.correctAnswer
                          ? "border-success-border bg-success-background"
                          : !feedback?.isCorrect && option === selectedAnswer
                          ? "border-error-border bg-error-background"
                          : option === currentQuestion.question.correctAnswer
                          ? "border-success-border bg-success-background"
                          : "border-border"
                        : "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-input hover:bg-accent/50"
                    }
                    ${(showingFeedback || isAnswering) ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                    </div>
                    {showingFeedback && (
                      <>
                        {option === currentQuestion.question.correctAnswer && (
                          <CheckCircle className="h-5 w-5 text-success" />
                        )}
                        {option === selectedAnswer && !feedback?.isCorrect && (
                          <XCircle className="h-5 w-5 text-error" />
                        )}
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Feedback display with history */}
            {showingFeedback && feedback && (
              <div className="space-y-4 animate-fadeIn">
                <div
                  className={`rounded-2xl border px-5 py-5 ${
                    feedback.isCorrect
                      ? "border-success-border bg-success-background/70"
                      : "border-error-border bg-error-background/70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 rounded-full p-2 ${
                        feedback.isCorrect
                          ? "bg-background/70 text-success"
                          : "bg-background/70 text-error"
                      }`}
                    >
                      {feedback.isCorrect ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="space-y-1 text-left">
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          feedback.isCorrect ? "text-success" : "text-error"
                        }`}
                      >
                        {feedback.isCorrect ? "Correct" : "Needs review"}
                      </p>
                      <h3 className="text-lg font-semibold text-foreground">
                        {feedback.isCorrect ? "Memory reinforced" : "Let's revisit this card"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {feedback.isCorrect
                          ? "Consistency keeps this concept locked in. Queue the next prompt when you're ready."
                          : "Review what went wrong, study the right answer, and take another pass soon."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        label: "Next review",
                        value: formatNextReviewWindow(feedback.scheduledDays, feedback.nextReview),
                      },
                      {
                        label: "Response time",
                        value: formatSeconds(feedback.timeSpentSeconds),
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-lg border bg-background/80 p-3 ${
                          feedback.isCorrect
                            ? "border-success-border/70"
                            : "border-error-border/70"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {!feedback.isCorrect && (
                    <div className="mt-4 rounded-lg border border-border/40 bg-background/90 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Correct answer
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {currentQuestion.question.correctAnswer}
                      </p>
                    </div>
                  )}

                  {currentQuestion.question.explanation && (
                    <div
                      className={`mt-4 border-t pt-4 ${
                        feedback.isCorrect ? "border-success-border" : "border-error-border"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Explanation
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {currentQuestion.question.explanation}
                      </p>
                    </div>
                  )}
                </div>

                {/* Show history after answering */}
                {currentQuestion.interactions.length > 0 && (
                  <QuestionHistory interactions={currentQuestion.interactions} loading={false} />
                )}
              </div>
            )}
            
            {/* Submit/Next button */}
            {!showingFeedback ? (
              <Button
                onClick={handleSubmit}
                disabled={!selectedAnswer || isAnswering}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg rounded-xl transition-all hover:scale-[1.02]"
                size="lg"
              >
                {isAnswering ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Submit Answer
              </Button>
            ) : (
              <Button
                onClick={advanceToNext}
                className="w-full bg-success hover:bg-success/90 text-success-foreground py-6 text-lg rounded-xl transition-all hover:scale-[1.02]"
                size="lg"
              >
                Next Question
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit question modal */}
      {currentQuestion && (
        <EditQuestionModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          question={currentQuestion.question}
          onSave={handleEditSave}
        />
      )}

      {currentQuestion && (
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            if (!isDeleting) {
              setIsDeleteDialogOpen(open);
            }
          }}
        >
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this question?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the current question from your review queue. You can undo from the toast immediately after deletion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-error hover:bg-error/90 focus:ring-error"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting
                  </>
                ) : (
                  "Delete question"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsHelp
        open={showHelp}
        onOpenChange={setShowHelp}
        shortcuts={shortcuts}
      />
      </div>
    </div>
  );
}
