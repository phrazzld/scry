'use client';

import { useMemo } from 'react';
import { useUser } from '@clerk/nextjs';

import { getShuffleSeed, shuffleWithSeed } from '@/lib/utils/shuffle';

/**
 * Shuffle question options deterministically based on questionId and userId
 *
 * This hook ensures:
 * - Same user sees consistent option order across multiple attempts (determinism)
 * - Different users see different option orders (prevents answer sharing)
 * - Options are only shuffled once per question render (memoized)
 * - Anonymous users get consistent shuffle per question
 *
 * @param options - Array of answer options to shuffle
 * @param questionId - Unique question identifier (or null for preview/temp questions)
 * @returns Shuffled array of options
 *
 * @example
 * ```typescript
 * function QuizQuestion({ question, questionId }) {
 *   const shuffledOptions = useShuffledOptions(
 *     question.options,
 *     questionId
 *   );
 *
 *   return (
 *     <div>
 *       {shuffledOptions.map((option, index) => (
 *         <button key={index}>{option}</button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useShuffledOptions(
  options: string[],
  questionId: string | null | undefined
): string[] {
  const { user } = useUser();

  return useMemo(() => {
    // Don't shuffle if no questionId (preview mode, temporary questions)
    if (!questionId) {
      return options;
    }

    // Generate deterministic seed from questionId + userId
    const seed = getShuffleSeed(questionId, user?.id);

    // Shuffle options using seeded shuffle
    return shuffleWithSeed(options, seed);
  }, [options, questionId, user?.id]);
}
