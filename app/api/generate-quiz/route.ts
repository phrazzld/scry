import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { generateQuizWithAI } from '@/lib/ai-client'
import { authOptionsMonitored as authOptions } from '@/lib/auth-monitored'
import { prismaMonitored as prisma } from '@/lib/prisma-monitored'
import type { SimpleQuestion } from '@/types/quiz'
import { createRequestLogger, loggers } from '@/lib/logger'

const requestSchema = z.object({
  topic: z.string().min(3).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
})

export async function POST(request: NextRequest) {
  const logger = createRequestLogger('api', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  })
  
  const timer = loggers.time('api.generate-quiz', 'api')
  
  try {
    logger.info({
      event: 'api.generate-quiz.start'
    }, 'Starting quiz generation request')

    const body = await request.json()
    const validationResult = requestSchema.safeParse(body)
    
    if (!validationResult.success) {
      logger.warn({
        event: 'api.generate-quiz.validation-error',
        errors: validationResult.error.issues,
        body
      }, 'Invalid request body for quiz generation')
      
      return new Response(
        JSON.stringify({ error: 'Invalid topic' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const { topic, difficulty } = validationResult.data
    
    // Check for authenticated session
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null
    
    logger.info({
      event: 'api.generate-quiz.params',
      topic,
      difficulty,
      userId,
      authenticated: !!session
    }, `Generating quiz for topic: ${topic}`)
    
    // Generate 10 multiple choice questions
    const questions: SimpleQuestion[] = await generateQuizWithAI(topic)
    
    // Save quiz result if user is authenticated
    let quizResultId = null
    if (userId) {
      try {
        const quizResult = await prisma.quizResult.create({
          data: {
            userId,
            topic,
            difficulty,
            score: 0, // Initial score, will be updated when quiz is completed
            totalQuestions: questions.length,
            answers: [], // Empty initially, will be filled when quiz is submitted
          }
        })
        quizResultId = quizResult.id
        
        logger.info({
          event: 'api.generate-quiz.quiz-saved',
          quizResultId,
          userId,
          topic,
          difficulty,
          questionCount: questions.length
        }, `Quiz result saved with ID: ${quizResultId}`)
      } catch (dbError) {
        loggers.error(
          dbError as Error,
          'database',
          {
            event: 'api.generate-quiz.save-failed',
            userId,
            topic,
            difficulty
          },
          'Failed to save quiz result to database'
        )
        // Continue without saving - don't fail the entire request
      }
    }
    
    const duration = timer.end({
      topic,
      difficulty,
      userId: userId || undefined,
      questionCount: questions.length,
      quizResultId: quizResultId || undefined,
      success: true
    })
    
    loggers.apiRequest('POST', '/api/generate-quiz', 200, duration, {
      topic,
      difficulty,
      userId: userId || undefined,
      questionCount: questions.length
    })
    
    return new Response(
      JSON.stringify({ 
        questions,
        quizResultId, // Include quiz result ID for future updates
        userId, // Include userId in response for debugging/frontend use
        authenticated: !!session
      }),
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
        event: 'api.generate-quiz.error',
        duration
      },
      'Unexpected error during quiz generation'
    )
    
    loggers.apiRequest('POST', '/api/generate-quiz', 500, duration, {
      error: (error as Error).message
    })
    
    return new Response(
      JSON.stringify({ error: 'Failed to generate quiz' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}