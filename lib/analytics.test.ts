import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientTrackMock = vi.fn();
const serverTrackMock = vi.fn().mockResolvedValue(undefined);
const captureExceptionMock = vi.fn();
const setUserMock = vi.fn();

vi.mock('@vercel/analytics', () => ({
  track: clientTrackMock,
}));

vi.mock('@vercel/analytics/server', () => ({
  track: serverTrackMock,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: captureExceptionMock,
  setUser: setUserMock,
}));

describe('analytics wrapper', () => {
  beforeEach(() => {
    clientTrackMock.mockReset();
    serverTrackMock.mockReset();
    captureExceptionMock.mockReset();
    setUserMock.mockReset();
    vi.unstubAllEnvs();
  });

  it('skips tracking in development environment by default', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', 'development');

    vi.resetModules();
    const { trackEvent } = await import('./analytics');

    trackEvent('Quiz Generation Started', { jobId: 'job-123' });

    expect(clientTrackMock).not.toHaveBeenCalled();
  });

  it('tracks events in production environment and merges user metadata', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');

    vi.resetModules();
    const { setUserContext, trackEvent } = await import('./analytics');

    setUserContext('user-123', { plan: 'pro', contact: 'learner@example.com' });
    trackEvent('Quiz Generation Started', {
      jobId: 'job-123',
      provider: 'anthropic',
      details: 'Contact learner@example.com if issues arise',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clientTrackMock).toHaveBeenCalledTimes(1);
    expect(clientTrackMock).toHaveBeenCalledWith(
      'Quiz Generation Started',
      expect.objectContaining({
        jobId: 'job-123',
        provider: 'anthropic',
        userId: 'user-123',
        'user.plan': 'pro',
        'user.contact': '[EMAIL_REDACTED]',
        details: 'Contact [EMAIL_REDACTED] if issues arise',
      })
    );

    expect(setUserMock).toHaveBeenLastCalledWith({
      id: 'user-123',
      meta_plan: 'pro',
      meta_contact: '[EMAIL_REDACTED]',
    });
  });

  it('allows enabling analytics explicitly in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', 'development');
    process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = 'true';

    vi.resetModules();
    const { trackEvent } = await import('./analytics');

    trackEvent('Quiz Generation Started', { jobId: 'job-123' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clientTrackMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the analytics SDK throws', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');

    clientTrackMock.mockImplementation(() => {
      throw new Error('sdk failure');
    });

    vi.resetModules();
    const { trackEvent } = await import('./analytics');

    expect(() =>
      trackEvent('Quiz Generation Started', {
        jobId: 'job-123',
      })
    ).not.toThrow();
  });

  it('uses server-side analytics when window is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');

    const originalWindow = globalThis.window;
    delete (globalThis as any).window;

    try {
      vi.resetModules();
      const { trackEvent } = await import('./analytics');

      trackEvent('Quiz Generation Started', { jobId: 'job-456' });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(serverTrackMock).toHaveBeenCalledTimes(1);
      expect(clientTrackMock).not.toHaveBeenCalled();
      expect(serverTrackMock).toHaveBeenCalledWith(
        'Quiz Generation Started',
        expect.objectContaining({ jobId: 'job-456' })
      );
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('reports errors to Sentry when enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    process.env.SENTRY_DSN = 'https://example.ingest.sentry.io/123';

    vi.resetModules();
    const { reportError } = await import('./analytics');

    const error = new Error('boom');

    reportError(error, {
      info: 'Email learner@example.com',
      nested: { attempts: 2 },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(error, {
      extra: {
        info: 'Email [EMAIL_REDACTED]',
        nested: { attempts: 2 },
      },
    });
  });

  it('skips Sentry reporting when disabled', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    vi.resetModules();
    const { reportError } = await import('./analytics');

    reportError(new Error('noop'));

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('clears user context', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');

    vi.resetModules();
    const { setUserContext, clearUserContext } = await import('./analytics');

    setUserContext('user-123', { plan: 'pro' });
    clearUserContext();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setUserMock).toHaveBeenLastCalledWith(null);
  });
});
