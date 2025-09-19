import { z } from 'zod';

/**
 * Prompt sanitization and validation module
 * Prevents prompt injection attacks by validating and sanitizing user inputs
 * before they are sent to AI models.
 */

// Common prompt injection patterns to detect and block
const INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|previous|above)/i,
  /disregard\s+(previous|all|above|prior)/i,
  /override\s+(instructions?|rules?|prompts?)/i,
  
  // Role/identity manipulation
  /you\s+are\s+(now|actually|really)\s+/i,
  /pretend\s+(to\s+be|you('re|r)|that)/i,
  /act\s+as\s+(if|though|a|an)/i,
  /roleplay\s+as/i,
  /assume\s+the\s+role/i,
  
  // System prompt extraction attempts
  /show\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /reveal\s+(your|the)\s+(instructions?|prompt|configuration)/i,
  /what\s+(are|were)\s+you(r)?\s+(instructed|told|programmed)/i,
  /repeat\s+(your|the)\s+(first|initial|original)\s+(prompt|instructions?)/i,
  
  // Command injection patterns
  /\{\{.*\}\}/,  // Template injection
  /\$\{.*\}/,     // Variable injection
  /<%.*%>/,       // Script injection
  /\[INST\]/i,    // Special instruction markers
  /\[\/INST\]/i,
  /<\|.*\|>/,     // Special delimiters
  
  // Escape attempts
  /\\n\\n/,       // Multiple newlines to break context
  /```[\s\S]*```/, // Code blocks that might contain instructions
];

// Whitelist of allowed characters for quiz topics
const TOPIC_ALLOWED_CHARS = /^[a-zA-Z0-9\s\-.,!?'&()+/:]+$/;

// Maximum lengths for different input types
const MAX_TOPIC_LENGTH = 200;  // Reduced from 500 for better control

/**
 * Zod schema for quiz topic with enhanced validation
 */
export const sanitizedTopicSchema = z
  .string()
  .min(3, 'Topic must be at least 3 characters')
  .max(MAX_TOPIC_LENGTH, `Topic must be less than ${MAX_TOPIC_LENGTH} characters`)
  .refine(
    (topic) => TOPIC_ALLOWED_CHARS.test(topic),
    'Topic contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed.'
  )
  .refine(
    (topic) => !INJECTION_PATTERNS.some(pattern => pattern.test(topic)),
    'Topic contains potentially harmful content. Please use a different topic.'
  )
  .transform((topic) => sanitizeTopic(topic));

/**
 * Zod schema for the complete quiz generation request
 */
export const sanitizedQuizRequestSchema = z.object({
  topic: sanitizedTopicSchema,
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
});

/**
 * Sanitize a quiz topic by removing potentially harmful content
 */
export function sanitizeTopic(topic: string): string {
  // Trim whitespace
  let sanitized = topic.trim();
  
  // Remove multiple consecutive spaces
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Remove any script-like content first
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove any HTML/XML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove markdown code blocks
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '');
  sanitized = sanitized.replace(/`[^`]*`/g, '');
  
  // Remove potential command sequences
  sanitized = sanitized.replace(/\{\{.*?\}\}/g, '');
  sanitized = sanitized.replace(/\$\{.*?\}/g, '');
  sanitized = sanitized.replace(/<%.*?%>/g, '');
  
  // Remove URLs to prevent external content injection
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '(URL removed)');
  
  // Remove email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '(email removed)');
  
  // Escape quotes to prevent breaking out of strings
  sanitized = sanitized.replace(/["']/g, '');
  
  // Remove backslashes to prevent escape sequences
  sanitized = sanitized.replace(/\\/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Limit consecutive punctuation
  sanitized = sanitized.replace(/([.!?,]){2,}/g, '$1');
  
  // Final trim and length check
  sanitized = sanitized.trim();
  if (sanitized.length > MAX_TOPIC_LENGTH) {
    sanitized = sanitized.substring(0, MAX_TOPIC_LENGTH);
  }
  
  return sanitized;
}

/**
 * Check if a topic contains potential prompt injection attempts
 */
export function containsInjectionAttempt(topic: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(topic));
}

/**
 * Validate and sanitize quiz generation input
 */
export function validateQuizInput(input: unknown) {
  return sanitizedQuizRequestSchema.parse(input);
}

/**
 * Create a safe prompt for AI generation
 * Wraps the user input in a controlled context
 */
export function createSafePrompt(topic: string, questionCount: number = 10): string {
  // Additional validation
  const sanitized = sanitizeTopic(topic);
  
  // Wrap the topic in a controlled prompt structure
  // This helps prevent the AI from interpreting the topic as instructions
  return `You are a quiz generation assistant. Generate exactly ${questionCount} educational quiz questions.

TOPIC TO CREATE QUESTIONS ABOUT: "${sanitized}"

Requirements:
- Create ${questionCount} questions total
- Mix of question types: multiple-choice and true/false
- Each multiple-choice question must have exactly 4 options
- Each true/false question must have exactly 2 options: "True" and "False"
- Include educational explanations for each answer
- Focus only on the topic provided above
- Do not include any content outside the specified topic

Generate the questions now:`;
}

/**
 * Log potential injection attempts for security monitoring
 */
export function logInjectionAttempt(
  topic: string, 
  ipAddress: string,
  logger?: { warn: (data: Record<string, unknown>, message: string) => void }
): void {
  const detectedPatterns = INJECTION_PATTERNS
    .filter(pattern => pattern.test(topic))
    .map(pattern => pattern.source);
    
  if (logger && detectedPatterns.length > 0) {
    logger.warn({
      event: 'security.prompt-injection-attempt',
      topic,
      ipAddress,
      detectedPatterns,
      timestamp: new Date().toISOString(),
    }, 'Potential prompt injection attempt detected');
  }
}

/**
 * Rate limiting key for prompt injection attempts
 * Can be used with existing rate limiting infrastructure
 */
export function getInjectionRateLimitKey(ipAddress: string): string {
  return `prompt-injection:${ipAddress}`;
}