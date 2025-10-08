/**
 * Scheduling abstraction for spaced repetition algorithms
 *
 * This module decouples question logic from specific scheduling implementations
 * (FSRS, SM-2, Leitner, etc.) through the IScheduler interface. This enables:
 * - Algorithm experimentation without touching question code
 * - Testability via dependency injection
 * - Clear separation of concerns (questions vs. scheduling)
 *
 * @module scheduling
 */

import { Card, createEmptyCard, FSRS, generatorParameters, Grade, Rating, State } from 'ts-fsrs';

import { Doc } from './_generated/dataModel';

/**
 * Scheduling result returned by all scheduler implementations
 *
 * This interface hides the specifics of the underlying algorithm
 * and provides only the fields needed to update question documents.
 */
export interface SchedulingResult {
  /** Database fields to patch on the question document */
  dbFields: Partial<Doc<'questions'>>;
  /** When the question should be reviewed next */
  nextReviewDate: Date;
  /** Days until next review (for display) */
  scheduledDays: number;
  /** Card state after this review */
  newState: 'new' | 'learning' | 'review' | 'relearning';
}

/**
 * Scheduler interface for spaced repetition algorithms
 *
 * Any spaced repetition algorithm can be used by implementing this interface.
 * Questions don't need to know which algorithm is being used - they just call
 * the scheduler methods through dependency injection.
 */
export interface IScheduler {
  /**
   * Initialize a new card for a question that has never been reviewed
   *
   * @returns Initial scheduler state for a new question
   */
  initializeCard(): Partial<Doc<'questions'>>;

  /**
   * Calculate next review time based on answer correctness
   *
   * @param question - Question document from database
   * @param isCorrect - Whether user answered correctly
   * @param now - Current timestamp for scheduling calculation
   * @returns Scheduling result with next review time and updated fields
   */
  scheduleNextReview(question: Doc<'questions'>, isCorrect: boolean, now: Date): SchedulingResult;
}

// ============================================================================
// FSRS Implementation
// ============================================================================

/**
 * FSRS (Free Spaced Repetition Scheduler) implementation
 *
 * Implements the IScheduler interface using the ts-fsrs library.
 * All FSRS-specific logic is encapsulated within this class.
 */
class FsrsScheduler implements IScheduler {
  private fsrs: FSRS;

  constructor() {
    // Default FSRS parameters - can be customized per user in the future
    this.fsrs = new FSRS(
      generatorParameters({
        maximum_interval: 365, // Maximum days between reviews
        enable_fuzz: true, // Add randomness to prevent clustering
        enable_short_term: true, // Enable short-term scheduling for new cards
      })
    );
  }

  /**
   * Initialize a new FSRS card with default values
   */
  initializeCard(): Partial<Doc<'questions'>> {
    const card = createEmptyCard(new Date());
    return this.cardToDb(card);
  }

  /**
   * Schedule the next review for a question based on user's answer
   *
   * This is the core integration point between user answers and the FSRS algorithm.
   * It uses automatic rating calculation to determine scheduling without requiring
   * explicit confidence ratings from users.
   *
   * @param question - The question document from the database
   * @param isCorrect - Whether the user answered correctly (binary)
   * @param now - Current date for scheduling calculation
   * @returns Scheduling result with next review time and DB fields
   */
  scheduleNextReview(question: Doc<'questions'>, isCorrect: boolean, now: Date): SchedulingResult {
    // Convert database question to FSRS Card format
    const card = this.dbToCard(question);

    // Calculate rating from binary correctness
    const rating = this.calculateRating(isCorrect);

    // Run FSRS scheduling algorithm
    const schedulingCards = this.fsrs.repeat(card, now);
    const updatedCard = schedulingCards[rating].card;

    // Convert FSRS Card back to database fields
    const dbFields = this.cardToDb(updatedCard);

    return {
      dbFields,
      nextReviewDate: updatedCard.due,
      scheduledDays: updatedCard.scheduled_days,
      newState: this.mapFsrsStateToDb(updatedCard.state),
    };
  }

