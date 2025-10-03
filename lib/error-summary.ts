/**
 * Error Summary Utilities
 *
 * Provides user-friendly error messages and determines if technical details
 * should be available for background generation jobs.
 */

export interface ErrorSummary {
  /** User-friendly, concise error message */
  summary: string;
  /** Whether full technical details are available */
  hasDetails: boolean;
}

/**
 * Convert technical error messages into user-friendly summaries
 *
 * @param errorMessage - Raw error message from the system (optional)
 * @param errorCode - Optional error code for classification
 * @returns ErrorSummary with user-friendly text and detail availability
 */
export function getErrorSummary(errorMessage?: string, errorCode?: string): ErrorSummary {
  // Handle missing error message
  if (!errorMessage) {
    return {
      summary: 'An unknown error occurred.',
      hasDetails: false,
    };
  }
  // Handle specific error codes with friendly messages
  if (errorCode === 'SCHEMA_VALIDATION') {
    return {
      summary: 'Invalid format. The AI returned unexpected data.',
      hasDetails: true,
    };
  }

  if (errorCode === 'RATE_LIMIT') {
    return {
      summary: 'Rate limit reached. Please wait a moment.',
      hasDetails: false,
    };
  }

  if (errorCode === 'API_KEY') {
    return {
      summary: 'API configuration error. Please contact support.',
      hasDetails: true,
    };
  }

  if (errorCode === 'NETWORK') {
    return {
      summary: 'Network error. Please check your connection.',
      hasDetails: false,
    };
  }

  // Handle long error messages by truncating
  if (errorMessage.length > 80) {
    return {
      summary: errorMessage.slice(0, 77) + '...',
      hasDetails: true,
    };
  }

  // Short, unknown errors - show as-is
  return {
    summary: errorMessage,
    hasDetails: false,
  };
}

/**
 * Format technical error details for display in expandable section
 *
 * @param errorMessage - Raw error message (optional)
 * @param errorCode - Error code if available
 * @returns Formatted technical details
 */
export function formatErrorDetails(errorMessage?: string, errorCode?: string): string {
  let details = '';

  if (errorCode) {
    details += `Error Code: ${errorCode}\n\n`;
  }

  details += errorMessage || 'No error details available.';

  return details;
}
