import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

import type { SimpleQuestion } from '@/types/questions';

import { aiLogger, loggers } from './logger';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || '',
});

const questionSchema = z.object({
  question: z.string(),
  type: z.enum(['multiple-choice', 'true-false']).optional(),
  options: z.array(z.string()).min(2).max(4),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
});

const questionsSchema = z.object({
  questions: z.array(questionSchema),
});

export async function generateQuizWithAI(topic: string): Promise<SimpleQuestion[]> {
  // Trust the model to understand natural language - just pass it through
  const prompt = topic;

  try {
    const timer = loggers.time(`ai.question-generation.${topic}`, 'ai');

    aiLogger.info(
      {
        event: 'ai.question-generation.start',
        topic,
        model: 'gemini-2.5-flash',
      },
      `Starting question generation for topic: ${topic}`
    );

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: questionsSchema,
      prompt,
    });

    const duration = timer.end({
      topic,
      questionCount: object.questions.length,
      success: true,
    });

    aiLogger.info(
      {
        event: 'ai.question-generation.success',
        topic,
        questionCount: object.questions.length,
        duration,
      },
      `Successfully generated ${object.questions.length} questions for ${topic}`
    );

    // Validate and ensure all required properties are present
    return object.questions.map(
      (q): SimpleQuestion => ({
        question: q.question || '',
        type: q.type || 'multiple-choice',
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation,
      })
    );
  } catch (error) {
    const errorMessage = (error as Error).message || 'Unknown error';
    const isApiKeyError =
      errorMessage.includes('API key') ||
      errorMessage.includes('401') ||
      errorMessage.includes('Unauthorized');
    const isRateLimitError =
      errorMessage.toLowerCase().includes('rate limit') ||
      errorMessage.includes('429') ||
      errorMessage.toLowerCase().includes('quota');
    const isTimeoutError =
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorMessage.includes('ETIMEDOUT');

    const errorType = isApiKeyError
      ? 'api-key-error'
      : isRateLimitError
        ? 'rate-limit-error'
        : isTimeoutError
          ? 'timeout-error'
          : 'generation-error';

    loggers.error(
      error as Error,
      'ai',
      {
        event: 'ai.question-generation.failure',
        topic,
        model: 'gemini-2.5-flash',
        errorType,
        errorMessage,
      },
      `Failed to generate questions: ${errorMessage}`
    );

    // Re-throw error with enhanced context for proper error handling upstream
    const enhancedError = new Error(errorMessage) as Error & { originalError?: unknown };
    enhancedError.name = errorType;
    enhancedError.originalError = error;
    throw enhancedError;
  }
}
