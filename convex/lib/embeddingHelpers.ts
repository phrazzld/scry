/**
 * Embedding Helpers
 *
 * Utility functions for managing embeddings in the separate questionEmbeddings table.
 * Provides clean abstractions for CRUD operations on embeddings with proper error handling.
 *
 * Design principles:
 * - Single responsibility: Each function does one thing well
 * - Idempotent operations: Safe to call multiple times
 * - Minimal duplication: Only userId is duplicated (immutable, security-critical)
 * - Clear ownership: userId must match question's userId for all operations
 */

import { Id } from '../_generated/dataModel';
import { MutationCtx, QueryCtx } from '../_generated/server';

/**
 * Get embedding for a question
 *
 * @param ctx - Convex query context
 * @param questionId - Question ID to fetch embedding for
 * @returns Embedding record or null if not found
 *
 * Usage:
 * ```typescript
 * const embedding = await getEmbeddingForQuestion(ctx, questionId);
 * if (embedding) {
 *   // Use embedding.embedding for vector search
 * }
 * ```
 */
export async function getEmbeddingForQuestion(
  ctx: QueryCtx,
  questionId: Id<'questions'>
): Promise<{
  _id: Id<'questionEmbeddings'>;
  questionId: Id<'questions'>;
  userId: Id<'users'>;
  embedding: number[];
  embeddingGeneratedAt: number;
} | null> {
  return await ctx.db
    .query('questionEmbeddings')
    .withIndex('by_question', (q) => q.eq('questionId', questionId))
    .first();
}

/**
 * Delete embedding for a question
 *
 * Idempotent: Safe to call even if embedding doesn't exist.
 * Used when question text changes (triggers regeneration) or question is hard deleted.
 *
 * @param ctx - Convex mutation context
 * @param questionId - Question ID to delete embedding for
 * @returns true if embedding was deleted, false if didn't exist
 *
 * Usage:
 * ```typescript
 * // When question text changes
 * await deleteEmbeddingForQuestion(ctx, questionId);
 * // Daily cron will regenerate within 24 hours
 * ```
 */
export async function deleteEmbeddingForQuestion(
  ctx: MutationCtx,
  questionId: Id<'questions'>
): Promise<boolean> {
  const existing = await ctx.db
    .query('questionEmbeddings')
    .withIndex('by_question', (q) => q.eq('questionId', questionId))
    .first();

  if (!existing) {
    return false; // Already deleted or never existed
  }

  await ctx.db.delete(existing._id);
  return true;
}

/**
 * Upsert (create or update) embedding for a question
 *
 * Creates new embedding if doesn't exist, updates if exists.
 * Validates that userId matches question's userId for security.
 *
 * @param ctx - Convex mutation context
 * @param questionId - Question ID to create/update embedding for
 * @param userId - User ID (must match question's userId)
 * @param embedding - 768-dimensional vector
 * @param embeddingGeneratedAt - Optional timestamp of when embedding was generated (defaults to Date.now())
 * @returns Created or updated embedding ID
 * @throws Error if userId doesn't match question's userId
 *
 * Usage:
 * ```typescript
 * // After generating embedding from AI (uses current timestamp)
 * const embedding = await generateEmbedding(questionText);
 * const embeddingId = await upsertEmbeddingForQuestion(
 *   ctx,
 *   questionId,
 *   userId,
 *   embedding
 * );
 *
 * // Preserving existing timestamp during migration
 * const embeddingId = await upsertEmbeddingForQuestion(
 *   ctx,
 *   questionId,
 *   userId,
 *   embedding,
 *   question.embeddingGeneratedAt // Preserve original timestamp
 * );
 * ```
 */
export async function upsertEmbeddingForQuestion(
  ctx: MutationCtx,
  questionId: Id<'questions'>,
  userId: Id<'users'>,
  embedding: number[],
  embeddingGeneratedAt?: number
): Promise<Id<'questionEmbeddings'>> {
  // Validate question exists and userId matches (security check)
  const question = await ctx.db.get(questionId);
  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }
  if (question.userId !== userId) {
    throw new Error(
      `UserId mismatch: question belongs to ${question.userId}, attempted upsert with ${userId}`
    );
  }

  // Validate embedding dimensions (Google text-embedding-004 = 768 dims)
  if (embedding.length !== 768) {
    throw new Error(`Invalid embedding dimensions: expected 768, got ${embedding.length}`);
  }

  // Use provided timestamp or default to current time
  const timestamp = embeddingGeneratedAt ?? Date.now();

  // Atomic operation: delete any existing embedding, then insert
  // This prevents race conditions from creating duplicates
  const existing = await ctx.db
    .query('questionEmbeddings')
    .withIndex('by_question', (q) => q.eq('questionId', questionId))
    .first();

  if (existing) {
    await ctx.db.delete(existing._id);
  }

  // Always insert fresh record
  return await ctx.db.insert('questionEmbeddings', {
    questionId,
    userId,
    embedding,
    embeddingGeneratedAt: timestamp,
  });
}

/**
 * Get embeddings for multiple questions (batch fetch)
 *
 * Useful for backfill operations or batch processing.
 * More efficient than calling getEmbeddingForQuestion in a loop.
 *
 * @param ctx - Convex query context
 * @param userId - User ID to filter embeddings by (security)
 * @param limit - Maximum number of embeddings to fetch (default 100)
 * @returns Array of embedding records for the user
 *
 * Usage:
 * ```typescript
 * // Fetch embeddings for user's questions
 * const embeddings = await getEmbeddingsForUser(ctx, userId, 100);
 * // Returns up to 100 embeddings for this user
 * ```
 */
export async function getEmbeddingsForUser(
  ctx: QueryCtx,
  userId: Id<'users'>,
  limit: number = 100
): Promise<
  Array<{
    _id: Id<'questionEmbeddings'>;
    questionId: Id<'questions'>;
    userId: Id<'users'>;
    embedding: number[];
    embeddingGeneratedAt: number;
  }>
> {
  return await ctx.db
    .query('questionEmbeddings')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(limit);
}

/**
 * Count embeddings for a user
 *
 * Returns count of embeddings for a user.
 * Useful for monitoring backfill progress.
 *
 * @param ctx - Convex query context
 * @param userId - User ID to count embeddings for
 * @returns Number of embeddings for this user
 *
 * Usage:
 * ```typescript
 * const embeddingCount = await countEmbeddingsForUser(ctx, userId);
 * const questionCount = await countQuestionsForUser(ctx, userId);
 * const backfillProgress = (embeddingCount / questionCount) * 100;
 * ```
 */
export async function countEmbeddingsForUser(ctx: QueryCtx, userId: Id<'users'>): Promise<number> {
  const embeddings = await ctx.db
    .query('questionEmbeddings')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  return embeddings.length;
}
