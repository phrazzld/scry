/**
 * Embeddings Service Module
 *
 * Deep module hiding Google AI API complexity for vector embeddings.
 * Provides simple interface for embedding generation, semantic search, and backfill sync.
 *
 * Interface:
 * - generateEmbedding(text): Generate 768-dim embedding vector
 * - searchQuestions(...): Hybrid semantic + text search (implemented in later phase)
 * - syncMissingEmbeddings(): Daily backfill cron (implemented in later phase)
 *
 * Hidden Complexity:
 * - Google AI API authentication and error handling
 * - Embedding model configuration (text-embedding-004)
 * - Rate limiting and batch processing
 * - Pino structured logging
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed } from 'ai';
import { v } from 'convex/values';
import pino from 'pino';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { action, internalAction, internalQuery } from './_generated/server';
import { requireUserFromClerk } from './clerk';

// Logger for this module
const logger = pino({ name: 'embeddings' });

/**
 * Secret diagnostics helper (reused pattern from aiGeneration.ts)
 * Provides safe logging of API key metadata without exposing the actual key
 */
type SecretDiagnostics = {
  present: boolean;
  length: number;
  fingerprint: string | null;
};

function getSecretDiagnostics(value: string | undefined): SecretDiagnostics {
  if (!value) {
    return {
      present: false,
      length: 0,
      fingerprint: null,
    };
  }

  // Simple FNV-1a hash for fingerprinting (collision-resistant for diagnostics)
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  const fingerprint = hash.toString(16).padStart(8, '0').slice(0, 8);

  return {
    present: true,
    length: value.length,
    fingerprint,
  };
}

/**
 * Generate embedding vector for text content
 *
 * Internal action that generates 768-dimensional embeddings using Google's text-embedding-004 model.
 * Handles API key validation, error logging, and graceful failure.
 *
 * @param text - Content to embed (typically question + explanation)
 * @returns 768-dimensional float64 array
 * @throws Error if API key missing or embedding generation fails
 */
export const generateEmbedding = internalAction({
  args: {},
  handler: async (ctx, args: { text: string }): Promise<number[]> => {
    const startTime = Date.now();

    // Validate API key
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    const keyDiagnostics = getSecretDiagnostics(apiKey);

    if (!apiKey || apiKey === '') {
      const errorMessage = 'GOOGLE_AI_API_KEY not configured in Convex environment';
      logger.error(
        {
          event: 'embeddings.generation.missing-key',
          keyDiagnostics,
          deployment: process.env.CONVEX_CLOUD_URL ?? 'unknown',
        },
        errorMessage
      );
      throw new Error(errorMessage);
    }

    // Initialize Google AI client
    const google = createGoogleGenerativeAI({ apiKey });

    try {
      // Generate embedding using text-embedding-004 (768 dimensions)
      const { embedding } = await embed({
        model: google.textEmbedding('text-embedding-004'),
        value: args.text,
      });

      const duration = Date.now() - startTime;

      logger.info(
        {
          event: 'embeddings.generation.success',
          dimensions: embedding.length,
          textLength: args.text.length,
          duration,
          model: 'text-embedding-004',
        },
        'Successfully generated embedding'
      );

      return embedding;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message || 'Unknown error';

      // Classify error for monitoring
      const isRateLimitError =
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.includes('429') ||
        errorMessage.toLowerCase().includes('quota');

      const isApiKeyError =
        errorMessage.includes('api key') ||
        errorMessage.includes('401') ||
        errorMessage.includes('unauthorized');

      const errorType = isApiKeyError
        ? 'api-key-error'
        : isRateLimitError
          ? 'rate-limit-error'
          : 'generation-error';

      logger.error(
        {
          event: 'embeddings.generation.failure',
          errorType,
          errorMessage,
          textLength: args.text.length,
          duration,
          model: 'text-embedding-004',
        },
        `Failed to generate embedding: ${errorMessage}`
      );

      // Re-throw with enhanced context
      const enhancedError = new Error(errorMessage) as Error & { errorType?: string };
      enhancedError.name = errorType;
      enhancedError.errorType = errorType;
      throw enhancedError;
    }
  },
});

/**
 * Internal helper to get authenticated user ID
 */
export const getAuthenticatedUserId = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<'users'>> => {
    const user = await requireUserFromClerk(ctx);
    return user._id;
  },
});

/**
 * Search questions by semantic similarity
 *
 * Public action that performs vector search on questions using embeddings.
 * Enforces userId filtering for security and respects view state (active/archived/trash).
 *
 * @param query - User search query (will be embedded for similarity matching)
 * @param limit - Maximum results to return (default 20, max 50)
 * @param view - Filter by question state: active, archived, or trash
 * @returns Array of questions sorted by similarity score (highest first)
 */
export const searchQuestions = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    view: v.optional(v.union(v.literal('active'), v.literal('archived'), v.literal('trash'))),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // Authenticate user via internal query
    const userId = await ctx.runQuery(internal.embeddings.getAuthenticatedUserId);

    // Validate and clamp limit (between 1 and 50)
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const view = args.view ?? 'active';

    logger.info(
      {
        event: 'embeddings.search.start',
        query: args.query,
        limit,
        view,
        userId,
      },
      'Starting vector search'
    );

    // Generate embedding for search query
    const queryEmbedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
      text: args.query,
    });

    // Build filter expression based on view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildFilter = (q: any) => {
      const filters = [q.eq('userId', userId)];

      switch (view) {
        case 'active':
          // Active: not deleted AND not archived
          filters.push(q.eq('deletedAt', undefined));
          filters.push(q.eq('archivedAt', undefined));
          break;
        case 'archived':
          // Archived: has archivedAt AND not deleted
          filters.push(q.neq('archivedAt', undefined));
          filters.push(q.eq('deletedAt', undefined));
          break;
        case 'trash':
          // Trash: has deletedAt (regardless of archived state)
          filters.push(q.neq('deletedAt', undefined));
          break;
      }

      return q.and(...filters);
    };

    // Perform vector search with filters
    const vectorResults = await ctx.vectorSearch('questions', 'by_embedding', {
      vector: queryEmbedding,
      limit,
      filter: buildFilter,
    });

    const duration = Date.now() - startTime;

    logger.info(
      {
        event: 'embeddings.search.success',
        query: args.query,
        resultCount: vectorResults.length,
        duration,
        view,
        userId,
      },
      'Vector search completed successfully'
    );

    // Return results with scores (already sorted by similarity, highest first)
    return vectorResults;
  },
});
