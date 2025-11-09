import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteUser, ensureUser } from './clerk';

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

    await ensureUser._handler(ctx, {});

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

describe('clerk.deleteUser', () => {
  it('soft deletes questions in paginated batches', async () => {
    const questionCount = 1_200;
    const ctx = createDeleteCtx(questionCount);

    await deleteUser._handler(ctx as any, { clerkId: 'clerk_user' });

    expect(ctx.db.patch).toHaveBeenCalledTimes(questionCount);
    const deletedAtValues = ctx.db.patch.mock.calls.map(([, update]) => update.deletedAt);
    expect(new Set(deletedAtValues).size).toBe(1); // single timestamp reused
    expect(ctx.db.query).toHaveBeenCalledWith('questions');
  });
});

function createDeleteCtx(questionCount: number) {
  const userDoc = { _id: 'user_1' };

  const questions = Array.from({ length: questionCount }, (_, i) => ({
    _id: `question_${i}`,
    userId: 'user_1',
    question: 'Q',
  }));

  const questionQuery = new MockQuestionQuery(questions);

  const querySpy = vi.fn((table: string) => {
    if (table === 'users') {
      return {
        withIndex: () => ({
          first: () => Promise.resolve(userDoc),
        }),
      };
    }

    if (table === 'questions') {
      return questionQuery;
    }

    throw new Error(`Unexpected table ${table}`);
  });

  const patchSpy = vi.fn().mockResolvedValue(undefined);

  return {
    db: {
      query: querySpy,
      patch: patchSpy,
    },
  } as any;
}

class MockQuestionQuery {
  private readonly rows;

  constructor(rows: Array<{ _id: string }>) {
    this.rows = rows;
  }

  withIndex() {
    return this;
  }

  order() {
    return this;
  }

  async paginate({ numItems, cursor }: { numItems: number; cursor: string | null }) {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const page = this.rows.slice(start, start + numItems);
    const nextIndex = start + page.length;
    return {
      page,
      continueCursor: nextIndex < this.rows.length ? String(nextIndex) : null,
      isDone: nextIndex >= this.rows.length,
    };
  }
}
