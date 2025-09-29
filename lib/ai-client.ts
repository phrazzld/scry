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
  // Provide clear guidance while trusting the model to scale appropriately
  const prompt = `You are a quiz generation assistant. Your task is to create comprehensive educational quiz questions.

First, consider the topic and determine how many questions would provide thorough coverage.
Be generous - it's better to have too many questions than too few.
For example: 'NATO alphabet' needs at least 26 questions, 'primary colors' needs 3, 'React hooks' might need 15-20.

TOPIC TO CREATE QUESTIONS ABOUT: "${topic}"

Generate enough questions to ensure complete coverage of this topic.
Mix question types: multiple-choice and true-false.
Each multiple-choice question must have exactly 4 options.
Each true/false question must have exactly 2 options: "True" and "False".
Include educational explanations for each answer.

Generate the questions now:`;

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
