"use client";

import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

interface ReviewReadyStateProps {
  dueCount: number;
  questionPreview: string;
  onStart: () => void;
}

export function ReviewReadyState({ dueCount, questionPreview, onStart }: ReviewReadyStateProps) {
  return (
    <article className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Review Time!
          </h2>
          <p className="text-muted-foreground">
            {dueCount} questions due for review
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Next question preview:</p>
            <p className="text-sm text-muted-foreground">{questionPreview}</p>
          </div>

          <Button
            onClick={onStart}
            className="w-full"
            size="lg"
          >
            Start Review
          </Button>
        </div>
      </div>
    </article>
  );
}