import type { Doc } from '../_generated/dataModel';
import {
  defaultEngine,
  type ConceptDoc,
  type ConceptFsrsState,
  type FsrsEngine,
} from '../fsrs/engine';

export type InteractionDoc = Doc<'interactions'>;

export interface ReplayOptions {
  limit?: number;
  engine?: FsrsEngine;
}

export interface ReplayResult {
  fsrs: ConceptFsrsState;
  applied: number;
}

export const DEFAULT_REPLAY_LIMIT = 50;

/**
 * Replays interaction outcomes into a concept's FSRS state.
 *
 * Applies interactions in chronological order, optionally bounded by a limit.
 */
export function replayInteractionsIntoState(
  concept: ConceptDoc,
  interactions: InteractionDoc[],
  options: ReplayOptions = {}
): ReplayResult {
  const limit = options.limit ?? DEFAULT_REPLAY_LIMIT;
  const engine = options.engine ?? defaultEngine;

  if (interactions.length === 0 || limit <= 0) {
    return {
      fsrs: concept.fsrs,
      applied: 0,
    };
  }

  const chronological = [...interactions]
    .sort((a, b) => a.attemptedAt - b.attemptedAt)
    .slice(-limit);

  let currentState: ConceptFsrsState = concept.fsrs;
  let applied = 0;

  for (const interaction of chronological) {
    const result = engine.schedule({
      state: currentState,
      isCorrect: interaction.isCorrect,
      now: new Date(interaction.attemptedAt),
    });
    currentState = result.state;
    applied += 1;
  }

  return {
    fsrs: currentState,
    applied,
  };
}
