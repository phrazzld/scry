/**
 * Health Check Module
 *
 * Provides health check endpoints for validating Convex deployment status
 * and environment configuration.
 */

import { query } from './_generated/server';

/**
 * Required environment variables for Convex functions to work properly
 *
 * These are read via process.env in Convex actions/mutations:
 * - GOOGLE_AI_API_KEY: Used in aiGeneration.ts for quiz generation
 * - RESEND_API_KEY: Used for sending magic link emails
 * - EMAIL_FROM: From address for emails
 * - NEXT_PUBLIC_APP_URL: Application URL for magic links
 */
const REQUIRED_ENV_VARS = [
  'GOOGLE_AI_API_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'NEXT_PUBLIC_APP_URL',
] as const;

/**
 * Health check query that validates environment configuration
 *
 * Returns:
 * - healthy: true if all required env vars are present
 * - missing: array of missing environment variable names
 * - timestamp: ISO timestamp of the check
 *
 * This query can be called from:
 * - Deployment scripts (pre-deployment validation)
 * - CI/CD pipelines (automated health checks)
 * - Monitoring systems (ongoing health monitoring)
 * - Manual testing (vercel inspect, curl, etc.)
 *
 * Example usage:
 * ```bash
 * # Via Convex CLI
 * npx convex run health:check
 *
 * # Via HTTP (after deployment)
 * curl https://uncommon-axolotl-639.convex.site/api/health:check
 * ```
 */
export const check = query({
  args: {},
  handler: async () => {
    const missing: string[] = [];

    // Check each required environment variable
    for (const varName of REQUIRED_ENV_VARS) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missing.push(varName);
      }
    }

    const healthy = missing.length === 0;

    return {
      healthy,
      missing,
      timestamp: new Date().toISOString(),
      deployment: process.env.CONVEX_CLOUD_URL || 'unknown',
    };
  },
});

/**
 * Detailed health check that provides additional diagnostic information
 *
 * Returns:
 * - status: "healthy" | "degraded" | "unhealthy"
 * - checks: object with individual check results
 * - environment: deployment information
 *
 * "degraded" means some non-critical features may not work
 * "unhealthy" means critical features will fail
 */
export const detailed = query({
  args: {},
  handler: async () => {
    const checks: Record<
      string,
      {
        status: 'ok' | 'missing' | 'empty';
        critical: boolean;
      }
    > = {};

    // Check critical variables
    const criticalVars = ['GOOGLE_AI_API_KEY', 'RESEND_API_KEY'] as const;
    for (const varName of criticalVars) {
      const value = process.env[varName];
      checks[varName] = {
        status: !value ? 'missing' : value.trim() === '' ? 'empty' : 'ok',
        critical: true,
      };
    }

    // Check non-critical but recommended variables
    const recommendedVars = ['EMAIL_FROM', 'NEXT_PUBLIC_APP_URL'] as const;
    for (const varName of recommendedVars) {
      const value = process.env[varName];
      checks[varName] = {
        status: !value ? 'missing' : value.trim() === '' ? 'empty' : 'ok',
        critical: false,
      };
    }

    // Determine overall status
    const hasCriticalFailures = Object.entries(checks).some(
      ([_, check]) => check.critical && check.status !== 'ok'
    );
    const hasAnyFailures = Object.entries(checks).some(([_, check]) => check.status !== 'ok');

    const status = hasCriticalFailures ? 'unhealthy' : hasAnyFailures ? 'degraded' : 'healthy';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
      environment: {
        deployment: process.env.CONVEX_CLOUD_URL || 'unknown',
        nodeVersion: process.version,
      },
    };
  },
});
