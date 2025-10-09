import { useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';

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
        return null;
      }
    },
    [recordInteraction, isSignedIn]
  );

  return { trackAnswer };
}
