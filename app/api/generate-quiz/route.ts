import { NextRequest } from 'next/server'
import { generateQuizWithAI } from '@/lib/ai-client'
import type { SimpleQuestion } from '@/types/quiz'
import { createRequestLogger, loggers } from '@/lib/logger'
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { 
  sanitizedQuizRequestSchema, 
  containsInjectionAttempt, 
  logInjectionAttempt 
} from '@/lib/prompt-sanitization';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  // Extract client IP properly - x-forwarded-for can contain multiple IPs
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor 
    ? forwardedFor.split(',')[0].trim() // Get first IP from comma-separated list
    : request.headers.get('x-real-ip') || 
      request.headers.get('cf-connecting-ip') || // Cloudflare
      'unknown';
  
  const logger = createRequestLogger('api', {
    method: request.method,
    url: request.url,
    // Only log safe headers, not sensitive ones like cookies or authorization
    headers: {
      'user-agent': request.headers.get('user-agent') || undefined,
      'content-type': request.headers.get('content-type') || undefined,
      'accept': request.headers.get('accept') || undefined,
    },
    ip: ipAddress
  })
  
  const timer = loggers.time('api.generate-quiz', 'api')
  
  try {
    // Check rate limit first
    const rateLimitResult = await convex.mutation(api.rateLimit.checkApiRateLimit, {
      ipAddress,
      operation: 'quizGeneration',
    });

    if (!rateLimitResult.allowed) {
      logger.warn({
        event: 'api.generate-quiz.rate-limited',
        ip: ipAddress,
        attemptsUsed: rateLimitResult.attemptsUsed,
        maxAttempts: rateLimitResult.maxAttempts,
      }, 'Rate limit exceeded for quiz generation');

      return new Response(
        JSON.stringify({ 
          error: rateLimitResult.errorMessage,
          retryAfter: rateLimitResult.retryAfter,
        }),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.retryAfter),
          } 
        }
      );
    }

    logger.info({
      event: 'api.generate-quiz.start',
      attemptsRemaining: rateLimitResult.attemptsRemaining,
    }, 'Starting quiz generation request')

    const body = await request.json()
    
    // Check for injection attempts before validation
    if (body.topic && containsInjectionAttempt(body.topic)) {
      logInjectionAttempt(body.topic, ipAddress, logger);
      
      // Rate limit injection attempts more aggressively
      logger.warn({
        event: 'api.generate-quiz.injection-blocked',
        ip: ipAddress,
        topic: body.topic?.substring(0, 100), // Log first 100 chars only
      }, 'Prompt injection attempt blocked');
      
      return new Response(
        JSON.stringify({ error: 'Invalid topic. Please use a different topic.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const validationResult = sanitizedQuizRequestSchema.safeParse(body)
    
    if (!validationResult.success) {
      logger.warn({
        event: 'api.generate-quiz.validation-error',
        errors: validationResult.error.issues,
        body
      }, 'Invalid request body for quiz generation')
      
      return new Response(
        JSON.stringify({ error: validationResult.error.issues[0]?.message || 'Invalid topic' }),
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