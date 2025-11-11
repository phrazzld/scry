import { beforeEach, describe, expect, it } from 'vitest';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { JOB_CONFIG } from '../../lib/constants/jobs';

/**
 * Tests for generationJobs.ts mutation business logic
 * Tests prompt validation, concurrent job limits, and job lifecycle without Convex context
 */

// Mock database helper for testing
class GenerationJobsSimulator {
  private jobs = new Map<string, Doc<'generationJobs'>>();
  private users = new Map<string, { _id: string; email: string; name: string; clerkId: string }>();
  private scheduledJobs: Array<{ jobId: string; delay: number }> = [];
  private rateLimitAttempts = new Map<string, number>();

  constructor() {
    // Add test users
    this.users.set('user123', {
      _id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      clerkId: 'clerk_user123',
    });
    this.users.set('user456', {
      _id: 'user456',
      email: 'other@example.com',
      name: 'Other User',
      clerkId: 'clerk_user456',
    });
  }

  // Simulate createJob mutation logic
  async createJob(clerkId: string, prompt: string, ipAddress?: string) {
    // 1. Authenticate user
    const user = this.getUserByClerkId(clerkId);
    if (!user) throw new Error('Authentication required');

    // 2. Validate prompt length
    const promptLength = prompt.trim().length;
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

    // 3. Check concurrent jobs limit
    const processingJobs = Array.from(this.jobs.values()).filter(
      (job) => job.userId === (user._id as string) && job.status === 'processing'
    );

    if (processingJobs.length >= JOB_CONFIG.MAX_CONCURRENT_PER_USER) {
      throw new Error(
        `Too many concurrent jobs. Maximum ${JOB_CONFIG.MAX_CONCURRENT_PER_USER} jobs allowed.`
      );
    }

    // 4. Enforce rate limit if IP provided
    if (ipAddress) {
      const attempts = this.rateLimitAttempts.get(ipAddress) || 0;
      if (attempts >= 10) {
        throw new Error('Rate limit exceeded');
      }
      this.rateLimitAttempts.set(ipAddress, attempts + 1);
    }

    // 5. Insert job record
    const jobId = `job_${Date.now()}_${Math.random()}`;
    const job: Doc<'generationJobs'> = {
      _id: jobId as Id<'generationJobs'>,
      _creationTime: Date.now(),
      userId: user._id as Id<'users'>,
      prompt: prompt.trim(),
      status: 'pending',
      phase: 'clarifying',
      questionsGenerated: 0,
      questionsSaved: 0,
      questionIds: [],
      conceptIds: [],
      pendingConceptIds: [],
      createdAt: Date.now(),
      ipAddress,
    };

    this.jobs.set(jobId, job);

    // 6. Schedule job for immediate processing
    this.scheduledJobs.push({ jobId, delay: 0 });

    return { jobId };
  }

  // Simulate cancelJob mutation logic
  async cancelJob(clerkId: string, jobId: string) {
    // 1. Authenticate user
    const user = this.getUserByClerkId(clerkId);
    if (!user) throw new Error('Authentication required');

    // 2. Get job
    const job = this.jobs.get(jobId);

    // 3. Verify ownership
    if (!job || job.userId !== user._id) {
      throw new Error('Job not found or access denied');
    }

    // 4. Check if cancellable
    if (job.status !== 'pending' && job.status !== 'processing') {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }

    // 5. Update to cancelled
    job.status = 'cancelled';
    job.completedAt = Date.now();
    this.jobs.set(jobId, job);

    return { success: true };
  }

