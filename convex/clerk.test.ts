import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureUser } from './clerk';

describe('clerk.ensureUser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes createdAt when inserting a new user', async () => {
    const fixedDate = new Date('2025-11-08T12:34:56Z');
    vi.setSystemTime(fixedDate);

    const insertSpy = vi.fn().mockResolvedValue('user_123');
    const firstSpy = vi.fn().mockResolvedValue(null);
    const withIndexSpy = vi.fn().mockReturnValue({ first: firstSpy });
    const querySpy = vi.fn().mockReturnValue({ withIndex: withIndexSpy });

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
          subject: 'clerk_123',
          email: 'user@example.com',
          name: 'Test User',
          pictureUrl: 'https://example.com/avatar.png',
          emailVerified: true,
        }),
      },
      db: {
        query: querySpy,
        insert: insertSpy,
      },
    } as any;

    await ensureUser.handler(ctx, {});

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const [, insertedDoc] = insertSpy.mock.calls[0];
    expect(insertedDoc.createdAt).toBe(fixedDate.getTime());
    expect(insertedDoc.createdAt).toBeDefined();
    expect(insertedDoc.email).toBe('user@example.com');

    expect(querySpy).toHaveBeenCalledWith('users');
    expect(withIndexSpy).toHaveBeenCalledWith('by_clerk_id', expect.any(Function));
    expect(firstSpy).toHaveBeenCalled();
  });
});
