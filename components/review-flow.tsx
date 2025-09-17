"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionHistory } from "@/components/question-history";
import { NoCardsEmptyState, NothingDueEmptyState } from "@/components/empty-states";
import { CheckCircle, XCircle, Loader2, Target, Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatNextReviewTime } from "@/lib/format-review-time";
import { toast } from "sonner";
import { useReviewShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { EditQuestionModal } from "@/components/edit-question-modal";
import { SignIn } from "@clerk/nextjs";

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
}

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
  const [currentQuestion, setCurrentQuestion] = useState<ReviewQuestion | null>(null);
  const [nextQuestion, setNextQuestion] = useState<ReviewQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showingFeedback, setShowingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [sessionStats, setSessionStats] = useState({ completed: 0 });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false); // General mutation loading state
  // Track deleted questions for undo functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [deletedQuestions, setDeletedQuestions] = useState<Set<string>>(new Set());
  
  // Minimal polling for time-based updates only (questions becoming due over time)
  // Convex handles data changes automatically via real-time subscriptions
  const timeBasedPollInterval = 60000; // 1 minute for time-based checks
  
  // Queries with minimal polling for time-based updates
  // New questions will appear automatically via Convex reactivity
  const currentReview = usePollingQuery(
    api.spacedRepetition.getNextReview,
    isSignedIn ? {} : "skip",
    timeBasedPollInterval
  );
  
  const dueCount = usePollingQuery(
    api.spacedRepetition.getDueCount,
    isSignedIn ? {} : "skip",
    timeBasedPollInterval
  );

  // Get user's card statistics for context-aware empty states
  const cardStats = usePollingQuery(
    api.spacedRepetition.getUserCardStats,
    isSignedIn ? {} : "skip",
    timeBasedPollInterval
  );
  
  // Pre-fetch next review when we have a current question
  const nextReview = usePollingQuery(
    api.spacedRepetition.getNextReview,
    currentQuestion && isSignedIn ? {} : "skip",
    timeBasedPollInterval
  );
  
  // Mutations
  const scheduleReview = useMutation(api.spacedRepetition.scheduleReview);
  const updateQuestion = useMutation(api.questions.updateQuestion);
  const deleteQuestion = useMutation(api.questions.softDeleteQuestion);
  const restoreQuestion = useMutation(api.questions.restoreQuestion);
  
  // Set initial question
  useEffect(() => {
    if (currentReview && !currentQuestion && !showingFeedback) {
      setCurrentQuestion(currentReview);
      setQuestionStartTime(Date.now());
    }
  }, [currentReview, currentQuestion, showingFeedback]);
  
  // Broadcast current question for generation context
  useEffect(() => {
    const event = new CustomEvent('review-question-changed', { 
      detail: { question: currentQuestion?.question || null }
    });
    window.dispatchEvent(event);
  }, [currentQuestion]);
  
  // No need for generation event listeners - Convex automatically updates queries
  // when new questions are inserted into the database!
  
  // Pre-fetch next question
  useEffect(() => {
    if (nextReview && nextReview !== currentQuestion) {
      setNextQuestion(nextReview);
    }
  }, [nextReview, currentQuestion]);
  
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
      });
      
      setShowingFeedback(true);
      setSessionStats(prev => ({ completed: prev.completed + 1 }));
      
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
  const handleDelete = useCallback(async (questionId: string) => {
    if (!isSignedIn) return;
    
    setIsMutating(true);
    
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
    } finally {
      setIsMutating(false);
    }
  }, [isSignedIn, deleteQuestion, restoreQuestion, router]);
  
  // Enhanced keyboard shortcuts for power users
  const { showHelp, setShowHelp, shortcuts } = useReviewShortcuts({
    onSelectAnswer: (index) => {
      if (currentQuestion?.question.options[index]) {
        setSelectedAnswer(currentQuestion.question.options[index]);
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
        handleDelete(currentQuestion.question._id);
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
  }) => {
    if (!isSignedIn || !currentQuestion) return;
    
    await updateQuestion({
      questionId: currentQuestion.question._id,
      question: updates.question,
      options: updates.options,
      correctAnswer: updates.correctAnswer
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
      <div className="flex items-center justify-center min-h-screen">
        <SignIn routing="hash" />
      </div>
    );
  }
  
  if (currentReview === undefined) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-12 pb-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Empty state
  if (!currentQuestion && !showingFeedback) {
    // Check if user has any cards at all
    if (cardStats?.totalCards === 0) {
      return <NoCardsEmptyState />;
    }

    // User has cards but nothing is due
    if (!currentReview && cardStats) {
      return (
        <NothingDueEmptyState
          nextReviewTime={cardStats.nextReviewTime}
          stats={{
            learningCount: cardStats.learningCount,
            totalCards: cardStats.totalCards,
            newCount: cardStats.newCount,
          }}
        />
      );
    }

    // Fallback (should not happen, but just in case)
    return <NoCardsEmptyState />;
  }
  
  // Review interface
  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pt-20">
      {/* Progress header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Review Session</CardTitle>
            </div>
            <div className="text-sm text-muted-foreground">
              {sessionStats.completed} reviewed
              {dueCount && dueCount.totalReviewable > 0 && (
                <span className="font-medium"> • {dueCount.totalReviewable} total due</span>
              )}
            </div>
          </div>
          {dueCount && dueCount.totalReviewable > 0 && (
            <div className="space-y-2">
              {/* Segmented progress bar */}
              <div className="relative h-2 mt-2 bg-secondary rounded-full overflow-hidden">
                {/* Calculate segment widths */}
                {(() => {
                  const total = sessionStats.completed + dueCount.totalReviewable;
                  
                  // Handle edge case where total is 0 (no completed, no due)
                  if (total === 0) {
                    return <div className="flex h-full" />;
                  }
                  
                  const completedPercent = (sessionStats.completed / total) * 100;
                  const newPercent = (dueCount.newCount / total) * 100;
                  const duePercent = (dueCount.dueCount / total) * 100;
                  
                  return (
                    <div className="flex h-full">
                      {/* Completed segment (green) */}
                      {completedPercent > 0 && (
                        <div 
                          className="bg-green-500 transition-all duration-300"
                          style={{ width: `${completedPercent}%` }}
                          title={`${sessionStats.completed} completed`}
                        />
                      )}
                      {/* New questions segment (blue) */}
                      {newPercent > 0 && (
                        <div 
                          className="bg-blue-500 transition-all duration-300"
                          style={{ width: `${newPercent}%` }}
                          title={`${dueCount.newCount} new questions`}
                        />
                      )}
                      {/* Due reviews segment (orange) */}
                      {duePercent > 0 && (
                        <div 
                          className="bg-orange-500 transition-all duration-300"
                          style={{ width: `${duePercent}%` }}
                          title={`${dueCount.dueCount} reviews due`}
                        />
                      )}
                    </div>
                  );
                })()}
              </div>
              
              {/* Legend */}
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Completed ({sessionStats.completed})</span>
                </div>
                {dueCount.newCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded" />
                    <span>New ({dueCount.newCount})</span>
                  </div>
                )}
                {dueCount.dueCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded" />
                    <span>Due ({dueCount.dueCount})</span>
                  </div>
                )}
              </div>
              
              {dueCount.totalReviewable > 100 && (
                <p className="text-xs text-muted-foreground">
                  This is your real learning debt. Each review matters.
                </p>
              )}
            </div>
          )}
        </CardHeader>
      </Card>
      
      {/* Question history */}
      {currentQuestion && currentQuestion.interactions.length > 0 && (
        <QuestionHistory 
          interactions={currentQuestion.interactions}
          loading={false}
        />
      )}
      
      {/* Question card */}
      {currentQuestion && (
        <Card className="group">
          <CardHeader className="flex items-start justify-between">
            <CardTitle className="text-xl flex-1">
              {currentQuestion.question.question}
              {currentQuestion.serverTime && currentQuestion.question._creationTime > currentQuestion.serverTime - 3600000 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  New
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => setIsEditModalOpen(true)}
                disabled={isMutating}
                className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Edit question"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(currentQuestion.question._id)}
                disabled={isMutating}
                className="p-1 hover:bg-red-100 rounded text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Delete question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Answer options */}
            <div className="space-y-2">
              {currentQuestion.question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => !showingFeedback && setSelectedAnswer(option)}
                  disabled={showingFeedback || isAnswering}
                  className={`
                    w-full text-left p-4 rounded-lg border transition-all
                    ${selectedAnswer === option 
                      ? showingFeedback
                        ? feedback?.isCorrect && option === currentQuestion.question.correctAnswer
                          ? "border-green-500 bg-green-50"
                          : !feedback?.isCorrect && option === selectedAnswer
                          ? "border-red-500 bg-red-50"
                          : option === currentQuestion.question.correctAnswer
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200"
                        : "border-primary bg-primary/10"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }
                    ${(showingFeedback || isAnswering) ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500">
                        {index + 1}
                      </span>
                      <span>{option}</span>
                    </div>
                    {showingFeedback && (
                      <>
                        {option === currentQuestion.question.correctAnswer && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {option === selectedAnswer && !feedback?.isCorrect && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Feedback display */}
            {showingFeedback && feedback && (
              <div className={`p-4 rounded-lg ${feedback.isCorrect ? "bg-green-50" : "bg-red-50"}`}>
                <p className="font-medium">
                  {feedback.isCorrect ? "Correct!" : "Incorrect"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Next review: {feedback.nextReview 
                    ? formatNextReviewTime(feedback.nextReview)
                    : "Not scheduled"}
                </p>
              </div>
            )}
            
            {/* Submit/Next button */}
            {!showingFeedback ? (
              <Button
                onClick={handleSubmit}
                disabled={!selectedAnswer || isAnswering}
                className="w-full"
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
                className="w-full"
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
      
      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsHelp
        open={showHelp}
        onOpenChange={setShowHelp}
        shortcuts={shortcuts}
      />
      
    </div>
  );
}