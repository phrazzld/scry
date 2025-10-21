/**
 * Related Question Generation
 *
 * AI-powered generation of related questions based on existing questions.
 * Hides topic inheritance logic, ownership verification, and FSRS initialization.
 *
 * Flow: prepareRelatedGeneration → AI generates → saveRelatedQuestions
 */
import { v } from 'convex/values';

import { mutation } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { getScheduler } from './scheduling';

/**
 * Prepare base question data for related generation
 *
 * Returns question data needed by AI to generate related questions.
 * Verifies ownership and validates question is not deleted.
 */
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
        question: baseQuestion.question,
        type: baseQuestion.type,
        correctAnswer: baseQuestion.correctAnswer,
        explanation: baseQuestion.explanation,
      },
      requestedCount: args.count || 3,
    };
  },
});

/**
 * Save AI-generated related questions
 *
 * Inherits topic from base question to maintain organization.
 * Initializes FSRS fields for spaced repetition.
 */
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
    const scheduler = getScheduler();
    const fsrsFields = scheduler.initializeCard();

    // Save all related questions with same topic as base
    const questionIds = await Promise.all(
      args.relatedQuestions.map((q) =>
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
