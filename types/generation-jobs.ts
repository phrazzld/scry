import type { Doc } from '@/convex/_generated/dataModel';

/**
 * Job status literal types
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Job processing phase literal types
 */
export type JobPhase =
  | 'clarifying'
  | 'concept_synthesis'
  | 'generating'
  | 'phrasing_generation'
  | 'finalizing';

/**
 * Error code literal types for job failures
 */
export type ErrorCode = 'RATE_LIMIT' | 'API_KEY' | 'NETWORK' | 'UNKNOWN';

/**
 * Type alias for generation job document
 */
export type GenerationJob = Doc<'generationJobs'>;

/**
 * Type guard to check if a job is in processing state
 */
export function isProcessingJob(job: GenerationJob): boolean {
  return job.status === 'processing';
}

/**
 * Type guard to check if a job is completed
 */
export function isCompletedJob(job: GenerationJob): boolean {
  return job.status === 'completed';
}

/**
 * Type guard to check if a job has failed
 */
export function isFailedJob(job: GenerationJob): boolean {
  return job.status === 'failed';
}

/**
 * Type guard to check if a job is cancelled
 */
export function isCancelledJob(job: GenerationJob): boolean {
  return job.status === 'cancelled';
}

/**
 * Type guard to check if a job is pending
 */
export function isPendingJob(job: GenerationJob): boolean {
  return job.status === 'pending';
}

/**
 * Type guard to check if a job is active (pending or processing)
 */
export function isActiveJob(job: GenerationJob): boolean {
  return job.status === 'pending' || job.status === 'processing';
}

/**
 * Type guard to check if a job is terminal (completed, failed, or cancelled)
 */
export function isTerminalJob(job: GenerationJob): boolean {
  return job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
}

/**
 * Type guard to check if a job has an error
 */
export function hasError(job: GenerationJob): job is GenerationJob & {
  errorMessage: string;
  errorCode: string;
} {
  return job.errorMessage !== undefined && job.errorCode !== undefined;
}

/**
 * Type guard to check if a job error is retryable
 */
export function isRetryableError(job: GenerationJob): boolean {
  return job.retryable === true;
}
