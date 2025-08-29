"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Ready to Start Your Quiz
        </CardTitle>
        <CardDescription>
          Topic: {topic} | Difficulty: {difficulty}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4">
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
      </CardContent>
    </Card>
  );
}