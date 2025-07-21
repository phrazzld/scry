"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/auth-context";
import { QuizSessionManager } from "@/components/quiz-session-manager";
import { QuestionHistory } from "@/components/question-history";
import { QuizFlowSkeleton } from "@/components/ui/loading-skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Brain, Target } from "lucide-react";
import type { SimpleQuiz, SimpleQuestion } from "@/types/quiz";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type FlowState = "loading" | "empty" | "generating" | "ready" | "quiz" | "complete";

interface UnifiedQuizFlowProps {
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  mode?: "quiz" | "review";
}

interface ExtendedQuiz extends SimpleQuiz {
  id?: string;
  difficulty?: "easy" | "medium" | "hard";
}

export function UnifiedQuizFlow({ 
  topic = "general knowledge", 
  difficulty = "medium",
  mode = "quiz" 
}: UnifiedQuizFlowProps) {
  const router = useRouter();
  const { sessionToken } = useAuth();
  const [flowState, setFlowState] = useState<FlowState>("loading");
  const [quiz, setQuiz] = useState<ExtendedQuiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewQuestion, setReviewQuestion] = useState<SimpleQuestion | null>(null);
  const [reviewQuestionId, setReviewQuestionId] = useState<Id<"questions"> | null>(null);
  const [reviewInteractions, setReviewInteractions] = useState<Doc<"interactions">[]>([]);

  // Queries - use polling for time-sensitive review queries
  const nextReview = usePollingQuery(
    api.spacedRepetition.getNextReview,
    mode === "review" && sessionToken ? { sessionToken } : "skip",
    30000 // Poll every 30 seconds for more responsive updates
  );
  
  const dueCount = usePollingQuery(
    api.spacedRepetition.getDueCount,
    mode === "review" && sessionToken ? { sessionToken } : "skip",
    30000 // Poll every 30 seconds
  );

  // Effect to handle initial state based on mode
  useEffect(() => {
    if (mode === "review") {
      if (nextReview === undefined) {
        setFlowState("loading");
      } else if (nextReview === null) {
        setFlowState("empty");
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
        setFlowState("ready");
      }
    } else {
      // Quiz mode - start in ready state
      setFlowState("ready");
    }
  }, [mode, nextReview]);

  const generateQuiz = async () => {
    if (mode === "review") return; // Should not generate in review mode
    
    setFlowState("generating");
    setError(null);

    try {
      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic, 
          difficulty,
          ...(sessionToken && { sessionToken })
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate quiz");
      }

      const data = await response.json();
      // Add currentIndex to match SimpleQuiz interface
      const quizData: ExtendedQuiz = {
        ...data.quiz,
        currentIndex: 0
      };
      setQuiz(quizData);
      setFlowState("quiz");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setFlowState("ready");
    }
  };

  const handleQuizComplete = async (score: number, answers: Array<{ userAnswer: string; isCorrect: boolean }>) => {
    if (mode === "quiz" && quiz) {
      // Save quiz results
      try {
        await fetch("/api/quiz/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId: quiz.id || "generated-quiz",
            score,
            answers,
            topic: quiz.topic,
            difficulty: quiz.difficulty || difficulty,
            ...(sessionToken && { sessionToken })
          }),
        });
      } catch (err) {
        console.error("Failed to save quiz results:", err);
      }
      setFlowState("complete");
    } else if (mode === "review") {
      // In review mode, just show completion and offer next review
      setFlowState("complete");
    }
  };

  const startNextReview = () => {
    setFlowState("loading");
    setReviewQuestion(null);
    // The useEffect will handle loading the next question
    window.location.reload(); // Simple way to refetch the next review
  };

  // Loading state
  if (flowState === "loading") {
    return <QuizFlowSkeleton />;
  }

  // Empty state for review mode
  if (flowState === "empty" && mode === "review") {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            All Caught Up!
          </CardTitle>
          <CardDescription>
            You have no questions due for review right now. Great job staying on top of your learning!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your next review will be available soon. In the meantime, you can:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => router.push("/create")}
                variant="default"
              >
                Create New Quiz
              </Button>
              <Button 
                onClick={() => router.push("/dashboard")}
                variant="outline"
              >
                View Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ready state - show start button or question preview
  if (flowState === "ready") {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mode === "quiz" ? (
              <>
                <Brain className="h-5 w-5" />
                Ready to Start Your Quiz
              </>
            ) : (
              <>
                <Target className="h-5 w-5" />
                Review Time!
              </>
            )}
          </CardTitle>
          <CardDescription>
            {mode === "quiz" 
              ? `Topic: ${topic} | Difficulty: ${difficulty}`
              : `${dueCount?.totalReviewable ?? 0} questions due for review`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {mode === "review" && reviewQuestion && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Next question preview:</p>
              <p className="text-sm text-muted-foreground">
                {reviewQuestion.question.substring(0, 100)}...
              </p>
            </div>
          )}

          <Button
            onClick={mode === "quiz" ? generateQuiz : () => setFlowState("quiz")}
            className="w-full"
            size="lg"
          >
            {mode === "quiz" ? "Generate Quiz" : "Start Review"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Generating state (quiz mode only)
  if (flowState === "generating") {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-12 pb-8">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Generating your quiz...</h3>
            <p className="text-sm text-muted-foreground text-center">
              Creating thoughtful questions about {topic}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Quiz/Review state - show questions
  if (flowState === "quiz") {
    const quizData: SimpleQuiz = mode === "quiz" 
      ? quiz! 
      : {
          topic: "Review Session",
          questions: [reviewQuestion!],
          questionIds: reviewQuestionId ? [reviewQuestionId] : [],
          currentIndex: 0,
          score: 0
        };

    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        {mode === "review" && reviewInteractions && (
          <QuestionHistory 
            interactions={reviewInteractions}
            loading={false}
          />
        )}
        
        <QuizSessionManager
          quiz={quizData}
          onComplete={handleQuizComplete}
        />
      </div>
    );
  }

  // Complete state
  if (flowState === "complete") {
    if (mode === "quiz" && quiz) {
      const percentage = Math.round((quiz.score / quiz.questions.length) * 100);
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Quiz Complete!</CardTitle>
            <CardDescription>
              You scored {quiz.score} out of {quiz.questions.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-5xl font-bold">{percentage}%</p>
                <p className="text-muted-foreground mt-2">
                  {percentage >= 80 ? "Excellent work!" : 
                   percentage >= 60 ? "Good job!" : 
                   "Keep practicing!"}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => window.location.reload()}
                  variant="default"
                  className="flex-1"
                >
                  Retake Quiz
                </Button>
                <Button 
                  onClick={() => router.push("/create")}
                  variant="outline"
                  className="flex-1"
                >
                  New Quiz
                </Button>
                <Button 
                  onClick={() => router.push("/dashboard")}
                  variant="outline"
                  className="flex-1"
                >
                  Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    } else if (mode === "review") {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Review Complete!</CardTitle>
            <CardDescription>
              Great job! Your review has been recorded and the next review time has been scheduled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {dueCount && dueCount.totalReviewable > 1 
                  ? `You have ${dueCount.totalReviewable - 1} more questions due for review.`
                  : "You're all caught up with your reviews!"
                }
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {dueCount && dueCount.totalReviewable > 1 && (
                  <Button 
                    onClick={startNextReview}
                    variant="default"
                  >
                    Next Review
                  </Button>
                )}
                <Button 
                  onClick={() => router.push("/dashboard")}
                  variant={dueCount && dueCount.totalReviewable > 1 ? "outline" : "default"}
                >
                  View Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  return null;
}