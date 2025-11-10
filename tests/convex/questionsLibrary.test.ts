import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireUserFromClerk } from '@/convex/clerk';
import { __quizStatsTest, getQuizInteractionStats } from '@/convex/questionsLibrary';

vi.mock('@/convex/clerk', () => ({
  requireUserFromClerk: vi.fn(),
}));

const mockRequireUserFromClerk = vi.mocked(requireUserFromClerk);

type InteractionRow = {
  _id: string;
  userId: string;
  sessionId?: string;
  questionId: string;
  isCorrect: boolean;
  attemptedAt: number;
};

describe('getQuizInteractionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUserFromClerk.mockResolvedValue({ _id: 'user_1' } as any);
  });

  it('aggregates stats for session using new index pagination', async () => {
    const interactions = createInteractions({
      count: 250,
      sessionId: 'session-a',
      userId: 'user_1',
    });
    const ctx = createMockCtx(interactions);

    // @ts-expect-error - Accessing private _handler for testing
    const result = await getQuizInteractionStats._handler(ctx as any, { sessionId: 'session-a' });

    expect(result.totalInteractions).toBe(250);
    expect(result.correctInteractions).toBe(125);
    expect(result.uniqueQuestions).toBe(50);
    expect(result.isTruncated).toBe(false);
  });

  it('caps stats at MAX_SESSION_INTERACTIONS and reports truncation', async () => {
    const limit = __quizStatsTest.MAX_SESSION_INTERACTIONS;
    const interactions = createInteractions({
      count: limit + 200,
      sessionId: 'session-cap',
      userId: 'user_1',
    });
    const ctx = createMockCtx(interactions);

    // @ts-expect-error - Accessing private _handler for testing
    const result = await getQuizInteractionStats._handler(ctx as any, { sessionId: 'session-cap' });

    expect(result.totalInteractions).toBe(limit);
    expect(result.isTruncated).toBe(true);
    expect(result.correctInteractions).toBe(closeHalf(limit));
  });
});

function closeHalf(n: number) {
  return Math.floor(n / 2);
}

function createInteractions(params: {
  count: number;
  sessionId: string;
  userId: string;
}): InteractionRow[] {
  const { count, sessionId, userId } = params;
  return Array.from({ length: count }, (_, i) => ({
    _id: `interaction_${i}`,
    userId,
    sessionId,
    questionId: `question_${i % 50}`,
    isCorrect: i % 2 === 0,
    attemptedAt: i,
  }));
}

function createMockCtx(interactions: InteractionRow[]) {
  return {
    db: new MockDb(interactions),
  };
}

class MockDb {
  private readonly interactions: InteractionRow[];

  constructor(interactions: InteractionRow[]) {
    this.interactions = interactions;
  }

  query(table: string) {
    if (table !== 'interactions') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return new MockQuery(this.interactions);
  }
}

type Predicate = (row: InteractionRow) => boolean;

type OrderDirection = 'asc' | 'desc' | null;

class MockQuery {
  private readonly rows: InteractionRow[];
  private readonly predicates: Predicate[];
  private readonly orderDirection: OrderDirection;

  constructor(
    rows: InteractionRow[],
    predicates: Predicate[] = [],
    orderDirection: OrderDirection = null
  ) {
    this.rows = rows;
    this.predicates = predicates;
    this.orderDirection = orderDirection;
  }

  withIndex(_name: string, builder?: (helpers: IndexBuilder) => unknown) {
    if (!builder) {
      return new MockQuery(this.rows, [...this.predicates], this.orderDirection);
    }

    const indexBuilder = new IndexBuilder();
    builder(indexBuilder);
    return new MockQuery(
      this.rows,
      [...this.predicates, indexBuilder.build()],
      this.orderDirection
    );
  }

  order(direction: 'asc' | 'desc') {
    return new MockQuery(this.rows, [...this.predicates], direction);
  }

  async paginate({ numItems, cursor }: { numItems: number; cursor: string | null }) {
    const data = this.buildResult();
    const start = cursor ? JSON.parse(cursor).index : 0;
    const page = data.slice(start, start + numItems);
    const nextIndex = start + page.length;
    return {
      page,
      continueCursor: nextIndex < data.length ? JSON.stringify({ index: nextIndex }) : null,
      isDone: nextIndex >= data.length,
    };
  }

  private buildResult() {
    let result = [...this.rows];
    for (const predicate of this.predicates) {
      result = result.filter(predicate);
    }
    result.sort((a, b) => a.attemptedAt - b.attemptedAt);
    if (this.orderDirection === 'desc') {
      result.reverse();
    }
    return result;
  }
}

class IndexBuilder {
  private readonly conditions: Predicate[] = [];

  eq(field: keyof InteractionRow, value: unknown) {
    this.conditions.push((row) => row[field] === value);
    return this;
  }

  build(): Predicate {
    return (row) => this.conditions.every((condition) => condition(row));
  }
}
