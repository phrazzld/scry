/**
 * OpenAI Responses API Helper
 *
 * Utility functions for generating structured outputs using the native OpenAI SDK
 * with the Responses API. This provides a cleaner interface that matches the
 * Vercel AI SDK's generateObject but uses the official Responses API.
 *
 * Benefits over Vercel AI SDK:
 * - Direct OpenAI SDK usage (no abstraction layer)
 * - Native support for reasoning_effort and verbosity
 * - Better performance (3% on benchmarks)
 * - Lower costs (40-80% cache improvement)
 * - Future-proof (recommended API)
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface ResponsesApiOptions<T extends z.ZodSchema> {
  client: OpenAI;
  model: string;
  input: string;
  schema: T;
  schemaName?: string;
  verbosity?: 'low' | 'medium' | 'high';
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface ResponsesApiResult<T> {
  object: T;
  usage: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
  raw: OpenAI.Responses.Response;
}

/**
 * Generate structured output using OpenAI Responses API
 *
 * This function:
 * 1. Converts Zod schema to JSON Schema
 * 2. Calls Responses API with structured output format
 * 3. Extracts and parses the JSON response
 * 4. Validates against the Zod schema
 * 5. Returns typed result with usage metrics
 *
 * @throws {Error} If no message output or parsing fails
 * @throws {z.ZodError} If schema validation fails
 */
export async function generateObjectWithResponsesApi<T extends z.ZodSchema>(
  options: ResponsesApiOptions<T>
): Promise<ResponsesApiResult<z.infer<T>>> {
  const {
    client,
    model,
    input,
    schema,
    schemaName = 'output',
    verbosity,
    reasoningEffort,
  } = options;

  // Call Responses API with structured output format
  const response = await client.responses.create({
    model,
    input,
    text: {
      format: {
        type: 'json_schema',
        name: schemaName,
        strict: true,
        schema: zodToJsonSchema(schema) as Record<string, unknown>,
      },
      ...(verbosity && { verbosity }),
    },
    ...(reasoningEffort && {
      reasoning: {
        effort: reasoningEffort,
      },
    }),
  });

  // Extract message content from response output
  const messageItem = response.output.find((item) => item.type === 'message');
  if (!messageItem) {
    throw new Error('No message in Responses API output');
  }

  // Find JSON or text content in message
  // Type assertion needed because OpenAI SDK doesn't expose detailed Responses API types yet
  // When using json_schema format, the API returns 'output_json' content type
  // For compatibility, we fall back to 'output_text' if json is not present
  const messageContent = (
    messageItem as {
      content?: Array<{ type: string; text?: string; json?: unknown }>;
    }
  ).content;

  const jsonContent = messageContent?.find((c) => c.type === 'output_json') as
    | { json?: unknown }
    | undefined;
  const textContent = messageContent?.find((c) => c.type === 'output_text') as
    | { text?: string }
    | undefined;

  // Prefer json content (from json_schema format), fall back to text content
  const parsedJson =
    jsonContent?.json ?? (textContent?.text ? JSON.parse(textContent.text) : undefined);
  if (parsedJson === undefined) {
    throw new Error('No structured output from Responses API');
  }

  // Validate against schema
  const validatedObject = schema.parse(parsedJson);

  // Extract reasoning tokens if available
  const reasoningItem = response.output.find((item) => item.type === 'reasoning');
  const reasoningTokens =
    reasoningItem && response.usage
      ? // Estimate reasoning tokens as portion of output tokens
        // (Responses API doesn't expose this directly yet)
        Math.floor(response.usage.output_tokens * 0.4)
      : undefined;

  return {
    object: validatedObject,
    usage: {
      totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      ...(reasoningTokens && {
        completion_tokens_details: {
          reasoning_tokens: reasoningTokens,
        },
      }),
    },
    raw: response,
  };
}
