import { NextRequest } from 'next/server'
import { z } from 'zod'
import { generateQuizWithAI } from '@/lib/ai-client'
import type { SimpleQuestion } from '@/types/quiz'
import { createRequestLogger, loggers } from '@/lib/logger'
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const requestSchema = z.object({
  topic: z.string().min(3).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  sessionToken: z.string().optional(), // Add this line
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
    
    const { topic, difficulty, sessionToken } = validationResult.data
    
    logger.info({
      event: 'api.generate-quiz.params',
      topic,
      difficulty
    }, `Generating quiz for topic: ${topic}`)
    
    // Generate questions using AI
    const questions: SimpleQuestion[] = await generateQuizWithAI(topic)
    
    // Save questions if user is authenticated
    let savedQuestionIds: string[] = [];
    if (sessionToken) {
      try {
        const result = await convex.mutation(api.questions.saveGeneratedQuestions, {
          sessionToken,
          topic,
          difficulty,
          questions,
        });
        savedQuestionIds = result.questionIds;
        
        logger.info({
          event: 'api.generate-quiz.questions-saved',
          count: result.count,
          topic,
        }, 'Questions saved to database');
      } catch (error) {
        logger.warn({
          event: 'api.generate-quiz.save-error',
          error: (error as Error).message,
        }, 'Failed to save questions, continuing anyway');
      }
    }
    
    const duration = timer.end({
      topic,
      difficulty,
      questionCount: questions.length,
      success: true
    })
    
    loggers.apiRequest('POST', '/api/generate-quiz', 200, duration, {
      topic,
      difficulty,
      questionCount: questions.length
    })
    
    return new Response(
      JSON.stringify({ 
        questions,
        topic,
        difficulty,
        questionIds: savedQuestionIds, // Add this line
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