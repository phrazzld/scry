/**
 * Configuration constants for background job system
 *
 * Centralized configuration for job limits, timeouts, and retention policies.
 * These values can be easily adjusted without touching business logic.
 */
export const JOB_CONFIG = {
  /** Maximum concurrent generation jobs per user */
  MAX_CONCURRENT_PER_USER: 3,

  /** Maximum prompt length in characters */
  MAX_PROMPT_LENGTH: 5000,

  /** Minimum prompt length in characters */
  MIN_PROMPT_LENGTH: 3,

  /** Days to retain completed jobs before cleanup */
  COMPLETED_JOB_RETENTION_DAYS: 7,

  /** Days to retain failed jobs before cleanup */
  FAILED_JOB_RETENTION_DAYS: 30,
} as const;
