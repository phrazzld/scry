/**
 * Centralized timing constants for the application
 * All timing values are in milliseconds for consistency
 */

/**
 * Polling intervals for reactive data updates
 */

// Review queue polling interval - how often to check for newly due questions
export const POLLING_INTERVAL_MS = 30000; // 30 seconds

// Default polling interval for general queries (1 minute)
export const DEFAULT_POLLING_INTERVAL_MS = 60000;

/**
 * UI update intervals
 */

// Frame rate update interval for debug panel FPS counter
export const FRAME_UPDATE_INTERVAL_MS = 1000; // 1 second

/**
 * Timeout thresholds
 */

// Timer cleanup threshold - remove old timers from debug panel after this duration
export const TIMER_CLEANUP_THRESHOLD_MS = 60000; // 1 minute

// Loading timeout - show error state if loading takes longer than this
export const LOADING_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Time formatting thresholds
 */

// Threshold for showing "< 1 minute" vs actual time
export const IMMINENT_REVIEW_THRESHOLD_MS = 60000; // 1 minute

/**
 * Data staleness checks
 */

// Consider data stale after this duration without updates
export const DATA_STALENESS_THRESHOLD_MS = 30000; // 30 seconds
