import type { Grade } from 'ts-fsrs';
import type { Doc } from '../_generated/dataModel';
import { ConceptFsrsState, ConceptState, defaultEngine, FsrsEngine } from './engine';

export interface ScheduleConceptOptions {
  now?: Date;
  engine?: FsrsEngine;
}

export interface ConceptSchedulingResult {
  fsrs: ConceptFsrsState;
  rating: Grade;
  nextReview: number;
  dueDate: Date;
  state: ConceptState;
  scheduledDays: number;
}

export function scheduleConceptReview(
  concept: Doc<'concepts'>,
  isCorrect: boolean,
  options: ScheduleConceptOptions = {}
): ConceptSchedulingResult {
  const engine = options.engine ?? defaultEngine;
  const now = options.now ?? new Date();
  const { state, rating } = engine.schedule({ state: concept.fsrs, isCorrect, now });

  return {
    fsrs: state,
    rating,
    nextReview: state.nextReview,
    dueDate: new Date(state.nextReview),
    state: state.state ?? 'new',
    scheduledDays: state.scheduledDays ?? 0,
  };
}

export function initializeConceptFsrs(
  now: Date = new Date(),
  engine: FsrsEngine = defaultEngine
): ConceptFsrsState {
  return engine.initializeState(now);
}

export function getConceptRetrievability(
  concept: Doc<'concepts'>,
  now?: Date,
  engine: FsrsEngine = defaultEngine
): number {
  return engine.getRetrievability(concept.fsrs, now);
}

export function isConceptDue(
  concept: Doc<'concepts'>,
  now?: Date,
  engine: FsrsEngine = defaultEngine
): boolean {
  return engine.isDue(concept.fsrs, now);
}
