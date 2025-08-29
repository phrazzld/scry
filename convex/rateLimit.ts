import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { GenericMutationCtx } from "convex/server";
import { DataModel } from "./_generated/dataModel";

/**
 * Rate limiting configuration for different operation types
 */
export const RATE_LIMITS = {
  magicLink: {
    maxAttempts: 5,
    windowMs: 3600000, // 1 hour
    errorMessage: "Too many login attempts. Please try again in 1 hour.",
  },
  quizGeneration: {
    maxAttempts: 100,
    windowMs: 3600000, // 1 hour per IP
    errorMessage: "Too many quiz generation requests. Please try again later.",
  },
  default: {
    maxAttempts: 100,
    windowMs: 3600000, // 1 hour
    errorMessage: "Too many requests. Please try again later.",
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Check if an email-based operation is rate limited
 * Used for magic link authentication
 */
export async function checkEmailRateLimit(
  ctx: GenericMutationCtx<DataModel>,
  email: string,
  limitType: RateLimitType = "magicLink"
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limit = RATE_LIMITS[limitType];
  const windowStart = Date.now() - limit.windowMs;

  // Count recent attempts for this email
  const recentAttempts = await ctx.db
    .query("rateLimits")
    .withIndex("by_identifier", (q) => 
      q.eq("identifier", email).gt("timestamp", windowStart)
    )
    .collect();

  if (recentAttempts.length >= limit.maxAttempts) {
    // Find the oldest attempt that would still be in the window
    const oldestInWindow = recentAttempts[recentAttempts.length - limit.maxAttempts];
    const retryAfter = oldestInWindow.timestamp + limit.windowMs - Date.now();
    
    return {
      allowed: false,
      retryAfter: Math.max(0, Math.ceil(retryAfter / 1000)), // seconds
    };
  }

  return { allowed: true };
}

/**
 * Check if an IP-based operation is rate limited
 * Used for API endpoints
 */
export async function checkIpRateLimit(
  ctx: GenericMutationCtx<DataModel>,
  ipAddress: string,
  limitType: RateLimitType = "default"
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limit = RATE_LIMITS[limitType];
  const windowStart = Date.now() - limit.windowMs;

  // Count recent attempts for this IP
  const recentAttempts = await ctx.db
    .query("rateLimits")
    .withIndex("by_identifier", (q) => 
      q.eq("identifier", ipAddress).gt("timestamp", windowStart)
    )
    .collect();

  if (recentAttempts.length >= limit.maxAttempts) {
    const oldestInWindow = recentAttempts[recentAttempts.length - limit.maxAttempts];
    const retryAfter = oldestInWindow.timestamp + limit.windowMs - Date.now();
    
    return {
      allowed: false,
      retryAfter: Math.max(0, Math.ceil(retryAfter / 1000)), // seconds
    };
  }

  return { allowed: true };
}

/**
 * Record a rate-limited operation attempt
 */
export async function recordRateLimitAttempt(
  ctx: GenericMutationCtx<DataModel>,
  identifier: string,
  operation: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await ctx.db.insert("rateLimits", {
    identifier,
    operation,
    timestamp: Date.now(),
    metadata,
  });

  // Clean up old entries outside any rate limit window
  const maxWindowMs = Math.max(
    ...Object.values(RATE_LIMITS).map(limit => limit.windowMs)
  );
  const cleanupThreshold = Date.now() - maxWindowMs * 2; // Keep 2x the max window for analysis

  const oldEntries = await ctx.db
    .query("rateLimits")
    .withIndex("by_identifier", (q) => 
      q.eq("identifier", identifier).lt("timestamp", cleanupThreshold)
    )
    .collect();

  // Delete old entries
  for (const entry of oldEntries) {
    await ctx.db.delete(entry._id);
  }
}

/**
 * Enforce rate limiting for a mutation
 * Throws an error if rate limit is exceeded
 */
export async function enforceRateLimit(
  ctx: GenericMutationCtx<DataModel>,
  identifier: string,
  limitType: RateLimitType,
  isEmail: boolean = false
): Promise<void> {
  const checkResult = isEmail 
    ? await checkEmailRateLimit(ctx, identifier, limitType)
    : await checkIpRateLimit(ctx, identifier, limitType);

  if (!checkResult.allowed) {
    const limit = RATE_LIMITS[limitType];
    const error = new Error(limit.errorMessage) as Error & {
      code: string;
      retryAfter: number;
    };
    error.code = "RATE_LIMIT_EXCEEDED";
    error.retryAfter = checkResult.retryAfter || 60;
    throw error;
  }

  // Record this attempt
  await recordRateLimitAttempt(ctx, identifier, limitType);
}

/**
 * Query to get current rate limit status for an identifier
 */
export const getRateLimitStatus = query({
  args: {
    identifier: v.string(),
    limitType: v.string(),
  },
  handler: async (ctx, args) => {
    const limitType = args.limitType as RateLimitType;
    const limit = RATE_LIMITS[limitType] || RATE_LIMITS.default;
    const windowStart = Date.now() - limit.windowMs;

    const recentAttempts = await ctx.db
      .query("rateLimits")
      .withIndex("by_identifier", (q) => 
        q.eq("identifier", args.identifier).gt("timestamp", windowStart)
      )
      .collect();

    const attemptsUsed = recentAttempts.length;
    const attemptsRemaining = Math.max(0, limit.maxAttempts - attemptsUsed);
    
    let resetTime: number | null = null;
    if (recentAttempts.length > 0) {
      // Reset time is when the oldest attempt in the window expires
      resetTime = recentAttempts[0].timestamp + limit.windowMs;
    }

    return {
      attemptsUsed,
      attemptsRemaining,
      maxAttempts: limit.maxAttempts,
      resetTime,
      isLimited: attemptsUsed >= limit.maxAttempts,
    };
  },
});

/**
 * Internal mutation to clean up expired rate limit entries
 * Scheduled to run hourly via cron job
 */
export const cleanupExpiredRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const maxWindowMs = Math.max(
      ...Object.values(RATE_LIMITS).map(limit => limit.windowMs)
    );
    const cleanupThreshold = Date.now() - maxWindowMs * 2;

    const expiredEntries = await ctx.db
      .query("rateLimits")
      .filter((q) => q.lt(q.field("timestamp"), cleanupThreshold))
      .collect();

    let deletedCount = 0;
    for (const entry of expiredEntries) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});

