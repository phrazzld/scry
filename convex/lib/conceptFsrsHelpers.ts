import type { Doc } from '../_generated/dataModel';
import type { ConceptFsrsState, ConceptState } from '../fsrs';
import { calculateStateTransitionDelta, type StatDeltas } from './userStatsHelpers';

export function questionToConceptFsrsState(
  question: Doc<'questions'>,
  fallbackTimestamp: number
): ConceptFsrsState {
  return {
    stability: question.stability ?? 0,
    difficulty: question.fsrsDifficulty ?? 5,
    lastReview: question.lastReview,
    nextReview: question.nextReview ?? fallbackTimestamp,
    elapsedDays: question.elapsedDays,
    retrievability: undefined,
    scheduledDays: question.scheduledDays,
    reps: question.reps ?? 0,
    lapses: question.lapses ?? 0,
    state: question.state ?? 'new',
  };
}

interface StatsDeltaArgs {
  oldState: ConceptState;
  newState?: ConceptState;
  oldNextReview?: number;
  newNextReview?: number;
  nowMs: number;
}

export function calculateConceptStatsDelta({
  oldState,
  newState,
  oldNextReview,
  newNextReview,
  nowMs,
}: StatsDeltaArgs): StatDeltas | null {
  const deltas = calculateStateTransitionDelta(oldState, newState) ?? {};
  const result: StatDeltas = { ...deltas };

  if (oldNextReview !== undefined && newNextReview !== undefined) {
    const wasDue = oldNextReview <= nowMs;
    const isDueNow = newNextReview <= nowMs;

    if (wasDue && !isDueNow) {
      result.dueNowCount = (result.dueNowCount ?? 0) - 1;
    } else if (!wasDue && isDueNow) {
      result.dueNowCount = (result.dueNowCount ?? 0) + 1;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
