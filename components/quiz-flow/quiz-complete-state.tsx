"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface QuizCompleteStateProps {
  score: number;
  totalQuestions: number;
  onRetake: () => void;
}

export function QuizCompleteState({ score, totalQuestions, onRetake }: QuizCompleteStateProps) {
  const router = useRouter();
  const percentage = Math.round((score / totalQuestions) * 100);

  return (
    <article className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        <div className="space-y-2 pb-6 border-b">
          <h2 className="text-xl font-semibold">Quiz Complete!</h2>
          <p className="text-muted-foreground">
            You scored {score} out of {totalQuestions}
          </p>
        </div>

        <div className="space-y-6">
          <div className="text-center pb-6 border-b">
            <p className="text-5xl font-bold">{percentage}%</p>
            <p className="text-muted-foreground mt-2">
              {percentage >= 80 ? "Excellent work!" :
               percentage >= 60 ? "Good job!" :
               "Keep practicing!"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={onRetake}
              variant="default"
              className="flex-1"
            >
              Retake Quiz
            </Button>
            <Button
              onClick={() => {
                router.push("/");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('open-generation-modal'));
                }, 100);
              }}
              variant="outline"
              className="flex-1"
            >
              New Quiz
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="flex-1"
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}