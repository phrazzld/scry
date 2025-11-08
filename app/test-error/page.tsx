'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { getDeploymentEnvironment } from '@/lib/environment';
import { reportError } from '@/lib/analytics';

// Force dynamic rendering to avoid SSR prerendering issues
export const dynamic = 'force-dynamic';

/**
 * Test Error Page
 *
 * Dev/preview-only route for testing Sentry error tracking.
 * Provides buttons to trigger different error scenarios and verify:
 * - Error boundary catches errors
 * - Sentry receives error events
 * - Source maps work (readable stack traces)
 * - PII redaction works
 *
 * This route is filtered from analytics tracking (see app/layout.tsx beforeSend).
 */
export default function TestErrorPage() {
  const [errorType, setErrorType] = useState<string>('');

  // Block access in production
  const env = getDeploymentEnvironment();
  if (env === 'production') {
    return (
      <div className="container mx-auto max-w-2xl py-12 px-4">
        <div className="rounded-lg border border-red-500 bg-red-50 p-6 dark:bg-red-950">
          <h1 className="text-2xl font-bold text-red-900 dark:text-red-100">
            Access Denied
          </h1>
          <p className="mt-2 text-red-800 dark:text-red-200">
            This test route is not available in production. Use preview deployments for testing.
          </p>
          <Link href="/" className="mt-4 inline-block">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Trigger synchronous error (caught by error boundary)
  if (errorType === 'sync') {
    throw new Error('Test synchronous error from /test-error page');
  }

  // Trigger async error
  const triggerAsyncError = async () => {
    try {
      await Promise.reject(new Error('Test async error'));
    } catch (error) {
      reportError(error as Error, {
        testContext: 'async-error-test',
        userEmail: 'test@example.com', // Should be redacted
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Trigger error with PII
  const triggerPIIError = () => {
    const error = new Error('Test error with PII in context');
    reportError(error, {
      userEmail: 'sensitive@example.com', // Should be redacted
      apiKey: 'sk-test-123456',           // Should be filtered
      userId: 'user_abc123',             // Safe to include
      action: 'test-pii-redaction',
    });
  };

  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <div className="rounded-lg border p-6">
        <h1 className="text-3xl font-bold">Sentry Error Testing</h1>
        <p className="mt-2 text-muted-foreground">
          Environment: <span className="font-mono text-sm">{env}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use these buttons to test error tracking and verify Sentry configuration.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded border p-4">
            <h2 className="font-semibold">1. Synchronous Error (Error Boundary)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Throws error that triggers React error boundary. Verify error boundary UI shows and
              error appears in Sentry.
            </p>
            <Button
              onClick={() => setErrorType('sync')}
              variant="destructive"
              className="mt-3"
            >
              Trigger Sync Error
            </Button>
          </div>

          <div className="rounded border p-4">
            <h2 className="font-semibold">2. Async Error (Manual Report)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Triggers async error and manually reports to Sentry. Verify error appears with
              context data.
            </p>
            <Button
              onClick={triggerAsyncError}
              variant="outline"
              className="mt-3"
            >
              Trigger Async Error
            </Button>
          </div>

          <div className="rounded border p-4">
            <h2 className="font-semibold">3. Error with PII (Redaction Test)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reports error with sensitive data. Verify in Sentry that email is redacted to
              [EMAIL_REDACTED] and API key is filtered.
            </p>
            <Button
              onClick={triggerPIIError}
              variant="outline"
              className="mt-3"
            >
              Trigger PII Error
            </Button>
          </div>
        </div>

        <div className="mt-8 rounded border-l-4 border-blue-500 bg-blue-50 p-4 dark:bg-blue-950">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            Verification Steps
          </h3>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>Click one of the error trigger buttons above</li>
            <li>
              Wait ~30 seconds, then check Sentry dashboard:{' '}
              <a
                href="https://sentry.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                sentry.io
              </a>
            </li>
            <li>Verify error appears with readable TypeScript stack traces</li>
            <li>Check source file paths are visible (not minified webpack references)</li>
            <li>Verify PII is redacted (emails → [EMAIL_REDACTED])</li>
            <li>Verify environment is set correctly (preview, not production)</li>
          </ol>
        </div>

        <div className="mt-6">
          <Link href="/">
            <Button variant="ghost">← Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
