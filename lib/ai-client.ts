import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { SimpleQuestion } from '@/types/quiz'
import { aiLogger, loggers } from './logger'

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
  const prompt = `Generate 10 quiz questions about "${topic}". 
Create a mix of question types:
- 7 multiple-choice questions (with 4 options each)
- 3 true/false questions (with 2 options: "True" and "False")

For each question:
- Set "type" to either "multiple-choice" or "true-false"
- For multiple-choice: provide 4 options with one correct answer
- For true/false: provide exactly 2 options ["True", "False"] with the correct answer
- Make questions educational and engaging
- Include a brief explanation for each answer`

  try {
    const timer = loggers.time(`ai.quiz-generation.${topic}`, 'ai')
    
    aiLogger.info({
      event: 'ai.quiz-generation.start',
      topic,
      model: 'gemini-2.0-flash-exp',
      questionCount: 10
    }, `Starting quiz generation for topic: ${topic}`)

    const { object } = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: questionsSchema,
      prompt,
    })

    const duration = timer.end({
      topic,
      questionCount: object.questions.length,
      success: true
    })

    aiLogger.info({
      event: 'ai.quiz-generation.success',
      topic,
      questionCount: object.questions.length,
      duration
    }, `Successfully generated ${object.questions.length} questions for ${topic}`)

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
        topic,
        model: 'gemini-2.0-flash-exp'
      },
      'Failed to generate quiz questions with AI'
    )

    aiLogger.warn({
      event: 'ai.quiz-generation.fallback',
      topic,
      fallbackQuestionCount: 1
    }, `Using fallback question for topic: ${topic}`)

    // Return some default questions as fallback
    return [
      {
        question: `What is ${topic}?`,
        type: 'multiple-choice' as const,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        explanation: 'This is a placeholder multiple-choice question.'
      },
      {
        question: `${topic} is an important subject to study.`,
        type: 'true-false' as const,
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'This is a placeholder true/false question.'
      }
    ]
  }
}