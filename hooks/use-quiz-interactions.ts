import { useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import { TOAST_DURATION } from '@/lib/constants/ui';

export function useQuizInteractions() {
  const recordConceptInteraction = useMutation(api.concepts.recordInteraction);
  const { isSignedIn } = useUser();

  const trackAnswer = useCallback(
    async (
      conceptId: string,
      phrasingId: string,
      userAnswer: string,
      isCorrect: boolean,
      timeSpent?: number,
      sessionId?: string
    ) => {
      if (!isSignedIn || !conceptId || !phrasingId) return null;

      try {
        const result = await recordConceptInteraction({
          conceptId,
          phrasingId,
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
          duration: TOAST_DURATION.ERROR + 3000, // Extended for critical errors
        });

        return null;
      }
    },
    [recordConceptInteraction, isSignedIn]
  );

  return { trackAnswer };
}
