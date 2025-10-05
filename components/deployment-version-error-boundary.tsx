/**
 * Deployment Version Error Boundary
 *
 * Catches errors from deployment version checks and handles them gracefully.
 * Specifically handles "function not found" errors for backwards compatibility.
 */

'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: 'function_missing' | 'version_mismatch' | 'unknown' | null;
}

export class DeploymentVersionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorType: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Detect error type based on message
    const errorMessage = error.message || '';

    let errorType: State['errorType'] = 'unknown';

    // Check if error is due to missing function (backwards compatibility case)
    if (
      errorMessage.includes('Could not find public function') ||
      errorMessage.includes('system:getSchemaVersion') ||
      (errorMessage.includes('Function') && errorMessage.includes('does not exist'))
    ) {
      errorType = 'function_missing';
    }
    // Check if error is version mismatch
    else if (errorMessage.includes('Deployment version mismatch')) {
      errorType = 'version_mismatch';
    }

    return {
      hasError: true,
      error,
      errorType,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorType = this.state.errorType;

    if (errorType === 'function_missing') {
      // Backwards compatibility: Function doesn't exist in backend
      console.warn(
        '⚠️ Deployment version check skipped: system.getSchemaVersion function not found in backend.\n' +
          'This is expected for older deployments before version checking was implemented.\n' +
          'To enable version checking, deploy the latest Convex functions: npx convex deploy'
      );
    } else if (errorType === 'version_mismatch') {
      // Version mismatch: Critical error that should block the app
      console.error('🚨 DEPLOYMENT VERSION MISMATCH DETECTED', error);
      // This error will be re-thrown and shown to the user
    } else {
      // Unknown error: Log for debugging
      console.error('Deployment version check error:', error, errorInfo);
    }
  }

  render() {
    // If error is missing function, render children normally (backwards compatible)
    if (this.state.hasError && this.state.errorType === 'function_missing') {
      // Reset error state and render children
      // The app works fine without version checking on older backends
      return this.props.children;
    }

    // If error is version mismatch, re-throw to show error to user
    if (this.state.hasError && this.state.errorType === 'version_mismatch') {
      throw this.state.error;
    }

    // If unknown error, re-throw
    if (this.state.hasError) {
      throw this.state.error;
    }

    // No error: render children normally
    return this.props.children;
  }
}
