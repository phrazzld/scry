import { GenericDatabaseReader, GenericDatabaseWriter, GenericMutationCtx } from 'convex/server';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { DataModel } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';

const MAX_RATE_LIMIT_READS = 100; // Hard cap per query to avoid unbounded bandwidth
const CLEANUP_DELETE_BATCH_SIZE = 100;

type DbContext = { db: GenericDatabaseReader<DataModel> };
type DbWriteContext = { db: GenericDatabaseWriter<DataModel> };
type RateLimitDoc = Doc<'rateLimits'>;

/**
 * Rate limiting configuration for different operation types
 */
export const RATE_LIMITS = {
  magicLink: {
    maxAttempts: 5,
    windowMs: 3600000, // 1 hour
    errorMessage: 'Too many login attempts. Please try again in 1 hour.',
  },
  questionGeneration: {
    maxAttempts: 100,
    windowMs: 3600000, // 1 hour per IP
    errorMessage: 'Too many question generation requests. Please try again later.',
  },
  default: {
    maxAttempts: 100,
    windowMs: 3600000, // 1 hour
    errorMessage: 'Too many requests. Please try again later.',
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
  limitType: RateLimitType = 'magicLink'
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limit = RATE_LIMITS[limitType];
  const windowStart = Date.now() - limit.windowMs;

  const recentAttempts = await loadRecentAttempts(ctx, email, windowStart, limit.maxAttempts);

  if (recentAttempts.length >= limit.maxAttempts) {
    const oldestInWindow = recentAttempts[recentAttempts.length - 1];
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
  limitType: RateLimitType = 'default'
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limit = RATE_LIMITS[limitType];
  const windowStart = Date.now() - limit.windowMs;

  const recentAttempts = await loadRecentAttempts(ctx, ipAddress, windowStart, limit.maxAttempts);

  if (recentAttempts.length >= limit.maxAttempts) {
    const oldestInWindow = recentAttempts[recentAttempts.length - 1];
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
  await ctx.db.insert('rateLimits', {
    identifier,
    operation,
    timestamp: Date.now(),
    metadata,
  });

  // Clean up old entries outside any rate limit window
  const maxWindowMs = Math.max(...Object.values(RATE_LIMITS).map((limit) => limit.windowMs));
  const cleanupThreshold = Date.now() - maxWindowMs * 2; // Keep 2x the max window for analysis

  await deleteOldAttemptsForIdentifier(ctx, identifier, cleanupThreshold);
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
    error.code = 'RATE_LIMIT_EXCEEDED';
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

    const recentAttempts = await loadRecentAttempts(
      ctx,
      args.identifier,
      windowStart,
      limit.maxAttempts
    );

    const attemptsUsed = recentAttempts.length;
    const attemptsRemaining = Math.max(0, limit.maxAttempts - attemptsUsed);

    const resetTime = recentAttempts.length
      ? recentAttempts[recentAttempts.length - 1].timestamp + limit.windowMs
      : null;

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
    const maxWindowMs = Math.max(...Object.values(RATE_LIMITS).map((limit) => limit.windowMs));
    const cleanupThreshold = Date.now() - maxWindowMs * 2;

    const deletedCount = await deleteExpiredEntries(ctx, cleanupThreshold);

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

    const recentAttempts = await loadRecentAttempts(
      ctx,
      args.ipAddress,
      windowStart,
      limit.maxAttempts
    );

    if (recentAttempts.length >= limit.maxAttempts) {
      const oldestInWindow = recentAttempts[recentAttempts.length - 1];
      const retryAfter = Math.max(
        0,
        Math.ceil((oldestInWindow.timestamp + limit.windowMs - Date.now()) / 1000)
      );

      return {
        allowed: false,
        retryAfter,
        errorMessage: limit.errorMessage,
        attemptsUsed: recentAttempts.length,
        maxAttempts: limit.maxAttempts,
      };
    }

    // Record this attempt
    await recordRateLimitAttempt(ctx, args.ipAddress, args.operation, { source: 'api' });

    return {
      allowed: true,
      attemptsUsed: recentAttempts.length + 1,
      maxAttempts: limit.maxAttempts,
      attemptsRemaining: limit.maxAttempts - (recentAttempts.length + 1),
    };
  },
});
async function loadRecentAttempts(
  ctx: DbContext,
  identifier: string,
  windowStart: number,
  maxAttempts: number
): Promise<Array<RateLimitDoc>> {
  const readLimit = Math.min(Math.max(maxAttempts, 1), MAX_RATE_LIMIT_READS);
  return await ctx.db
    .query('rateLimits')
    .withIndex('by_identifier', (q) => q.eq('identifier', identifier).gt('timestamp', windowStart))
    .order('desc')
    .take(readLimit);
}

async function deleteOldAttemptsForIdentifier(
  ctx: DbWriteContext,
  identifier: string,
  threshold: number
): Promise<number> {
  let deleted = 0;

  while (true) {
    const batch = await ctx.db
      .query('rateLimits')
      .withIndex('by_identifier', (q) => q.eq('identifier', identifier).lt('timestamp', threshold))
      .order('asc')
      .take(CLEANUP_DELETE_BATCH_SIZE);

    if (batch.length === 0) {
      break;
    }

    for (const entry of batch) {
      await ctx.db.delete(entry._id);
      deleted++;
    }
  }

  return deleted;
}

async function deleteExpiredEntries(ctx: DbWriteContext, threshold: number): Promise<number> {
  const queryBuilder = ctx.db
    .query('rateLimits')
    .filter((q) => q.lt(q.field('timestamp'), threshold))
    .order('asc');

  let deleted = 0;
  let pagination = await queryBuilder.paginate({
    numItems: CLEANUP_DELETE_BATCH_SIZE,
    cursor: null,
  });
  await deleteBatch(pagination.page);

  while (!pagination.isDone) {
    pagination = await queryBuilder.paginate({
      numItems: CLEANUP_DELETE_BATCH_SIZE,
      cursor: pagination.continueCursor,
    });
    await deleteBatch(pagination.page);
  }

  async function deleteBatch(batch: Array<RateLimitDoc>) {
    for (const entry of batch) {
      await ctx.db.delete(entry._id);
      deleted++;
    }
  }

  return deleted;
}

export const __test = {
  MAX_RATE_LIMIT_READS,
  CLEANUP_DELETE_BATCH_SIZE,
};
