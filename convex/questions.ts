import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { cardToDb, initializeCard, scheduleNextReview } from './fsrs';

export const saveGeneratedQuestions = mutation({
  args: {
    topic: v.string(),
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
    const initialCard = initializeCard();
    const fsrsFields = cardToDb(initialCard);

    const questionIds = await Promise.all(
      args.questions.map((q) =>
        ctx.db.insert('questions', {
          userId,
          topic: args.topic,
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
    topic: v.string(),
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
  handler: async (ctx, args): Promise<Id<'questions'>[]> => {
    // Initialize FSRS card for new questions
    const initialCard = initializeCard();
    const fsrsFields = cardToDb(initialCard);

    // Insert all questions in parallel
    const questionIds = await Promise.all(
      args.questions.map((q) =>
        ctx.db.insert('questions', {
          userId: args.userId,
          topic: args.topic,
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

    return questionIds;
  },
});

/**
 * Record a user's interaction with a question and automatically schedule next review
 *
 * This mutation integrates Scry's automatic rating system directly into the interaction
 * recording process. When a user answers a question, we automatically:
 * 1. Record the interaction with timing and correctness data
 * 2. Update denormalized statistics on the question
 * 3. Calculate and apply FSRS scheduling using automatic rating
 *
 * The automatic rating approach means users never see traditional confidence buttons
 * (Again/Hard/Good/Easy). Instead, the system infers the appropriate rating from
 * whether they answered correctly or not.
 *
 * @returns Scheduling information including next review time for immediate display
 */
export const recordInteraction = mutation({
  args: {
    questionId: v.id('questions'),
    userAnswer: v.string(),
    isCorrect: v.boolean(),
    timeSpent: v.optional(v.number()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Verify user owns this question
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== userId) {
      throw new Error('Question not found or unauthorized');
    }

    // Record interaction
    await ctx.db.insert('interactions', {
      userId,
      questionId: args.questionId,
      userAnswer: args.userAnswer,
      isCorrect: args.isCorrect,
      attemptedAt: Date.now(),
      timeSpent: args.timeSpent,
      context: args.sessionId ? { sessionId: args.sessionId } : undefined,
    });

    // Prepare updated stats
    const updatedStats = {
      attemptCount: question.attemptCount + 1,
      correctCount: question.correctCount + (args.isCorrect ? 1 : 0),
      lastAttemptedAt: Date.now(),
    };

    // Calculate FSRS scheduling
    const now = new Date();
    let fsrsFields: Partial<typeof question> = {};

    // If this is the first interaction and question has no FSRS state, initialize it
    if (!question.state) {
      const initialCard = initializeCard();
      const initialDbFields = cardToDb(initialCard);

      // Schedule the first review
      const { dbFields: scheduledFields } = scheduleNextReview(
        { ...question, ...initialDbFields },
        args.isCorrect,
        now
      );

      fsrsFields = scheduledFields;
    } else {
      // For subsequent reviews, use existing FSRS state
      const { dbFields: scheduledFields } = scheduleNextReview(question, args.isCorrect, now);
      fsrsFields = scheduledFields;
    }

    // Update question with both stats and FSRS fields
    await ctx.db.patch(args.questionId, {
      ...updatedStats,
      ...fsrsFields,
    });

    return {
      success: true,
      nextReview: fsrsFields.nextReview || null,
      scheduledDays: fsrsFields.scheduledDays || 0,
      newState: fsrsFields.state || question.state || 'new',
    };
  },
});

export const getUserQuestions = query({
  args: {
    topic: v.optional(v.string()),
    onlyUnattempted: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    includeDeleted: v.optional(v.boolean()), // Option to include deleted questions
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Choose the most selective index based on filters provided
    let query;

    // If topic is specified, use the topic index (most selective)
    if (args.topic) {
      const topic = args.topic;
      query = ctx.db
        .query('questions')
        .withIndex('by_user_topic', (q) => q.eq('userId', userId).eq('topic', topic));
    }
    // If only unattempted filter is specified, use that index
    else if (args.onlyUnattempted) {
      query = ctx.db
        .query('questions')
        .withIndex('by_user_unattempted', (q) => q.eq('userId', userId).eq('attemptCount', 0));
    }
    // Otherwise use the basic user index
    else {
      query = ctx.db.query('questions').withIndex('by_user', (q) => q.eq('userId', userId));
    }

    let questions = await query.order('desc').take(args.limit || 50);

    // Apply additional filters in memory
    // If topic index was used but unattempted filter also requested, apply it here
    if (args.topic && args.onlyUnattempted) {
      questions = questions.filter((q) => q.attemptCount === 0);
    }

    // Filter out soft-deleted questions by default
    if (!args.includeDeleted) {
      questions = questions.filter((q) => !q.deletedAt);
    }

    return questions;
  },
});

export const getQuizInteractionStats = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Get all interactions for this session
    const interactions = await ctx.db
      .query('interactions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('context.sessionId'), args.sessionId))
      .collect();

    // Calculate stats
    const totalInteractions = interactions.length;
    const correctInteractions = interactions.filter((i) => i.isCorrect).length;
    const uniqueQuestions = new Set(interactions.map((i) => i.questionId)).size;

    return {
      totalInteractions,
      correctInteractions,
      uniqueQuestions,
      accuracy: totalInteractions > 0 ? correctInteractions / totalInteractions : 0,
    };
  },
});

/**
 * Update a question (creator-only)
 *
 * Allows the question creator to update question content, but preserves
 * FSRS data and interaction history to maintain learning integrity.
 */
export const updateQuestion = mutation({
  args: {
    questionId: v.id('questions'),
    question: v.optional(v.string()),
    topic: v.optional(v.string()),
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
      throw new Error('Question not found or unauthorized');
    }

    // 3. Check if already deleted
    if (question.deletedAt) {
      throw new Error('Cannot update deleted question');
    }

    // 4. Input validation
    if (args.question !== undefined && args.question.trim().length === 0) {
      throw new Error('Question cannot be empty');
    }

    if (args.topic !== undefined && args.topic.trim().length === 0) {
      throw new Error('Topic cannot be empty');
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
    if (args.topic !== undefined) updateFields.topic = args.topic;
    if (args.explanation !== undefined) updateFields.explanation = args.explanation;
    if (args.options !== undefined) updateFields.options = args.options;
    if (args.correctAnswer !== undefined) updateFields.correctAnswer = args.correctAnswer;

    // 6. Update with timestamp
    await ctx.db.patch(args.questionId, {
      ...updateFields,
      updatedAt: Date.now(),
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
      throw new Error('Question not found or unauthorized');
    }

    // 3. Check if already deleted
    if (question.deletedAt) {
      throw new Error('Question is already deleted');
    }

    // 4. Soft delete with timestamp
    await ctx.db.patch(args.questionId, {
      deletedAt: Date.now(),
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
      throw new Error('Question not found or unauthorized');
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

    return {
      success: true,
      questionId: args.questionId,
      message: 'Question restored successfully',
    };
  },
});

// Mutation to prepare for generating related questions
export const prepareRelatedGeneration = mutation({
  args: {
    baseQuestionId: v.id('questions'),
    count: v.optional(v.number()), // Default to 3 related questions
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Get the base question
    const baseQuestion = await ctx.db.get(args.baseQuestionId);

    if (!baseQuestion) {
      throw new Error('Question not found');
    }

    // Verify ownership
    if (baseQuestion.userId !== userId) {
      throw new Error(
        'Unauthorized: You can only generate related questions for your own questions'
      );
    }

    // Check if question is deleted
    if (baseQuestion.deletedAt) {
      throw new Error('Cannot generate related questions for deleted questions');
    }

    // Return the base question data needed for AI generation
    return {
      success: true,
      baseQuestion: {
        id: baseQuestion._id,
        topic: baseQuestion.topic,
        question: baseQuestion.question,
        type: baseQuestion.type,
        correctAnswer: baseQuestion.correctAnswer,
        explanation: baseQuestion.explanation,
      },
      requestedCount: args.count || 3,
    };
  },
});

// Mutation to save related questions after AI generation
export const saveRelatedQuestions = mutation({
  args: {
    baseQuestionId: v.id('questions'),
    relatedQuestions: v.array(
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

    // Get the base question for topic
    const baseQuestion = await ctx.db.get(args.baseQuestionId);

    if (!baseQuestion) {
      throw new Error('Base question not found');
    }

    // Verify ownership
    if (baseQuestion.userId !== userId) {
      throw new Error('Unauthorized: You can only save related questions for your own questions');
    }

    // Initialize FSRS card for new questions
    const initialCard = initializeCard();
    const fsrsFields = cardToDb(initialCard);

    // Save all related questions with same topic as base
    const questionIds = await Promise.all(
      args.relatedQuestions.map((q) =>
        ctx.db.insert('questions', {
          userId,
          topic: baseQuestion.topic,
          question: q.question,
          type: q.type || 'multiple-choice',
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          generatedAt: Date.now(),
          attemptCount: 0,
          correctCount: 0,
          // Initialize FSRS fields
          ...fsrsFields,
        })
      )
    );

    return {
      success: true,
      questionIds,
      count: questionIds.length,
      message: `Generated ${questionIds.length} related questions`,
    };
  },
});

// Query to get user's recent topics for quick generation
export const getRecentTopics = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Query user's recent questions (not deleted)
    const recentQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc') // Most recent first
      .take(100); // Get enough to find unique topics

    // Filter out deleted questions and extract unique topics
    const topicCounts = new Map<string, number>();

    for (const question of recentQuestions) {
      // Skip deleted questions
      if (question.deletedAt) continue;

      // Skip questions without topics
      if (!question.topic) continue;

      // Count occurrences of each topic
      const count = topicCounts.get(question.topic) || 0;
      topicCounts.set(question.topic, count + 1);
    }

    // Convert to array, sort by frequency (most used topics first), then take limit
    const topics = Array.from(topicCounts.entries())
      .sort(([, a], [, b]) => b - a) // Sort by count descending
      .slice(0, args.limit || 5) // Take top 5 by default
      .map(([topic]) => topic); // Extract just the topic names

    return topics;
  },
});

/**
 * Archive multiple questions (bulk operation)
 *
 * Sets archivedAt timestamp to remove questions from active review queue
 * while preserving all FSRS data and history. Archived questions can be unarchived.
 */
export const archiveQuestions = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    // Verify ownership and update all questions in parallel
    await Promise.all(
      args.questionIds.map(async (id) => {
        const question = await ctx.db.get(id);
        if (!question || question.userId !== userId) {
          throw new Error('Question not found or unauthorized');
        }

        await ctx.db.patch(id, {
          archivedAt: now,
          updatedAt: now,
        });
      })
    );

    return { archived: args.questionIds.length };
  },
});

/**
 * Unarchive multiple questions (bulk operation)
 *
 * Clears archivedAt timestamp to return questions to active review queue.
 */
export const unarchiveQuestions = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    await Promise.all(
      args.questionIds.map(async (id) => {
        const question = await ctx.db.get(id);
        if (!question || question.userId !== userId) {
          throw new Error('Question not found or unauthorized');
        }

        await ctx.db.patch(id, {
          archivedAt: undefined,
          updatedAt: now,
        });
      })
    );

    return { unarchived: args.questionIds.length };
  },
});

/**
 * Bulk soft delete questions
 *
 * Marks multiple questions as deleted but preserves them in database
 * for recovery. Preserves all FSRS data and history.
 */
export const bulkDelete = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = Date.now();

    await Promise.all(
      args.questionIds.map(async (id) => {
        const question = await ctx.db.get(id);
        if (!question || question.userId !== userId) {
          throw new Error('Question not found or unauthorized');
        }

        await ctx.db.patch(id, {
          deletedAt: now,
          updatedAt: now,
        });
      })
    );

    return { deleted: args.questionIds.length };
  },
});

/**
 * Permanently delete questions (irreversible)
 *
 * Actually removes questions from the database. This operation cannot be undone.
 * Should only be called from trash view with explicit user confirmation.
 */
export const permanentlyDelete = mutation({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    await Promise.all(
      args.questionIds.map(async (id) => {
        const question = await ctx.db.get(id);
        if (!question || question.userId !== userId) {
          throw new Error('Question not found or unauthorized');
        }

        // Actually delete from database
        await ctx.db.delete(id);
      })
    );

    return { permanentlyDeleted: args.questionIds.length };
  },
});
