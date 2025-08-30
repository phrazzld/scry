import { QueryCtx, MutationCtx } from "../_generated/server";

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

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session");
  }

  return session.userId;
}