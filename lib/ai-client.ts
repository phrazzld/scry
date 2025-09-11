import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { SimpleQuestion } from '@/types/quiz'
import { aiLogger, loggers } from './logger'
import { createSafePrompt, sanitizeTopic } from './prompt-sanitization'

// Validate API key is present
if (!process.env.GOOGLE_AI_API_KEY) {
  const errorMessage = 'GOOGLE_AI_API_KEY is not configured. Please set it in your environment variables.';
  console.error(`[AI Client Error] ${errorMessage}`);
  // Log this configuration error
  aiLogger.error({
    event: 'ai.configuration.missing-api-key',
    error: errorMessage,
  }, errorMessage);
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
})

const questionSchema = z.object({
  question: z.string(),
  type: z.enum(['multiple-choice', 'true-false']).optional(),
  options: z.array(z.string()).min(2).max(4),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
})

const questionsSchema = z.object({
  questions: z.array(questionSchema)
})

export async function generateQuizWithAI(topic: string): Promise<SimpleQuestion[]> {
  // Sanitize the topic before using it
  const sanitizedTopic = sanitizeTopic(topic);
  
  // Create a safe prompt that prevents injection
  const prompt = createSafePrompt(sanitizedTopic, 10);

  try {
    const timer = loggers.time(`ai.quiz-generation.${sanitizedTopic}`, 'ai')
    
    aiLogger.info({
      event: 'ai.quiz-generation.start',
      topic: sanitizedTopic,
      originalTopic: topic !== sanitizedTopic ? topic : undefined,
      model: 'gemini-2.0-flash-exp',
      questionCount: 10
    }, `Starting quiz generation for topic: ${sanitizedTopic}`)

    const { object } = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: questionsSchema,
      prompt,
    })

    const duration = timer.end({
      topic: sanitizedTopic,
      questionCount: object.questions.length,
      success: true
    })

    aiLogger.info({
      event: 'ai.quiz-generation.success',
      topic: sanitizedTopic,
      questionCount: object.questions.length,
      duration
    }, `Successfully generated ${object.questions.length} questions for ${sanitizedTopic}`)

    // Validate and ensure all required properties are present
    return object.questions.map((q): SimpleQuestion => ({
      question: q.question || '',
      type: q.type || 'multiple-choice',
      options: q.options || [],
      correctAnswer: q.correctAnswer || '',
      explanation: q.explanation
    }))
  } catch (error) {
    loggers.error(
      error as Error,
      'ai',
      {
        event: 'ai.quiz-generation.failure',
        topic: sanitizedTopic,
        model: 'gemini-2.0-flash-exp'
      },
      'Failed to generate quiz questions with AI'
    )

    aiLogger.warn({
      event: 'ai.quiz-generation.fallback',
      topic: sanitizedTopic,
      fallbackQuestionCount: 2
    }, `Using fallback questions for topic: ${sanitizedTopic}`)

    // Return some default questions as fallback
    return [
      {
        question: `What is ${sanitizedTopic}?`,
        type: 'multiple-choice' as const,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        explanation: 'This is a placeholder multiple-choice question.'
      },
      {
        question: `${sanitizedTopic} is an important subject to study.`,
        type: 'true-false' as const,
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'This is a placeholder true/false question.'
      }
    ]
  }
}