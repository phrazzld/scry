/**
 * Deployment Version Guard
 *
 * Client component that validates frontend/backend schema compatibility.
 * Renders children only if versions match, otherwise shows error.
 *
 * Wrapped in error boundary for backwards compatibility with backends
 * that don't have the version checking function deployed.
 */

'use client';

import { useDeploymentCheck } from '@/lib/deployment-check';

import { DeploymentVersionErrorBoundary } from './deployment-version-error-boundary';

interface DeploymentVersionGuardProps {
  children: React.ReactNode;
}

function DeploymentVersionGuardInner({ children }: DeploymentVersionGuardProps) {
  // This will throw if there's a version mismatch
  // or if the function doesn't exist (backwards compatibility case)
  useDeploymentCheck();

  return <>{children}</>;
}

export function DeploymentVersionGuard({ children }: DeploymentVersionGuardProps) {
  return (
    <DeploymentVersionErrorBoundary>
      <DeploymentVersionGuardInner>{children}</DeploymentVersionGuardInner>
    </DeploymentVersionErrorBoundary>
  );
}
