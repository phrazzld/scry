import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPollingInterval,
  describePollingInterval,
  getOptimalPollingInterval,
  shouldPausePolling,
  createVisibilityAwareInterval
} from './smart-polling';

describe('getPollingInterval', () => {
  beforeEach(() => {
    // Mock Date.now() for consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('edge cases', () => {
    it('returns 1 hour interval for null input', () => {
      expect(getPollingInterval(null)).toBe(60 * 60 * 1000);
    });

    it('returns 0 for past due times', () => {
      const pastDate = new Date('2024-01-15T11:00:00Z'); // 1 hour ago
      expect(getPollingInterval(pastDate)).toBe(0);
    });

    it('returns 0 for exactly current time', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      expect(getPollingInterval(now)).toBe(0);
    });

    it('returns 1 hour for far future times (> 24 hours)', () => {
      const farFuture = new Date('2024-01-17T12:00:00Z'); // 2 days from now
      expect(getPollingInterval(farFuture)).toBe(60 * 60 * 1000);
    });

    it('handles invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      // Invalid dates have NaN as time value, which results in NaN - now
      // The function returns 1 hour for any falsy/invalid input
      expect(getPollingInterval(invalidDate)).toBe(60 * 60 * 1000);
    });

    it('handles negative timestamps', () => {
      const negativeTime = -1000;
      expect(getPollingInterval(negativeTime)).toBe(0);
    });

    it('handles extremely large future timestamps', () => {
      const farFuture = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year from now
      expect(getPollingInterval(farFuture)).toBe(60 * 60 * 1000);
    });
  });

  describe('time-based intervals', () => {
    it('returns 5 seconds for times less than 1 minute away', () => {
      const nearFuture = new Date('2024-01-15T12:00:30Z'); // 30 seconds from now
      expect(getPollingInterval(nearFuture)).toBe(5 * 1000);
    });

    it('returns 5 seconds for exactly 59 seconds away', () => {
      const nearFuture = Date.now() + (59 * 1000);
      expect(getPollingInterval(nearFuture)).toBe(5 * 1000);
    });

    it('returns 30 seconds for times between 1-5 minutes away', () => {
      const nearFuture = new Date('2024-01-15T12:03:00Z'); // 3 minutes from now
      expect(getPollingInterval(nearFuture)).toBe(30 * 1000);
    });

    it('returns 5 minutes for times between 5 minutes and 1 hour away', () => {
      const nearFuture = new Date('2024-01-15T12:30:00Z'); // 30 minutes from now
      expect(getPollingInterval(nearFuture)).toBe(5 * 60 * 1000);
    });

    it('returns 30 minutes for times between 1-24 hours away', () => {
      const tomorrow = new Date('2024-01-15T20:00:00Z'); // 8 hours from now
      expect(getPollingInterval(tomorrow)).toBe(30 * 60 * 1000);
    });

    it('returns 30 minutes for exactly 23 hours 59 minutes away', () => {
      const almostTomorrow = Date.now() + (23 * 60 * 60 * 1000) + (59 * 60 * 1000);
      expect(getPollingInterval(almostTomorrow)).toBe(30 * 60 * 1000);
    });
  });

  describe('input type handling', () => {
    it('handles Date objects correctly', () => {
      const futureDate = new Date('2024-01-15T12:00:30Z');
      expect(getPollingInterval(futureDate)).toBe(5 * 1000);
    });

    it('handles timestamp numbers correctly', () => {
      const futureTimestamp = Date.now() + (30 * 1000);
      expect(getPollingInterval(futureTimestamp)).toBe(5 * 1000);
    });

    it('treats 0 timestamp as invalid and returns default interval', () => {
      // 0 is treated as falsy/null, not as a valid timestamp
      expect(getPollingInterval(0)).toBe(60 * 60 * 1000);
    });
  });
});

describe('describePollingInterval', () => {
  it('describes immediate correctly', () => {
    expect(describePollingInterval(0)).toBe('immediate');
  });

  it('describes milliseconds correctly', () => {
    expect(describePollingInterval(500)).toBe('500ms');
    expect(describePollingInterval(999)).toBe('999ms');
  });

  it('describes seconds correctly', () => {
    expect(describePollingInterval(5000)).toBe('5s');
    expect(describePollingInterval(30000)).toBe('30s');
    expect(describePollingInterval(59999)).toBe('60s'); // Rounds up
  });

  it('describes minutes correctly', () => {
    expect(describePollingInterval(5 * 60 * 1000)).toBe('5min');
    expect(describePollingInterval(30 * 60 * 1000)).toBe('30min');
    expect(describePollingInterval(59 * 60 * 1000)).toBe('59min');
  });

  it('describes hours correctly', () => {
    expect(describePollingInterval(60 * 60 * 1000)).toBe('1hr');
    expect(describePollingInterval(2 * 60 * 60 * 1000)).toBe('2hr');
    expect(describePollingInterval(24 * 60 * 60 * 1000)).toBe('24hr');
  });
});

