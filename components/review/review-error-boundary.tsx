'use client';

import React from 'react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { systemLogger } from '@/lib/logger';

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ReviewErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    systemLogger.error(
      {
        event: 'review.error-boundary',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        },
        timestamp: new Date().toISOString(),
        context: 'ReviewErrorBoundary',
      },
      `Review component error: ${error.message}`
    );

    // Track error count to detect repeated failures
    this.setState((prevState) => ({
      errorCount: prevState.errorCount + 1,
    }));

    // Check for specific review-related errors
    if (error.message?.includes('question') || error.message?.includes('review')) {
      systemLogger.warn(
        {
          event: 'review.question-error',
          message: error.message,
        },
        'Question-related error detected'
      );
    }

    // Send error event for potential recovery by parent components
    window.dispatchEvent(
      new CustomEvent('review-error', {
        detail: { error, errorInfo },
      })
    );
  }

  handleRetry = () => {
    // Clear error state
    this.setState({ hasError: false, error: null });

    // Call parent reset handler if provided
    this.props.onReset?.();

    // Dispatch reset event for child components
    window.dispatchEvent(new CustomEvent('review-error-reset'));

    // Log recovery attempt
    systemLogger.info(
      {
        event: 'review.error-recovery',
        errorCount: this.state.errorCount,
      },
      'User attempting error recovery'
    );
  };

  handleRestart = () => {
    // Full page reload to reset all state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorCount } = this.state;
      const isRecoverableError = errorCount < 3; // Allow up to 3 retry attempts
      const isDevelopment = process.env.NODE_ENV === 'development';

      // Determine error type for specific messaging
      const isQuestionError = error?.message?.toLowerCase().includes('question');
      const isNetworkError =
        error?.message?.toLowerCase().includes('network') ||
        error?.message?.toLowerCase().includes('fetch');
      const isStateError =
        error?.message?.toLowerCase().includes('state') ||
        error?.message?.toLowerCase().includes('undefined');

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="bg-background rounded-lg border border-border p-6 space-y-4">
              {/* Error Icon and Title */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex-grow">
                  <h2 className="text-lg font-semibold">
                    {isQuestionError
                      ? 'Question Loading Error'
                      : isNetworkError
                        ? 'Connection Problem'
                        : isStateError
                          ? 'Review Session Error'
                          : 'Something went wrong'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {this.props.fallbackMessage ||
                      (isQuestionError
                        ? 'Unable to load the review question. This might be temporary.'
                        : isNetworkError
                          ? 'Check your internet connection and try again.'
                          : isStateError
                            ? 'The review session encountered an unexpected state.'
                            : 'An unexpected error occurred during your review session.')}
                  </p>
                </div>
              </div>

              {/* Error Details (Development Only) */}
              {isDevelopment && error && (
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {error.name}: {error.message}
                  </p>
                  {errorCount > 1 && (
                    <p className="text-xs text-amber-600 mt-1">Error occurred {errorCount} times</p>
                  )}
                </div>
              )}

              {/* Recovery Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                {isRecoverableError ? (
                  <>
                    <Button onClick={this.handleRetry} className="flex-1" variant="default">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                    <Button onClick={this.handleRestart} className="flex-1" variant="outline">
                      <Home className="mr-2 h-4 w-4" />
                      Start Over
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground mb-2">
                      Multiple errors detected. A fresh start is recommended.
                    </div>
                    <Button onClick={this.handleRestart} className="w-full" variant="default">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Page
                    </Button>
                  </>
                )}
              </div>

              {/* Help Text */}
              {isNetworkError && (
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Troubleshooting tips:</p>
                  <ul className="space-y-0.5 list-disc list-inside">
                    <li>Check your internet connection</li>
                    <li>Try refreshing the page</li>
                    <li>Clear your browser cache</li>
                    <li>Disable browser extensions temporarily</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for using the ReviewErrorBoundary in functional components
 * Provides a way to trigger error recovery programmatically
 */
export function useReviewErrorRecovery() {
  const triggerRecovery = () => {
    window.dispatchEvent(new CustomEvent('review-error-reset'));
  };

  return { triggerRecovery };
}
