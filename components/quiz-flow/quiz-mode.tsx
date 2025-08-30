"use client";

import { useState } from "react";
import { QuizSessionManager } from "@/components/quiz-session-manager";
import { QuizReadyState } from "./quiz-ready-state";
import { QuizGeneratingState } from "./quiz-generating-state";
import { QuizCompleteState } from "./quiz-complete-state";
import type { SimpleQuiz } from "@/types/quiz";

interface ExtendedQuiz extends SimpleQuiz {
  id?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface QuizModeProps {
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  sessionToken?: string | null;
}

type QuizState = "ready" | "generating" | "quiz" | "complete";

export function QuizMode({ topic, difficulty, sessionToken }: QuizModeProps) {
  const [state, setState] = useState<QuizState>("ready");
  const [quiz, setQuiz] = useState<ExtendedQuiz | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateQuiz = async () => {
    setState("generating");
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
      const quizData: ExtendedQuiz = {
        ...data.quiz,
        currentIndex: 0
      };
      setQuiz(quizData);
      setState("quiz");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("ready");
    }
  };

  const handleQuizComplete = async (score: number, answers: Array<{ userAnswer: string; isCorrect: boolean }>) => {
    if (!quiz) return;
    
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
    setState("complete");
  };

  switch (state) {
    case "ready":
      return (
        <QuizReadyState
          topic={topic}
          difficulty={difficulty}
          error={error}
          onStart={generateQuiz}
        />
      );
    
    case "generating":
      return <QuizGeneratingState topic={topic} />;
    
    case "quiz":
      if (!quiz) return null;
      return (
        <div className="w-full max-w-2xl mx-auto">
          <QuizSessionManager
            quiz={quiz}
            onComplete={handleQuizComplete}
          />
        </div>
      );
    
    case "complete":
      if (!quiz) return null;
      return (
        <QuizCompleteState
          score={quiz.score}
          totalQuestions={quiz.questions.length}
          onRetake={() => window.location.reload()}
        />
      );
    
    default:
      return null;
  }
}