/**
 * Question CRUD Operations
 *
 * Handles the lifecycle of individual questions: creation, updates, and soft deletion.
 * Hides field validation complexity, FSRS initialization, and ownership verification.
 * New questions are initialized with FSRS scheduling fields via the scheduling abstraction.
 *
 * Note: Bulk operations (archive, bulkDelete, restore, etc.) are in questionsBulk.ts
 */
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { trackEvent } from './lib/analytics';
import { deleteEmbeddingForQuestion, upsertEmbeddingForQuestion } from './lib/embeddingHelpers';
import { updateStatsCounters } from './lib/userStatsHelpers';
import { getScheduler } from './scheduling';

/**
 * Save AI-generated questions with FSRS initialization
 *
 * Public mutation called from frontend when users manually save generated questions.
 * Initializes FSRS fields for new questions to prepare them for spaced repetition.
 */
export const saveGeneratedQuestions = mutation({
  args: {
    questions: v.array(
      v.object({
        question: v.string(),
        type: v.optional(v.union(v.literal('multiple-choice'), v.literal('true-false'))),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Initialize FSRS card for new questions
    const scheduler = getScheduler();
    const fsrsFields = scheduler.initializeCard();

    const questionIds = await Promise.all(
      args.questions.map((q) =>
        ctx.db.insert('questions', {
          userId,
          question: q.question,
          type: q.type || 'multiple-choice',
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          generatedAt: Date.now(),
          attemptCount: 0,
          correctCount: 0,
          // Initialize FSRS fields with proper defaults
          ...fsrsFields,
        })
      )
    );

    // Update userStats with new question counts (incremental bandwidth optimization)
    // All new questions start in 'new' state
    await updateStatsCounters(ctx, userId, {
      totalCards: questionIds.length,
      newCount: questionIds.length,
    });

    trackEvent('Question Created', {
      userId: String(userId),
      questionId: questionIds.length === 1 ? String(questionIds[0]) : 'batch',
      source: 'ai',
      questionCount: questionIds.length,
    });

    return { questionIds, count: questionIds.length };
  },
});

/**
 * Internal mutation to save a batch of questions
 *
 * Called by the AI generation action to save questions as they're generated.
 * This is an internal mutation so it can be called from actions without authentication
 * (the action handles authentication by passing the userId).
 */
export const saveBatch = internalMutation({
  args: {
    userId: v.id('users'),
    questions: v.array(
      v.object({
        question: v.string(),
        type: v.optional(v.union(v.literal('multiple-choice'), v.literal('true-false'))),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        // Optional embedding fields for semantic search
        embedding: v.optional(v.array(v.float64())),
        embeddingGeneratedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args): Promise<Id<'questions'>[]> => {
    // Initialize FSRS card for new questions
    const scheduler = getScheduler();
    const fsrsFields = scheduler.initializeCard();

    // Insert all questions in parallel
    const questionIds = await Promise.all(
      args.questions.map((q) =>
        ctx.db.insert('questions', {
          userId: args.userId,
          question: q.question,
          type: q.type || 'multiple-choice',
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          generatedAt: Date.now(),
          attemptCount: 0,
          correctCount: 0,
          // Initialize FSRS fields with proper defaults
          ...fsrsFields,
        })
      )
    );

    // Save embeddings to questionEmbeddings table (separate for bandwidth optimization)
    if (args.questions.some((q) => q.embedding)) {
      await Promise.all(
        args.questions.map((q, index) => {
          // Only save if embedding was provided
          if (q.embedding) {
            return upsertEmbeddingForQuestion(
              ctx,
              questionIds[index],
              args.userId,
              q.embedding,
              q.embeddingGeneratedAt
            );
          }
          return Promise.resolve();
        })
      );
    }

    // Update userStats with new question counts (incremental bandwidth optimization)
    // All new questions start in 'new' state
    await updateStatsCounters(ctx, args.userId, {
      totalCards: questionIds.length,
      newCount: questionIds.length,
    });

    trackEvent('Question Created', {
      userId: String(args.userId),
      questionId: questionIds.length === 1 ? String(questionIds[0]) : 'batch',
      source: 'ai',
      questionCount: questionIds.length,
    });

    return questionIds;
  },
});

/**
 * Update question content (creator-only)
 *
 * Validates all field changes and ensures data integrity.
 * Preserves FSRS scheduling data when editing question content.
 */
export const updateQuestion = mutation({
  args: {
    questionId: v.id('questions'),
    question: v.optional(v.string()),
    explanation: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // 2. Verify ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== userId) {
      throw new Error(`Question not found or unauthorized: ${args.questionId}`);
    }

    // 3. Check if already deleted
    if (question.deletedAt) {
      throw new Error('Cannot update deleted question');
    }

    // 4. Input validation
    if (args.question !== undefined && args.question.trim().length === 0) {
      throw new Error('Question cannot be empty');
    }

    if (args.options !== undefined) {
      if (args.options.length < 2) {
        throw new Error('At least 2 answer options are required');
      }
      if (args.options.length > 6) {
        throw new Error('Maximum 6 answer options allowed');
      }
      if (args.options.some((opt) => !opt.trim())) {
        throw new Error('All answer options must have text');
      }
    }

    if (args.correctAnswer !== undefined && args.correctAnswer.trim().length === 0) {
      throw new Error('Correct answer cannot be empty');
    }

    // If updating options, ensure correctAnswer is still valid
    if (args.options !== undefined && args.correctAnswer === undefined) {
      if (!args.options.includes(question.correctAnswer)) {
        throw new Error('Current correct answer must be included in new options');
      }
    }

    // If updating both, ensure correctAnswer is in options
    if (args.options !== undefined && args.correctAnswer !== undefined) {
      if (!args.options.includes(args.correctAnswer)) {
        throw new Error('Correct answer must be one of the options');
      }
    }

    // 5. Build update fields
    const updateFields: Partial<typeof question> = {};
    if (args.question !== undefined) updateFields.question = args.question;
    if (args.explanation !== undefined) updateFields.explanation = args.explanation;
    if (args.options !== undefined) updateFields.options = args.options;
    if (args.correctAnswer !== undefined) updateFields.correctAnswer = args.correctAnswer;

    // 5.1. Clear embedding if question/explanation text changed
    // CRITICAL: Embeddings are generated from question + explanation text (see embeddings.ts:579)
    // If text changes, the stored embedding becomes stale and will NEVER be updated because
    // the daily backfill cron (syncMissingEmbeddings) only processes embedding === undefined.
    //
    // Solution: Delete embedding when text changes so the daily cron regenerates it within 24hrs.
    // This is better than permanent staleness. During the delay, the question will be missing from
    // vector search but still appears in text search (keyword matching).
    //
    // Note: We don't clear embedding for options/correctAnswer changes because embeddings only
    // use question + explanation text, not answer options.
    const textChanged = args.question !== undefined || args.explanation !== undefined;
    if (textChanged) {
      // Delete from questionEmbeddings table when text changes
      await deleteEmbeddingForQuestion(ctx, args.questionId);
      updateFields.embedding = undefined;
      updateFields.embeddingGeneratedAt = undefined;
    }

    // 6. Update with timestamp
    await ctx.db.patch(args.questionId, {
      ...updateFields,
      updatedAt: Date.now(),
    });

    trackEvent('Question Updated', {
      userId: String(userId),
      questionId: String(args.questionId),
      source: 'manual',
    });

    return {
      success: true,
      questionId: args.questionId,
      message: 'Question updated successfully',
    };
  },
});

/**
 * Soft delete a question (creator-only)
 *
 * @deprecated Use bulkDelete from questionsBulk.ts for consistent UX
 * Marks the question as deleted but preserves it in the database
 * to maintain FSRS history and enable potential restoration.
 */
export const softDeleteQuestion = mutation({
  args: {
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // 2. Verify ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== userId) {
      throw new Error(`Question not found or unauthorized: ${args.questionId}`);
    }

    // 3. Check if already deleted
    if (question.deletedAt) {
      throw new Error('Question is already deleted');
    }

    // 4. Soft delete with timestamp
    await ctx.db.patch(args.questionId, {
      deletedAt: Date.now(),
    });

    trackEvent('Question Deleted', {
      userId: String(userId),
      questionId: String(args.questionId),
      source: 'manual',
    });

    return {
      success: true,
      questionId: args.questionId,
      message: 'Question deleted successfully',
    };
  },
});

/**
 * Restore a soft-deleted question (creator-only)
 *
 * @deprecated Use restoreQuestions from questionsBulk.ts for consistent UX
 * Allows users to undo a deletion within the recovery window.
 */
export const restoreQuestion = mutation({
  args: {
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    // 1. Authenticate user
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // 2. Verify ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== userId) {
      throw new Error(`Question not found or unauthorized: ${args.questionId}`);
    }

    // 3. Check if deleted
    if (!question.deletedAt) {
      throw new Error('Question is not deleted');
    }

    // 4. Restore by removing deletedAt
    await ctx.db.patch(args.questionId, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });

    trackEvent('Question Restored', {
      userId: String(userId),
      questionId: String(args.questionId),
      source: 'manual',
    });

    return {
      success: true,
      questionId: args.questionId,
      message: 'Question restored successfully',
    };
  },
});
