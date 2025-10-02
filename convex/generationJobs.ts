import { v } from 'convex/values';

import { JOB_CONFIG } from '../lib/constants/jobs';
import { Doc } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { enforceRateLimit } from './rateLimit';

/**
 * Create a new generation job
 *
 * Validates prompt, checks concurrent job limits, enforces rate limiting,
 * and schedules the job for processing.
 */
export const createJob = mutation({
  args: {
    prompt: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authenticate user
    const user = await requireUserFromClerk(ctx);

    // Validate prompt length
    const promptLength = args.prompt.trim().length;
    if (promptLength < JOB_CONFIG.MIN_PROMPT_LENGTH) {
      throw new Error(
        `Prompt too short. Minimum ${JOB_CONFIG.MIN_PROMPT_LENGTH} characters required.`
      );
    }
    if (promptLength > JOB_CONFIG.MAX_PROMPT_LENGTH) {
      throw new Error(
        `Prompt too long. Maximum ${JOB_CONFIG.MAX_PROMPT_LENGTH} characters allowed.`
      );
    }

    // Check concurrent jobs limit
    const processingJobs = await ctx.db
      .query('generationJobs')
      .withIndex('by_user_status', (q) => q.eq('userId', user._id).eq('status', 'processing'))
      .collect();

    if (processingJobs.length >= JOB_CONFIG.MAX_CONCURRENT_PER_USER) {
      throw new Error(
        `Too many concurrent jobs. Maximum ${JOB_CONFIG.MAX_CONCURRENT_PER_USER} jobs allowed.`
      );
    }

    // Enforce rate limit if IP provided
    if (args.ipAddress) {
      await enforceRateLimit(ctx, args.ipAddress, 'questionGeneration', false);
    }

    // Insert job record
    const jobId = await ctx.db.insert('generationJobs', {
      userId: user._id,
      prompt: args.prompt.trim(),
      status: 'pending',
      phase: 'clarifying',
      questionsGenerated: 0,
      questionsSaved: 0,
      questionIds: [],
      createdAt: Date.now(),
      ipAddress: args.ipAddress,
    });

    // TODO: Schedule job for immediate processing once aiGeneration module exists
    // await ctx.scheduler.runAfter(0, internal.aiGeneration.processJob, { jobId });

    return { jobId };
  },
});

/**
 * Get recent jobs for the authenticated user
 */
export const getRecentJobs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const limit = args.limit ?? 20;

    const jobs = await ctx.db
      .query('generationJobs')
      .withIndex('by_user_status', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(limit);

    return jobs;
  },
});

/**
 * Get a specific job by ID
 *
 * Verifies ownership - only returns job if it belongs to the authenticated user.
 */
export const getJobById = query({
  args: {
    jobId: v.id('generationJobs'),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);

    const job = await ctx.db.get(args.jobId);

    // Verify ownership
    if (!job || job.userId !== user._id) {
      return null;
    }

    return job;
  },
});

/**
 * Cancel a pending or processing job
 *
 * Only the job owner can cancel their jobs.
 */
export const cancelJob = mutation({
  args: {
    jobId: v.id('generationJobs'),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);

    const job = await ctx.db.get(args.jobId);

    // Verify ownership
    if (!job || job.userId !== user._id) {
      throw new Error('Job not found or access denied');
    }

    // Check if cancellable
    if (job.status !== 'pending' && job.status !== 'processing') {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }

    // Update to cancelled
    await ctx.db.patch(args.jobId, {
      status: 'cancelled',
      completedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update job progress
 *
 * Called by the AI generation action to report progress.
 */
export const updateProgress = internalMutation({
  args: {
    jobId: v.id('generationJobs'),
    phase: v.optional(
      v.union(v.literal('clarifying'), v.literal('generating'), v.literal('finalizing'))
    ),
    questionsGenerated: v.optional(v.number()),
    questionsSaved: v.optional(v.number()),
    estimatedTotal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Partial<Doc<'generationJobs'>> = {};

    if (args.phase !== undefined) {
      updates.phase = args.phase;
    }
    if (args.questionsGenerated !== undefined) {
      updates.questionsGenerated = args.questionsGenerated;
    }
    if (args.questionsSaved !== undefined) {
      updates.questionsSaved = args.questionsSaved;
    }
    if (args.estimatedTotal !== undefined) {
      updates.estimatedTotal = args.estimatedTotal;
    }

    // Set status to processing and startedAt if not already set
    const job = await ctx.db.get(args.jobId);
    if (job && job.status === 'pending') {
      updates.status = 'processing';
      updates.startedAt = Date.now();
    }

    await ctx.db.patch(args.jobId, updates);
  },
});

/**
 * Internal mutation to mark job as completed
 */
export const completeJob = internalMutation({
  args: {
    jobId: v.id('generationJobs'),
    topic: v.string(),
    questionIds: v.array(v.id('questions')),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: 'completed',
      topic: args.topic,
      questionIds: args.questionIds,
      durationMs: args.durationMs,
      completedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to mark job as failed
 */
export const failJob = internalMutation({
  args: {
    jobId: v.id('generationJobs'),
    errorMessage: v.string(),
    errorCode: v.string(),
    retryable: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: 'failed',
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
      retryable: args.retryable,
      completedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to clean up old jobs
 *
 * Scheduled via cron to run daily at 3 AM UTC.
 */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const completedThreshold = now - JOB_CONFIG.COMPLETED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const failedThreshold = now - JOB_CONFIG.FAILED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // Find old completed jobs
    const oldCompletedJobs = await ctx.db
      .query('generationJobs')
      .withIndex('by_status_created', (q) => q.eq('status', 'completed'))
      .filter((q) => q.lt(q.field('createdAt'), completedThreshold))
      .collect();

    // Find old failed jobs
    const oldFailedJobs = await ctx.db
      .query('generationJobs')
      .withIndex('by_status_created', (q) => q.eq('status', 'failed'))
      .filter((q) => q.lt(q.field('createdAt'), failedThreshold))
      .collect();

    // Delete old jobs
    await Promise.all([
      ...oldCompletedJobs.map((job) => ctx.db.delete(job._id)),
      ...oldFailedJobs.map((job) => ctx.db.delete(job._id)),
    ]);

    const deletedCompleted = oldCompletedJobs.length;
    const deletedFailed = oldFailedJobs.length;
    const total = deletedCompleted + deletedFailed;

    return { deletedCompleted, deletedFailed, total };
  },
});