  // Simulate getRecentJobs query logic
  async getRecentJobs(clerkId: string, limit: number = 20) {
    // 1. Authenticate user
    const user = this.getUserByClerkId(clerkId);
    if (!user) throw new Error('Authentication required');

    // 2. Get user's jobs sorted by createdAt desc
    const userJobs = Array.from(this.jobs.values())
      .filter((job) => job.userId === user._id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return userJobs;
  }

  // Simulate getJobById query logic
  async getJobById(clerkId: string, jobId: string) {
    // 1. Authenticate user
    const user = this.getUserByClerkId(clerkId);
    if (!user) throw new Error('Authentication required');

    // 2. Get job
    const job = this.jobs.get(jobId);

    // 3. Verify ownership
    if (!job || job.userId !== user._id) {
      return null;
    }

    return job;
  }

  // Simulate updateProgress internal mutation logic
  async updateProgress(
    jobId: string,
    updates: {
      phase?: 'clarifying' | 'generating' | 'finalizing';
      questionsGenerated?: number;
      questionsSaved?: number;
      estimatedTotal?: number;
    }
  ) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    // Apply updates
    if (updates.phase !== undefined) {
      job.phase = updates.phase;
    }
    if (updates.questionsGenerated !== undefined) {
      job.questionsGenerated = updates.questionsGenerated;
    }
    if (updates.questionsSaved !== undefined) {
      job.questionsSaved = updates.questionsSaved;
    }
    if (updates.estimatedTotal !== undefined) {
      job.estimatedTotal = updates.estimatedTotal;
    }

    // Set status to processing and startedAt if not already set
    if (job.status === 'pending') {
      job.status = 'processing';
      job.startedAt = Date.now();
    }

    this.jobs.set(jobId, job);
  }

  // Simulate completeJob internal mutation logic
  async completeJob(
    jobId: string,
    topic: string,
    questionIds: string[],
    durationMs: number,
    conceptIds: string[] = []
  ) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    job.status = 'completed';
    job.topic = topic;
    job.questionIds = questionIds as Id<'questions'>[];
    job.conceptIds = conceptIds as Id<'concepts'>[];
    job.pendingConceptIds = [];
    job.questionsSaved = questionIds.length > 0 ? questionIds.length : conceptIds.length;
    job.durationMs = durationMs;
    job.completedAt = Date.now();

    this.jobs.set(jobId, job);
  }

  // Simulate failJob internal mutation logic
  async failJob(jobId: string, errorMessage: string, errorCode: string, retryable: boolean) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    job.status = 'failed';
    job.errorMessage = errorMessage;
    job.errorCode = errorCode;
    job.retryable = retryable;
    job.completedAt = Date.now();

    this.jobs.set(jobId, job);
  }

  // Simulate cleanup internal mutation logic
  async cleanup() {
    const now = Date.now();
    const completedThreshold = now - JOB_CONFIG.COMPLETED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const failedThreshold = now - JOB_CONFIG.FAILED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const oldCompletedJobs = Array.from(this.jobs.values()).filter(
      (job) => job.status === 'completed' && job.createdAt < completedThreshold
    );

    const oldFailedJobs = Array.from(this.jobs.values()).filter(
      (job) => job.status === 'failed' && job.createdAt < failedThreshold
    );

    // Delete old jobs
    oldCompletedJobs.forEach((job) => this.jobs.delete(job._id as string));
    oldFailedJobs.forEach((job) => this.jobs.delete(job._id as string));

    return {
      deletedCompleted: oldCompletedJobs.length,
      deletedFailed: oldFailedJobs.length,
      total: oldCompletedJobs.length + oldFailedJobs.length,
    };
  }

  // Helper: get user by Clerk ID
  private getUserByClerkId(clerkId: string) {
    return Array.from(this.users.values()).find((u) => u.clerkId === clerkId);
  }

  // Test helpers
  private jobCounter = 0;
  addTestJob(job: Partial<Doc<'generationJobs'>>) {
    const id = job._id || (`job_${Date.now()}_${this.jobCounter++}` as Id<'generationJobs'>);
    const fullJob: Doc<'generationJobs'> = {
      _id: id as Id<'generationJobs'>,
      _creationTime: Date.now(),
      userId: 'user123' as Id<'users'>,
      prompt: 'Test prompt',
      status: 'pending',
      phase: 'clarifying',
      questionsGenerated: 0,
      questionsSaved: 0,
      questionIds: [],
      conceptIds: [],
      pendingConceptIds: [],
      createdAt: Date.now(),
      ...job,
    };
    this.jobs.set(id as string, fullJob);
    return id;
  }

  getScheduledJobs() {
    return [...this.scheduledJobs];
  }

  clearRateLimits() {
    this.rateLimitAttempts.clear();
  }
}

