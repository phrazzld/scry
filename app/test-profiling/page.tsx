"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { QuizSessionManager } from "@/components/quiz-session-manager";
import { QuizReadyState } from "@/components/quiz-flow/quiz-ready-state";
import { QuizGeneratingState } from "@/components/quiz-flow/quiz-generating-state";
import { QuizCompleteState } from "@/components/quiz-flow/quiz-complete-state";

export default function ProfilingTestPage() {
  const [testCase, setTestCase] = useState<string>("none");
  const [renderCount, setRenderCount] = useState(0);
  const [stateTransition, setStateTransition] = useState(0);

  // Force re-render without changing props
  const forceRender = useCallback(() => {
    setRenderCount(prev => prev + 1);
  }, []);

  // Simulate state transitions
  const triggerStateTransition = useCallback(() => {
    setStateTransition(prev => prev + 1);
  }, []);

  const mockQuizResult = {
    topic: "Performance Testing",
    difficulty: "medium" as const,
    questions: [
      {
        id: "test-1",
        question: "Does Card removal improve performance?",
        options: ["Yes", "No", "Maybe", "Depends"],
        correctAnswer: "Yes",
        explanation: "Simpler DOM = better performance",
        type: "multiple-choice" as const,
      }
    ],
    score: 100,
    totalQuestions: 1,
    correctAnswers: 1,
    timeSpent: 5000,
    currentIndex: 0,
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Performance Profiling Test Page</h1>

      <div className="mb-8 space-y-4">
        <div className="flex gap-4 flex-wrap">
          <Button
            onClick={() => setTestCase("ready")}
            variant={testCase === "ready" ? "default" : "outline"}
          >
            Test Ready State
          </Button>
          <Button
            onClick={() => setTestCase("generating")}
            variant={testCase === "generating" ? "default" : "outline"}
          >
            Test Generating State
          </Button>
          <Button
            onClick={() => setTestCase("complete")}
            variant={testCase === "complete" ? "default" : "outline"}
          >
            Test Complete State
          </Button>
          <Button
            onClick={() => setTestCase("manager")}
            variant={testCase === "manager" ? "default" : "outline"}
          >
            Test Full Manager
          </Button>
        </div>

        <div className="flex gap-4">
          <Button onClick={forceRender} variant="secondary">
            Force Parent Re-render ({renderCount})
          </Button>
          <Button onClick={triggerStateTransition} variant="secondary">
            Trigger State Change ({stateTransition})
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Open React DevTools Profiler</li>
            <li>Start recording</li>
            <li>Click test buttons above</li>
            <li>Use &quot;Force Parent Re-render&quot; to test if children re-render unnecessarily</li>
            <li>Stop recording and analyze flame graph</li>
          </ol>
        </div>
      </div>

      <div className="border-t pt-8">
        {testCase === "ready" && (
          <QuizReadyState
            topic="Performance Testing"
            difficulty="medium"
            error={null}
            onStart={() => {}}
          />
        )}

        {testCase === "generating" && (
          <QuizGeneratingState topic="Performance Testing" />
        )}

        {testCase === "complete" && (
          <QuizCompleteState
            score={mockQuizResult.correctAnswers}
            totalQuestions={mockQuizResult.totalQuestions}
            onRetake={() => {}}
          />
        )}

        {testCase === "manager" && (
          <div className="max-w-3xl">
            <QuizSessionManager
              quiz={mockQuizResult}
              onComplete={() => {}}
            />
          </div>
        )}

        {testCase === "none" && (
          <div className="text-center text-muted-foreground py-12">
            Select a test case above to begin profiling
          </div>
        )}
      </div>

      {/* Hidden counter to verify render tracking */}
      <div className="mt-8 text-xs text-muted-foreground">
        Debug: Parent renders: {renderCount}, State transitions: {stateTransition}
      </div>
    </div>
  );
}