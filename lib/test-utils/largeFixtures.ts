import type { Doc, Id } from '@/convex/_generated/dataModel';

const BASE_TIMESTAMP = 1_700_000_000_000;

export function generateUsers(count: number): Array<Doc<'users'>> {
  return Array.from({ length: count }, (_, i) => ({
    _id: `user_${i}` as Id<'users'>,
    _creationTime: BASE_TIMESTAMP + i,
    email: `user${i}@example.com`,
    createdAt: BASE_TIMESTAMP + i,
  }));
}

export function generateQuestions(params: {
  userId: Id<'users'>;
  count: number;
  includeDeleted?: boolean;
}): Array<Doc<'questions'>> {
  const { userId, count, includeDeleted = false } = params;
  return Array.from({ length: count }, (_, i) => ({
    _id: `question_${userId}_${i}` as Id<'questions'>,
    _creationTime: BASE_TIMESTAMP + i,
    userId,
    question: `Question ${i}?`,
    type: 'multiple-choice',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    generatedAt: BASE_TIMESTAMP + i,
    attemptCount: i % 5,
    correctCount: i % 3,
    state: ['new', 'learning', 'review'][i % 3] as Doc<'questions'>['state'],
    nextReview: BASE_TIMESTAMP + i * 1000,
    deletedAt: includeDeleted && i % 50 === 0 ? BASE_TIMESTAMP : undefined,
  }));
}

export function generateInteractions(params: {
  userId: Id<'users'>;
  sessionId: string;
  count: number;
  questionPoolSize?: number;
}): Array<Doc<'interactions'>> {
  const { userId, sessionId, count, questionPoolSize = 50 } = params;
  return Array.from({ length: count }, (_, i) => ({
    _id: `interaction_${sessionId}_${i}` as Id<'interactions'>,
    _creationTime: BASE_TIMESTAMP + i,
    userId,
    questionId: `question_${i % questionPoolSize}` as Id<'questions'>,
    userAnswer: 'A',
    isCorrect: i % 2 === 0,
    attemptedAt: BASE_TIMESTAMP + i,
    sessionId,
  }));
}

export function generateRateLimitEntries(params: {
  identifier: string;
  count: number;
  startTimestamp: number;
  intervalMs?: number;
  operation?: string;
}): Array<Doc<'rateLimits'>> {
  const { identifier, count, startTimestamp, intervalMs = 1, operation = 'default' } = params;
  return Array.from({ length: count }, (_, i) => ({
    _id: `rateLimit_${identifier}_${i}` as Id<'rateLimits'>,
    _creationTime: startTimestamp + i * intervalMs,
    identifier,
    operation,
    timestamp: startTimestamp + i * intervalMs,
    metadata: {},
  }));
}
