/**
 * AI Generation Action Module
 *
 * Processes background question generation jobs using validated AI generation.
 * This module handles the complete lifecycle from job initialization through
 * question generation with schema validation and completion.
 *
 * ARCHITECTURE: 1-Phase Learning Science Approach
 * - Single comprehensive prompt incorporating all learning science principles
 * - GPT-5 with high reasoning effort for optimal quality
 * - Structured outputs via Zod schema validation
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, type LanguageModel } from 'ai';
import { v } from 'convex/values';
import OpenAI from 'openai';
import pino from 'pino';
import { z } from 'zod';

import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import { getSecretDiagnostics } from './lib/envDiagnostics';
import { buildLearningSciencePrompt } from './lib/promptTemplates';
import { generateObjectWithResponsesApi } from './lib/responsesApi';

// Logger for this module
const logger = pino({ name: 'aiGeneration' });

// Zod schema for 1-phase question generation
const questionSchema = z.object({
  question: z.string(),
  type: z.enum(['multiple-choice', 'true-false']), // Required - must be exactly one of these values
  options: z.array(z.string()).min(2).max(4),
  correctAnswer: z.string(),
  explanation: z.string(), // Required for OpenAI strict mode + learning science principles
});

const questionsSchema = z.object({
  questions: z.array(questionSchema),
});

/**
 * Classify error for appropriate handling and retry logic
 */
function classifyError(error: Error): { code: string; retryable: boolean } {
  const message = error.message.toLowerCase();
  const errorName = error.name || '';

  // Schema validation errors - AI generated invalid format
  if (
    errorName.includes('AI_NoObjectGeneratedError') ||
    message.includes('schema') ||
    message.includes('validation') ||
    message.includes('does not match validator')
  ) {
    return { code: 'SCHEMA_VALIDATION', retryable: true };
  }

  // Rate limit errors are transient and retryable
  if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) {
    return { code: 'RATE_LIMIT', retryable: true };
  }

  // API key errors are permanent and not retryable
  if (message.includes('api key') || message.includes('401') || message.includes('unauthorized')) {
    return { code: 'API_KEY', retryable: false };
  }

  // Network/timeout errors are transient and retryable
  if (message.includes('network') || message.includes('timeout') || message.includes('etimedout')) {
    return { code: 'NETWORK', retryable: true };
  }

  // Unknown errors are treated as non-retryable by default
  return { code: 'UNKNOWN', retryable: false };
}

/**
 * Process a generation job
 *
 * This is the main entry point for background question generation.
 * It handles the complete flow from job initialization through
 * intent clarification, streaming generation, and completion.
 */
