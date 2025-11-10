import { describe, expect, it } from 'vitest';
import type { Doc, Id } from './_generated/dataModel';
import { calculateConceptStatsDelta, questionToConceptFsrsState } from './lib/conceptFsrsHelpers';

describe('Concept FSRS helper utilities', () => {
  it('converts question docs to concept FSRS state faithfully', () => {
    const question = {
      _id: 'q1' as Id<'questions'>,
      _creationTime: Date.now(),
      userId: 'user1' as Id<'users'>,
      question: 'What is ATP?',
      options: ['Energy', 'Enzyme'],
      correctAnswer: 'Energy',
      type: 'multiple-choice' as const,
      generatedAt: Date.now(),
      attemptCount: 3,
      correctCount: 2,
      stability: 4.5,
      fsrsDifficulty: 3.2,
      nextReview: 12345,
      elapsedDays: 1,
      scheduledDays: 2,
      reps: 5,
      lapses: 1,
      state: 'review' as const,
      lastReview: 12000,
    } satisfies Doc<'questions'>;

    const fsrsState = questionToConceptFsrsState(question, 99999);

    expect(fsrsState).toMatchObject({
      stability: 4.5,
      difficulty: 3.2,
      nextReview: 12345,
      elapsedDays: 1,
      scheduledDays: 2,
      reps: 5,
      lapses: 1,
      state: 'review',
      lastReview: 12000,
    });
  });

  it('calculates stats delta for due boundary transitions', () => {
    const now = Date.now();
    const delta = calculateConceptStatsDelta({
      oldState: 'learning',
      newState: 'review',
      oldNextReview: now - 1000,
      newNextReview: now + 60_000,
      nowMs: now,
    });

    expect(delta).toMatchObject({ learningCount: -1, matureCount: 1, dueNowCount: -1 });
  });

  it('adds due count when concept becomes immediately due', () => {
    const now = Date.now();
    const delta = calculateConceptStatsDelta({
      oldState: 'review',
      newState: 'relearning',
      oldNextReview: now + 60_000,
      newNextReview: now - 1,
      nowMs: now,
    });

    expect(delta).toMatchObject({ matureCount: -1, learningCount: 1, dueNowCount: 1 });
  });
});
