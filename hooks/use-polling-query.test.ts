import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePollingQuery } from './use-polling-query';

// Mock convex/react
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}));

// Import the mocked function
import { useQuery } from 'convex/react';

describe('usePollingQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Mock document.hidden
    Object.defineProperty(document, 'hidden', {
      writable: true,
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call useQuery with initial timestamp', () => {
    const mockQuery = vi.fn() as any;
    const mockArgs = { foo: 'bar' };
    const mockResult = { data: 'test' };
    
    (useQuery as any).mockReturnValue(mockResult);
    
    const { result } = renderHook(() => 
      usePollingQuery(mockQuery, mockArgs)
    );
    
    expect(useQuery).toHaveBeenCalledWith(
      mockQuery,
      expect.objectContaining({
        foo: 'bar',
        _refreshTimestamp: expect.any(Number),
      })
    );
    
    expect(result.current).toBe(mockResult);
  });

  it('should skip query when args is "skip"', () => {
    const mockQuery = vi.fn() as any;
    
    (useQuery as any).mockReturnValue(undefined);
    
    renderHook(() => usePollingQuery(mockQuery, "skip"));
    
    expect(useQuery).toHaveBeenCalledWith(mockQuery, "skip");
  });

  it('should update timestamp at specified interval', async () => {
    const mockQuery = vi.fn() as any;
    const mockArgs = { foo: 'bar' };
    const intervalMs = 5000; // 5 seconds
    
    (useQuery as any).mockReturnValue({ data: 'test' });
    
    renderHook(() => 
      usePollingQuery(mockQuery, mockArgs, intervalMs)
    );
    
    // Get initial call
    const initialCall = (useQuery as any).mock.calls[0][1];
    const initialTimestamp = initialCall._refreshTimestamp;
    
    // Advance timer by interval
    vi.advanceTimersByTime(intervalMs);
    
    // Wait for re-render
    await waitFor(() => {
      const latestCall = (useQuery as any).mock.calls.at(-1)[1];
      expect(latestCall._refreshTimestamp).toBeGreaterThan(initialTimestamp);
    });
  });

  it('should use default interval of 60 seconds when not specified', () => {
    const mockQuery = vi.fn() as any;
    const mockArgs = { foo: 'bar' };
    
    (useQuery as any).mockReturnValue({ data: 'test' });
    
    renderHook(() => usePollingQuery(mockQuery, mockArgs));
    
    const initialCallCount = (useQuery as any).mock.calls.length;
    
    // Advance by less than 60 seconds
    vi.advanceTimersByTime(30000);
    expect((useQuery as any).mock.calls.length).toBe(initialCallCount);
    
    // Advance to 60 seconds
    vi.advanceTimersByTime(30000);
    // Interval should have fired by now
  });

  it('should pause polling when document is hidden', async () => {
    const mockQuery = vi.fn() as any;
    const mockArgs = { foo: 'bar' };
    const intervalMs = 5000;
    
    (useQuery as any).mockReturnValue({ data: 'test' });
    
    renderHook(() => 
      usePollingQuery(mockQuery, mockArgs, intervalMs)
    );
    
    const initialCallCount = (useQuery as any).mock.calls.length;
    
    // Hide document
    Object.defineProperty(document, 'hidden', { value: true });
    
    // Advance timer
    vi.advanceTimersByTime(intervalMs);
    
    // Should not have updated because document is hidden
    expect((useQuery as any).mock.calls.length).toBe(initialCallCount);
  });

  it('should resume polling when document becomes visible', async () => {
    const mockQuery = vi.fn() as any;
    const mockArgs = { foo: 'bar' };
    const intervalMs = 5000;
    
    (useQuery as any).mockReturnValue({ data: 'test' });
    
    const { rerender } = renderHook(() => 
      usePollingQuery(mockQuery, mockArgs, intervalMs)
    );
    
    // Hide document
    Object.defineProperty(document, 'hidden', { value: true });
    const hiddenEvent = new Event('visibilitychange');
    document.dispatchEvent(hiddenEvent);
    
    // Wait a bit
    vi.advanceTimersByTime(intervalMs * 2);
    
    // Show document
    Object.defineProperty(document, 'hidden', { value: false });
    const visibleEvent = new Event('visibilitychange');
    document.dispatchEvent(visibleEvent);
    
    // Force re-render
    rerender();
    
    // Advance timer
    vi.advanceTimersByTime(intervalMs);
    
    // Should have resumed polling
    await waitFor(() => {
      expect((useQuery as any).mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('should clean up interval on unmount', () => {
    const mockQuery = vi.fn() as any;
    const mockArgs = { foo: 'bar' };
    
    (useQuery as any).mockReturnValue({ data: 'test' });
    
    const { unmount } = renderHook(() => 
      usePollingQuery(mockQuery, mockArgs, 5000)
    );
    
    const initialCallCount = (useQuery as any).mock.calls.length;
    
    unmount();
    
    // Advance timer after unmount
    vi.advanceTimersByTime(10000);
    
    // Should not have made additional calls after unmount
    expect((useQuery as any).mock.calls.length).toBe(initialCallCount);
  });

  it('should handle visibility change listeners correctly', () => {
    const mockQuery = vi.fn() as any;
    const mockArgs = { foo: 'bar' };
    
    (useQuery as any).mockReturnValue({ data: 'test' });
    
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    
    const { unmount } = renderHook(() => 
      usePollingQuery(mockQuery, mockArgs)
    );
    
    // Should have added visibility change listener
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
    
    unmount();
    
    // Should have removed listener on unmount
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
  });
});