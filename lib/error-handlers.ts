/**
 * Error Handler Utilities
 *
 * Centralized error handling functions for common error scenarios.
 */

import { toast } from 'sonner';

import { TOAST_DURATION } from './constants/ui';

/**
 * Handle errors from job creation mutations
 *
 * Logs error in development and shows user-friendly toast notification.
 *
 * @param error - The error object from the mutation
 */
export function handleJobCreationError(error: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.error('Failed to create job:', error);
  }

  const errorMessage = (error as Error).message || 'Failed to start generation';

  toast.error(errorMessage, {
    description: 'Please try again',
    duration: TOAST_DURATION.ERROR,
  });
}
