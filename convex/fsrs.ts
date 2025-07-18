import { Card, createEmptyCard, FSRS, generatorParameters, Rating, Grade, State } from "ts-fsrs";
import { Doc } from "./_generated/dataModel";

// Default FSRS parameters - can be customized per user in the future
const DEFAULT_FSRS_PARAMS = generatorParameters({
  maximum_interval: 365, // Maximum days between reviews
  enable_fuzz: true,     // Add randomness to prevent clustering
  enable_short_term: true, // Enable short-term scheduling for new cards
});

/**
 * Initialize a new FSRS card with default values
 */
export function initializeCard(): Card {
  return createEmptyCard(new Date());
}

/**
 * Convert database question to FSRS Card format
 */
export function dbToCard(question: Doc<"questions">): Card {
  // If no FSRS fields are set, return a new card
  if (!question.nextReview || !question.state) {
    return initializeCard();
  }

  return {
    due: new Date(question.nextReview),
    stability: question.stability ?? 0,
    difficulty: question.fsrsDifficulty ?? 0,
    elapsed_days: question.elapsedDays ?? 0,
    scheduled_days: question.scheduledDays ?? 0,
    reps: question.reps ?? 0,
    lapses: question.lapses ?? 0,
    state: mapDbStateToFsrs(question.state),
    last_review: question.lastReview ? new Date(question.lastReview) : undefined,
    learning_steps: 0, // Not stored in DB, using default
  };
}

/**
 * Convert FSRS Card to database fields (partial update)
 */
export function cardToDb(card: Card): Partial<Doc<"questions">> {
  return {
    nextReview: card.due.getTime(),
    stability: card.stability,
    fsrsDifficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: mapFsrsStateToDb(card.state),
    lastReview: card.last_review?.getTime(),
  };
}

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
export function calculateRatingFromCorrectness(isCorrect: boolean): Grade {
  return isCorrect ? Rating.Good : Rating.Again;
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
 * @param now - Current timestamp (defaults to now)
 * @returns Updated FSRS card and database fields for persistence
 * 
 * The scheduling process:
 * 1. Convert question from DB format to FSRS Card format
 * 2. Automatically determine rating from correctness (Good or Again)
 * 3. Apply FSRS algorithm to calculate next review time
 * 4. Convert updated card back to DB format for storage
 * 
 * The FSRS algorithm considers:
 * - Current card state (new/learning/review/relearning)
 * - The automatic rating based on correctness
 * - Previous review history (stability, difficulty, reps, lapses)
 * - Configured parameters (maximum interval, fuzzing, etc.)
 */
export function scheduleNextReview(
  question: Doc<"questions">,
  isCorrect: boolean,
  now: Date = new Date()
): { updatedCard: Card; dbFields: Partial<Doc<"questions">> } {
  const fsrs = new FSRS(DEFAULT_FSRS_PARAMS);
  const currentCard = dbToCard(question);
  const rating = calculateRatingFromCorrectness(isCorrect);
  
  // Calculate next review using FSRS algorithm
  const { card: updatedCard } = fsrs.next(currentCard, now, rating);
  
  // Convert back to DB format
  const dbFields = cardToDb(updatedCard);
  
  return { updatedCard, dbFields };
}

/**
 * Get FSRS retrievability (probability of successful recall) for a card
 * Lower values indicate higher priority for review
 */
export function getRetrievability(question: Doc<"questions">, now: Date = new Date()): number {
  const fsrs = new FSRS(DEFAULT_FSRS_PARAMS);
  const card = dbToCard(question);
  
  // FSRS retrievability returns a value between 0 and 1
  // 1 = perfect recall, 0 = completely forgotten
  // The third parameter 'false' returns the numeric value instead of formatted string
  return fsrs.get_retrievability(card, now, false) as number;
}

/**
 * Map database state string to FSRS State enum
 */
function mapDbStateToFsrs(state: "new" | "learning" | "review" | "relearning"): State {
  switch (state) {
    case "new":
      return State.New;
    case "learning":
      return State.Learning;
    case "review":
      return State.Review;
    case "relearning":
      return State.Relearning;
  }
}

/**
 * Map FSRS State enum to database state string
 */
function mapFsrsStateToDb(state: State): "new" | "learning" | "review" | "relearning" {
  switch (state) {
    case State.New:
      return "new";
    case State.Learning:
      return "learning";
    case State.Review:
      return "review";
    case State.Relearning:
      return "relearning";
  }
}

/**
 * Check if a question is due for review
 */
export function isDue(question: Doc<"questions">, now: Date = new Date()): boolean {
  // Questions without nextReview are immediately due (new questions)
  if (!question.nextReview) {
    return true;
  }
  
  return question.nextReview <= now.getTime();
}