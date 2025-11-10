import { describe, expect, it } from 'vitest';
import type { Doc, Id } from './_generated/dataModel';
import { __test, reconcileUserStats } from './userStats';

const { sampleUsersForReconciliation, QUESTION_BATCH_SIZE } = __test;

describe('userStats reconciliation helpers', () => {
  it('samples bounded number of users from large dataset', async () => {
    const users = createUsers(10_000);
    const ctx = createMockCtx({ users });

    const sampleSize = 100;
    const sampled = await sampleUsersForReconciliation(ctx as any, sampleSize, () => 0.42);

    expect(sampled).toHaveLength(sampleSize);
    expect(ctx.metrics.reads.users ?? 0).toBeLessThanOrEqual(sampleSize * 2);
  });

  it('reconciles stats by scanning questions in batches', async () => {
    const userId = 'user_1' as Id<'users'>;
    const users = [createUser('user_1', 0)];
    const questions = createQuestions(userId, 1_200);
    const userStats: Array<Doc<'userStats'>> = [
      {
        _id: 'stats_user_1' as Id<'userStats'>,
        _creationTime: Date.now(),
        userId,
        totalCards: 0,
        newCount: 0,
        learningCount: 0,
        matureCount: 0,
        dueNowCount: 0,
        nextReviewTime: undefined,
        lastCalculated: Date.now(),
      },
    ];

    const ctx = createMockCtx({ users, questions, userStats });

    // @ts-expect-error - Accessing private _handler for testing
    const result = await reconcileUserStats._handler(ctx as any, {
      sampleSize: 1,
      driftThreshold: 0,
    });

    expect(result.stats.usersChecked).toBe(1);
    const maxReads = Math.ceil(1_200 / QUESTION_BATCH_SIZE) * QUESTION_BATCH_SIZE;
    expect(ctx.metrics.reads.questions ?? 0).toBeLessThanOrEqual(maxReads);

    const updatedStats = ctx.tables.userStats[0];
    const expectedStats = summarizeQuestions(questions);
    expect(updatedStats.totalCards).toBe(expectedStats.totalCards);
    expect(updatedStats.newCount).toBe(expectedStats.newCount);
    expect(updatedStats.learningCount).toBe(expectedStats.learningCount);
    expect(updatedStats.matureCount).toBe(expectedStats.matureCount);
    expect(updatedStats.nextReviewTime).toBe(expectedStats.nextReviewTime);
  });
});

type TableSeed = {
  users?: Array<Doc<'users'>>;
  questions?: Array<Doc<'questions'>>;
  userStats?: Array<Doc<'userStats'>>;
};

type Metrics = {
  reads: Record<string, number>;
};

function createMockCtx(seed: TableSeed) {
  const db = new MockDb(seed);
  return {
    db,
    metrics: db.metrics,
    tables: db.tables,
  };
}

class MockDb {
  tables: Required<TableSeed>;
  metrics: Metrics;

  constructor(seed: TableSeed) {
    this.tables = {
      users: seed.users ? [...seed.users] : [],
      questions: seed.questions ? [...seed.questions] : [],
      userStats: seed.userStats ? [...seed.userStats] : [],
    };
    this.metrics = { reads: {} };
  }

  query<TTable extends keyof TableSeed>(table: TTable | string) {
    const rows = (this.tables as Record<string, Array<Record<string, unknown>>>)[table] || [];
    return new MockQuery(table as string, rows, this.metrics);
  }

  async patch(id: string, update: Record<string, unknown>) {
    const doc = this.findDocById(id);
    if (!doc) {
      throw new Error(`Doc ${id} not found`);
    }
    Object.assign(doc, update);
  }

  async insert(table: string, doc: Record<string, unknown>) {
    const rows = (this.tables as Record<string, Array<Record<string, unknown>>>)[table];
    if (!rows) {
      throw new Error(`Unknown table: ${table}`);
    }
    const newDoc = {
      _id: doc._id ?? `${table}_${rows.length + 1}`,
      ...(doc as Record<string, unknown>),
    };
    rows.push(newDoc);
    return newDoc._id as string;
  }

  private findDocById(id: string) {
    for (const rows of Object.values(this.tables) as Array<Array<Record<string, unknown>>>) {
      const match = rows.find((row) => row._id === id);
      if (match) {
        return match;
      }
    }
    return null;
  }
}

type Expr<T> = (doc: T) => unknown;

type QueryOptions<T> = {
  indexName?: string;
  indexExprs?: Array<Expr<T>>;
  filterExprs?: Array<Expr<T>>;
  orderDirection?: 'asc' | 'desc';
};

class MockQuery<T extends Record<string, unknown>> {
  private readonly table: string;
  private readonly rows: Array<T>;
  private readonly metrics: Metrics;
  private readonly options: QueryOptions<T>;

  constructor(table: string, rows: Array<T>, metrics: Metrics, options?: QueryOptions<T>) {
    this.table = table;
    this.rows = rows;
    this.metrics = metrics;
    this.options = options ?? {};
  }

  withIndex(name: string, builder?: (q: ReturnType<typeof createExprBuilder<T>>) => Expr<T>) {
    const exprs = [...(this.options.indexExprs ?? [])];
    if (builder) {
      const expr = builder(createExprBuilder());
      exprs.push(expr);
    }
    return new MockQuery(this.table, this.rows, this.metrics, {
      ...this.options,
      indexName: name,
      indexExprs: exprs,
    });
  }

  filter(builder: (q: ReturnType<typeof createExprBuilder<T>>) => Expr<T>) {
    const expr = builder(createExprBuilder());
    const filterExprs = [...(this.options.filterExprs ?? []), expr];
    return new MockQuery(this.table, this.rows, this.metrics, {
      ...this.options,
      filterExprs,
    });
  }