describe('getOptimalPollingInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns shortest interval from multiple due times', () => {
    const dueTimes = [
      new Date('2024-01-15T12:00:30Z'), // 30 seconds -> 5s interval
      new Date('2024-01-15T12:30:00Z'), // 30 minutes -> 5min interval
      new Date('2024-01-16T12:00:00Z'), // 24 hours -> 30min interval
    ];
    expect(getOptimalPollingInterval(dueTimes)).toBe(5 * 1000);
  });

  it('handles null values in array', () => {
    const dueTimes = [
      null,
      new Date('2024-01-15T12:30:00Z'), // 30 minutes -> 5min interval
      null,
      new Date('2024-01-16T12:00:00Z'), // 24 hours -> 30min interval
    ];
    expect(getOptimalPollingInterval(dueTimes)).toBe(5 * 60 * 1000);
  });

  it('returns 1 hour for empty array', () => {
    expect(getOptimalPollingInterval([])).toBe(60 * 60 * 1000);
  });

  it('returns 1 hour for array of all nulls', () => {
    expect(getOptimalPollingInterval([null, null, null])).toBe(60 * 60 * 1000);
  });

  it('handles past due times correctly', () => {
    const dueTimes = [
      new Date('2024-01-15T11:00:00Z'), // Past due -> 0 interval
      new Date('2024-01-15T12:30:00Z'), // 30 minutes -> 5min interval
    ];
    expect(getOptimalPollingInterval(dueTimes)).toBe(0);
  });
});

describe('shouldPausePolling', () => {
  it('returns false when document is undefined (non-browser)', () => {
    // In test environment, document might be undefined
    const originalDocument = global.document;
    // Intentionally setting to undefined for test
    (global as any).document = undefined;

    expect(shouldPausePolling()).toBe(false);

    global.document = originalDocument;
  });

  it('returns true when document is hidden', () => {
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: true
    });

    expect(shouldPausePolling()).toBe(true);

    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false
    });
  });

  it('returns true when visibility state is hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'hidden'
    });

    expect(shouldPausePolling()).toBe(true);

    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'visible'
    });
  });

  it('returns false when document is visible', () => {
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false
    });
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'visible'
    });

    expect(shouldPausePolling()).toBe(false);
  });
});

describe('createVisibilityAwareInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('calls callback at specified intervals when visible', () => {
    const callback = vi.fn();
    const getInterval = () => 1000; // 1 second

    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false
    });

    const cleanup = createVisibilityAwareInterval(callback, getInterval);

    // Initially shouldn't be called
    expect(callback).not.toHaveBeenCalled();

    // After 1 second, should be called once
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    // After another second, should be called again
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it('stops polling when page becomes hidden', () => {
    const callback = vi.fn();
    const getInterval = () => 1000;

    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false
    });

    const cleanup = createVisibilityAwareInterval(callback, getInterval);

    // Run for 1 second
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    // Hide the page
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: true
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Advance time - callback should not be called
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1); // Still 1

    cleanup();
  });

  it('resumes polling immediately when page becomes visible', () => {
    const callback = vi.fn();
    const getInterval = () => 1000;

    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false
    });

    const cleanup = createVisibilityAwareInterval(callback, getInterval);

    // Hide the page
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: true
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Show the page again
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Should be called immediately on visibility change
    expect(callback).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('handles immediate interval (0ms) correctly', () => {
    const callback = vi.fn();
    const getInterval = vi.fn(() => 0);

    const cleanup = createVisibilityAwareInterval(callback, getInterval);

    // Should be called immediately
    expect(callback).toHaveBeenCalledTimes(1);

    // getInterval is called multiple times:
    // 1. Initial call to get interval
    // 2. After immediate execution to get next interval
    // 3. Inside the recursive call to startPolling
    expect(getInterval).toHaveBeenCalledTimes(3);

    cleanup();
  });

  it('adjusts interval dynamically when it changes', () => {
    const callback = vi.fn();
    let interval = 1000;
    const getInterval = () => interval;

    const cleanup = createVisibilityAwareInterval(callback, getInterval);

    // After 1 second
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    // Change interval to 500ms
    interval = 500;

    // Next call will detect interval change and restart
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);

    // Now should be called every 500ms
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(3);

    cleanup();
  });

  it('cleanup function stops interval and removes listener', () => {
    const callback = vi.fn();
    const getInterval = () => 1000;

    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const cleanup = createVisibilityAwareInterval(callback, getInterval);

    cleanup();

    // Should remove the visibility change listener
    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    // Advancing time should not trigger callback
    vi.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });
});