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
    if (!sessionToken || !questionId) return null;
    
    try {
      const result = await recordInteraction({
        sessionToken,
        questionId,
        userAnswer,
        isCorrect,
        timeSpent,
        sessionId,
      });
      
      return {
        nextReview: result.nextReview,
        scheduledDays: result.scheduledDays,
        newState: result.newState,
      };
    } catch (error) {
      console.error('Failed to track interaction:', error);
      return null;
    }
  }, [recordInteraction, sessionToken]);
  
  return { trackAnswer };
}