  order(direction: 'asc' | 'desc') {
    return new MockQuery(this.table, this.rows, this.metrics, {
      ...this.options,
      orderDirection: direction,
    });
  }

  async first() {
    const data = this.buildResult();
    return data[0] ?? null;
  }

  async take(limit: number) {
    const data = this.buildResult();
    const page = data.slice(0, limit);
    this.addRead(page.length);
    return page;
  }

  async paginate({ numItems, cursor }: { numItems: number; cursor: string | null }) {
    const data = this.buildResult();
    const start = cursor ? JSON.parse(cursor).index : 0;
    const page = data.slice(start, start + numItems);
    this.addRead(page.length);
    const nextIndex = start + page.length;
    return {
      page,
      continueCursor: nextIndex < data.length ? JSON.stringify({ index: nextIndex }) : null,
      isDone: nextIndex >= data.length,
    };
  }

  private addRead(count: number) {
    this.metrics.reads[this.table] = (this.metrics.reads[this.table] || 0) + count;
  }

  private buildResult() {
    let result = [...this.rows];

    for (const expr of this.options.indexExprs ?? []) {
      result = result.filter((doc) => Boolean(expr(doc)));
    }

    for (const expr of this.options.filterExprs ?? []) {
      result = result.filter((doc) => Boolean(expr(doc)));
    }

    if (this.options.orderDirection) {
      const comparator = getComparator(this.options.indexName);
      result.sort((a, b) => comparator(a, b));
      if (this.options.orderDirection === 'desc') {
        result.reverse();
      }
    }

    return result;
  }
}

function createExprBuilder<T extends Record<string, unknown>>() {
  const resolve = (operand: unknown, doc: T) => {
    if (typeof operand === 'function') {
      return (operand as Expr<T>)(doc);
    }
    if (typeof operand === 'string' && operand in doc) {
      return doc[operand];
    }
    return operand;
  };

  const builder = {
    field: (name: keyof T | string) => (doc: T) => doc[name as keyof T],
    eq: (a: unknown, b: unknown) => (doc: T) => resolve(a, doc) === resolve(b, doc),
    neq: (a: unknown, b: unknown) => (doc: T) => resolve(a, doc) !== resolve(b, doc),
    lt: (a: unknown, b: unknown) => (doc: T) =>
      (resolve(a, doc) as number) < (resolve(b, doc) as number),
    lte: (a: unknown, b: unknown) => (doc: T) =>
      (resolve(a, doc) as number) <= (resolve(b, doc) as number),
    gt: (a: unknown, b: unknown) => (doc: T) =>
      (resolve(a, doc) as number) > (resolve(b, doc) as number),
    gte: (a: unknown, b: unknown) => (doc: T) =>
      (resolve(a, doc) as number) >= (resolve(b, doc) as number),
    and:
      (...exprs: Array<(doc: T) => boolean>) =>
      (doc: T) =>
        exprs.every((expr) => expr(doc)),
  } as const;

  return builder;
}

function getComparator<T extends Record<string, unknown>>(indexName?: string) {
  if (indexName === 'by_creation_time') {
    return (a: T, b: T) => (getTimestamp(a) ?? 0) - (getTimestamp(b) ?? 0);
  }
  if (indexName === 'by_user') {
    return (a: T, b: T) => ((a as any).generatedAt ?? 0) - ((b as any).generatedAt ?? 0);
  }
  return (a: T, b: T) => ((a as any)._creationTime ?? 0) - ((b as any)._creationTime ?? 0);
}

function getTimestamp(doc: Record<string, unknown>) {
  return (doc.createdAt as number | undefined) ?? (doc._creationTime as number | undefined);
}

function createUser(id: string, offset: number): Doc<'users'> {
  return {
    _id: id as Id<'users'>,
    _creationTime: offset,
    email: `${id}@example.com`,
    createdAt: offset,
  } as Doc<'users'>;
}

function createUsers(count: number): Array<Doc<'users'>> {
  return Array.from({ length: count }, (_, i) => createUser(`user_${i}`, i));
}

function createQuestions(userId: Id<'users'>, count: number): Array<Doc<'questions'>> {
  return Array.from({ length: count }, (_, i) => {
    const stateCycle: Array<'new' | 'learning' | 'review'> = ['new', 'learning', 'review'];
    const state = stateCycle[i % stateCycle.length];
    const deletedAt = i % 50 === 0 ? Date.now() : undefined;
    return {
      _id: `question_${i}` as Id<'questions'>,
      _creationTime: Date.now() + i,
      userId,
      question: `Question ${i}`,
      type: 'multiple-choice',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      generatedAt: Date.now() + i,
      attemptCount: 0,
      correctCount: 0,
      state,
      nextReview: Date.now() + i * 1000,
      deletedAt,
    } as Doc<'questions'>;
  });
}

function summarizeQuestions(questions: Array<Doc<'questions'>>) {
  let newCount = 0;
  let learningCount = 0;
  let matureCount = 0;
  let nextReviewTime: number | undefined = undefined;
  let total = 0;

  for (const question of questions) {
    if (question.deletedAt) {
      continue;
    }

    total++;

    if (!question.state || question.state === 'new') {
      newCount++;
    } else if (question.state === 'learning' || question.state === 'relearning') {
      learningCount++;
    } else if (question.state === 'review') {
      matureCount++;
    }

    if (question.nextReview) {
      if (!nextReviewTime || question.nextReview < nextReviewTime) {
        nextReviewTime = question.nextReview;
      }
    }
  }

  return { totalCards: total, newCount, learningCount, matureCount, nextReviewTime };
}
