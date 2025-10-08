'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

interface UndoableActionOptions {
  action: () => Promise<void>;
  message: string;
  undo: () => Promise<void>;
  duration?: number;
  /** Custom error message for failed action (default: "Action failed") */
  errorMessage?: string;
  /** Custom error message for failed undo (default: "Failed to undo action") */
  undoErrorMessage?: string;
}

/**
 * Hook for executing actions with undo support
 *
 * Shows a success toast with undo button for reversible operations.
 * Use for soft deletes, archives, and other reversible actions.
 *
 * @example
 * const undoableAction = useUndoableAction();
 * await undoableAction({
 *   action: () => archiveQuestion(id),
 *   message: 'Question archived',
 *   undo: () => unarchiveQuestion(id),
 *   duration: 5000, // Optional: toast duration in ms
 * });
 */
export function useUndoableAction() {
  const execute = useCallback(
    async ({
      action,
      message,
      undo,
      duration = 5000,
      errorMessage = 'Action failed',
      undoErrorMessage = 'Failed to undo action',
    }: UndoableActionOptions) => {
      try {
        // Execute action optimistically
        await action();

        // Show success toast with undo option
        toast.success(message, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await undo();
                toast.success('Action undone');
              } catch (error) {
                console.error('Failed to undo action:', error);
                const errorDetail = error instanceof Error ? error.message : '';
                toast.error(undoErrorMessage, {
                  description: errorDetail || undefined,
                });
              }
            },
          },
          duration,
        });
      } catch (error) {
        console.error('Action failed:', error);
        const errorDetail = error instanceof Error ? error.message : '';
        toast.error(errorMessage, {
          description: errorDetail || undefined,
        });
        throw error;
      }
    },
    []
  );

  return execute;
}
