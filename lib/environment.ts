/**
 * Environment detection utilities for session isolation
 */

/**
 * Detects the current deployment environment
 * Used to tag sessions and prevent cross-environment access
 */
export function getDeploymentEnvironment(): string {
  // Vercel environment variable
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === 'production') {
    return 'production';
  }

  if (vercelEnv === 'preview') {
    // Include branch name for better debugging
    const branch = process.env.VERCEL_GIT_COMMIT_REF;
    return branch ? `preview-${branch}` : 'preview';
  }

  // Local development or unknown
  return 'development';
}

/**
 * Checks if the current environment matches the session environment
 * Used for session validation
 */
export function isValidSessionEnvironment(
  sessionEnv: string | undefined,
  currentEnv: string
): boolean {
  // If session has no environment (legacy sessions), only allow in development
  if (!sessionEnv) {
    return currentEnv === 'development';
  }

  // Exact match for production
  if (currentEnv === 'production') {
    return sessionEnv === 'production';
  }

  // Preview environments can access preview sessions
  if (currentEnv.startsWith('preview')) {
    return sessionEnv.startsWith('preview');
  }

  // Development can access development sessions
  if (currentEnv === 'development') {
    return sessionEnv === 'development';
  }

  // Default deny
  return false;
}

/**
 * Gets a user-friendly environment name for display
 */
export function getEnvironmentDisplayName(env: string): string {
  if (env === 'production') return 'Production';
  if (env.startsWith('preview-')) return `Preview (${env.slice(8)})`;
  if (env === 'preview') return 'Preview';
  if (env === 'development') return 'Development';
  return 'Unknown';
}
