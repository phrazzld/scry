/**
 * Shared validation utilities for Convex mutations
 *
 * This module provides reusable validation helpers that enforce
 * consistency across mutations while reducing code duplication.
 */

import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

/**
 * Validate bulk ownership of questions
 *
 * Ensures all questions exist and belong to the specified user.
 * Uses atomic validation pattern: fetch ALL first, validate ALL,
 * then execute mutations. This prevents partial failures where
 * some operations succeed and others fail.
 *
 * **Atomic Validation Pattern:**
 * 1. Fetch all questions in parallel (Promise.all)
 * 2. Validate ALL questions before mutating ANY
 * 3. Throw on first validation failure (rollback all)
 * 4. Only proceed to mutations if ALL validations pass
 *
 * This ensures either ALL operations succeed or ALL fail together,
 * maintaining database consistency.
 *
 * @param ctx - Mutation context for database access
 * @param userId - ID of the user who must own all questions
 * @param questionIds - Array of question IDs to validate
 * @throws Error if any question not found or unauthorized
 * @returns Array of validated question documents (guaranteed to exist and be owned by user)
 *
 * @example
 * ```typescript
 * // In a bulk mutation
 * const user = await requireUserFromClerk(ctx);
 * const questions = await validateBulkOwnership(ctx, user._id, args.questionIds);
 * // At this point, all questions are guaranteed valid - safe to mutate
 * await Promise.all(questions.map(q => ctx.db.patch(q._id, { ... })));
 * ```
 */
export async function validateBulkOwnership(
  ctx: MutationCtx,
  userId: Id<'users'>,
  questionIds: Id<'questions'>[]
): Promise<Doc<'questions'>[]> {
  // Step 1: Fetch all questions in parallel
  const questions = await Promise.all(questionIds.map((id) => ctx.db.get(id)));

  // Step 2: Validate ALL before mutating ANY (atomic validation)
  questions.forEach((question, index) => {
    if (!question) {
      throw new Error(`Question not found: ${questionIds[index]}`);
    }
    if (question.userId !== userId) {
      throw new Error(`Unauthorized access to question: ${questionIds[index]}`);
    }
  });

  // Step 3: Return validated questions (TypeScript now knows they're non-null)
  return questions as Doc<'questions'>[];
}
