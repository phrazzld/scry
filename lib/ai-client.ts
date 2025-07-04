import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { SimpleQuestion } from '@/types/quiz'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
})

const questionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
})

const questionsSchema = z.object({
  questions: z.array(questionSchema)
})

export async function generateQuizWithAI(topic: string): Promise<SimpleQuestion[]> {
  const prompt = `Generate 10 multiple choice questions about "${topic}". 
Each question should have 4 options with one correct answer.
Make the questions educational and engaging.
Include a brief explanation for each answer.`

  try {
    const { object } = await generateObject({
      model: google('gemini-2.0-flash-exp'),
      schema: questionsSchema,
      prompt,
    })

    return object.questions
  } catch (error) {
    console.error('Failed to generate quiz:', error)
    // Return some default questions as fallback
    return [{
      question: `What is ${topic}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: 'This is a placeholder question.'
    }]
  }
}