/**
 * Seeded shuffling utilities for deterministic randomization
 *
 * Used to shuffle quiz answer options in a predictable way - same seed
 * always produces the same shuffle. This ensures users see consistent
 * option ordering across multiple attempts at the same question.
 */

/**
 * Simple seeded pseudorandom number generator (PRNG)
 * Based on mulberry32 algorithm - fast and sufficient for our needs
 *
 * @param seed - String seed to initialize the PRNG
 * @returns Function that generates numbers in [0, 1)
 */
function createSeededRandom(seed: string): () => number {
  // Convert string seed to 32-bit integer hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Mulberry32 PRNG implementation
  return function () {
    hash = (hash + 0x6d2b79f5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically shuffle array using Fisher-Yates algorithm
 *
 * Uses a seeded PRNG to ensure the same seed always produces the same shuffle.
 * Does not mutate the original array.
 *
 * @param array - Array to shuffle
 * @param seed - String seed for deterministic randomization
 * @returns New array with elements shuffled
 *
 * @example
 * ```typescript
 * const options = ['A', 'B', 'C', 'D'];
 * const shuffled1 = shuffleWithSeed(options, 'question-123');
 * const shuffled2 = shuffleWithSeed(options, 'question-123');
 * // shuffled1 and shuffled2 are identical (same seed)
 *
 * const shuffled3 = shuffleWithSeed(options, 'question-456');
 * // shuffled3 is different from shuffled1 (different seed)
 * ```
 */
export function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  // Don't shuffle empty arrays or single elements
  if (array.length <= 1) {
    return [...array];
  }

  // Create copy to avoid mutation
  const result = [...array];

  // Create seeded random number generator
  const random = createSeededRandom(seed);

  // Fisher-Yates shuffle with seeded randomness
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Generate shuffle seed from questionId and optional userId
 *
 * Ensures:
 * - Same question shows same shuffle for same user (determinism)
 * - Different users see different shuffles (prevents answer sharing)
 * - Anonymous users get consistent shuffle per question
 *
 * @param questionId - Unique question identifier
 * @param userId - Optional user identifier
 * @returns Shuffle seed string
 *
 * @example
 * ```typescript
 * // Same user, same question -> same seed
 * getShuffleSeed('q-123', 'user-456'); // 'q-123-user-456'
 * getShuffleSeed('q-123', 'user-456'); // 'q-123-user-456'
 *
 * // Different user, same question -> different seed
 * getShuffleSeed('q-123', 'user-789'); // 'q-123-user-789'
 *
 * // Anonymous user -> consistent per question
 * getShuffleSeed('q-123'); // 'q-123-anonymous'
 * ```
 */
export function getShuffleSeed(questionId: string, userId?: string): string {
  return `${questionId}-${userId || 'anonymous'}`;
}
