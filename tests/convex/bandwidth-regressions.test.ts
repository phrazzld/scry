import { describe, expect, it, vi } from 'vitest';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { deleteUser } from '@/convex/clerk';
import { __quizStatsTest, getQuizInteractionStats } from '@/convex/questionsLibrary';
import {
  checkEmailRateLimit,
  __test as rateLimitTest,
  recordRateLimitAttempt,
} from '@/convex/rateLimit';
import { reconcileUserStats, __test as userStatsTest } from '@/convex/userStats';
import {
  generateInteractions,
  generateQuestions,
  generateRateLimitEntries,
  generateUsers,
} from '@/lib/test-utils/largeFixtures';

describe('Bandwidth regressions (>1,100 docs)', () => {
  describe('userStats reconciliation', () => {
    it('samples users and paginates questions without .collect()', async () => {
      const users = generateUsers(10_000);
      const questions = generateQuestions({ userId: users[0]._id, count: 1_200 });
      const ctx = createUserStatsCtx(users, questions);

      // @ts-expect-error - Accessing private _handler for testing
      const result = await reconcileUserStats._handler(ctx as any, {
        sampleSize: 100,
        driftThreshold: 0,
      });

      expect(result.stats.usersChecked).toBeGreaterThan(0);
      expect(ctx.metrics.userReads).toBeLessThanOrEqual(200);
      const maxQuestionReads =
        Math.ceil(questions.length / userStatsTest.QUESTION_BATCH_SIZE) *
        userStatsTest.QUESTION_BATCH_SIZE;
      expect(ctx.metrics.questionReads).toBeLessThanOrEqual(maxQuestionReads);
      expect(ctx.flags.collectCalled).toBe(false);
    });
  });

  describe('rate limit helpers', () => {
    it('caps read batches when checking limits for 1,200 attempts', async () => {
      const entries = generateRateLimitEntries({
        identifier: 'user@example.com',
        count: 1_200,
        startTimestamp: Date.now() - 10_000,
      });
      const ctx = createRateLimitCtx(entries);

      const result = await checkEmailRateLimit(ctx as any, 'user@example.com', 'magicLink');
      expect(result.allowed).toBe(false);
      expect(ctx.metrics.maxBatchRead).toBeLessThanOrEqual(rateLimitTest.MAX_RATE_LIMIT_READS);
      expect(ctx.flags.collectCalled).toBe(false);
    });

    it('cleans history incrementally when recording attempts', async () => {
      const entries = generateRateLimitEntries({
        identifier: 'ip-123',
        count: 1_100,
        startTimestamp: Date.now() - 3_600_000 * 5,
      });
      const ctx = createRateLimitCtx(entries);

      await recordRateLimitAttempt(ctx as any, 'ip-123', 'default');
      expect(ctx.metrics.maxBatchRead).toBeLessThanOrEqual(rateLimitTest.CLEANUP_DELETE_BATCH_SIZE);
      expect(ctx.flags.collectCalled).toBe(false);
      expect(ctx.db.tables.rateLimits.length).toBe(1);
    });
  });

  describe('quiz interaction stats', () => {
    it('streams interactions and reports truncation above cap', async () => {
      const interactions = generateInteractions({
        userId: 'user_stream' as Id<'users'>,
        sessionId: 'session-stream',
        count: __quizStatsTest.MAX_SESSION_INTERACTIONS + 400,
      });
      const ctx = createInteractionsCtx('user_stream', interactions);

      // @ts-expect-error - Accessing private _handler for testing
      const stats = await getQuizInteractionStats._handler(ctx as any, {
        sessionId: 'session-stream',
      });

      expect(stats.totalInteractions).toBe(__quizStatsTest.MAX_SESSION_INTERACTIONS);
      expect(stats.isTruncated).toBe(true);
      expect(ctx.flags.collectCalled).toBe(false);
    });
  });

  describe('clerk deleteUser cleanup', () => {
    it('patches questions via paginated batches (1,200 docs)', async () => {
      const questions = generateQuestions({ userId: 'user_delete' as Id<'users'>, count: 1_200 });
      const ctx = createDeleteCtx(questions);

      // @ts-expect-error - Accessing private _handler for testing
      await deleteUser._handler(ctx as any, { clerkId: 'clerk_delete' });

      expect(ctx.db.patch).toHaveBeenCalledTimes(questions.length);
      expect(ctx.metrics.maxBatchRead).toBeLessThanOrEqual(200);
      expect(ctx.flags.collectCalled).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------
// Shared helpers

function createExprBuilder<T extends Record<string, unknown>>() {
  const predicates: Array<(doc: T) => boolean> = [];

  const builder = {
    eq(field: keyof T | string, value: unknown) {
      predicates.push((doc) => doc[field as keyof T] === value);
      return builder;
    },
    gt(field: keyof T | string, value: unknown) {
      predicates.push((doc) => (doc[field as keyof T] as number) > (value as number));
      return builder;
    },
    gte(field: keyof T | string, value: unknown) {
      predicates.push((doc) => (doc[field as keyof T] as number) >= (value as number));
      return builder;
    },
    lt(field: keyof T | string, value: unknown) {
      predicates.push((doc) => (doc[field as keyof T] as number) < (value as number));
      return builder;
    },
    lte(field: keyof T | string, value: unknown) {
      predicates.push((doc) => (doc[field as keyof T] as number) <= (value as number));
      return builder;
    },
    _getPredicate() {
      return (doc: T) => predicates.every((p) => p(doc));
    },
  };

  return builder;
}

class GenericQuery<T extends Record<string, unknown>> {
  private readonly tableName: string;
  private readonly rows: T[];
  private readonly metrics: MetricsRecorder;
  private readonly flags: { collectCalled: boolean };
  private predicates: Array<(doc: T) => boolean> = [];
  private orderDirection: 'asc' | 'desc' | null = null;

  constructor(
    tableName: string,
    rows: T[],
    metrics: MetricsRecorder,
    flags: { collectCalled: boolean }
  ) {
    this.tableName = tableName;
    this.rows = rows;
    this.metrics = metrics;
    this.flags = flags;
  }

  withIndex(
    _name: string,
    builder?: (
      expr: ReturnType<typeof createExprBuilder<T>>
    ) => ReturnType<typeof createExprBuilder<T>>
  ) {
    if (builder) {
      const exprBuilder = createExprBuilder<T>();
      builder(exprBuilder);
      this.predicates.push(exprBuilder._getPredicate());
    }
    return this;
  }

  filter(
    builder: (
      expr: ReturnType<typeof createExprBuilder<T>>
    ) => ReturnType<typeof createExprBuilder<T>>
  ) {
    const exprBuilder = createExprBuilder<T>();
    builder(exprBuilder);
    this.predicates.push(exprBuilder._getPredicate());
    return this;
  }

  order(direction: 'asc' | 'desc') {
    this.orderDirection = direction;
    return this;
  }

  async first() {
    const data = this.buildResult();
    return data[0] ?? null;
  }

  async take(limit: number) {
    const page = this.buildResult().slice(0, limit);
    this.metrics.record(this.tableName, page.length);
    return page;
  }

  async paginate({ numItems, cursor }: { numItems: number; cursor: string | null }) {
    const data = this.buildResult();
    const start = cursor ? parseInt(cursor, 10) : 0;
    const page = data.slice(start, start + numItems);
    this.metrics.record(this.tableName, page.length);
    const nextIndex = start + page.length;
    return {
      page,
      continueCursor: nextIndex < data.length ? String(nextIndex) : null,
      isDone: nextIndex >= data.length,
    };
  }

  collect() {
    this.flags.collectCalled = true;
    throw new Error('collect() should not be used in bandwidth regression scenarios');
  }

  private buildResult() {
    let result = [...this.rows];
    for (const predicate of this.predicates) {
      result = result.filter(predicate);
    }

    const key = this.orderDirection ? getSortKey(result[0]) : null;
    if (key) {
      result.sort((a, b) => ((a as any)[key] ?? 0) - ((b as any)[key] ?? 0));
      if (this.orderDirection === 'desc') {
        result.reverse();
      }
    }

    return result;
  }
}

function getSortKey(row: Record<string, unknown> | undefined) {
  if (!row) {
    return null;
  }
  if ('attemptedAt' in row) return 'attemptedAt';
  if ('generatedAt' in row) return 'generatedAt';
  if ('timestamp' in row) return 'timestamp';
  if ('createdAt' in row) return 'createdAt';
  if ('_creationTime' in row) return '_creationTime';
  return null;
}

// ---------------------------------------------------------------------
// User stats context

type MetricsRecorder = {
  userReads?: number;
  questionReads?: number;
  totalReads?: number;
  maxBatchRead?: number;
  record: (table: string, count: number) => void;
};

function createUserStatsCtx(users: Array<Doc<'users'>>, questions: Array<Doc<'questions'>>) {
  const flags = { collectCalled: false };
  const metrics: MetricsRecorder = {
    userReads: 0,
    questionReads: 0,
    record: (table, count) => {
      if (table === 'users') metrics.userReads! += count;
      if (table === 'questions') metrics.questionReads! += count;
    },
  };

  const db = {
    query: (table: string) => {
      if (table === 'users') {
        return new GenericQuery(table, users, wrapMetrics(metrics, flags), flags);
      }
      if (table === 'questions') {
        return new GenericQuery(table, questions, wrapMetrics(metrics, flags), flags);
      }
      if (table === 'userStats') {
        return new GenericQuery(table, [], wrapMetrics(metrics, flags), flags);
      }
      throw new Error(`Unknown table ${table}`);
    },
    insert: vi.fn(),
    patch: vi.fn(),
  };

  return {
    db,
    metrics: metrics as Required<Pick<MetricsRecorder, 'userReads' | 'questionReads'>>,
    flags,
  };
}

function wrapMetrics(metrics: MetricsRecorder, _flags: { collectCalled: boolean }) {
  return {
    record(table: string, count: number) {
      metrics.record(table, count);
    },
  } as MetricsRecorder & { record: (table: string, count: number) => void };
}

// ---------------------------------------------------------------------
// Rate limits

function createRateLimitCtx(entries: Array<Doc<'rateLimits'>>) {
  const flags = { collectCalled: false };
  const metrics: MetricsRecorder = {
    totalReads: 0,
    maxBatchRead: 0,
    record: (_table, count) => {
      metrics.totalReads! += count;
      metrics.maxBatchRead = Math.max(metrics.maxBatchRead!, count);
    },
  };

  const tables = {
    rateLimits: entries,
  };

  const db = {
    tables,
    query: (table: string) => {
      if (table !== 'rateLimits') throw new Error(`Unknown table ${table}`);
      return new GenericQuery(table, tables.rateLimits, wrapMetrics(metrics, flags), flags);
    },
    insert: (_table: string, doc: Doc<'rateLimits'>) => {
      tables.rateLimits.push(doc);
    },
    delete: (id: string) => {
      tables.rateLimits = tables.rateLimits.filter((row) => row._id !== id);
    },
  };

  return {
    db,
    metrics: metrics as Required<Pick<MetricsRecorder, 'totalReads' | 'maxBatchRead'>>,
    flags,
  };
}

// ---------------------------------------------------------------------
// Interactions

function createInteractionsCtx(userId: string, interactions: Array<Doc<'interactions'>>) {
  const flags = { collectCalled: false };
  const metrics: MetricsRecorder = {
    record: () => {},
  } as MetricsRecorder;

  const mockUser = {
    _id: userId as Id<'users'>,
    _creationTime: Date.now(),
    email: 'test@example.com',
    clerkId: 'clerk_test_user',
    createdAt: Date.now(),
  };

  const db = {
    query: (table: string) => {
      if (table === 'interactions') {
        return new GenericQuery(table, interactions, wrapMetrics(metrics, flags), flags);
      }
      if (table === 'users') {
        return new GenericQuery(table, [mockUser], wrapMetrics(metrics, flags), flags);
      }
      throw new Error(`Unknown table ${table}`);
    },
  };

  const auth = {
    getUserIdentity: vi.fn().mockResolvedValue({
      subject: 'clerk_test_user',
      email: 'test@example.com',
      name: 'Test User',
    }),
  };

  return { db, auth, flags };
}

// ---------------------------------------------------------------------
// Delete user

function createDeleteCtx(questions: Array<Doc<'questions'>>) {
  const flags = { collectCalled: false };
  const metrics: MetricsRecorder = {
    maxBatchRead: 0,
    record: (_table, count) => {
      metrics.maxBatchRead = Math.max(metrics.maxBatchRead!, count);
    },
  };

  const questionQuery = new GenericQuery(
    'questions',
    questions,
    wrapMetrics(metrics, flags),
    flags
  );

  const db = {
    metrics,
    patch: vi.fn().mockResolvedValue(undefined),
    query: (table: string) => {
      if (table === 'users') {
        return {
          withIndex: () => ({
            first: () => Promise.resolve({ _id: 'user_delete' }),
          }),
        };
      }
      if (table === 'questions') {
        return questionQuery;
      }
      throw new Error(`Unknown table ${table}`);
    },
  };

  return { db, metrics: metrics as Required<Pick<MetricsRecorder, 'maxBatchRead'>>, flags };
}
