import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
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

/**
 * Build the intent clarification prompt for raw user input
 */
function buildIntentClarificationPrompt(userInput: string): string {
  return `You are an expert educational strategist. A learner wants to study something, but their input may contain typos, be vague, or need clarification.

USER INPUT: "${userInput}"

Your task: Analyze this input and provide a clear, detailed description of what the learner should study. Include:

1. Correct any obvious typos or errors
   - If you spot an error, mention it naturally ("likely meant X not Y")

2. Clarify vague or ambiguous topics
   - Expand abbreviations, add context
   - If multiple interpretations exist, choose the most educational one

3. Describe the key learning goals
   - What should they know/understand/be able to do?
   - Be specific but natural (not a bulleted list if possible)

4. Estimate scope
   - How much content is involved?
   - Briefly mention what good coverage would include

Write 2-4 paragraphs. Be conversational and helpful.`;
}

/**
 * Build the question generation prompt using clarified intent
 */
function buildQuestionPromptFromIntent(clarifiedIntent: string): string {
  return `You are a quiz generation assistant.

An educational strategist has clarified what a learner wants to study:

---
${clarifiedIntent}
---

Based on this analysis, generate comprehensive quiz questions that:
- Cover all the key learning goals mentioned
- Scale appropriately for the scope described
- Mix multiple-choice and true-false formats
- Each multiple-choice question must have exactly 4 options
- Each true/false question must have exactly 2 options: "True" and "False"
- Include educational explanations for each answer

Generate the questions now:`;
}

/**
 * Step 1: Clarify learning intent from raw user input (unstructured)
 */
async function clarifyLearningIntent(userInput: string): Promise<string> {
  const prompt = buildIntentClarificationPrompt(userInput);

  try {
    const response = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });

    return response.text;
  } catch (error) {
    // Tag error with stage for fallback handling
    const stageError = error as Error & { stage?: string };
    stageError.stage = 'intent-clarification';
    throw stageError;
  }
}

/**
 * Fallback: Generate questions directly without intent clarification
 */
async function generateQuestionsDirectly(topic: string): Promise<SimpleQuestion[]> {
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

  const { object } = await generateObject({
    model: google('gemini-2.5-flash'),
    schema: questionsSchema,
    prompt,
  });

  return object.questions.map(
    (q): SimpleQuestion => ({
      question: q.question || '',
      type: q.type || 'multiple-choice',
      options: q.options || [],
      correctAnswer: q.correctAnswer || '',
      explanation: q.explanation,
    })
  );
}

export async function generateQuizWithAI(topic: string): Promise<SimpleQuestion[]> {
  try {
    const overallTimer = loggers.time(`ai.question-generation.${topic}`, 'ai');

    aiLogger.info(
      {
        event: 'ai.question-generation.start',
        topic,
        model: 'gemini-2.5-flash',
        mode: 'two-step',
      },
      `Starting two-step question generation for topic: ${topic}`
    );

    // Step 1: Clarify learning intent
    const intentTimer = loggers.time('ai.intent-clarification', 'ai');

    let clarifiedIntent: string;
    try {
      clarifiedIntent = await clarifyLearningIntent(topic);

      const intentDuration = intentTimer.end({ originalInput: topic });

      aiLogger.info(
        {
          event: 'ai.intent-clarification.success',
          originalInput: topic,
          clarifiedIntentPreview: clarifiedIntent.slice(0, 200) + '...',
          duration: intentDuration,
        },
        'Successfully clarified learning intent'
      );
    } catch (intentError) {
      intentTimer.end({ success: false });

      // If intent clarification fails, fall back to direct generation
      aiLogger.warn(
        {
          event: 'ai.intent-clarification.failure',
          originalInput: topic,
          error: (intentError as Error).message,
          fallback: 'direct-generation',
        },
        'Intent clarification failed, falling back to direct generation'
      );

      const questions = await generateQuestionsDirectly(topic);

      const overallDuration = overallTimer.end({
        topic,
        questionCount: questions.length,
        mode: 'fallback',
        success: true,
      });

      aiLogger.info(
        {
          event: 'ai.question-generation.success',
          topic,
          questionCount: questions.length,
          duration: overallDuration,
          mode: 'fallback',
        },
        `Successfully generated ${questions.length} questions (fallback mode)`
      );

      return questions;
    }

    // Step 2: Generate questions using clarified intent
    const questionTimer = loggers.time('ai.question-generation-step', 'ai');

    const questionPrompt = buildQuestionPromptFromIntent(clarifiedIntent);

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: questionsSchema,
      prompt: questionPrompt,
    });

    const questionDuration = questionTimer.end({ questionCount: object.questions.length });

    const questions = object.questions.map(
      (q): SimpleQuestion => ({
        question: q.question || '',
        type: q.type || 'multiple-choice',
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation,
      })
    );

    const overallDuration = overallTimer.end({
      topic,
      questionCount: questions.length,
      success: true,
    });

    aiLogger.info(
      {
        event: 'ai.question-generation.success',
        topic,
        questionCount: questions.length,
        duration: overallDuration,
        questionGenerationDuration: questionDuration,
        mode: 'two-step',
      },
      `Successfully generated ${questions.length} questions via two-step flow`
    );

    return questions;
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
