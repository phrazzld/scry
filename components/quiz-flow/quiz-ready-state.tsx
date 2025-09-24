"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain } from "lucide-react";

interface QuizReadyStateProps {
  topic: string;
  difficulty: string;
  error: string | null;
  onStart: () => void;
}

export function QuizReadyState({ topic, difficulty, error, onStart }: QuizReadyStateProps) {
  return (
    <article className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Ready to Start Your Quiz
          </h2>
          <p className="text-muted-foreground">
            Topic: {topic} | Difficulty: {difficulty}
          </p>
        </div>

        <div className="space-y-4">
          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={onStart}
            className="w-full"
            size="lg"
          >
            Generate Quiz
          </Button>
        </div>
      </div>
    </article>
  );
}