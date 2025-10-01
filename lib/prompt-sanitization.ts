import { z } from 'zod';

/**
 * Minimal prompt validation - trust the model, constrain the output
 *
 * Security model:
 * - Input: Remove control chars that break JSON, enforce length limits
 * - Output: Zod schema constrains AI responses (the real security boundary)
 * - Abuse: Rate limiting (see convex/rateLimit.ts)
 */

/**
 * Remove only null bytes and control chars that break JSON encoding
 */
function cleanControlChars(input: string): string {
  return input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '').trim();
}

const MAX_TOPIC_LENGTH = 5000;

/**
 * Topic validation schema - minimal constraints only
 */
export const sanitizedTopicSchema = z
  .string()
  .min(3, 'Topic must be at least 3 characters')
  .max(MAX_TOPIC_LENGTH, `Topic must be less than ${MAX_TOPIC_LENGTH} characters`)
  .transform(cleanControlChars);

/**
 * Complete request validation schema
 */
export const sanitizedQuizRequestSchema = z.object({
  topic: sanitizedTopicSchema,
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
});

/**
 * Rate limiting key for API requests
 */
export function getInjectionRateLimitKey(ipAddress: string): string {
  return `prompt-injection:${ipAddress}`;
}
