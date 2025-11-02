/**
 * Genesis Laboratory Execution Module
 *
 * Handles execution of infrastructure configurations for testing.
 * Supports both single-phase (recommended) and multi-phase prompt chains.
 * Supports Google AI and OpenAI providers (including GPT-5 reasoning models).
 *
 * RECOMMENDED: 1-phase learning science architecture (see PROD_CONFIG_METADATA)
 * LEGACY: Multi-phase chains with template interpolation (for experimentation)
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, type LanguageModel } from 'ai';
import { v } from 'convex/values';
import OpenAI from 'openai';
import pino from 'pino';
import { z } from 'zod';

import { action } from './_generated/server';
import { getSecretDiagnostics } from './lib/envDiagnostics';
import { generateObjectWithResponsesApi } from './lib/responsesApi';

// Logger for this module
const logger = pino({ name: 'lab' });

// Zod schema for question generation
const questionSchema = z.object({
  question: z.string(),
  type: z.enum(['multiple-choice', 'true-false']),
  options: z.array(z.string()).min(2).max(4),
  correctAnswer: z.string(),
  explanation: z.string(), // Required for OpenAI strict mode + learning science principles
});

const questionsSchema = z.object({
  questions: z.array(questionSchema),
});

/**
 * Template variable interpolation
 *
 * Replaces {{variableName}} with values from context object.
 * Throws error if variable is missing from context.
 */
function interpolateTemplate(template: string, context: Record<string, string>): string {
  // Find all {{variableName}} patterns
  const variablePattern = /\{\{(\w+)\}\}/g;
  let result = template;

  // Track missing variables
  const missingVars: string[] = [];

  result = template.replace(variablePattern, (match, varName) => {
    if (varName in context) {
      return context[varName];
    } else {
      missingVars.push(varName);
      return match; // Keep original if missing
    }
  });

  if (missingVars.length > 0) {
    throw new Error(`Missing template variables: ${missingVars.join(', ')}`);
  }

  return result;
}

/**
 * Execute a configuration against a test input
 *
 * Runs N-phase prompt chain sequentially, validates output against schema,
 * returns ExecutionResult with metrics.
 *
 * Note: This is a public action (not internal) to allow client calls from the lab UI.
 * The lab is dev-only (guarded by NODE_ENV check), and this function has no
 * security concerns (validates inputs, reads API key from env, returns safe data).
 */
