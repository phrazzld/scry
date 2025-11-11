import { Card, createEmptyCard, FSRS, generatorParameters, Grade, Rating, State } from 'ts-fsrs';
import type { Doc } from '../_generated/dataModel';

export type ConceptDoc = Doc<'concepts'>;
export type ConceptFsrsState = ConceptDoc['fsrs'];
export type ConceptState = NonNullable<ConceptFsrsState['state']>;

const DEFAULT_PARAMS = generatorParameters({
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
});

export interface ScheduleArgs {
  state?: ConceptFsrsState | null;
  isCorrect: boolean;
  now?: Date;
}

export interface ScheduleResult {
  state: ConceptFsrsState;
  card: Card;
  rating: Grade;
}

export class FsrsEngine {
  private readonly fsrs: FSRS;

  constructor() {
    this.fsrs = new FSRS(DEFAULT_PARAMS);
  }

  initializeState(now: Date = new Date()): ConceptFsrsState {
    const card = createEmptyCard(now);
    return this.cardToState(card);
  }

  schedule({ state, isCorrect, now = new Date() }: ScheduleArgs): ScheduleResult {
    const rating = this.ratingFromCorrectness(isCorrect);
    const currentCard = this.stateToCard(state, now);
    const { card: updatedCard } = this.fsrs.next(currentCard, now, rating);
    const nextState = this.cardToState(updatedCard);

    nextState.retrievability = this.fsrs.get_retrievability(updatedCard, now, false) as number;

    return {
      state: nextState,
      card: updatedCard,
      rating,
    };
  }

  getRetrievability(state?: ConceptFsrsState | null, now: Date = new Date()): number {
    if (!state || state.nextReview === undefined) {
      return -1;
    }

    // New concepts (no reps yet) are always highest priority
    if (!state.state || state.state === 'new' || (state.reps ?? 0) === 0) {
      return -1;
    }

    const card = this.stateToCard(state, now);
    return this.fsrs.get_retrievability(card, now, false) as number;
  }

  isDue(state?: ConceptFsrsState | null, now: Date = new Date()): boolean {
    if (!state || state.nextReview === undefined) {
      return true;
    }

    return state.nextReview <= now.getTime();
  }

  private ratingFromCorrectness(isCorrect: boolean): Grade {
    return isCorrect ? Rating.Good : Rating.Again;
  }

  private stateToCard(state?: ConceptFsrsState | null, now: Date = new Date()): Card {
    if (!state || state.nextReview === undefined) {
      return createEmptyCard(now);
    }

    const dbState: ConceptState = state.state ?? 'new';

    return {
      due: new Date(state.nextReview),
      stability: state.stability ?? 0,
      difficulty: state.difficulty ?? 0,
      elapsed_days: state.elapsedDays ?? 0,
      scheduled_days: state.scheduledDays ?? 0,
      reps: state.reps ?? 0,
      lapses: state.lapses ?? 0,
      state: this.mapDbStateToFsrs(dbState),
      last_review: state.lastReview ? new Date(state.lastReview) : undefined,
      learning_steps: 0,
    };
  }

  private cardToState(card: Card): ConceptFsrsState {
    return {
      stability: card.stability,
      difficulty: card.difficulty,
      lastReview: card.last_review?.getTime(),
      nextReview: card.due.getTime(),
      elapsedDays: card.elapsed_days,
      retrievability: undefined,
      scheduledDays: card.scheduled_days,
      reps: card.reps,
      lapses: card.lapses,
      state: this.mapFsrsStateToDb(card.state),
    };
  }

  private mapDbStateToFsrs(state: ConceptState): State {
    switch (state) {
      case 'new':
        return State.New;
      case 'learning':
        return State.Learning;
      case 'review':
        return State.Review;
      case 'relearning':
        return State.Relearning;
      default:
        return State.New;
    }
  }

  private mapFsrsStateToDb(state: State): ConceptState {
    switch (state) {
      case State.New:
        return 'new';
      case State.Learning:
        return 'learning';
      case State.Review:
        return 'review';
      case State.Relearning:
        return 'relearning';
      default:
        return 'new';
    }
  }
}

export const defaultEngine = new FsrsEngine();
