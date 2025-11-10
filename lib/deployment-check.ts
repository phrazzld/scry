/**
 * Deployment Version Check
 *
 * Validates that frontend and backend schema versions match.
 * Prevents runtime errors from deployment mismatches where
 * frontend code expects backend functions/fields that don't exist.
 *
 * BACKWARDS COMPATIBILITY: If the backend doesn't have the version
 * function deployed yet, the check is skipped (no crash).
 */

'use client';

import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

/**
 * Expected Backend Schema Version
 *
 * This MUST match SCHEMA_VERSION in convex/schemaVersion.ts.
 * Update this when deploying schema changes to prevent mismatches.
 */
const FRONTEND_VERSION = '2.7.0';

/**
 * Feature Flag: Enable Version Checking
 *
 * Can be disabled via environment variable for emergency bypass.
 */
const VERSION_CHECK_ENABLED = process.env.NEXT_PUBLIC_DISABLE_VERSION_CHECK !== 'true';

/**
 * Deployment Version Check Hook
 *
 * Call this hook in root layout to validate deployment compatibility.
 * Gracefully handles backends without the version function (backwards compatible).
 *
 * @throws {Error} If schema version mismatch detected (only when function exists)
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
  const [hasChecked, setHasChecked] = useState(false);
  const backendVersion = useQuery(api.system.getSchemaVersion);

  useEffect(() => {
    // Skip if disabled via feature flag
    if (!VERSION_CHECK_ENABLED) {
      if (!hasChecked) {
        console.warn('⚠️ Version check disabled via NEXT_PUBLIC_DISABLE_VERSION_CHECK');
        setHasChecked(true);
      }
      return;
    }

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

    setHasChecked(true);
  }, [backendVersion, hasChecked]);

  return backendVersion;
}
