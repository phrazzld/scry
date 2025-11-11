import { describe, expect, it, vi } from 'vitest';
import type { Doc, Id } from './_generated/dataModel';
import { initializeConceptFsrs } from './fsrs';
import { buildProposalKey, computeTitleSimilarity, shouldConsiderMerge } from './iqc';
import { DEFAULT_REPLAY_LIMIT, replayInteractionsIntoState } from './lib/fsrsReplay';
import { logConceptEvent, type ConceptsLogger } from './lib/logger';

describe('IQC helpers', () => {
  describe('buildProposalKey', () => {
    it('produces stable key regardless of order', () => {
      const keyA = buildProposalKey('1' as any, '2' as any);
      const keyB = buildProposalKey('2' as any, '1' as any);

      expect(keyA).toBe(keyB);
      expect(keyA).toBe('1::2');
    });
  });

  describe('computeTitleSimilarity', () => {
    it('returns 1.0 for identical titles ignoring case/punctuation', () => {
      const similarity = computeTitleSimilarity('Grace & Nature', 'grace nature!!');
      expect(similarity).toBeCloseTo(1);
    });

    it('returns 0 when tokens do not overlap', () => {
      const similarity = computeTitleSimilarity('Eucharistic theology', 'Quantum entanglement');
      expect(similarity).toBe(0);
    });
  });

  describe('shouldConsiderMerge', () => {
    it('accepts very high vector score even with modest title overlap', () => {
      const result = shouldConsiderMerge(0.98, 0.2, 5, 4);
      expect(result).toBe(true);
    });

    it('rejects low similarity even if phrasing counts small', () => {
      const result = shouldConsiderMerge(0.85, 0.4, 2, 1);
      expect(result).toBe(false);
    });

    it('accepts thin concepts when both heuristics moderately high', () => {
      const result = shouldConsiderMerge(0.945, 0.55, 1, 1);
      expect(result).toBe(true);
    });
  });

  describe('replayInteractionsIntoState', () => {
    const baseConcept = (): Doc<'concepts'> => ({
      _id: 'concept1' as Id<'concepts'>,
      _creationTime: Date.now(),
      userId: 'user1' as Id<'users'>,
      title: 'Concept',
      description: undefined,
      fsrs: initializeConceptFsrs(new Date('2024-01-01')),
      phrasingCount: 1,
      conflictScore: undefined,
      thinScore: undefined,
      qualityScore: undefined,
      embedding: undefined,
      embeddingGeneratedAt: undefined,
      createdAt: Date.now(),
      updatedAt: undefined,
      generationJobId: undefined,
      canonicalPhrasingId: undefined,
    });

    const makeInteraction = (
      attemptedAt: number,
      isCorrect: boolean,
      idSuffix: string
    ): Doc<'interactions'> => ({
      _id: `interaction-${idSuffix}` as Id<'interactions'>,
      _creationTime: attemptedAt,
      userId: 'user1' as Id<'users'>,
      conceptId: 'concept2' as Id<'concepts'>,
      questionId: undefined,
      phrasingId: undefined,
      userAnswer: isCorrect ? 'correct' : 'incorrect',
      isCorrect,
      attemptedAt,
      timeSpent: undefined,
      context: undefined,
    });

    it('applies interactions in chronological order', () => {
      const concept = baseConcept();
      const interactions = [
        makeInteraction(Date.parse('2024-01-02'), false, 'b'),
        makeInteraction(Date.parse('2024-01-03'), true, 'c'),
        makeInteraction(Date.parse('2024-01-01'), true, 'a'),
      ];

      const result = replayInteractionsIntoState(concept, interactions);
      expect(result.applied).toBe(interactions.length);
      expect(result.fsrs.lastReview).toBeGreaterThan(concept.fsrs.lastReview ?? 0);
    });

    it('respects replay limit', () => {
      const concept = baseConcept();
      const interactions = Array.from({ length: DEFAULT_REPLAY_LIMIT + 5 }).map((_, idx) =>
        makeInteraction(Date.now() + idx * 1000, true, String(idx))
      );

      const result = replayInteractionsIntoState(concept, interactions, { limit: 5 });
      expect(result.applied).toBe(5);
    });
  });
});

describe('IQC logging', () => {
  it('includes action card metadata in apply logs', () => {
    const infoSpy = vi.fn();
    const stubLogger: ConceptsLogger = {
      info: infoSpy,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    logConceptEvent(stubLogger, 'info', 'IQC merge apply completed', {
      phase: 'iqc_apply',
      event: 'completed',
      correlationId: 'corr-iqc-apply',
      actionCardId: 'card_123',
      conceptIds: ['concept_a', 'concept_b'],
      movedPhrasings: 4,
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [message, context] = infoSpy.mock.calls[0];
    expect(message).toBe('IQC merge apply completed');
    expect(context?.event).toBe('concepts.iqc_apply.completed');
    expect(context?.actionCardId).toBe('card_123');
    expect(context?.conceptIds).toEqual(['concept_a', 'concept_b']);
    expect(context?.correlationId).toBe('corr-iqc-apply');
  });
});
