'use client';

import React, { useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clearUserContext, reportError, setUserContext } from '@/lib/analytics';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

interface AnalyticsUser {
  id: string;
  metadata: Record<string, string>;
}

interface BoundaryProps extends Props {
  analyticsUser: AnalyticsUser | null;
}

class ConvexErrorBoundaryInner extends React.Component<BoundaryProps, State> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { analyticsUser } = this.props;

    if (analyticsUser) {
      setUserContext(analyticsUser.id, analyticsUser.metadata);
    } else {
      clearUserContext();
    }

    reportError(error, {
      boundary: 'convex-error-boundary',
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    // Reset error state without reloading the page
    // This will trigger a re-render and allow components to retry
    this.setState({ hasError: false, error: null });

    // Optionally dispatch a custom event to notify components to retry
    window.dispatchEvent(new CustomEvent('error-boundary-reset'));
  };

  render() {
    if (this.state.hasError) {
      const isConvexError =
        this.state.error?.message?.includes('CONVEX') ||
        this.state.error?.message?.includes('Server Error');

      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>
                  {isConvexError ? 'Backend Connection Error' : 'Something went wrong'}
                </CardTitle>
              </div>
              <CardDescription>
                {isConvexError
                  ? 'Unable to connect to the backend service. This might be a temporary issue.'
                  : 'An unexpected error occurred. Please try refreshing the page.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md font-mono">
                  {this.state.error.message}
                </div>
              )}

              <div className="space-y-3">
                <Button onClick={this.handleReset} className="w-full" variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>

                {isConvexError && (
                  <div className="text-sm text-muted-foreground text-center">
                    <p>If this issue persists, it may be due to:</p>
                    <ul className="mt-2 space-y-1">
                      <li>• Backend deployment in progress</li>
                      <li>• Version mismatch between frontend and backend</li>
                      <li>• Temporary connection issues</li>
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

function createAnalyticsUser(user: ReturnType<typeof useUser>['user']): AnalyticsUser | null {
  if (!user?.id) {
    return null;
  }

  const metadata: Record<string, string> = {};

  const email = user.primaryEmailAddress?.emailAddress;
  if (email) {
    metadata.email = email;
  }

  if (user.fullName) {
    metadata.name = user.fullName;
  }

  if (user.username) {
    metadata.username = user.username;
  }

  return {
    id: user.id,
    metadata,
  };
}

export function ConvexErrorBoundary({ children }: Props) {
  const { isSignedIn, user } = useUser();

  const analyticsUser = useMemo(() => {
    if (!isSignedIn) {
      return null;
    }

    return createAnalyticsUser(user);
  }, [isSignedIn, user]);

  return (
    <ConvexErrorBoundaryInner analyticsUser={analyticsUser}>{children}</ConvexErrorBoundaryInner>
  );
}

export { ConvexErrorBoundaryInner as ConvexErrorBoundaryImpl };
