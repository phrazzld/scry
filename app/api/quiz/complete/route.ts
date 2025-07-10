import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { createRequestLogger, loggers } from '@/lib/logger'

const requestSchema = z.object({
  sessionToken: z.string(),
  topic: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  score: z.number().int().min(0),
  totalQuestions: z.number().int().positive(),
  answers: z.array(z.object({
    questionId: z.string(),
    question: z.string(),
    userAnswer: z.string(),
    correctAnswer: z.string(),
    isCorrect: z.boolean(),
    options: z.array(z.string()),
  })),
})

export async function POST(request: NextRequest) {
  const logger = createRequestLogger('api', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  })
  
  const timer = loggers.time('api.quiz-complete', 'api')
  
  try {
    logger.info({
      event: 'api.quiz-complete.start'
    }, 'Starting quiz completion request')

    const body = await request.json()
    const validationResult = requestSchema.safeParse(body)
    
    if (!validationResult.success) {
      logger.warn({
        event: 'api.quiz-complete.validation-error',
        errors: validationResult.error.issues,
        body
      }, 'Invalid request body for quiz completion')
      
      return new Response(
        JSON.stringify({ error: 'Invalid quiz data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const quizData = validationResult.data
    
    // Initialize Convex client
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) {
      throw new Error('NEXT_PUBLIC_CONVEX_URL not configured')
    }
    
    const client = new ConvexHttpClient(convexUrl)
    
    logger.info({
      event: 'api.quiz-complete.params',
      topic: quizData.topic,
      difficulty: quizData.difficulty,
      score: quizData.score,
      totalQuestions: quizData.totalQuestions
    }, `Completing quiz for topic: ${quizData.topic}`)
    
    // Save quiz result using Convex mutation
    const result = await client.mutation(api.quiz.completeQuiz, quizData)
    
    const duration = timer.end({
      topic: quizData.topic,
      difficulty: quizData.difficulty,
      score: quizData.score,
      totalQuestions: quizData.totalQuestions,
      success: true
    })
    
    loggers.apiRequest('POST', '/api/quiz/complete', 200, duration, {
      topic: quizData.topic,
      difficulty: quizData.difficulty,
      score: quizData.score,
      totalQuestions: quizData.totalQuestions
    })
    
    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    const duration = timer.end({
      success: false,
      error: (error as Error).message
    })
    
    loggers.error(
      error as Error,
      'api',
      {
        event: 'api.quiz-complete.error',
        duration
      },
      'Error completing quiz'
    )
    
    loggers.apiRequest('POST', '/api/quiz/complete', 500, duration, {
      error: (error as Error).message
    })
    
    // Check if it's an authentication error
    if ((error as Error).message.includes('Authentication required') || 
        (error as Error).message.includes('Invalid or expired session')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to save quiz results' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}