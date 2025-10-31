/**
 * Genesis Laboratory Execution Module
 *
 * Handles execution of infrastructure configurations for testing.
 * Supports multi-phase prompt chains with template interpolation.
 * Supports Google AI and OpenAI providers (including GPT-5 reasoning models).
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, type LanguageModel } from 'ai';
import { v } from 'convex/values';
import pino from 'pino';
import { z } from 'zod';

import { action } from './_generated/server';
import { getSecretDiagnostics } from './lib/envDiagnostics';

// Logger for this module
const logger = pino({ name: 'lab' });

// Zod schemas for question generation (reusing from aiGeneration)
const questionSchema = z.object({
  question: z.string(),
  type: z.enum(['multiple-choice', 'true-false']),
  options: z.array(z.string()).min(2).max(4),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
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
      let model: LanguageModel;
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
          'Using OpenAI provider'
        );

        if (!apiKey || apiKey === '') {
          const errorMessage = 'OPENAI_API_KEY not configured in Convex environment';
          logger.error({ configId: args.configId, keyDiagnostics }, errorMessage);
          throw new Error(errorMessage);
        }

        const openai = createOpenAI({ apiKey });
        model = openai(args.model) as unknown as LanguageModel;
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
          },
          'Executing phase'
        );

        // Interpolate template with current context
        const prompt = interpolateTemplate(phase.template, context);

        // Execute phase (use generateObject for final phase, generateText for intermediate)
        if (i === args.phases.length - 1) {
          // Final phase - expect structured output
          // Only include parameters if explicitly set (production omits them for model defaults)
          const response = await generateObject({
            model,
            schema: questionsSchema,
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

          finalOutput = response.object;
          totalTokens += response.usage?.totalTokens || 0;

          // Log reasoning token usage if available (OpenAI)
          // Type assertion needed as completion_tokens_details is OpenAI-specific
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
              ...(reasoningTokens > 0 && {
                reasoningPercentage: Math.round(
                  (reasoningTokens / response.usage.totalTokens) * 100
                ),
              }),
            },
            'Final phase completed'
          );
        } else {
          // Intermediate phase - text output
          const { generateText: genText } = await import('ai');
          // Only include parameters if explicitly set (production omits them for model defaults)
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
            'Intermediate phase completed'
          );
        }
      }

      // Validate final output
      let valid = false;
      let questions: unknown[] = [];

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
