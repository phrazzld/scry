import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Edge case tests for rate limiting boundary calculations
 * Tests window boundaries, retryAfter calculations, and edge conditions
 */

// Mock types for testing
type RateLimitEntry = {
  _id: string;
  identifier: string;
  operation: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

// Helper to create mock rate limit entries
function createMockAttempts(
  identifier: string,
  count: number,
  baseTime: number,
  intervalMs: number = 1000
): RateLimitEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    _id: `entry_${i}`,
    identifier,
    operation: 'test',
    timestamp: baseTime + (i * intervalMs),
    metadata: {}
  }));
}

// Helper to calculate retryAfter similar to the actual implementation
function calculateRetryAfter(
  oldestInWindowTimestamp: number,
  windowMs: number,
  currentTime: number
): number {
  const retryAfter = oldestInWindowTimestamp + windowMs - currentTime;
  return Math.max(0, Math.ceil(retryAfter / 1000));
}

describe('Rate Limit Boundary Calculations', () => {
  const WINDOW_MS = 3600000; // 1 hour
  const MAX_ATTEMPTS = 5;
  let fixedTime: number;

  beforeEach(() => {
    // Fixed timestamp for consistent testing
    fixedTime = new Date('2025-01-16T12:00:00Z').getTime();
  });

  describe('Window Boundary Edge Cases', () => {
    it('should correctly identify attempts at exact window boundary', () => {
      const windowStart = fixedTime - WINDOW_MS;
      
      // Attempt exactly at window boundary should be included
      const attemptAtBoundary = windowStart;
      expect(attemptAtBoundary).toBe(fixedTime - WINDOW_MS);
      expect(attemptAtBoundary > windowStart - 1).toBe(true); // Would be included in query
      
      // Attempt 1ms before window boundary should be excluded
      const attemptBeforeBoundary = windowStart - 1;
      expect(attemptBeforeBoundary > windowStart - 1).toBe(false); // Would be excluded
      
      // Attempt 1ms after window boundary should be included
      const attemptAfterBoundary = windowStart + 1;
      expect(attemptAfterBoundary > windowStart - 1).toBe(true); // Would be included
    });

    it('should handle window calculations when time advances between checks', () => {
      // Simulate time advancing during rate limit check
      const initialTime = fixedTime;
      const laterTime = fixedTime + 5000; // 5 seconds later
      
      const windowStartInitial = initialTime - WINDOW_MS;
      const windowStartLater = laterTime - WINDOW_MS;
      
      // Window moves forward as time advances
      expect(windowStartLater - windowStartInitial).toBe(5000);
      
      // An attempt that was in window initially might fall out
      const attemptTime = initialTime - WINDOW_MS + 2000; // 2 seconds into window
      expect(attemptTime > windowStartInitial).toBe(true); // In window at initial time
      expect(attemptTime > windowStartLater).toBe(false); // Out of window 5 seconds later
    });

    it('should handle attempts at same timestamp', () => {
      // Multiple attempts at exact same millisecond
      const attempts = createMockAttempts('test@example.com', 5, fixedTime, 0);
      
      // All attempts have same timestamp
      expect(attempts.every(a => a.timestamp === fixedTime)).toBe(true);
      
      // All would be in window
      const windowStart = fixedTime - WINDOW_MS;
      expect(attempts.every(a => a.timestamp > windowStart)).toBe(true);
    });

    it('should handle very old attempts outside any window', () => {
      const veryOldTime = fixedTime - (WINDOW_MS * 10); // 10 hours ago
      const windowStart = fixedTime - WINDOW_MS;
      
      expect(veryOldTime > windowStart).toBe(false);
      
      // Cleanup threshold is 2x window
      const cleanupThreshold = fixedTime - (WINDOW_MS * 2);
      expect(veryOldTime < cleanupThreshold).toBe(true); // Should be cleaned up
    });
  });

  describe('RetryAfter Calculation Edge Cases', () => {
    it('should handle retryAfter when it would be negative', () => {
      // Oldest attempt is older than window size
      const oldestTimestamp = fixedTime - WINDOW_MS - 5000; // 5 seconds past window
      const retryAfter = calculateRetryAfter(oldestTimestamp, WINDOW_MS, fixedTime);
      
      // Should be 0, not negative
      expect(retryAfter).toBe(0);
    });

    it('should correctly round up fractional seconds', () => {
      // Test various fractional second scenarios
      const testCases = [
        { ms: 500, expected: 1 },    // 0.5 seconds -> 1 second
        { ms: 1001, expected: 2 },   // 1.001 seconds -> 2 seconds
        { ms: 1500, expected: 2 },   // 1.5 seconds -> 2 seconds
        { ms: 1999, expected: 2 },   // 1.999 seconds -> 2 seconds
        { ms: 2000, expected: 2 },   // 2.0 seconds -> 2 seconds
        { ms: 2001, expected: 3 },   // 2.001 seconds -> 3 seconds
      ];

      testCases.forEach(({ ms, expected }) => {
        const oldestTimestamp = fixedTime - WINDOW_MS + ms;
        const retryAfter = calculateRetryAfter(oldestTimestamp, WINDOW_MS, fixedTime);
        expect(retryAfter).toBe(expected);
      });
    });

    it('should handle retryAfter at exact window boundary', () => {
      // Oldest attempt exactly at window start
      const oldestTimestamp = fixedTime - WINDOW_MS;
      const retryAfter = calculateRetryAfter(oldestTimestamp, WINDOW_MS, fixedTime);
      
      // Should be exactly 0 (just expired)
      expect(retryAfter).toBe(0);
    });

    it('should calculate correct retryAfter for max window time', () => {
      // Oldest attempt just happened
      const oldestTimestamp = fixedTime;
      const retryAfter = calculateRetryAfter(oldestTimestamp, WINDOW_MS, fixedTime);
      
      // Should be full window time in seconds
      expect(retryAfter).toBe(3600); // 1 hour = 3600 seconds
    });

    it('should handle retryAfter with different window sizes', () => {
      const windows = [
        { ms: 60000, seconds: 60 },      // 1 minute
        { ms: 300000, seconds: 300 },    // 5 minutes
        { ms: 3600000, seconds: 3600 },  // 1 hour
        { ms: 86400000, seconds: 86400 }, // 24 hours
      ];

      windows.forEach(({ ms, seconds }) => {
        const oldestTimestamp = fixedTime;
        const retryAfter = calculateRetryAfter(oldestTimestamp, ms, fixedTime);
        expect(retryAfter).toBe(seconds);
      });
    });
  });

  describe('Array Indexing Edge Cases', () => {
    it('should handle correct oldest attempt selection', () => {
      // When we have exactly maxAttempts
      const attempts = createMockAttempts('test@example.com', MAX_ATTEMPTS, fixedTime - 3000);
      
      // The oldest that would still be in window after hitting limit
      // is at index [length - maxAttempts] which is [5 - 5] = [0]
      const oldestInWindow = attempts[attempts.length - MAX_ATTEMPTS];
      expect(oldestInWindow).toBe(attempts[0]);
      
      // When we have more than maxAttempts
      const moreAttempts = createMockAttempts('test@example.com', 10, fixedTime - 5000);
      const oldestRelevant = moreAttempts[moreAttempts.length - MAX_ATTEMPTS];
      expect(oldestRelevant).toBe(moreAttempts[5]); // Index 5 for 10 - 5
    });

    it('should handle empty attempts array', () => {
      const attempts: RateLimitEntry[] = [];
      
      // No attempts means not rate limited
      expect(attempts.length >= MAX_ATTEMPTS).toBe(false);
      expect(attempts.length).toBe(0);
    });

    it('should handle single attempt', () => {
      const attempts = createMockAttempts('test@example.com', 1, fixedTime);
      
      expect(attempts.length >= MAX_ATTEMPTS).toBe(false);
      expect(attempts.length).toBe(1);
    });
  });

  describe('Reset Time Calculations', () => {
    it('should calculate correct reset time for oldest attempt', () => {
      const attempts = createMockAttempts('test@example.com', 3, fixedTime - 2000, 500);
      
      // Reset time is when oldest attempt expires
      const oldestAttempt = attempts[0];
      const resetTime = oldestAttempt.timestamp + WINDOW_MS;
      
      expect(resetTime).toBe(fixedTime - 2000 + WINDOW_MS);
      expect(resetTime > fixedTime).toBe(true); // In the future
    });

    it('should handle reset time with no attempts', () => {
      const attempts: RateLimitEntry[] = [];
      
      // No attempts means no reset time
      let resetTime: number | null = null;
      if (attempts.length > 0) {
        resetTime = attempts[0].timestamp + WINDOW_MS;
      }
      
      expect(resetTime).toBe(null);
    });
  });

  describe('Cleanup Threshold Edge Cases', () => {
    it('should calculate cleanup threshold correctly', () => {
      const maxWindowMs = WINDOW_MS; // Assuming 1 hour is max
      const cleanupThreshold = fixedTime - maxWindowMs * 2;
      
      // Entries older than 2x window should be cleaned
      const veryOld = fixedTime - maxWindowMs * 3;
      expect(veryOld < cleanupThreshold).toBe(true);
      
      // Entries within 2x window should be kept
      const recent = fixedTime - maxWindowMs * 1.5;
      expect(recent < cleanupThreshold).toBe(false);
    });

    it('should handle cleanup with different window sizes', () => {
      const windows = [
        3600000,  // 1 hour
        1800000,  // 30 minutes
        7200000,  // 2 hours
      ];
      
      const maxWindow = Math.max(...windows);
      const cleanupThreshold = fixedTime - maxWindow * 2;
      
      // Should use the maximum window for cleanup
      expect(cleanupThreshold).toBe(fixedTime - 7200000 * 2);
    });
  });

  describe('Compound Edge Cases', () => {
    it('should handle rapid attempts near window boundary', () => {
      // Attempts happening right as window is about to expire
      const windowEdge = fixedTime - WINDOW_MS + 100; // 100ms before expiry
      const rapidAttempts = createMockAttempts('test@example.com', 10, windowEdge, 10);
      
      // All attempts within 100ms of window edge
      const lastAttempt = rapidAttempts[rapidAttempts.length - 1];
      expect(lastAttempt.timestamp).toBe(windowEdge + 90);
      
      // RetryAfter should be very small
      const retryAfter = calculateRetryAfter(windowEdge, WINDOW_MS, fixedTime);
      expect(retryAfter).toBe(1); // Less than 1 second, rounds up to 1
    });

    it('should handle timezone and DST boundaries', () => {
      // Test timestamps around daylight saving time changes
      // Spring forward: 2AM -> 3AM
      const beforeDST = new Date('2025-03-09T07:00:00Z').getTime(); // 2AM EST
      const afterDST = new Date('2025-03-09T08:00:00Z').getTime();  // 3AM EDT
      
      // The hour difference should still be 3600000ms
      expect(afterDST - beforeDST).toBe(3600000);
      
      // Window calculations should work consistently
      const windowStart = afterDST - WINDOW_MS;
      // beforeDST is 1 hour before afterDST, window is 1 hour, so beforeDST is exactly at window start
      expect(beforeDST).toBe(windowStart);
      expect(beforeDST >= windowStart).toBe(true);
    });

    it('should handle maximum safe integer boundaries', () => {
      // Test with very large timestamps (future dates)
      const farFuture = Number.MAX_SAFE_INTEGER - WINDOW_MS - 1000;
      const windowStart = farFuture - WINDOW_MS;
      
      // Should still calculate correctly without overflow
      expect(windowStart).toBeLessThan(Number.MAX_SAFE_INTEGER);
      expect(farFuture - windowStart).toBe(WINDOW_MS);
    });
  });
});