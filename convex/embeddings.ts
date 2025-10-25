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
import { action, internalAction, internalMutation, internalQuery } from './_generated/server';
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
  args: { text: v.string() },
  handler: async (ctx, args): Promise<number[]> => {
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
 * Internal helper to fetch questions by IDs
 */
export const getQuestionsByIds = internalQuery({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const questions = await Promise.all(args.questionIds.map((id) => ctx.db.get(id)));
    return questions.filter((q): q is NonNullable<typeof q> => q !== null);
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

    // Validate query length to prevent excessive API costs
    const MAX_QUERY_LENGTH = 500;
    if (args.query.length > MAX_QUERY_LENGTH) {
      throw new Error(
        `Search query too long: ${args.query.length} characters (max ${MAX_QUERY_LENGTH})`
      );
    }

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

    // Generate embedding for search query (with graceful degradation)
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
        text: args.query,
      });
    } catch (error) {
      logger.warn(
        {
          event: 'embeddings.search.embedding-failed',
          query: args.query,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to generate query embedding, falling back to text-only search'
      );
    }

    // Build filter expression based on view
    // Note: Vector search filterFields only support 'eq' checks on optional fields
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
          // Archived: Filter for not-deleted only (archivedAt filtering happens post-fetch)
          // Can't use neq in vector search, so we post-filter archivedAt below
          filters.push(q.eq('deletedAt', undefined));
          break;
        case 'trash':
          // Trash: Can't use neq in vector search, so we skip vector search for trash view
          // (will rely on text search only)
          break;
      }

      return q.and(...filters);
    };

    // Perform vector search with filters (only if embedding generation succeeded)
    // Skip vector search for trash view (can't filter with neq)
    const rawVectorResults =
      queryEmbedding && view !== 'trash'
        ? await ctx.vectorSearch('questions', 'by_embedding', {
            vector: queryEmbedding,
            limit: limit * 2, // Get extra results for merging
            filter: buildFilter,
          })
        : [];

    // Post-filter vector results for archived view (fetch full docs to check archivedAt)
    let vectorResults: SearchResult[];
    if (view === 'archived' && rawVectorResults.length > 0) {
      // Fetch full documents to check archivedAt field
      const questionIds = rawVectorResults.map((r) => r._id);
      const fullDocs: Array<{
        _id: Id<'questions'>;
        archivedAt?: number;
        [key: string]: unknown;
      }> = await ctx.runQuery(internal.embeddings.getQuestionsByIds, { questionIds });

      // Create score map for quick lookup
      const scoreMap = new Map(rawVectorResults.map((r) => [r._id.toString(), r._score]));

      // Filter for archived questions only and add scores
      vectorResults = fullDocs
        .filter((doc) => doc.archivedAt !== undefined)
        .map(
          (doc) =>
            ({
              ...doc,
              _score: scoreMap.get(doc._id.toString()) ?? 0.5,
            }) as SearchResult
        );
    } else {
      vectorResults = rawVectorResults;
    }

    // Perform text search for keyword matching
    const textResults = await ctx.runQuery(internal.questionsLibrary.textSearchQuestions, {
      query: args.query,
      limit,
      userId,
      view,
    });

    // Merge results: Deduplicate by _id, prioritize vector results, sort by score
    const mergedResults = mergeSearchResults(vectorResults, textResults, limit);

    const duration = Date.now() - startTime;

    logger.info(
      {
        event: 'embeddings.search.success',
        query: args.query,
        vectorCount: vectorResults.length,
        textCount: textResults.length,
        mergedCount: mergedResults.length,
        duration,
        view,
        userId,
      },
      'Hybrid search completed successfully'
    );

    // Return merged results sorted by score (highest first)
    return mergedResults;
  },
});

/**
 * Merge vector search and text search results
 *
 * Deduplicates by question ID, prioritizes vector results (semantic similarity),
 * and returns top N results sorted by score.
 *
 * Vector results have similarity scores (0.0-1.0), text results get default score 0.5
 * to rank them between low and high vector matches.
 */
type SearchResult = {
  _id: Id<'questions'>;
  _score: number;
  [key: string]: unknown;
};

function mergeSearchResults(
  vectorResults: SearchResult[],
  textResults: unknown[],
  limit: number
): SearchResult[] {
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  // Add vector results first (semantic similarity - usually more relevant)
  for (const result of vectorResults) {
    const id = result._id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(result);
    }
  }

  // Add text results that aren't duplicates
  // Assign default score of 0.5 to text-only matches (between low/high vector scores)
  for (const result of textResults) {
    const typedResult = result as { _id: Id<'questions'>; [key: string]: unknown };
    const id = typedResult._id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      merged.push({
        ...typedResult,
        _score: 0.5, // Default score for keyword matches
      } as SearchResult);
    }
  }

  // Sort by score descending and take top N
  return merged.sort((a, b) => b._score - a._score).slice(0, limit);
}

