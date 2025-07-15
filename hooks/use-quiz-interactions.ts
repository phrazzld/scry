import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback } from "react";

export function useQuizInteractions() {
  const recordInteraction = useMutation(api.questions.recordInteraction);
  
  const trackAnswer = useCallback(async (
    questionId: string,
    userAnswer: string,
    isCorrect: boolean,
    timeSpent?: number,
    sessionId?: string
  ) => {
    const sessionToken = localStorage.getItem('scry_session_token');
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
  }, [recordInteraction]);
  
  return { trackAnswer };
}