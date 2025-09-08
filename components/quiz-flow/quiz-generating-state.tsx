"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface QuizGeneratingStateProps {
  topic: string;
}

export function QuizGeneratingState({ topic }: QuizGeneratingStateProps) {
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