/**
 * Get questions without embeddings for backfill sync
 *
 * Internal query used by daily sync cron to identify questions that need embeddings.
 * Limits results to prevent overwhelming the sync process.
 *
 * @param limit - Maximum questions to return (default 100 for daily sync)
 * @returns Array of questions without embeddings
 */
export const getQuestionsWithoutEmbeddings = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    // Query questions where embedding is undefined
    // Only active questions (not deleted or archived) to avoid wasting API calls
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_user_active')
      .filter((q) =>
        q.and(
          q.eq(q.field('embedding'), undefined),
          q.eq(q.field('deletedAt'), undefined),
          q.eq(q.field('archivedAt'), undefined)
        )
      )
      .take(limit);

    return questions;
  },
});

/**
 * Count questions without embeddings
 *
 * Used for monitoring and progress tracking of backfill sync.
 *
 * @returns Count of questions missing embeddings
 */
export const countQuestionsWithoutEmbeddings = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Use take with a reasonable limit for counting (avoid unbounded queries)
    // If count exceeds limit, return "limit+" to indicate "at least this many"
    const SAMPLE_LIMIT = 1000;

    const questions = await ctx.db
      .query('questions')
      .withIndex('by_user_active')
      .filter((q) =>
        q.and(
          q.eq(q.field('embedding'), undefined),
          q.eq(q.field('deletedAt'), undefined),
          q.eq(q.field('archivedAt'), undefined)
        )
      )
      .take(SAMPLE_LIMIT);

    return {
      count: questions.length,
      isApproximate: questions.length === SAMPLE_LIMIT,
    };
  },
});

/**
 * Get a single question for embedding generation
 *
 * Internal query used by sync to fetch full question data.
 *
 * @param questionId - ID of question to fetch
 * @returns Question document or null if not found
 */
export const getQuestionForEmbedding = internalQuery({
  args: {
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId);
    return question;
  },
});

/**
 * Save embedding to a question
 *
 * Internal mutation used by sync to update questions with generated embeddings.
 *
 * @param questionId - ID of question to update
 * @param embedding - 768-dimensional embedding vector
 * @param timestamp - When embedding was generated
 */
export const saveEmbedding = internalMutation({
  args: {
    questionId: v.id('questions'),
    embedding: v.array(v.float64()),
    embeddingGeneratedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questionId, {
      embedding: args.embedding,
      embeddingGeneratedAt: args.embeddingGeneratedAt,
    });
  },
});

/**
 * Sync missing embeddings (daily cron)
 *
 * Backfills embeddings for questions that don't have them.
 * Processes up to 100 questions/day in batches of 10 to respect rate limits.
 *
 * Scheduled to run daily at 3:30 AM UTC via cron.ts
 */
export const syncMissingEmbeddings = internalAction({
  args: {},
  handler: async (ctx) => {
    const startTime = Date.now();

    // Fetch questions without embeddings
    const questions = await ctx.runQuery(internal.embeddings.getQuestionsWithoutEmbeddings, {
      limit: 100,
    });

    // Type the questions array (from the internal query return type)
    type Question = (typeof questions)[number];

    if (questions.length === 0) {
      logger.info(
        {
          event: 'embeddings.sync.complete',
          count: 0,
          duration: Date.now() - startTime,
        },
        'No questions need embeddings'
      );
      return;
    }

    logger.info(
      {
        event: 'embeddings.sync.start',
        count: questions.length,
      },
      `Starting embedding sync for ${questions.length} questions`
    );

    // Process in batches of 10 for rate limit protection
    const BATCH_SIZE = 10;
    const batches = chunkArray(questions, BATCH_SIZE);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];

      // Process batch in parallel using Promise.allSettled
      const results = await Promise.allSettled(
        batch.map(async (question: Question) => {
          // Combine question + explanation for embedding
          const text = `${question.question} ${question.explanation || ''}`;

          // Generate embedding
          const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
            text,
          });

          // Save to database
          await ctx.runMutation(internal.embeddings.saveEmbedding, {
            questionId: question._id,
            embedding,
            embeddingGeneratedAt: Date.now(),
          });

          return question._id;
        })
      );

      // Count successes and failures
      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount += 1;
        } else {
          failureCount += 1;
          logger.error(
            {
              event: 'embeddings.sync.batch-failure',
              error: result.reason,
              batch: i + 1,
            },
            'Failed to generate embedding in batch'
          );
        }
      }

      // Rate limit protection: Sleep 1 second between batches (except last)
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const duration = Date.now() - startTime;

    // Get remaining count for logging
    const remaining = await ctx.runQuery(internal.embeddings.countQuestionsWithoutEmbeddings);

    logger.info(
      {
        event: 'embeddings.sync.complete',
        successCount,
        failureCount,
        totalProcessed: successCount + failureCount,
        duration,
        remainingCount: remaining.count,
        remainingIsApproximate: remaining.isApproximate,
      },
      `Embedding sync complete: ${successCount} success, ${failureCount} failed, ${remaining.count} remaining`
    );
  },
});

/**
 * Helper to chunk array into batches
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