export const executeConfig = action({
  args: {
    configId: v.string(),
    configName: v.string(),
    provider: v.string(),
    model: v.string(),
    // Google parameters
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
    // OpenAI reasoning parameters
    reasoningEffort: v.optional(
      v.union(v.literal('minimal'), v.literal('low'), v.literal('medium'), v.literal('high'))
    ),
    verbosity: v.optional(v.union(v.literal('low'), v.literal('medium'), v.literal('high'))),
    maxCompletionTokens: v.optional(v.number()),
    phases: v.array(
      v.object({
        name: v.string(),
        template: v.string(),
        outputTo: v.optional(v.string()),
        outputType: v.optional(v.union(v.literal('text'), v.literal('questions'))),
      })
    ),
    testInput: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      logger.info(
        {
          configId: args.configId,
          configName: args.configName,
          provider: args.provider,
          model: args.model,
          phasesCount: args.phases.length,
        },
        'Starting config execution'
      );

      // Initialize provider based on config
      let model: LanguageModel | undefined;
      let openaiClient: OpenAI | undefined;

      if (args.provider === 'google') {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        const keyDiagnostics = getSecretDiagnostics(apiKey);

        logger.info(
          {
            configId: args.configId,
            provider: 'google',
            keyDiagnostics,
            deployment: process.env.CONVEX_CLOUD_URL ?? 'unknown',
          },
          'Using Google AI provider'
        );

        if (!apiKey || apiKey === '') {
          const errorMessage = 'GOOGLE_AI_API_KEY not configured in Convex environment';
          logger.error({ configId: args.configId, keyDiagnostics }, errorMessage);
          throw new Error(errorMessage);
        }

        const google = createGoogleGenerativeAI({ apiKey });
        model = google(args.model) as unknown as LanguageModel;
      } else if (args.provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY;
        const keyDiagnostics = getSecretDiagnostics(apiKey);

        logger.info(
          {
            configId: args.configId,
            provider: 'openai',
            keyDiagnostics,
            deployment: process.env.CONVEX_CLOUD_URL ?? 'unknown',
          },
          'Using OpenAI provider with Responses API'
        );

        if (!apiKey || apiKey === '') {
          const errorMessage = 'OPENAI_API_KEY not configured in Convex environment';
          logger.error({ configId: args.configId, keyDiagnostics }, errorMessage);
          throw new Error(errorMessage);
        }

        openaiClient = new OpenAI({ apiKey });
      } else {
        throw new Error(`Provider '${args.provider}' not supported. Use 'google' or 'openai'.`);
      }

      // Execute N-phase chain
      const context: Record<string, string> = {
        userInput: args.testInput,
      };

      let finalOutput: unknown = null;
      let totalTokens = 0;

      for (let i = 0; i < args.phases.length; i++) {
        const phase = args.phases[i];
        logger.info(
          {
            configId: args.configId,
            phase: i + 1,
            phaseName: phase.name,
            outputType: phase.outputType || 'text',
          },
          'Executing phase'
        );

        // Interpolate template with current context
        const prompt = interpolateTemplate(phase.template, context);

        // Determine output type (default to 'questions' for final phase, 'text' otherwise)
        const outputType =
          phase.outputType || (i === args.phases.length - 1 ? 'questions' : 'text');

        // Execute phase based on output type
        if (outputType === 'text') {
          // Text output (Phase 1, 2) - only supported for Google provider
          if (!model) {
            throw new Error('Text output type requires Google provider (model not initialized)');
          }
          const { generateText: genText } = await import('ai');
          const response = await genText({
            model,
            prompt,
            // Standard parameters (Google + OpenAI)
            ...(args.temperature !== undefined && { temperature: args.temperature }),
            ...(args.maxTokens !== undefined && { maxTokens: args.maxTokens }),
            ...(args.topP !== undefined && { topP: args.topP }),
            // OpenAI reasoning parameters (ignored by Google models)
            ...(args.reasoningEffort && { reasoning_effort: args.reasoningEffort }),
            ...(args.verbosity && { verbosity: args.verbosity }),
            ...(args.maxCompletionTokens && { max_completion_tokens: args.maxCompletionTokens }),
          });

          const output = response.text;
          totalTokens += response.usage?.totalTokens || 0;

          // Store output in context for next phase
          if (phase.outputTo) {
            context[phase.outputTo] = output;
          }

          logger.info(
            {
              configId: args.configId,
              phase: i + 1,
              outputLength: output.length,
              tokensUsed: response.usage?.totalTokens || 0,
            },
            'Text phase completed'
          );
        } else if (outputType === 'questions') {
          // Questions output (Phase 3, 5)
          let response;

          if (args.provider === 'openai' && openaiClient) {
            // Use native Responses API for OpenAI
            response = await generateObjectWithResponsesApi({
              client: openaiClient,
              model: args.model,
              input: prompt,
              schema: questionsSchema,
              schemaName: 'questions',
              verbosity: args.verbosity,
              reasoningEffort: args.reasoningEffort,
            });
          } else if (args.provider === 'google' && model) {
            // Use Vercel AI SDK for Google
            response = await generateObject({
              model,
              schema: questionsSchema,
              prompt,
              ...(args.temperature !== undefined && { temperature: args.temperature }),
              ...(args.maxTokens !== undefined && { maxTokens: args.maxTokens }),
              ...(args.topP !== undefined && { topP: args.topP }),
            });
          } else {
            throw new Error('Provider not initialized correctly');
          }

          totalTokens += response.usage?.totalTokens || 0;

          // Store JSON output in context for next phase
          if (phase.outputTo) {
            context[phase.outputTo] = JSON.stringify(response.object);
          }

          // If this is the final phase, save as finalOutput
          if (i === args.phases.length - 1) {
            finalOutput = response.object;
          }

          // Log reasoning token usage if available (OpenAI)
          const reasoningTokens =
            (response.usage as { completion_tokens_details?: { reasoning_tokens?: number } })
              ?.completion_tokens_details?.reasoning_tokens || 0;

          logger.info(
            {
              configId: args.configId,
              phase: i + 1,
              questionCount: response.object.questions.length,
              tokensUsed: response.usage?.totalTokens || 0,
              reasoningTokens,
              ...(reasoningTokens > 0 &&
                response.usage?.totalTokens && {
                  reasoningPercentage: Math.round(
                    (reasoningTokens / response.usage.totalTokens) * 100
                  ),
                }),
            },
            'Questions phase completed'
          );
        }
      }

      // Validate final output
      let valid = false;
      let questions: unknown[] = [];

      // Determine if final phase expects questions output
      const finalPhase = args.phases[args.phases.length - 1];
      const expectsQuestions =
        finalPhase.outputType === 'questions' || (!finalPhase.outputType && args.phases.length > 1); // Default: expect questions if multi-phase

      if (expectsQuestions) {
        // Validate questions output
        if (finalOutput && typeof finalOutput === 'object' && 'questions' in finalOutput) {
          try {
            const validated = questionsSchema.parse(finalOutput);
            questions = validated.questions;
            valid = true;
          } catch (validationError) {
            errors.push(
              `Schema validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`
            );
            logger.warn(
              {
                configId: args.configId,
                validationError:
                  validationError instanceof Error
                    ? validationError.message
                    : String(validationError),
              },
              'Output failed schema validation'
            );
          }
        } else {
          errors.push('No valid output generated');
        }
      } else {
        // Text or error output - valid if phase completed without errors
        valid = errors.length === 0;
      }

      const latency = Date.now() - startTime;

      logger.info(
        {
          configId: args.configId,
          configName: args.configName,
          latency,
          totalTokens,
          questionCount: questions.length,
          valid,
          errorCount: errors.length,
        },
        'Config execution completed'
      );

      return {
        configId: args.configId,
        configName: args.configName,
        input: args.testInput,
        questions,
        rawOutput: finalOutput,
        latency,
        tokenCount: totalTokens,
        valid,
        errors,
        executedAt: Date.now(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      logger.error(
        {
          configId: args.configId,
          configName: args.configName,
          error: errorMessage,
          latency,
        },
        'Config execution failed'
      );

      return {
        configId: args.configId,
        configName: args.configName,
        input: args.testInput,
        questions: [],
        rawOutput: null,
        latency,
        tokenCount: 0,
        valid: false,
        errors,
        executedAt: Date.now(),
      };
    }
  },
});
