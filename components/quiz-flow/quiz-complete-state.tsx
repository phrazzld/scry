"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface QuizCompleteStateProps {
  score: number;
  totalQuestions: number;
  onRetake: () => void;
}

export function QuizCompleteState({ score, totalQuestions, onRetake }: QuizCompleteStateProps) {
  const router = useRouter();
  const percentage = Math.round((score / totalQuestions) * 100);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Quiz Complete!</CardTitle>
        <CardDescription>
          You scored {score} out of {totalQuestions}
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
              onClick={onRetake}
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
}