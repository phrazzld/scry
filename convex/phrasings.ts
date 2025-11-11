import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internalMutation, internalQuery } from './_generated/server';

export const getByConcept = internalQuery({
  args: {
    userId: v.id('users'),
    conceptId: v.id('concepts'),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('phrasings')
      .withIndex('by_user_concept', (q) =>
        q.eq('userId', args.userId).eq('conceptId', args.conceptId)
      )
      .take(args.limit);
  },
});

export const insertGenerated = internalMutation({
  args: {
    conceptId: v.id('concepts'),
    userId: v.id('users'),
    phrasings: v.array(
      v.object({
        question: v.string(),
        explanation: v.string(),
        type: v.union(
          v.literal('multiple-choice'),
          v.literal('true-false'),
          v.literal('cloze'),
          v.literal('short-answer')
        ),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        embedding: v.optional(v.array(v.float64())),
        embeddingGeneratedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids: Id<'phrasings'>[] = [];

    for (const phrasing of args.phrasings) {
      const id = await ctx.db.insert('phrasings', {
        userId: args.userId,
        conceptId: args.conceptId,
        question: phrasing.question,
        explanation: phrasing.explanation,
        type: phrasing.type,
        options: phrasing.options,
        correctAnswer: phrasing.correctAnswer,
        attemptCount: 0,
        correctCount: 0,
        createdAt: now,
        updatedAt: now,
        archivedAt: undefined,
        deletedAt: undefined,
        embedding: phrasing.embedding,
        embeddingGeneratedAt: phrasing.embeddingGeneratedAt,
      });
      ids.push(id);
    }

    return { ids };
  },
});
