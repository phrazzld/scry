"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

interface ReviewReadyStateProps {
  dueCount: number;
  questionPreview: string;
  onStart: () => void;
}

export function ReviewReadyState({ dueCount, questionPreview, onStart }: ReviewReadyStateProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Review Time!
        </CardTitle>
        <CardDescription>
          {dueCount} questions due for review
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 bg-muted rounded-lg">
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
      </CardContent>
    </Card>
  );
}