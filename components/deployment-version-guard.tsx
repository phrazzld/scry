/**
 * Deployment Version Guard
 *
 * Client component that validates frontend/backend schema compatibility.
 * Renders children only if versions match, otherwise shows error.
 */

'use client';

import { useDeploymentCheck } from '@/lib/deployment-check';

interface DeploymentVersionGuardProps {
  children: React.ReactNode;
}

export function DeploymentVersionGuard({ children }: DeploymentVersionGuardProps) {
  // This will throw if there's a version mismatch
  // The error will be caught by Next.js error boundary
  useDeploymentCheck();

  return <>{children}</>;
}
