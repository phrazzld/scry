"use client";

import { Loader2 } from "lucide-react";

interface QuizGeneratingStateProps {
  topic: string;
}

export function QuizGeneratingState({ topic }: QuizGeneratingStateProps) {
  return (
    <article className="w-full max-w-3xl px-4 py-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <h2 className="text-xl font-semibold">Generating your quiz...</h2>
        </div>
        <p className="text-muted-foreground">
          Creating thoughtful questions about {topic}
        </p>
      </div>
    </article>
  );
}