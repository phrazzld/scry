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

// Lazy-load ConvexHttpClient to allow proper mocking in tests
let convex: ConvexHttpClient | null = null;
function getConvexClient() {
  if (!convex) {
    convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  }
  return convex;
}

// For testing purposes - allows resetting between tests
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  const g = globalThis as typeof globalThis & {
    __resetConvexClient?: () => void;
    __getConvexClient?: typeof getConvexClient;
  };
  g.__resetConvexClient = () => {
    convex = null;
  };
  g.__getConvexClient = getConvexClient;
}

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
    const rateLimitResult = await getConvexClient().mutation(api.rateLimit.checkApiRateLimit, {
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
          limit: rateLimitResult.maxAttempts,
          windowMs: rateLimitResult.windowMs,
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

    let body;
    try {
      body = await request.json()
    } catch (parseError) {
      logger.warn({
        event: 'api.generate-quiz.json-parse-error',
        error: (parseError as Error).message,
      }, 'Failed to parse request body')
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: { message: 'Request body must be valid JSON' }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    if (!body) {
      return new Response(
        JSON.stringify({ 
          error: 'Request body is required',
          details: { message: 'Request must include a JSON body' }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
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
        JSON.stringify({ 
          error: `Validation error: ${validationResult.error.issues[0]?.message || 'Invalid topic'}`,
          details: validationResult.error.issues
        }),
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
    
    // Add IDs to questions for frontend tracking
    const questionsWithIds = questions.map((q, index) => ({
      ...q,
      id: index + 1
    }))
    
    // Save questions if user is authenticated
    let savedQuestionIds: string[] = [];
    let saveError: string | undefined;
    if (sessionToken) {
      try {
        const result = await getConvexClient().mutation(api.questions.saveGeneratedQuestions, {
          sessionToken,
          topic,
          difficulty,
          questions: questionsWithIds,
        });
        savedQuestionIds = result.questionIds;
        
        logger.info({
          event: 'api.generate-quiz.questions-saved',
          count: result.count,
          topic,
        }, 'Questions saved to database');
      } catch (error) {
        saveError = (error as Error).message;
        logger.warn({
          event: 'api.generate-quiz.save-error',
          error: saveError,
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
    
    const responseData: Record<string, number | string | boolean | SimpleQuestion[] | string[] | undefined> = { 
      questions: questionsWithIds,
      topic,
      difficulty,
      saved: savedQuestionIds.length > 0,
    };
    
    // Only include savedCount if there were saved questions
    if (savedQuestionIds.length > 0) {
      responseData.savedCount = savedQuestionIds.length;
      responseData.questionIds = savedQuestionIds; // Keep for backward compatibility
    }
    
    // Include save error if one occurred
    if (saveError) {
      responseData.saveError = saveError;
    }
    
    return new Response(
      JSON.stringify(responseData),
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
      JSON.stringify({ error: 'Quiz generation failed. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}