describe('GenerationJobs - Job Creation', () => {
  let simulator: GenerationJobsSimulator;

  beforeEach(() => {
    simulator = new GenerationJobsSimulator();
  });

  describe('createJob - Validation', () => {
    it('should create job with valid prompt', async () => {
      const result = await simulator.createJob('clerk_user123', 'Generate questions about React');

      expect(result.jobId).toBeDefined();
      expect(typeof result.jobId).toBe('string');
    });

    it('should schedule job for immediate processing', async () => {
      await simulator.createJob('clerk_user123', 'Valid prompt');

      const scheduled = simulator.getScheduledJobs();
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].delay).toBe(0);
    });

    it('should require authentication', async () => {
      await expect(simulator.createJob('invalid_clerk_id', 'Test prompt')).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should trim prompt before validation', async () => {
      const result = await simulator.createJob('clerk_user123', '   Valid prompt   ');
      expect(result.jobId).toBeDefined();
    });
  });

  describe('createJob - Prompt Length Validation', () => {
    it('should reject empty prompt', async () => {
      await expect(simulator.createJob('clerk_user123', '')).rejects.toThrow(
        `Prompt too short. Minimum ${JOB_CONFIG.MIN_PROMPT_LENGTH} characters required.`
      );
    });

    it('should reject prompt shorter than MIN_PROMPT_LENGTH', async () => {
      const shortPrompt = 'ab'; // 2 characters, minimum is 3
      await expect(simulator.createJob('clerk_user123', shortPrompt)).rejects.toThrow(
        `Prompt too short. Minimum ${JOB_CONFIG.MIN_PROMPT_LENGTH} characters required.`
      );
    });

    it('should accept prompt at MIN_PROMPT_LENGTH', async () => {
      const minPrompt = 'abc'; // Exactly 3 characters
      const result = await simulator.createJob('clerk_user123', minPrompt);
      expect(result.jobId).toBeDefined();
    });

    it('should reject prompt longer than MAX_PROMPT_LENGTH', async () => {
      const longPrompt = 'a'.repeat(JOB_CONFIG.MAX_PROMPT_LENGTH + 1);
      await expect(simulator.createJob('clerk_user123', longPrompt)).rejects.toThrow(
        `Prompt too long. Maximum ${JOB_CONFIG.MAX_PROMPT_LENGTH} characters allowed.`
      );
    });

    it('should accept prompt at MAX_PROMPT_LENGTH', async () => {
      const maxPrompt = 'a'.repeat(JOB_CONFIG.MAX_PROMPT_LENGTH);
      const result = await simulator.createJob('clerk_user123', maxPrompt);
      expect(result.jobId).toBeDefined();
    });

    it('should handle whitespace-only prompt as too short', async () => {
      await expect(simulator.createJob('clerk_user123', '   ')).rejects.toThrow(
        `Prompt too short. Minimum ${JOB_CONFIG.MIN_PROMPT_LENGTH} characters required.`
      );
    });
  });

  describe('createJob - Concurrent Job Limits', () => {
    it('should allow creating jobs when under MAX_CONCURRENT_PER_USER', async () => {
      // Create MAX_CONCURRENT_PER_USER - 1 processing jobs (under the limit)
      for (let i = 0; i < JOB_CONFIG.MAX_CONCURRENT_PER_USER - 1; i++) {
        simulator.addTestJob({
          userId: 'user123' as Id<'users'>,
          status: 'processing',
        });
      }

      // Should allow creating one more job since we're under the limit
      const result = await simulator.createJob('clerk_user123', 'Test prompt');
      expect(result.jobId).toBeDefined();
    });

    it('should reject job when MAX_CONCURRENT_PER_USER processing jobs exist', async () => {
      // Create exactly MAX_CONCURRENT_PER_USER processing jobs to hit the limit
      for (let i = 0; i < JOB_CONFIG.MAX_CONCURRENT_PER_USER; i++) {
        simulator.addTestJob({
          userId: 'user123' as Id<'users'>,
          status: 'processing',
        });
      }

      // Verify we have exactly MAX_CONCURRENT_PER_USER processing jobs
      const jobsBefore = await simulator.getRecentJobs('clerk_user123');
      const processingCount = jobsBefore.filter((j) => j.status === 'processing').length;
      expect(processingCount).toBe(JOB_CONFIG.MAX_CONCURRENT_PER_USER);

      // Trying to create another job should fail (would exceed limit)
      await expect(simulator.createJob('clerk_user123', 'Test prompt')).rejects.toThrow(
        `Too many concurrent jobs. Maximum ${JOB_CONFIG.MAX_CONCURRENT_PER_USER} jobs allowed.`
      );
    });

    it('should not count completed jobs toward limit', async () => {
      // Create MAX_CONCURRENT_PER_USER + 1 completed jobs
      for (let i = 0; i < JOB_CONFIG.MAX_CONCURRENT_PER_USER + 1; i++) {
        simulator.addTestJob({
          userId: 'user123' as Id<'users'>,
          status: 'completed',
        });
      }

      // Should allow new job since completed jobs don't count
      const result = await simulator.createJob('clerk_user123', 'Test prompt');
      expect(result.jobId).toBeDefined();
    });

    it('should not count pending jobs toward limit', async () => {
      // Create MAX_CONCURRENT_PER_USER pending jobs
      for (let i = 0; i < JOB_CONFIG.MAX_CONCURRENT_PER_USER; i++) {
        simulator.addTestJob({
          userId: 'user123' as Id<'users'>,
          status: 'pending',
        });
      }

      // Should allow new job since only processing jobs count
      const result = await simulator.createJob('clerk_user123', 'Test prompt');
      expect(result.jobId).toBeDefined();
    });

    it('should not count cancelled jobs toward limit', async () => {
      // Create MAX_CONCURRENT_PER_USER cancelled jobs
      for (let i = 0; i < JOB_CONFIG.MAX_CONCURRENT_PER_USER; i++) {
        simulator.addTestJob({
          userId: 'user123' as Id<'users'>,
          status: 'cancelled',
        });
      }

      // Should allow new job since cancelled jobs don't count
      const result = await simulator.createJob('clerk_user123', 'Test prompt');
      expect(result.jobId).toBeDefined();
    });

    it('should not count failed jobs toward limit', async () => {
      // Create MAX_CONCURRENT_PER_USER failed jobs
      for (let i = 0; i < JOB_CONFIG.MAX_CONCURRENT_PER_USER; i++) {
        simulator.addTestJob({
          userId: 'user123' as Id<'users'>,
          status: 'failed',
        });
      }

      // Should allow new job since failed jobs don't count
      const result = await simulator.createJob('clerk_user123', 'Test prompt');
      expect(result.jobId).toBeDefined();
    });

    it('should enforce limits per user independently', async () => {
      // User 123 has MAX_CONCURRENT_PER_USER processing jobs
      for (let i = 0; i < JOB_CONFIG.MAX_CONCURRENT_PER_USER; i++) {
        simulator.addTestJob({
          userId: 'user123' as Id<'users'>,
          status: 'processing',
        });
      }

      // User 456 should still be able to create jobs
      const result = await simulator.createJob('clerk_user456', 'Test prompt');
      expect(result.jobId).toBeDefined();
    });
  });

  describe('createJob - Rate Limiting', () => {
    beforeEach(() => {
      simulator.clearRateLimits();
    });

    it('should allow job creation without IP address', async () => {
      const result = await simulator.createJob('clerk_user123', 'Test prompt');
      expect(result.jobId).toBeDefined();
    });

    it('should track rate limit attempts when IP provided', async () => {
      const result = await simulator.createJob('clerk_user123', 'Test prompt', '192.168.1.1');
      expect(result.jobId).toBeDefined();
    });

    it('should enforce rate limit after max attempts', async () => {
      const ipAddress = '192.168.1.1';

      // Create 10 jobs to hit rate limit
      for (let i = 0; i < 10; i++) {
        await simulator.createJob('clerk_user123', `Test prompt ${i}`, ipAddress);
      }

      // 11th attempt should be rate limited
      await expect(simulator.createJob('clerk_user123', 'Test prompt', ipAddress)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should track rate limits per IP independently', async () => {
      // IP 1 hits rate limit
      for (let i = 0; i < 10; i++) {
        await simulator.createJob('clerk_user123', `Test ${i}`, '192.168.1.1');
      }

      // IP 2 should still work
      const result = await simulator.createJob('clerk_user123', 'Test prompt', '192.168.1.2');
      expect(result.jobId).toBeDefined();
    });
  });

  describe('createJob - Job Record Structure', () => {
    it('should create job with correct initial fields', async () => {
      await simulator.createJob('clerk_user123', 'Test prompt');

      const jobs = await simulator.getRecentJobs('clerk_user123');
      const createdJob = jobs[0];

      expect(createdJob.userId).toBe('user123');
      expect(createdJob.prompt).toBe('Test prompt');
      expect(createdJob.status).toBe('pending');
      expect(createdJob.phase).toBe('clarifying');
      expect(createdJob.questionsGenerated).toBe(0);
      expect(createdJob.questionsSaved).toBe(0);
      expect(createdJob.questionIds).toEqual([]);
      expect(createdJob.createdAt).toBeDefined();
      expect(createdJob.ipAddress).toBeUndefined();
    });

    it('should store IP address when provided', async () => {
      await simulator.createJob('clerk_user123', 'Test prompt', '192.168.1.1');

      const jobs = await simulator.getRecentJobs('clerk_user123');
      expect(jobs[0].ipAddress).toBe('192.168.1.1');
    });

    it('should trim prompt before storing', async () => {
      await simulator.createJob('clerk_user123', '  Prompt with spaces  ');

      const jobs = await simulator.getRecentJobs('clerk_user123');
      expect(jobs[0].prompt).toBe('Prompt with spaces');
    });
  });
});

