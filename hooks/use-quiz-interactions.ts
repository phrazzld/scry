import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";

export function useQuizInteractions() {
  const recordInteraction = useMutation(api.questions.recordInteraction);
  const { sessionToken } = useAuth();
  
  const trackAnswer = useCallback(async (
    questionId: string,
    userAnswer: string,
    isCorrect: boolean,
    timeSpent?: number,
    sessionId?: string
  ) => {
    if (!sessionToken || !questionId) return;
    
    try {
      await recordInteraction({
        sessionToken,
        questionId,
        userAnswer,
        isCorrect,
        timeSpent,
        sessionId,
      });
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }, [recordInteraction, sessionToken]);
  
  return { trackAnswer };
}