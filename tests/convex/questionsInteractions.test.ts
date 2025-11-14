import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from '@/convex/_generated/dataModel';
import { requireUserFromClerk } from '@/convex/clerk';
import { recordInteraction } from '@/convex/questionsInteractions';
import { getScheduler } from '@/convex/scheduling';

vi.mock('@/convex/clerk', () => ({
  requireUserFromClerk: vi.fn(),
}));

vi.mock('@/convex/scheduling', () => ({
  getScheduler: vi.fn(),
}));

const mockRequireUserFromClerk = vi.mocked(requireUserFromClerk);
const mockGetScheduler = vi.mocked(getScheduler);
let mockNextReview: number;

describe('recordInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireUserFromClerk.mockResolvedValue({
      _id: 'user_1' as Id<'users'>,
      _creationTime: Date.now(),
      email: 'test@example.com',
    } as any);

    mockNextReview = Date.now() + 1000;

    mockGetScheduler.mockReturnValue({
      initializeCard: vi.fn().mockReturnValue({
        state: 'new',
      }),
      scheduleNextReview: vi.fn().mockReturnValue({
        dbFields: {
          nextReview: mockNextReview,
          scheduledDays: 1,
          state: 'learning',
        },
      }),
    } as any);
  });

  it('persists sessionId for recorded interactions', async () => {
    const insertSpy = vi.fn();
    const ctx = createMockCtx(insertSpy);

    // @ts-expect-error - Accessing private _handler for testing
    await recordInteraction._handler(ctx as any, {
      questionId: 'question_1' as any,
      userAnswer: 'A',
      isCorrect: true,
      sessionId: 'session-123',
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0][1];
    expect(inserted.sessionId).toBe('session-123');
    expect(inserted.context).toEqual({
      sessionId: 'session-123',
      scheduledDays: 1,
      nextReview: mockNextReview,
      fsrsState: 'learning',
    });
  });
});

function createMockCtx(insertSpy: ReturnType<typeof vi.fn>) {
  return {
    db: {
      get: vi.fn().mockResolvedValue({
        _id: 'question_1',
        userId: 'user_1',
        attemptCount: 0,
        correctCount: 0,
      }),
      insert: insertSpy,
      patch: vi.fn().mockResolvedValue(undefined),
    },
  };
}
