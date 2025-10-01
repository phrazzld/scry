/**
 * Smart polling intervals for battery-efficient real-time updates
 * Dynamically adjusts polling frequency based on when cards are due
 */

/**
 * Calculate optimal polling interval based on next due time
 * @param nextDueTime - The timestamp when the next card is due
 * @returns Polling interval in milliseconds
 */
export function getPollingInterval(nextDueTime: Date | number | null): number {
  // If no due time, use a very long interval (1 hour)
  if (!nextDueTime) {
    return 60 * 60 * 1000; // 1 hour
  }

  // Convert to timestamp if Date object
  const dueTimestamp = typeof nextDueTime === 'number' ? nextDueTime : nextDueTime.getTime();

  const now = Date.now();
  const timeUntilDue = dueTimestamp - now;

  // Already due or past due - immediate polling
  if (timeUntilDue <= 0) {
    return 0; // Immediate refresh
  }

  // Less than 1 minute - very frequent polling
  if (timeUntilDue < 60 * 1000) {
    return 5 * 1000; // 5 seconds
  }

  // Less than 5 minutes - frequent polling
  if (timeUntilDue < 5 * 60 * 1000) {
    return 30 * 1000; // 30 seconds
  }

  // Less than 1 hour - moderate polling
  if (timeUntilDue < 60 * 60 * 1000) {
    return 5 * 60 * 1000; // 5 minutes
  }

  // Due today (within 24 hours) - infrequent polling
  if (timeUntilDue < 24 * 60 * 60 * 1000) {
    return 30 * 60 * 1000; // 30 minutes
  }

  // Due tomorrow or later - very infrequent polling
  return 60 * 60 * 1000; // 1 hour
}

/**
 * Get a human-readable description of the polling interval
 * Useful for debugging and monitoring
 */
export function describePollingInterval(interval: number): string {
  if (interval === 0) return 'immediate';
  if (interval < 1000) return `${interval}ms`;
  if (interval < 60 * 1000) return `${Math.round(interval / 1000)}s`;
  if (interval < 60 * 60 * 1000) return `${Math.round(interval / (60 * 1000))}min`;
  return `${Math.round(interval / (60 * 60 * 1000))}hr`;
}

/**
 * Calculate the next optimal check time based on multiple due times
 * Useful when tracking multiple cards or users
 */
export function getOptimalPollingInterval(dueTimes: Array<Date | number | null>): number {
  // Filter out null values and get the minimum interval needed
  const intervals = dueTimes
    .filter((time) => time !== null)
    .map((time) => getPollingInterval(time));

  // If no valid times, use default long interval
  if (intervals.length === 0) {
    return 60 * 60 * 1000; // 1 hour
  }

  // Return the shortest interval (most urgent)
  return Math.min(...intervals);
}

/**
 * Check if polling should be paused based on visibility state
 * Returns true if the page is hidden and polling can be paused
 */
export function shouldPausePolling(): boolean {
  if (typeof document === 'undefined') {
    return false; // Not in browser environment
  }

  // Check if page is hidden using the Page Visibility API
  return document.hidden || document.visibilityState === 'hidden';
}

/**
 * Create a visibility-aware polling interval
 * Automatically pauses when tab is hidden and resumes when visible
 */
export function createVisibilityAwareInterval(
  callback: () => void,
  getInterval: () => number
): () => void {
  let intervalId: NodeJS.Timeout | null = null;
  let lastInterval = getInterval();

  const startPolling = () => {
    // Clear any existing interval
    if (intervalId) {
      clearInterval(intervalId);
    }

    // Don't start if page is hidden
    if (shouldPausePolling()) {
      return;
    }

    // Get the current interval
    lastInterval = getInterval();

    // If interval is 0, run immediately and don't set up interval
    if (lastInterval === 0) {
      callback();
      // After immediate execution, get next interval
      lastInterval = getInterval();
    }

    // Set up the interval if it's greater than 0
    if (lastInterval > 0) {
      intervalId = setInterval(() => {
        // Check if we should still be polling
        if (!shouldPausePolling()) {
          callback();

          // Check if interval needs to be updated
          const newInterval = getInterval();
          if (newInterval !== lastInterval) {
            // Restart with new interval
            startPolling();
          }
        }
      }, lastInterval);
    }
  };

  const stopPolling = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // Set up visibility change listener
  if (typeof document !== 'undefined') {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Resume polling when page becomes visible
        // Run callback immediately to catch up
        callback();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start initial polling
    startPolling();

    // Return cleanup function
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }

  // If not in browser, just set up regular interval
  startPolling();
  return stopPolling;
}
