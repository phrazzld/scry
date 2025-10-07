'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

interface UndoableActionOptions {
  action: () => Promise<void>;
  message: string;
  undo: () => Promise<void>;
  duration?: number;
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
    async ({ action, message, undo, duration = 5000 }: UndoableActionOptions) => {
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
                toast.error('Failed to undo action');
              }
            },
          },
          duration,
        });
      } catch (error) {
        console.error('Action failed:', error);
        toast.error('Action failed');
        throw error;
      }
    },
    []
  );

  return execute;
}
