import { useUser } from '@clerk/nextjs';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTrackEvent } from './use-track-event';

import { clearUserContext, setUserContext, trackEvent } from '@/lib/analytics';

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
  setUserContext: vi.fn(),
  clearUserContext: vi.fn(),
}));

describe('useTrackEvent', () => {
  const mockUseUser = useUser as unknown as vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseUser.mockReturnValue({
      isSignedIn: true,
      user: {
        id: 'user-123',
        fullName: 'Test User',
        username: 'test-user',
        primaryEmailAddress: { emailAddress: 'user@example.com' },
      },
    });
  });

  it('returns memoized handler and forwards tracking calls', async () => {
    const { result, rerender } = renderHook(() => useTrackEvent());

    await waitFor(() => {
      expect(setUserContext).toHaveBeenCalledWith('user-123', {
        email: 'user@example.com',
        name: 'Test User',
        username: 'test-user',
      });
    });

    const handler1 = result.current;

    act(() => {
      handler1('Quiz Generation Started', { jobId: 'job-456' });
    });

    expect(trackEvent).toHaveBeenCalledWith('Quiz Generation Started', {
      jobId: 'job-456',
    });

    rerender();
    const handler2 = result.current;
    expect(handler1).toBe(handler2);
  });

  it('clears analytics context when the user signs out', async () => {
    const { rerender } = renderHook(() => useTrackEvent());

    await waitFor(() => {
      expect(setUserContext).toHaveBeenCalledTimes(1);
    });

    mockUseUser.mockReturnValue({ isSignedIn: false, user: null });

    rerender();

    await waitFor(() => {
      expect(clearUserContext).toHaveBeenCalledTimes(1);
    });
  });

  it('ignores user metadata when fields are absent', async () => {
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      user: {
        id: 'user-789',
        fullName: undefined,
        username: undefined,
        primaryEmailAddress: null,
      },
    });

    renderHook(() => useTrackEvent());

    await waitFor(() => {
      expect(setUserContext).toHaveBeenCalledWith('user-789', {});
    });
  });
});
