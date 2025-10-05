/**
 * Deployment Version Check
 *
 * Validates that frontend and backend schema versions match.
 * Prevents runtime errors from deployment mismatches where
 * frontend code expects backend functions/fields that don't exist.
 */

'use client';

import { useEffect } from 'react';
import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';

/**
 * Expected Backend Schema Version
 *
 * This MUST match SCHEMA_VERSION in convex/schemaVersion.ts.
 * Update this when deploying schema changes to prevent mismatches.
 */
const FRONTEND_VERSION = '2.2.0';

/**
 * Deployment Version Check Hook
 *
 * Call this hook in root layout to validate deployment compatibility.
 * Throws error if backend version doesn't match frontend expectations.
 *
 * @throws {Error} If schema version mismatch detected
 *
 * @example
 * ```tsx
 * export default function RootLayout() {
 *   useDeploymentCheck();
 *   return <html>...</html>;
 * }
 * ```
 */
export function useDeploymentCheck() {
  const backendVersion = useQuery(api.system.getSchemaVersion);

  useEffect(() => {
    // Wait for query to resolve
    if (backendVersion === undefined) {
      return;
    }

    // Check for version mismatch
    if (backendVersion !== FRONTEND_VERSION) {
      const error = new Error(
        `Deployment version mismatch!\n\n` +
          `Frontend expects: ${FRONTEND_VERSION}\n` +
          `Backend provides: ${backendVersion}\n\n` +
          `This usually means the backend was deployed without deploying the frontend,\n` +
          `or vice versa. Please ensure both are deployed together.\n\n` +
          `To fix:\n` +
          `1. Check that convex/schemaVersion.ts matches lib/deployment-check.ts\n` +
          `2. Run: npx convex deploy (for backend)\n` +
          `3. Run: vercel --prod (for frontend)\n` +
          `4. Or use: ./scripts/deploy-production.sh (atomic deployment)`
      );

      // Log to console for developers
      console.error(error.message);

      // Throw to trigger error boundary
      throw error;
    }
  }, [backendVersion]);

  return backendVersion;
}
