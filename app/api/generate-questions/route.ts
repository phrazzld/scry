import { NextRequest } from 'next/server';

import { generateQuizWithAI } from '@/lib/ai-client';
import { createRequestLogger, loggers } from '@/lib/logger';
import {
  containsInjectionAttempt,
  logInjectionAttempt,
  sanitizedQuizRequestSchema,
} from '@/lib/prompt-sanitization';
import type { SimpleQuestion } from '@/types/questions';

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
      accept: request.headers.get('accept') || undefined,
    },
    ip: ipAddress,
  });

  const timer = loggers.time('api.generate-questions', 'api');

  try {
    logger.info(
      {
        event: 'api.generate-questions.start',
      },
      'Starting question generation request'
    );

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.warn(
        {
          event: 'api.generate-questions.json-parse-error',
          error: (parseError as Error).message,
        },
        'Failed to parse request body'
      );

      return new Response(
        JSON.stringify({
          error: 'Invalid JSON in request body',
          details: { message: 'Request body must be valid JSON' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body) {
      return new Response(
        JSON.stringify({
          error: 'Request body is required',
          details: { message: 'Request must include a JSON body' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for injection attempts before validation
    if (body.topic && containsInjectionAttempt(body.topic)) {
      logInjectionAttempt(body.topic, ipAddress, logger);

      // Rate limit injection attempts more aggressively
      logger.warn(
        {
          event: 'api.generate-questions.injection-blocked',
          ip: ipAddress,
          topic: body.topic?.substring(0, 100), // Log first 100 chars only
        },
        'Prompt injection attempt blocked'
      );

      return new Response(
        JSON.stringify({ error: 'Invalid topic. Please use a different topic.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validationResult = sanitizedQuizRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn(
        {
          event: 'api.generate-questions.validation-error',
          errors: validationResult.error.issues,
          body,
        },
        'Invalid request body for question generation'
      );

      return new Response(
        JSON.stringify({
          error: `Validation error: ${validationResult.error.issues[0]?.message || 'Invalid topic'}`,
          details: validationResult.error.issues,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { topic, difficulty } = validationResult.data;

    logger.info(
      {
        event: 'api.generate-questions.params',
        topic,
        difficulty,
      },
      `Generating questions for topic: ${topic}`
    );

    // Generate questions using AI
    const questions: SimpleQuestion[] = await generateQuizWithAI(topic);

    // Add IDs to questions for frontend tracking
    const questionsWithIds = questions.map((q, index) => ({
      ...q,
      id: index + 1,
    }));

    const duration = timer.end({
      topic,
      difficulty,
      questionCount: questions.length,
      success: true,
    });

    loggers.apiRequest('POST', '/api/generate-questions', 200, duration, {
      topic,
      difficulty,
      questionCount: questions.length,
    });

    return new Response(
      JSON.stringify({
        questions: questionsWithIds,
        topic,
        difficulty,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const duration = timer.end({
      success: false,
      error: (error as Error).message,
    });

    loggers.error(
      error as Error,
      'api',
      {
        event: 'api.generate-questions.error',
        duration,
      },
      'Unexpected error during question generation'
    );

    loggers.apiRequest('POST', '/api/generate-questions', 500, duration, {
      error: (error as Error).message,
    });

    return new Response(
      JSON.stringify({ error: 'Question generation failed. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
