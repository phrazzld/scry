import { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Validate session token format
 */
function isValidTokenFormat(token: string): boolean {
  // Session tokens are 43 characters, base64url format
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * Get deployment environment for session validation
 */
function getDeploymentEnvironment(): string {
  const env = process.env.VERCEL_ENV;
  if (!env || env === 'development') return 'development';
  if (env === 'production') return 'production';
  if (env === 'preview') {
    // Include branch info for preview environments
    const branch = process.env.VERCEL_GIT_COMMIT_REF || 'unknown';
    return `preview:${branch}`;
  }
  return 'development';
}

/**
 * Helper to get authenticated user ID from session token
 * 
 * @param ctx - Convex query or mutation context
 * @param sessionToken - Session token from client
 * @returns User ID if authenticated
 * @throws Error if not authenticated or session expired
 */
export async function getAuthenticatedUserId(
  ctx: QueryCtx | MutationCtx, 
  sessionToken: string | undefined
) {
  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  // Validate token format before database lookup
  if (!isValidTokenFormat(sessionToken)) {
    throw new Error("Invalid session token format");
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();

  if (!session) {
    throw new Error("Session not found");
  }

  // Check expiration with detailed error
  if (session.expiresAt < Date.now()) {
    const expiredDaysAgo = Math.floor((Date.now() - session.expiresAt) / (1000 * 60 * 60 * 24));
    throw new Error(`Session expired ${expiredDaysAgo} days ago`);
  }

  // Environment validation with more lenient rules for development
  const currentEnv = getDeploymentEnvironment();
  const sessionEnv = session.environment || 'development';
  
  // Allow development sessions to work in development environment
  if (currentEnv === 'development') {
    // Development accepts all sessions for easier testing
    return session.userId;
  }
  
  // Production only accepts production sessions
  if (currentEnv === 'production' && sessionEnv !== 'production') {
    throw new Error("Session created in non-production environment");
  }
  
  // Preview environments accept preview sessions from any branch
  if (currentEnv.startsWith('preview:') && !sessionEnv.startsWith('preview:')) {
    throw new Error("Session created in non-preview environment");
  }

  return session.userId;
}