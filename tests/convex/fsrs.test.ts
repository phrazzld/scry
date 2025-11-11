import { describe, expect, it } from 'vitest';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import {
  FsrsEngine,
  getConceptRetrievability,
  initializeConceptFsrs,
  isConceptDue,
  scheduleConceptReview,
  selectPhrasingForConcept,
} from '../../convex/fsrs';

const engine = new FsrsEngine();
const fixedNow = new Date('2025-01-16T12:00:00Z');

function createConcept(overrides: Partial<Doc<'concepts'>> = {}): Doc<'concepts'> {
  return {
    _id: (overrides._id ?? 'concept_1') as Id<'concepts'>,
    _creationTime: overrides._creationTime ?? Date.now(),
    userId: (overrides.userId ?? 'user_1') as Id<'users'>,
    title: overrides.title ?? 'Concept Title',
    description: overrides.description,
    fsrs: overrides.fsrs ?? initializeConceptFsrs(fixedNow),
    phrasingCount: overrides.phrasingCount ?? 1,
    createdAt: overrides.createdAt ?? fixedNow.getTime(),
    updatedAt: overrides.updatedAt,
    conflictScore: overrides.conflictScore,
    thinScore: overrides.thinScore,
    qualityScore: overrides.qualityScore,
    embedding: overrides.embedding,
    embeddingGeneratedAt: overrides.embeddingGeneratedAt,
  };
}

function createPhrasing(overrides: Partial<Doc<'phrasings'>> = {}): Doc<'phrasings'> {
  return {
    _id: (overrides._id ?? Math.random().toString()) as Id<'phrasings'>,
    _creationTime: overrides._creationTime ?? Date.now(),
    userId: (overrides.userId ?? 'user_1') as Id<'users'>,
    conceptId: (overrides.conceptId ?? 'concept_1') as Id<'concepts'>,
    question: overrides.question ?? 'Question text',
    explanation: overrides.explanation,
    type: overrides.type,
    options: overrides.options,
    correctAnswer: overrides.correctAnswer,
    attemptCount: overrides.attemptCount,
    correctCount: overrides.correctCount,
    lastAttemptedAt: overrides.lastAttemptedAt,
    createdAt: overrides.createdAt ?? fixedNow.getTime(),
    updatedAt: overrides.updatedAt,
    archivedAt: overrides.archivedAt,
    deletedAt: overrides.deletedAt,
    embedding: overrides.embedding,
    embeddingGeneratedAt: overrides.embeddingGeneratedAt,
  };
}

describe('FsrsEngine', () => {
  it('initializes new state with next review set to current time', () => {
    const state = engine.initializeState(fixedNow);
    expect(state.nextReview).toBe(fixedNow.getTime());
    expect(state.state).toBe('new');
    expect(state.reps).toBe(0);
  });

  it('schedules longer interval after correct answer', () => {
    const initialState = engine.initializeState(fixedNow);
    const correct = engine.schedule({ state: initialState, isCorrect: true, now: fixedNow });
    const incorrect = engine.schedule({ state: initialState, isCorrect: false, now: fixedNow });

    expect(correct.state.nextReview).toBeGreaterThan(incorrect.state.nextReview);
    expect(correct.state.state).not.toBe('new');
  });

  it('marks concept due when nextReview is in the past', () => {
    const concept = createConcept({
      fsrs: {
        ...engine.initializeState(fixedNow),
        nextReview: fixedNow.getTime() - 60_000,
      },
    });

    expect(isConceptDue(concept, fixedNow)).toBe(true);
  });
});

describe('conceptScheduler', () => {
  it('updates concept FSRS state via scheduleConceptReview', () => {
    const concept = createConcept();
    const result = scheduleConceptReview(concept, true, { now: fixedNow, engine });

    expect(result.state).toBe('learning');
    expect(result.nextReview).toBe(result.fsrs.nextReview);
    expect(result.fsrs.reps).toBeGreaterThan(0);
  });

  it('supports incorrect answers transitioning to relearning', () => {
    let concept = createConcept();

    // Graduate concept with a few correct answers
    for (let i = 0; i < 3; i++) {
      const result = scheduleConceptReview(concept, true, { now: fixedNow, engine });
      concept = { ...concept, fsrs: result.fsrs };
    }

    const relapse = scheduleConceptReview(concept, false, { now: fixedNow, engine });
    expect(relapse.state).toBe('relearning');
    expect(relapse.fsrs.lapses).toBeGreaterThanOrEqual(1);
  });

  it('computes retrievability scores for matured concepts', () => {
    let concept = createConcept();

    // Answer correctly multiple times to reach review state
    for (let i = 0; i < 5; i++) {
      const result = scheduleConceptReview(concept, true, {
        now: new Date(fixedNow.getTime() + i * 3_600_000),
        engine,
      });
      concept = { ...concept, fsrs: result.fsrs };
    }

    const retrievability = getConceptRetrievability(concept, fixedNow, engine);
    expect(retrievability).toBeGreaterThanOrEqual(0);
    expect(retrievability).toBeLessThanOrEqual(1);
  });
});

describe('selectionPolicy', () => {
  const conceptId = 'concept_select' as Id<'concepts'>;

  it('prefers canonical phrasing when available', () => {
    const canonicalId = 'canonical' as Id<'phrasings'>;
    const phrasings = [
      createPhrasing({ _id: canonicalId, conceptId, attemptCount: 5 }),
      createPhrasing({ _id: 'other' as Id<'phrasings'>, conceptId, attemptCount: 0 }),
    ];

    const decision = selectPhrasingForConcept(phrasings, { canonicalPhrasingId: canonicalId });
    expect(decision.reason).toBe('canonical');
    expect(decision.phrasing?._id).toBe(canonicalId);
  });

  it('falls back to least-seen phrasing when canonical missing', () => {
    const phrasings = [
      createPhrasing({ _id: 'a' as Id<'phrasings'>, conceptId, attemptCount: 10 }),
      createPhrasing({ _id: 'b' as Id<'phrasings'>, conceptId, attemptCount: 1 }),
      createPhrasing({ _id: 'c' as Id<'phrasings'>, conceptId, attemptCount: 0 }),
    ];

    const decision = selectPhrasingForConcept(phrasings);
    expect(decision.reason).toBe('least-seen');
    expect(decision.phrasing?._id).toBe('c');
  });

  it('uses random strategy as final fallback', () => {
    const phrasings = [
      createPhrasing({ _id: 'x' as Id<'phrasings'>, conceptId, attemptCount: 2 }),
      createPhrasing({ _id: 'y' as Id<'phrasings'>, conceptId, attemptCount: 2 }),
    ];

    const decision = selectPhrasingForConcept(phrasings, {
      preferLeastSeen: false,
      random: () => 0.75,
    });

    expect(decision.reason).toBe('random');
    expect(decision.phrasing?._id).toBe('y');
  });
});
