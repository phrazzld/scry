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
}

type QuizState = "ready" | "generating" | "quiz" | "complete";

export function QuizMode({ topic, difficulty }: QuizModeProps) {
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
          difficulty
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
          difficulty: quiz.difficulty || difficulty
        }),
      });
    } catch (err) {
      console.error("Failed to save quiz results:", err);
    }
    setState("complete");
  };

  return (
    <div className="min-h-[400px] flex items-start justify-center">
      {state === "ready" && (
        <QuizReadyState
          topic={topic}
          difficulty={difficulty}
          error={error}
          onStart={generateQuiz}
        />
      )}

      {state === "generating" && <QuizGeneratingState topic={topic} />}

      {state === "quiz" && quiz && (
        <QuizSessionManager
          quiz={quiz}
          onComplete={handleQuizComplete}
        />
      )}

      {state === "complete" && quiz && (
        <QuizCompleteState
          score={quiz.score}
          totalQuestions={quiz.questions.length}
          onRetake={() => window.location.reload()}
        />
      )}
    </div>
  );
}