describe('GenerationJobs - Job Mutations', () => {
  let simulator: GenerationJobsSimulator;

  beforeEach(() => {
    simulator = new GenerationJobsSimulator();
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      const jobId = simulator.addTestJob({
        userId: 'user123' as Id<'users'>,
        status: 'pending',
      });

      const result = await simulator.cancelJob('clerk_user123', jobId as string);

      expect(result.success).toBe(true);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.status).toBe('cancelled');
      expect(job?.completedAt).toBeDefined();
    });

    it('should cancel a processing job', async () => {
      const jobId = simulator.addTestJob({
        userId: 'user123' as Id<'users'>,
        status: 'processing',
        startedAt: Date.now(),
      });

      const result = await simulator.cancelJob('clerk_user123', jobId as string);

      expect(result.success).toBe(true);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.status).toBe('cancelled');
    });

    it('should reject cancelling a completed job', async () => {
      const jobId = simulator.addTestJob({
        userId: 'user123' as Id<'users'>,
        status: 'completed',
      });

      await expect(simulator.cancelJob('clerk_user123', jobId as string)).rejects.toThrow(
        'Cannot cancel job with status: completed'
      );
    });

    it('should reject cancelling a failed job', async () => {
      const jobId = simulator.addTestJob({
        userId: 'user123' as Id<'users'>,
        status: 'failed',
      });

      await expect(simulator.cancelJob('clerk_user123', jobId as string)).rejects.toThrow(
        'Cannot cancel job with status: failed'
      );
    });

    it('should reject cancelling an already cancelled job', async () => {
      const jobId = simulator.addTestJob({
        userId: 'user123' as Id<'users'>,
        status: 'cancelled',
      });

      await expect(simulator.cancelJob('clerk_user123', jobId as string)).rejects.toThrow(
        'Cannot cancel job with status: cancelled'
      );
    });

    it('should require authentication', async () => {
      const jobId = simulator.addTestJob({
        status: 'pending',
      });

      await expect(simulator.cancelJob('invalid_clerk_id', jobId as string)).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should enforce ownership check - cannot cancel other users job', async () => {
      const jobId = simulator.addTestJob({
        userId: 'user456' as Id<'users'>,
        status: 'pending',
      });

      await expect(simulator.cancelJob('clerk_user123', jobId as string)).rejects.toThrow(
        'Job not found or access denied'
      );
    });

    it('should return error for non-existent job', async () => {
      await expect(simulator.cancelJob('clerk_user123', 'nonexistent_id')).rejects.toThrow(
        'Job not found or access denied'
      );
    });
  });

  describe('updateProgress', () => {
    it('should update phase', async () => {
      const jobId = simulator.addTestJob({
        status: 'pending',
        phase: 'clarifying',
      });

      await simulator.updateProgress(jobId as string, { phase: 'generating' });

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.phase).toBe('generating');
    });

    it('should update questionsGenerated', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
        questionsGenerated: 5,
      });

      await simulator.updateProgress(jobId as string, { questionsGenerated: 10 });

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.questionsGenerated).toBe(10);
    });

    it('should update questionsSaved', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
        questionsSaved: 3,
      });

      await simulator.updateProgress(jobId as string, { questionsSaved: 8 });

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.questionsSaved).toBe(8);
    });

    it('should update estimatedTotal', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      await simulator.updateProgress(jobId as string, { estimatedTotal: 20 });

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.estimatedTotal).toBe(20);
    });

    it('should update multiple fields at once', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      await simulator.updateProgress(jobId as string, {
        phase: 'finalizing',
        questionsGenerated: 15,
        questionsSaved: 15,
        estimatedTotal: 15,
      });

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.phase).toBe('finalizing');
      expect(job?.questionsGenerated).toBe(15);
      expect(job?.questionsSaved).toBe(15);
      expect(job?.estimatedTotal).toBe(15);
    });

    it('should transition pending job to processing and set startedAt', async () => {
      const jobId = simulator.addTestJob({
        status: 'pending',
      });

      await simulator.updateProgress(jobId as string, { phase: 'generating' });

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.status).toBe('processing');
      expect(job?.startedAt).toBeDefined();
    });

    it('should not change status if already processing', async () => {
      const startedAt = Date.now() - 10000;
      const jobId = simulator.addTestJob({
        status: 'processing',
        startedAt,
      });

      await simulator.updateProgress(jobId as string, { questionsGenerated: 5 });

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.status).toBe('processing');
      expect(job?.startedAt).toBe(startedAt);
    });
  });

  describe('completeJob', () => {
    it('should mark job as completed with all required fields', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
        startedAt: Date.now() - 5000,
      });

      const questionIds = ['q1', 'q2', 'q3'];
      await simulator.completeJob(jobId as string, 'React Basics', questionIds, 5000);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.status).toBe('completed');
      expect(job?.topic).toBe('React Basics');
      expect(job?.questionIds).toEqual(questionIds);
      expect(job?.questionsSaved).toBe(questionIds.length);
      expect(job?.durationMs).toBe(5000);
      expect(job?.completedAt).toBeDefined();
    });

    it('should handle empty questionIds array', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      await simulator.completeJob(jobId as string, 'Topic', [], 1000);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.status).toBe('completed');
      expect(job?.questionIds).toEqual([]);
      expect(job?.questionsSaved).toBe(0);
    });

    it('should record conceptIds when provided', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      const conceptIds = ['concept1', 'concept2'];
      await simulator.completeJob(jobId as string, 'Topic', [], 1200, conceptIds);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.conceptIds).toEqual(conceptIds);
      expect(job?.questionsSaved).toBe(conceptIds.length);
    });

    it('should handle zero duration', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      await simulator.completeJob(jobId as string, 'Topic', ['q1'], 0);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.durationMs).toBe(0);
    });
  });

  describe('failJob', () => {
    it('should mark job as failed with error details', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      await simulator.failJob(jobId as string, 'API key invalid', 'API_KEY', false);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.status).toBe('failed');
      expect(job?.errorMessage).toBe('API key invalid');
      expect(job?.errorCode).toBe('API_KEY');
      expect(job?.retryable).toBe(false);
      expect(job?.completedAt).toBeDefined();
    });

    it('should handle retryable errors', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      await simulator.failJob(jobId as string, 'Rate limit exceeded', 'RATE_LIMIT', true);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.errorCode).toBe('RATE_LIMIT');
      expect(job?.retryable).toBe(true);
    });

    it('should handle network errors', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      await simulator.failJob(jobId as string, 'Connection timeout', 'NETWORK', true);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.errorCode).toBe('NETWORK');
      expect(job?.retryable).toBe(true);
    });

    it('should handle unknown errors', async () => {
      const jobId = simulator.addTestJob({
        status: 'processing',
      });

      await simulator.failJob(jobId as string, 'Something went wrong', 'UNKNOWN', false);

      const job = await simulator.getJobById('clerk_user123', jobId as string);
      expect(job?.errorCode).toBe('UNKNOWN');
      expect(job?.retryable).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should delete old completed jobs', async () => {
      const oldDate =
        Date.now() - (JOB_CONFIG.COMPLETED_JOB_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;

      simulator.addTestJob({
        status: 'completed',
        createdAt: oldDate,
      });

      const result = await simulator.cleanup();

      expect(result.deletedCompleted).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should delete old failed jobs', async () => {
      const oldDate = Date.now() - (JOB_CONFIG.FAILED_JOB_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;

      simulator.addTestJob({
        status: 'failed',
        createdAt: oldDate,
      });

      const result = await simulator.cleanup();

      expect(result.deletedFailed).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should not delete recent completed jobs', async () => {
      simulator.addTestJob({
        status: 'completed',
        createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day old
      });

      const result = await simulator.cleanup();

      expect(result.deletedCompleted).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should not delete recent failed jobs', async () => {
      simulator.addTestJob({
        status: 'failed',
        createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day old
      });

      const result = await simulator.cleanup();

      expect(result.deletedFailed).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should not delete pending, processing, or cancelled jobs', async () => {
      const veryOldDate = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100 days old

      simulator.addTestJob({ status: 'pending', createdAt: veryOldDate });
      simulator.addTestJob({ status: 'processing', createdAt: veryOldDate });
      simulator.addTestJob({ status: 'cancelled', createdAt: veryOldDate });

      const result = await simulator.cleanup();

      expect(result.total).toBe(0);
    });

    it('should delete multiple jobs in one cleanup', async () => {
      const oldCompletedDate =
        Date.now() - (JOB_CONFIG.COMPLETED_JOB_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;
      const oldFailedDate =
        Date.now() - (JOB_CONFIG.FAILED_JOB_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;

      simulator.addTestJob({ status: 'completed', createdAt: oldCompletedDate });
      simulator.addTestJob({ status: 'completed', createdAt: oldCompletedDate });
      simulator.addTestJob({ status: 'failed', createdAt: oldFailedDate });

      const result = await simulator.cleanup();

      expect(result.deletedCompleted).toBe(2);
      expect(result.deletedFailed).toBe(1);
      expect(result.total).toBe(3);
    });

    it('should use different retention periods for completed vs failed', async () => {
      // Job at completed retention threshold (should be deleted)
      const atCompletedThreshold =
        Date.now() - (JOB_CONFIG.COMPLETED_JOB_RETENTION_DAYS + 0.1) * 24 * 60 * 60 * 1000;

      // Job at failed retention threshold (should be deleted)
      const atFailedThreshold =
        Date.now() - (JOB_CONFIG.FAILED_JOB_RETENTION_DAYS + 0.1) * 24 * 60 * 60 * 1000;

      simulator.addTestJob({ status: 'completed', createdAt: atCompletedThreshold });
      simulator.addTestJob({ status: 'failed', createdAt: atFailedThreshold });

      // Also add jobs just inside the threshold (should NOT be deleted)
      const justInsideCompleted =
        Date.now() - (JOB_CONFIG.COMPLETED_JOB_RETENTION_DAYS - 1) * 24 * 60 * 60 * 1000;
      const justInsideFailed =
        Date.now() - (JOB_CONFIG.FAILED_JOB_RETENTION_DAYS - 1) * 24 * 60 * 60 * 1000;

      simulator.addTestJob({ status: 'completed', createdAt: justInsideCompleted });
      simulator.addTestJob({ status: 'failed', createdAt: justInsideFailed });

      const result = await simulator.cleanup();

      // Should only delete the 2 old ones, not the 2 recent ones
      expect(result.total).toBe(2);
    });
  });
});
