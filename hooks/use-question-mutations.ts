'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { OPTIMISTIC_UPDATE_CLEAR_DELAY } from '@/lib/constants/ui';

// Track optimistic updates globally to persist across component re-renders
const optimisticStore = {
  edits: new Map<
    string,
    {
      question: string;
      topic: string;
      explanation?: string;
      options?: string[];
      correctAnswer?: string;
    }
  >(),
  deletes: new Set<string>(),
};

interface OptimisticEditParams {
  questionId: Id<'questions'>;
  question: string;
  topic: string;
  explanation?: string;
  options?: string[];
  correctAnswer?: string;
}

interface OptimisticDeleteParams {
  questionId: Id<'questions'>;
}

/**
 * Hook for optimistic question mutations (edit and delete)
 * Provides immediate UI updates with automatic rollback on error
 */
export function useQuestionMutations() {
  const { isSignedIn } = useUser();
  const updateQuestion = useMutation(api.questions.updateQuestion);
  const softDeleteQuestion = useMutation(api.questions.softDeleteQuestion);

  // Local state to trigger re-renders when optimistic state changes
  const [optimisticEdits, setOptimisticEdits] = useState(optimisticStore.edits);
  const [optimisticDeletes, setOptimisticDeletes] = useState(optimisticStore.deletes);

  // Optimistic edit with rollback on error
  const optimisticEdit = useCallback(
    async (params: OptimisticEditParams) => {
      if (!isSignedIn) {
        toast.error('You must be logged in to edit questions');
        return { success: false };
      }

      const { questionId, question, topic, explanation, options, correctAnswer } = params;
      const questionIdStr = questionId as string;

      // Store the optimistic update
      const optimisticData = { question, topic, explanation, options, correctAnswer };
      optimisticStore.edits.set(questionIdStr, optimisticData);
      setOptimisticEdits(new Map(optimisticStore.edits));

      // Show immediate feedback
      toast.success('Question updated');

      try {
        // Perform the actual mutation
        const result = await updateQuestion({
          questionId,
          question,
          topic,
          explanation,
          options,
          correctAnswer,
        });

        if (result.success) {
          // Keep the optimistic update until Convex subscription updates
          // This prevents a flash of old data
          setTimeout(() => {
            optimisticStore.edits.delete(questionIdStr);
            setOptimisticEdits(new Map(optimisticStore.edits));
          }, OPTIMISTIC_UPDATE_CLEAR_DELAY); // Small delay to allow subscription to update

          return { success: true };
        } else {
          // Rollback on failure
          optimisticStore.edits.delete(questionIdStr);
          setOptimisticEdits(new Map(optimisticStore.edits));
          toast.error('Failed to update question');
          return { success: false };
        }
      } catch (error) {
        // Rollback optimistic update on error
        optimisticStore.edits.delete(questionIdStr);
        setOptimisticEdits(new Map(optimisticStore.edits));

        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to update question:', error);
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to update question';

        if (errorMessage.includes('unauthorized')) {
          toast.error('You are not authorized to edit this question');
        } else if (errorMessage.includes('deleted')) {
          toast.error('Cannot edit a deleted question');
        } else {
          toast.error(errorMessage);
        }

        return { success: false };
      }
    },
    [isSignedIn, updateQuestion]
  );

  // Optimistic delete with rollback on error
  const optimisticDelete = useCallback(
    async (params: OptimisticDeleteParams) => {
      if (!isSignedIn) {
        toast.error('You must be logged in to delete questions');
        return { success: false };
      }

      const { questionId } = params;
      const questionIdStr = questionId as string;

      // Add to optimistic deletes
      optimisticStore.deletes.add(questionIdStr);
      setOptimisticDeletes(new Set(optimisticStore.deletes));

      // Show immediate feedback
      toast.success('Question deleted');

      try {
        // Perform the actual mutation
        await softDeleteQuestion({
          questionId,
        });

        // Remove from optimistic deletes after success
        // The subscription will handle the actual UI update
        setTimeout(() => {
          optimisticStore.deletes.delete(questionIdStr);
          setOptimisticDeletes(new Set(optimisticStore.deletes));
        }, OPTIMISTIC_UPDATE_CLEAR_DELAY); // Small delay to allow subscription to update

        return { success: true };
      } catch (error) {
        // Rollback optimistic delete on error
        optimisticStore.deletes.delete(questionIdStr);
        setOptimisticDeletes(new Set(optimisticStore.deletes));

        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to delete question:', error);
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete question';

        if (errorMessage.includes('unauthorized')) {
          toast.error('You are not authorized to delete this question');
        } else if (errorMessage.includes('already deleted')) {
          toast.error('This question has already been deleted');
        } else {
          toast.error(errorMessage);
        }

        return { success: false };
      }
    },
    [isSignedIn, softDeleteQuestion]
  );

  // Helper to apply optimistic updates to a question
  const applyOptimisticUpdates = useCallback(
    <T extends { _id: string | Id<'questions'> }>(question: T): T => {
      const questionIdStr =
        typeof question._id === 'string' ? question._id : (question._id as unknown as string);

      // Check if this question has an optimistic edit
      if (optimisticEdits.has(questionIdStr)) {
        const edits = optimisticEdits.get(questionIdStr);
        return {
          ...question,
          ...edits,
        };
      }

      return question;
    },
    [optimisticEdits]
  );

  // Helper to check if a question is optimistically deleted
  const isOptimisticallyDeleted = useCallback(
    (questionId: string | Id<'questions'>): boolean => {
      const questionIdStr =
        typeof questionId === 'string' ? questionId : (questionId as unknown as string);
      return optimisticDeletes.has(questionIdStr);
    },
    [optimisticDeletes]
  );

  // Helper to filter out optimistically deleted questions
  const filterOptimisticDeletes = useCallback(
    <T extends { _id: string | Id<'questions'> }>(questions: T[]): T[] => {
      return questions.filter((q) => !isOptimisticallyDeleted(q._id));
    },
    [isOptimisticallyDeleted]
  );

  // Apply both optimistic edits and deletes to a list of questions
  const applyOptimisticChanges = useCallback(
    <T extends { _id: string | Id<'questions'> }>(questions: T[]): T[] => {
      return filterOptimisticDeletes(questions).map(applyOptimisticUpdates);
    },
    [filterOptimisticDeletes, applyOptimisticUpdates]
  );

  // Clear optimistic state on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear component-specific optimistic state if needed
      // Global store persists for cross-component consistency
    };
  }, []);

  return {
    // Mutation functions with optimistic updates
    optimisticEdit,
    optimisticDelete,

    // Helper functions for applying optimistic state
    applyOptimisticUpdates,
    isOptimisticallyDeleted,
    filterOptimisticDeletes,
    applyOptimisticChanges,

    // Raw optimistic state (rarely needed directly)
    optimisticEdits,
    optimisticDeletes,
  };
}

/**
 * Hook for optimistic edit operations
 * Simplified version focused only on edit functionality
 */
export function useOptimisticEdit() {
  const { optimisticEdit, applyOptimisticUpdates } = useQuestionMutations();
  return { optimisticEdit, applyOptimisticUpdates };
}

/**
 * Hook for optimistic delete operations
 * Simplified version focused only on delete functionality
 */
export function useOptimisticDelete() {
  const { optimisticDelete, isOptimisticallyDeleted, filterOptimisticDeletes } =
    useQuestionMutations();
  return { optimisticDelete, isOptimisticallyDeleted, filterOptimisticDeletes };
}