export const processJob = internalAction({
  args: {
    jobId: v.id('generationJobs'),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // Initialize AI provider from environment configuration
    // Defaults to OpenAI for production, but can be overridden via env vars
    const provider = process.env.AI_PROVIDER || 'openai';
    const modelName = process.env.AI_MODEL || 'gpt-5-mini';
    const reasoningEffort = process.env.AI_REASONING_EFFORT || 'high';

    // Declare keyDiagnostics outside conditional blocks for error handler access
    let keyDiagnostics: ReturnType<typeof getSecretDiagnostics> = {
      present: false,
      length: 0,
      fingerprint: null,
    };
    let model: LanguageModel | undefined;
    let openaiClient: OpenAI | undefined;

    if (provider === 'google') {
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      keyDiagnostics = getSecretDiagnostics(apiKey);

      logger.info(
        {
          jobId: args.jobId,
          provider: 'google',
          model: modelName,
          keyDiagnostics,
          deployment: process.env.CONVEX_CLOUD_URL ?? 'unknown',
        },
        'Using Google AI provider'
      );

      if (!apiKey || apiKey === '') {
        const errorMessage = 'GOOGLE_AI_API_KEY not configured in Convex environment';
        logger.error(
          {
            jobId: args.jobId,
            keyDiagnostics,
            deployment: process.env.CONVEX_CLOUD_URL ?? 'unknown',
          },
          errorMessage
        );
        await ctx.runMutation(internal.generationJobs.failJob, {
          jobId: args.jobId,
          errorMessage,
          errorCode: 'API_KEY',
          retryable: false,
        });
        throw new Error(errorMessage);
      }
      const google = createGoogleGenerativeAI({ apiKey });
      model = google(modelName) as unknown as LanguageModel;
    } else if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      keyDiagnostics = getSecretDiagnostics(apiKey);

      logger.info(
        {
          jobId: args.jobId,
          provider: 'openai',
          model: modelName,
          reasoningEffort,
          keyDiagnostics,
          deployment: process.env.CONVEX_CLOUD_URL ?? 'unknown',
        },
        'Using OpenAI provider with Responses API'
      );

      if (!apiKey || apiKey === '') {
        const errorMessage = 'OPENAI_API_KEY not configured in Convex environment';
        logger.error(
          {
            jobId: args.jobId,
            keyDiagnostics,
            deployment: process.env.CONVEX_CLOUD_URL ?? 'unknown',
          },
          errorMessage
        );
        await ctx.runMutation(internal.generationJobs.failJob, {
          jobId: args.jobId,
          errorMessage,
          errorCode: 'API_KEY',
          retryable: false,
        });
        throw new Error(errorMessage);
      }
      openaiClient = new OpenAI({ apiKey });
    } else {
      const errorMessage = `Unsupported AI_PROVIDER: ${provider}. Use 'google' or 'openai'.`;
      logger.error({ jobId: args.jobId, provider }, errorMessage);
      await ctx.runMutation(internal.generationJobs.failJob, {
        jobId: args.jobId,
        errorMessage,
        errorCode: 'CONFIG_ERROR',
        retryable: false,
      });
      throw new Error(errorMessage);
    }

    try {
      logger.info({ jobId: args.jobId }, 'Starting job processing');

      // Update job to processing status
      await ctx.runMutation(internal.generationJobs.updateProgress, {
        jobId: args.jobId,
        phase: 'clarifying',
      });

      // Fetch job details
      const job = await ctx.runQuery(internal.generationJobs.getJobByIdInternal, {
        jobId: args.jobId,
      });

      if (!job) {
        logger.error({ jobId: args.jobId }, 'Job not found');
        throw new Error('Job not found');
      }

      // Check if already cancelled
      if (job.status === 'cancelled') {
        logger.info({ jobId: args.jobId }, 'Job already cancelled, exiting early');
        return;
      }

      logger.info({ jobId: args.jobId, prompt: job.prompt }, 'Job details fetched');

      // Single Phase: Learning Science Question Generation
      logger.info({ jobId: args.jobId }, 'Generating questions with learning science principles');

      await ctx.runMutation(internal.generationJobs.updateProgress, {
        jobId: args.jobId,
        phase: 'generating',
      });

      const questionPrompt = buildLearningSciencePrompt(job.prompt);

      let finalResponse;
      if (provider === 'openai' && openaiClient) {
        // Use native Responses API for OpenAI
        finalResponse = await generateObjectWithResponsesApi({
          client: openaiClient,
          model: modelName,
          input: questionPrompt,
          schema: questionsSchema,
          schemaName: 'questions',
          verbosity: 'high',
          reasoningEffort: 'high',
        });
      } else if (provider === 'google' && model) {
        // Use Vercel AI SDK for Google
        finalResponse = await generateObject({
          model,
          schema: questionsSchema,
          prompt: questionPrompt,
        });
      } else {
        throw new Error('Provider not initialized correctly');
      }

      const { object } = finalResponse;

      // Log reasoning token usage if available (OpenAI)
      const reasoningTokens =
        (finalResponse.usage as { completion_tokens_details?: { reasoning_tokens?: number } })
          ?.completion_tokens_details?.reasoning_tokens || 0;

      logger.info(
        {
          jobId: args.jobId,
          questionCount: object.questions.length,
          totalTokens: finalResponse.usage?.totalTokens,
          reasoningTokens,
          ...(reasoningTokens > 0 &&
            finalResponse.usage?.totalTokens && {
              reasoningPercentage: Math.round(
                (reasoningTokens / finalResponse.usage.totalTokens) * 100
              ),
            }),
        },
        'Question generation complete'
      );

      // Generate embeddings for semantic search
      // Process in batches to avoid overwhelming the API
      logger.info({ jobId: args.jobId }, 'Generating embeddings for questions');

      const questionsWithEmbeddings: Array<
        (typeof object.questions)[number] & {
          embedding?: number[];
          embeddingGeneratedAt?: number;
        }
      > = [];
      let embeddingSuccessCount = 0;
      let embeddingFailureCount = 0;

      // Process embeddings in batches of 10 for rate limit protection
      const BATCH_SIZE = 10;
      for (let i = 0; i < object.questions.length; i += BATCH_SIZE) {
        const batch = object.questions.slice(i, i + BATCH_SIZE);

        const embeddingResults = await Promise.allSettled(
          batch.map(async (q) => {
            // Combine question + explanation for richer semantic context
            const text = `${q.question}${q.explanation ? ' ' + q.explanation : ''}`;

            try {
              const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
                text,
              });
              return {
                ...q,
                embedding,
                embeddingGeneratedAt: Date.now(),
              };
            } catch (error) {
              // Graceful degradation: Log error but continue without embedding
              logger.warn(
                {
                  jobId: args.jobId,
                  questionPreview: q.question.slice(0, 50),
                  error: (error as Error).message,
                },
                'Failed to generate embedding for question'
              );
              return q; // Return question without embedding
            }
          })
        );

        // Collect results (with or without embeddings)
        embeddingResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const question = result.value;
            questionsWithEmbeddings.push(question);
            if ('embedding' in question) {
              embeddingSuccessCount++;
            } else {
              embeddingFailureCount++;
            }
          } else {
            // Log rejected promises with question details for debugging
            const question = batch[index];
            logger.warn(
              {
                event: 'embeddings.generation.batch-failure',
                jobId: args.jobId,
                questionPreview: question.question.slice(0, 50),
                questionType: question.type,
                error:
                  result.reason instanceof Error ? result.reason.message : String(result.reason),
              },
              'Promise rejected during embedding generation'
            );
            // Retain question without embedding (graceful degradation)
            questionsWithEmbeddings.push(question);
            embeddingFailureCount++;
          }
        });
      }

      logger.info(
        {
          jobId: args.jobId,
          totalQuestions: object.questions.length,
          embeddingSuccessCount,
          embeddingFailureCount,
        },
        'Embedding generation complete'
      );

      // Check for cancellation before saving
      const currentJob = await ctx.runQuery(internal.generationJobs.getJobByIdInternal, {
        jobId: args.jobId,
      });

      if (currentJob?.status === 'cancelled') {
        logger.info({ jobId: args.jobId }, 'Job cancelled by user before save');
        return;
      }

      // Save all validated questions (with embeddings where successful)
      const allQuestionIds = await ctx.runMutation(internal.questionsCrud.saveBatch, {
        userId: job.userId,
        questions: questionsWithEmbeddings,
      });

      logger.info(
        {
          jobId: args.jobId,
          questionsSaved: allQuestionIds.length,
        },
        'Questions saved to database'
      );

      // Job completion
      const durationMs = Date.now() - startTime;
      const topic = job.prompt;

      // Mark job as completed
      await ctx.runMutation(internal.generationJobs.completeJob, {
        jobId: args.jobId,
        topic,
        questionIds: allQuestionIds,
        durationMs,
      });

      logger.info(
        {
          jobId: args.jobId,
          topic,
          questionCount: allQuestionIds.length,
          durationMs,
        },
        'Job completed successfully'
      );
    } catch (error) {
      const err = error as Error;
      const { code, retryable } = classifyError(err);

      // Provide user-friendly error messages for common scenarios
      let userMessage = err.message;
      if (code === 'SCHEMA_VALIDATION') {
        userMessage =
          'The AI generated questions in an unexpected format. This is usually temporary. Please try again.';
      } else if (code === 'RATE_LIMIT') {
        userMessage = 'Rate limit reached. Please wait a moment and try again.';
      } else if (code === 'API_KEY') {
        userMessage = 'API configuration error. Please contact support.';
      } else if (code === 'NETWORK') {
        userMessage = 'Network error. Please check your connection and try again.';
      }

      logger.error(
        {
          jobId: args.jobId,
          errorCode: code,
          retryable,
          errorMessage: err.message,
          errorName: err.name,
          stack: err.stack,
          keyDiagnostics,
          deployment: process.env.CONVEX_CLOUD_URL ?? 'unknown',
        },
        'Job processing failed'
      );

      // Mark job as failed
      await ctx.runMutation(internal.generationJobs.failJob, {
        jobId: args.jobId,
        errorMessage: userMessage,
        errorCode: code,
        retryable,
      });

      // Re-throw to signal failure
      throw error;
    }
  },
});