/**
 * Mutation to check and enforce API rate limits
 * Returns rate limit status without throwing
 */
export const checkApiRateLimit = mutation({
  args: {
    ipAddress: v.string(),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    const limitType = args.operation as RateLimitType;
    const limit = RATE_LIMITS[limitType] || RATE_LIMITS.default;
    const windowStart = Date.now() - limit.windowMs;

    // Count recent attempts for this IP
    const recentAttempts = await ctx.db
      .query("rateLimits")
      .withIndex("by_identifier", (q) => 
        q.eq("identifier", args.ipAddress).gt("timestamp", windowStart)
      )
      .collect();

    if (recentAttempts.length >= limit.maxAttempts) {
      const oldestInWindow = recentAttempts[recentAttempts.length - limit.maxAttempts];
      const retryAfter = Math.max(0, Math.ceil((oldestInWindow.timestamp + limit.windowMs - Date.now()) / 1000));
      
      return {
        allowed: false,
        retryAfter,
        errorMessage: limit.errorMessage,
        attemptsUsed: recentAttempts.length,
        maxAttempts: limit.maxAttempts,
      };
    }

    // Record this attempt
    await ctx.db.insert("rateLimits", {
      identifier: args.ipAddress,
      operation: args.operation,
      timestamp: Date.now(),
      metadata: { source: 'api' },
    });

    return {
      allowed: true,
      attemptsUsed: recentAttempts.length + 1,
      maxAttempts: limit.maxAttempts,
      attemptsRemaining: limit.maxAttempts - (recentAttempts.length + 1),
    };
  },
});