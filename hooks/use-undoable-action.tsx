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
 * Hook for executing actions with undo toast support
 * Shows success toast with undo button for reversible operations
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
