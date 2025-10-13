import { useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';

import { api } from '@/convex/_generated/api';

export function useQuizInteractions() {
  const recordInteraction = useMutation(api.questionsInteractions.recordInteraction);
  const { isSignedIn } = useUser();

  const trackAnswer = useCallback(
    async (
      questionId: string,
      userAnswer: string,
      isCorrect: boolean,
      timeSpent?: number,
      sessionId?: string
    ) => {
      if (!isSignedIn || !questionId) return null;

      try {
        const result = await recordInteraction({
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
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to track interaction:', error);
        }

        toast.error('Failed to save your answer', {
          description: "Your progress wasn't saved. Please try again.",
          duration: 8000, // Longer for critical errors
        });

        return null;
      }
    },
    [recordInteraction, isSignedIn]
  );

  return { trackAnswer };
}