  // ==========================================================================
  // Private Helpers - FSRS-specific implementation details
  // ==========================================================================

  /**
   * Calculate FSRS rating from answer correctness using automatic rating approach
   *
   * This function implements Scry's automatic rating system that maps binary
   * correct/incorrect answers to FSRS ratings, eliminating the need for users
   * to manually rate their confidence level.
   *
   * @param isCorrect - Whether the user answered the question correctly
   * @returns FSRS Grade (Rating) for scheduling calculation
   *
   * Rating Rationale:
   * - Correct → Rating.Good (3): Indicates successful recall with normal effort.
   *   We use Good instead of Easy because without explicit user feedback,
   *   we assume average difficulty of recall.
   *
   * - Incorrect → Rating.Again (1): Indicates complete failure to recall.
   *   This ensures the question is reviewed again soon (typically within minutes).
   *
   * Benefits of this approach:
   * 1. Simplified UX - Users only need to answer, not rate confidence
   * 2. Consistent scheduling - Removes subjective bias from the algorithm
   * 3. Mobile-friendly - Single tap to answer and move on
   * 4. Faster reviews - No additional interaction after answering
   *
   * Future enhancements could consider:
   * - Time spent: Fast correct answers → Easy, slow → Good
   * - Question difficulty: Adjust rating based on question's success rate
   * - Partial credit: For multiple choice, close answers → Hard instead of Again
   */
  private calculateRating(isCorrect: boolean): Grade {
    return isCorrect ? Rating.Good : Rating.Again;
  }

  /**
   * Convert database question to FSRS Card format
   */
  private dbToCard(question: Doc<'questions'>): Card {
    // If no FSRS fields are set, return a new card
    if (!question.nextReview || !question.state) {
      return createEmptyCard(new Date());
    }

    return {
      due: new Date(question.nextReview),
      stability: question.stability ?? 0,
      difficulty: question.fsrsDifficulty ?? 0,
      elapsed_days: question.elapsedDays ?? 0,
      scheduled_days: question.scheduledDays ?? 0,
      reps: question.reps ?? 0,
      lapses: question.lapses ?? 0,
      state: this.mapDbStateToFsrs(question.state),
      last_review: question.lastReview ? new Date(question.lastReview) : undefined,
      learning_steps: 0, // Not stored in DB, using default
    };
  }

  /**
   * Convert FSRS Card to database fields (partial update)
   */
  private cardToDb(card: Card): Partial<Doc<'questions'>> {
    return {
      nextReview: card.due.getTime(),
      stability: card.stability,
      fsrsDifficulty: card.difficulty,
      elapsedDays: card.elapsed_days,
      scheduledDays: card.scheduled_days,
      reps: card.reps,
      lapses: card.lapses,
      state: this.mapFsrsStateToDb(card.state),
      lastReview: card.last_review?.getTime(),
    };
  }

  /**
   * Map database state strings to FSRS State enum
   */
  private mapDbStateToFsrs(dbState: string): State {
    switch (dbState) {
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

  /**
   * Map FSRS State enum to database state strings
   */
  private mapFsrsStateToDb(fsrsState: State): 'new' | 'learning' | 'review' | 'relearning' {
    switch (fsrsState) {
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

// ============================================================================
// Factory Function - Dependency Injection Point
// ============================================================================

/**
 * Factory function for scheduler dependency injection
 *
 * Returns the configured scheduler implementation.
 * This is the SINGLE POINT where you can swap algorithms:
 *
 * To switch to SM-2:
 *   return new Sm2Scheduler();
 *
 * To switch to Leitner:
 *   return new LeitnerScheduler();
 *
 * To A/B test algorithms:
 *   return Math.random() > 0.5 ? new FsrsScheduler() : new Sm2Scheduler();
 *
 * To read from user preferences:
 *   const userPref = await getUserSchedulingPreference();
 *   return userPref === 'sm2' ? new Sm2Scheduler() : new FsrsScheduler();
 */
export function getScheduler(): IScheduler {
  return new FsrsScheduler();
}
