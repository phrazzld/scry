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
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { action, internalAction, internalMutation, internalQuery } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { chunkArray } from './lib/chunkArray';
import {
  createConceptsLogger,
  generateCorrelationId,
  logConceptEvent,
  type LogContext,
} from './lib/logger';

// Logger for this module
const conceptsLogger = createConceptsLogger({
  module: 'embeddings',
});

const logger = {
  info(context: LogContext = {}, message = '') {
    conceptsLogger.info(message, context);
  },
  warn(context: LogContext = {}, message = '') {
    conceptsLogger.warn(message, context);
  },
  error(context: LogContext = {}, message = '') {
    conceptsLogger.error(message, context);
  },
};

const EMBEDDING_SYNC_CONFIG = {
  ttlMs: 1000 * 60 * 60 * 6, // 6 hours
  perUserLimit: 20,
  questionLimit: 60,
  conceptLimit: 40,
  phrasingLimit: 80,
  batchSize: 10,
  batchDelayMs: 1000,
} as const;

export function enforcePerUserLimit<T extends { userId: Id<'users'> }>(
  items: T[],
  perUserLimit: number
): T[] {
  if (perUserLimit <= 0) {
    return [];
  }

  const counts = new Map<string, number>();
  const limited: T[] = [];

  for (const item of items) {
    const key = item.userId.toString();
    const current = counts.get(key) ?? 0;
    if (current >= perUserLimit) {
      continue;
    }

    counts.set(key, current + 1);
    limited.push(item);
  }

  return limited;
}

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

    // Build filter expression for vector search
    // IMPORTANT: Convex vector search filters only support q.eq() and q.or() - NO q.and()
    // For AND conditions (userId + deletedAt + archivedAt), we must post-filter in action code
    // See: https://docs.convex.dev/search/vector-search (filter API limitations)
    //
    // Strategy: Filter by userId only at DB level, then post-filter by view state
    // This maintains security (userId prevents cross-user leaks) while enabling complex filtering
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildFilter = (q: any) => {
      // Only filter by userId in vector search (prevents cross-user data leaks)
      // View state filtering (active/archived/trash) happens post-fetch
      return q.eq('userId', userId);
    };

    // Perform vector search with userId-only filter (view filtering happens post-fetch)
    // Note: Vector search filters don't support AND conditions, so we filter by view state below
    const rawVectorResults = queryEmbedding
      ? await ctx.vectorSearch('questions', 'by_embedding', {
          vector: queryEmbedding,
          limit: limit * 2, // Get extra results for merging with text search
          filter: buildFilter,
        })
      : [];

    // Post-filter vector results by view state
    // Vector search returns partial documents, so we need full docs to check deletedAt/archivedAt
    let vectorResults: SearchResult[];
    if (rawVectorResults.length > 0) {
      // Fetch full documents to access deletedAt and archivedAt fields
      const questionIds = rawVectorResults.map((r) => r._id);
      const fullDocs = await ctx.runQuery(internal.embeddings.getQuestionsByIds, { questionIds });

      // Create score map for quick lookup (preserve vector similarity scores)
      const scoreMap = new Map(rawVectorResults.map((r) => [r._id.toString(), r._score]));

      // Apply view state filtering (active/archived/trash)
      const filteredDocs = filterResultsByView(fullDocs as SearchResult[], view);

      // Re-attach similarity scores from vector search
      vectorResults = filteredDocs.map(
        (doc) =>
          ({
            ...doc,
            _score: scoreMap.get(doc._id.toString()) ?? 0.5,
          }) as SearchResult
      );
    } else {
      vectorResults = [];
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
 * Type definition for search results with similarity scores
 *
 * Vector results have similarity scores (0.0-1.0), text results get default score 0.5
 * to rank them between low and high vector matches.
 */
type SearchResult = {
  _id: Id<'questions'>;
  _score: number;
  deletedAt?: number;
  archivedAt?: number;
  [key: string]: unknown;
};

/**
 * Filter search results by view state
 *
 * Applies post-filtering logic for view states that can't be expressed
 * in vector search filters (which only support q.eq and q.or, not q.and).
 *
 * @param results - Search results to filter
 * @param view - View state to filter by
 * @returns Filtered results matching the view criteria
 */
function filterResultsByView(
  results: SearchResult[],
  view: 'active' | 'archived' | 'trash'
): SearchResult[] {
  switch (view) {
    case 'active':
      // Active: not deleted AND not archived
      return results.filter((r) => !r.deletedAt && !r.archivedAt);
    case 'archived':
      // Archived: not deleted AND archived
      return results.filter((r) => !r.deletedAt && r.archivedAt);
    case 'trash':
      // Trash: deleted (regardless of archived state)
      return results.filter((r) => r.deletedAt);
  }
}

/**
 * Merge vector search and text search results
 *
 * Deduplicates by question ID, prioritizes vector results (semantic similarity),
 * and returns top N results sorted by score.
 */

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
    cutoff: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const cutoff = args.cutoff ?? Date.now();

    // Query questions where embedding is undefined
    // Only active questions (not deleted or archived) to avoid wasting API calls
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_user_active')
      .filter((q) =>
        q.and(
          q.eq(q.field('deletedAt'), undefined),
          q.eq(q.field('archivedAt'), undefined),
          q.or(q.eq(q.field('embedding'), undefined), q.lt(q.field('embeddingGeneratedAt'), cutoff))
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
  args: {
    cutoff: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const SAMPLE_LIMIT = 1000;
    const cutoff = args.cutoff ?? Date.now();

    const questions = await ctx.db
      .query('questions')
      .withIndex('by_user_active')
      .filter((q) =>
        q.and(
          q.eq(q.field('deletedAt'), undefined),
          q.eq(q.field('archivedAt'), undefined),
          q.or(q.eq(q.field('embedding'), undefined), q.lt(q.field('embeddingGeneratedAt'), cutoff))
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

export const getConceptsWithoutEmbeddings = internalQuery({
  args: {
    limit: v.optional(v.number()),
    cutoff: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const cutoff = args.cutoff ?? Date.now();

    const concepts = await ctx.db
      .query('concepts')
      .filter((q) =>
        q.or(q.eq(q.field('embedding'), undefined), q.lt(q.field('embeddingGeneratedAt'), cutoff))
      )
      .take(limit * 3);

    return concepts.slice(0, limit);
  },
});

export const countConceptsWithoutEmbeddings = internalQuery({
  args: {
    cutoff: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const SAMPLE_LIMIT = 1000;
    const cutoff = args.cutoff ?? Date.now();

    const concepts = await ctx.db
      .query('concepts')
      .filter((q) =>
        q.or(q.eq(q.field('embedding'), undefined), q.lt(q.field('embeddingGeneratedAt'), cutoff))
      )
      .take(SAMPLE_LIMIT);

    return {
      count: concepts.length,
      isApproximate: concepts.length === SAMPLE_LIMIT,
    };
  },
});

export const getPhrasingsWithoutEmbeddings = internalQuery({
  args: {
    limit: v.optional(v.number()),
    cutoff: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 80;
    const cutoff = args.cutoff ?? Date.now();

    const phrasings = await ctx.db
      .query('phrasings')
      .filter((q) =>
        q.and(
          q.eq(q.field('deletedAt'), undefined),
          q.eq(q.field('archivedAt'), undefined),
          q.or(q.eq(q.field('embedding'), undefined), q.lt(q.field('embeddingGeneratedAt'), cutoff))
        )
      )
      .take(limit);

    return phrasings;
  },
});

export const countPhrasingsWithoutEmbeddings = internalQuery({
  args: {
    cutoff: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const SAMPLE_LIMIT = 1000;
    const cutoff = args.cutoff ?? Date.now();

    const phrasings = await ctx.db
      .query('phrasings')
      .filter((q) =>
        q.and(
          q.eq(q.field('deletedAt'), undefined),
          q.eq(q.field('archivedAt'), undefined),
          q.or(q.eq(q.field('embedding'), undefined), q.lt(q.field('embeddingGeneratedAt'), cutoff))
        )
      )
      .take(SAMPLE_LIMIT);

    return {
      count: phrasings.length,
      isApproximate: phrasings.length === SAMPLE_LIMIT,
    };
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

export const saveConceptEmbedding = internalMutation({
  args: {
    conceptId: v.id('concepts'),
    embedding: v.array(v.float64()),
    embeddingGeneratedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conceptId, {
      embedding: args.embedding,
      embeddingGeneratedAt: args.embeddingGeneratedAt,
    });
  },
});

export const savePhrasingEmbedding = internalMutation({
  args: {
    phrasingId: v.id('phrasings'),
    embedding: v.array(v.float64()),
    embeddingGeneratedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.phrasingId, {
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
    const cutoff = Date.now() - EMBEDDING_SYNC_CONFIG.ttlMs;
    const correlationId = generateCorrelationId('embeddings-sync');
    const syncMetadata = {
      phase: 'embeddings_sync' as const,
      correlationId,
    };

    const [questions, concepts, phrasings] = await Promise.all([
      ctx.runQuery(internal.embeddings.getQuestionsWithoutEmbeddings, {
        limit: EMBEDDING_SYNC_CONFIG.questionLimit,
        cutoff,
      }),
      ctx.runQuery(internal.embeddings.getConceptsWithoutEmbeddings, {
        limit: EMBEDDING_SYNC_CONFIG.conceptLimit,
        cutoff,
      }),
      ctx.runQuery(internal.embeddings.getPhrasingsWithoutEmbeddings, {
        limit: EMBEDDING_SYNC_CONFIG.phrasingLimit,
        cutoff,
      }),
    ]);

    const limitedQuestions: Doc<'questions'>[] = enforcePerUserLimit<Doc<'questions'>>(
      questions,
      EMBEDDING_SYNC_CONFIG.perUserLimit
    );
    const limitedConcepts: Doc<'concepts'>[] = enforcePerUserLimit<Doc<'concepts'>>(
      concepts,
      EMBEDDING_SYNC_CONFIG.perUserLimit
    );
    const limitedPhrasings: Doc<'phrasings'>[] = enforcePerUserLimit<Doc<'phrasings'>>(
      phrasings,
      EMBEDDING_SYNC_CONFIG.perUserLimit
    );

    const totalCandidates =
      limitedQuestions.length + limitedConcepts.length + limitedPhrasings.length;

    if (totalCandidates === 0) {
      logConceptEvent(conceptsLogger, 'info', 'Embedding sync no-op', {
        ...syncMetadata,
        event: 'noop',
        questionCandidates: questions.length,
        conceptCandidates: concepts.length,
        phrasingCandidates: phrasings.length,
        duration: Date.now() - startTime,
      });
      return;
    }

    logConceptEvent(conceptsLogger, 'info', 'Embedding sync started', {
      ...syncMetadata,
      event: 'start',
      questionCandidates: limitedQuestions.length,
      conceptCandidates: limitedConcepts.length,
      phrasingCandidates: limitedPhrasings.length,
      cutoff,
    });

    type QuestionDoc = (typeof limitedQuestions)[number];
    type ConceptDoc = (typeof limitedConcepts)[number];
    type PhrasingDoc = (typeof limitedPhrasings)[number];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processItems = async <T extends { _id: Id<any>; userId: Id<'users'> }>(
      label: string,
      items: T[],
      getText: (item: T) => string | null,
      save: (item: T, embedding: number[], timestamp: number) => Promise<void>
    ) => {
      if (items.length === 0) {
        return { success: 0, failure: 0 };
      }

      const batches = chunkArray(items, EMBEDDING_SYNC_CONFIG.batchSize);
      let success = 0;
      let failure = 0;

      for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            const text = getText(item);
            if (!text || text.trim().length === 0) {
              throw new Error('EMPTY_EMBEDDING_TEXT');
            }

            const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
              text,
            });

            await save(item, embedding, Date.now());
          })
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            success += 1;
          } else {
            failure += 1;
            const current = batch[index];
            logger.warn(
              {
                event: 'embeddings.sync.item-failure',
                label,
                id: current._id,
                userId: current.userId,
                reason:
                  result.reason instanceof Error ? result.reason.message : String(result.reason),
              },
              `Failed to sync embedding for ${label.slice(0, -1)}`
            );
          }
        });

        if (i < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, EMBEDDING_SYNC_CONFIG.batchDelayMs));
        }
      }

      return { success, failure };
    };

    const questionStats = await processItems<QuestionDoc>(
      'questions',
      limitedQuestions,
      (question) => `${question.question}\n\n${question.explanation ?? ''}`.trim(),
      (question, embedding, timestamp) =>
        ctx.runMutation(internal.embeddings.saveEmbedding, {
          questionId: question._id,
          embedding,
          embeddingGeneratedAt: timestamp,
        })
    );

    const conceptStats = await processItems<ConceptDoc>(
      'concepts',
      limitedConcepts,
      (concept) => `${concept.title}\n\n${concept.description ?? ''}`.trim(),
      (concept, embedding, timestamp) =>
        ctx.runMutation(internal.embeddings.saveConceptEmbedding, {
          conceptId: concept._id,
          embedding,
          embeddingGeneratedAt: timestamp,
        })
    );

    const phrasingStats = await processItems<PhrasingDoc>(
      'phrasings',
      limitedPhrasings,
      (phrasing) => `${phrasing.question}\n\n${phrasing.explanation ?? ''}`.trim(),
      (phrasing, embedding, timestamp) =>
        ctx.runMutation(internal.embeddings.savePhrasingEmbedding, {
          phrasingId: phrasing._id,
          embedding,
          embeddingGeneratedAt: timestamp,
        })
    );

    const duration = Date.now() - startTime;

    const [remainingQuestions, remainingConcepts, remainingPhrasings] = await Promise.all([
      ctx.runQuery(internal.embeddings.countQuestionsWithoutEmbeddings, { cutoff }),
      ctx.runQuery(internal.embeddings.countConceptsWithoutEmbeddings, { cutoff }),
      ctx.runQuery(internal.embeddings.countPhrasingsWithoutEmbeddings, { cutoff }),
    ]);

    logConceptEvent(conceptsLogger, 'info', 'Embedding sync completed', {
      ...syncMetadata,
      event: 'completed',
      questionProcessed: questionStats.success,
      questionFailed: questionStats.failure,
      conceptProcessed: conceptStats.success,
      conceptFailed: conceptStats.failure,
      phrasingProcessed: phrasingStats.success,
      phrasingFailed: phrasingStats.failure,
      duration,
      remainingQuestions: remainingQuestions.count,
      remainingConcepts: remainingConcepts.count,
      remainingPhrasings: remainingPhrasings.count,
      remainingQuestionsApprox: remainingQuestions.isApproximate,
      remainingConceptsApprox: remainingConcepts.isApproximate,
      remainingPhrasingsApprox: remainingPhrasings.isApproximate,
    });
  },
});
