import { useUser } from '@clerk/nextjs';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { ConvexErrorBoundary } from './convex-error-boundary';

import { clearUserContext, reportError, setUserContext } from '@/lib/analytics';

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  reportError: vi.fn(),
  setUserContext: vi.fn(),
  clearUserContext: vi.fn(),
}));

describe('ConvexErrorBoundary', () => {
  const mockUseUser = useUser as unknown as Mock;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

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

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function Thrower(): null {
    throw new Error('Boom!');
  }

  it('reports errors with user context to analytics', async () => {
    render(
      <ConvexErrorBoundary>
        <Thrower />
      </ConvexErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    expect(setUserContext).toHaveBeenCalledWith('user-123', {
      email: 'user@example.com',
      name: 'Test User',
      username: 'test-user',
    });

    expect(reportError).toHaveBeenCalledTimes(1);

    const [error, context] = vi.mocked(reportError).mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Boom!');
    expect(context).toMatchObject({
      boundary: 'convex-error-boundary',
      componentStack: expect.stringContaining('Thrower'),
    });
  });

  it('clears user context when user is not signed in', async () => {
    mockUseUser.mockReturnValue({
      isSignedIn: false,
      user: null,
    });

    render(
      <ConvexErrorBoundary>
        <Thrower />
      </ConvexErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    expect(setUserContext).not.toHaveBeenCalled();
    expect(clearUserContext).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
