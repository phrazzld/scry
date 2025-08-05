"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/auth-context";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QuestionHistory } from "@/components/question-history";
import { AllReviewsCompleteEmptyState, NoQuestionsEmptyState } from "@/components/empty-states";
import { CheckCircle, XCircle, Loader2, Target } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatNextReviewTime } from "@/lib/format-review-time";

interface ReviewQuestion {
  question: Doc<"questions">;
  interactions: Doc<"interactions">[];
  attemptCount: number;
  correctCount: number;
  successRate: number | null;
}

interface ReviewFeedback {
  isCorrect: boolean;
  nextReview: number | null;
  scheduledDays: number;
}

export function ReviewFlow() {
  const router = useRouter();
  const { sessionToken } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState<ReviewQuestion | null>(null);
  const [nextQuestion, setNextQuestion] = useState<ReviewQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [showingFeedback, setShowingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [sessionStats, setSessionStats] = useState({ completed: 0 });
  
  // Queries with polling for real-time updates
  const currentReview = usePollingQuery(
    api.spacedRepetition.getNextReview,
    sessionToken ? { sessionToken } : "skip",
    30000 // Poll every 30 seconds
  );
  
  const dueCount = usePollingQuery(
    api.spacedRepetition.getDueCount,
    sessionToken ? { sessionToken } : "skip",
    30000 // Poll every 30 seconds
  );
  
  // Pre-fetch next review when we have a current question
  const nextReview = usePollingQuery(
    api.spacedRepetition.getNextReview,
    currentQuestion && sessionToken ? { sessionToken } : "skip",
    30000 // Poll every 30 seconds
  );
  
  // Mutations
  const scheduleReview = useMutation(api.spacedRepetition.scheduleReview);
  
  // Set initial question
  useEffect(() => {
    if (currentReview && !currentQuestion && !showingFeedback) {
      setCurrentQuestion(currentReview);
      setQuestionStartTime(Date.now());
    }
  }, [currentReview, currentQuestion, showingFeedback]);
  
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
    if (!currentQuestion || !selectedAnswer || !sessionToken || isAnswering) return;
    
    setIsAnswering(true);
    const isCorrect = selectedAnswer === currentQuestion.question.correctAnswer;
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    
    try {
      const result = await scheduleReview({
        sessionToken,
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
    } finally {
      setIsAnswering(false);
    }
  }, [currentQuestion, selectedAnswer, sessionToken, isAnswering, questionStartTime, scheduleReview]);
  
  
  // Loading state
  if (!sessionToken) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-12 pb-8">
          <div className="text-center">
            <p className="text-muted-foreground">Please sign in to access reviews</p>
            <Button onClick={() => router.push("/auth/signin")} className="mt-4">
              Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
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
    if (!currentReview) {
      return <AllReviewsCompleteEmptyState />;
    }
    return <NoQuestionsEmptyState />;
  }
  
  // Review interface
  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Progress header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Review Session</CardTitle>
            </div>
            <div className="text-sm text-muted-foreground">
              {sessionStats.completed} completed
              {dueCount && dueCount.totalReviewable > 0 && (
                <span> • {dueCount.totalReviewable} remaining</span>
              )}
            </div>
          </div>
          {dueCount && dueCount.totalReviewable > 0 && (
            <Progress 
              value={(sessionStats.completed / (sessionStats.completed + dueCount.totalReviewable)) * 100} 
              className="h-2 mt-2"
            />
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
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{currentQuestion.question.question}</CardTitle>
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
    </div>
  );
}