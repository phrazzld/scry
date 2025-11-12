import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import {
  defaultEngine as conceptEngine,
  initializeConceptFsrs,
  scheduleConceptReview,
  selectPhrasingForConcept,
} from './fsrs';
import { TARGET_PHRASINGS_PER_CONCEPT } from './lib/conceptConstants';
import { calculateConceptStatsDelta } from './lib/conceptFsrsHelpers';
import { updateStatsCounters } from './lib/userStatsHelpers';

type ConceptDoc = Doc<'concepts'>;
type PhrasingDoc = Doc<'phrasings'>;

type SelectionResult = {
  concept: ConceptDoc;
  phrasing: PhrasingDoc;
  selectionReason: ReturnType<typeof selectPhrasingForConcept>['reason'];
};

const MAX_CONCEPT_CANDIDATES = 25;
const MAX_PHRASINGS = 50;
const MAX_INTERACTIONS = 10;
const MAX_EXISTING_TITLES = 250;
const DEFAULT_LIBRARY_PAGE_SIZE = 25;
const MAX_LIBRARY_PAGE_SIZE = 100;
const MIN_LIBRARY_PAGE_SIZE = 10;

type ConceptLibraryView = 'all' | 'due' | 'thin' | 'conflict';
type ConceptLibrarySort = 'recent' | 'nextReview';

export const createMany = internalMutation({
  args: {
    userId: v.id('users'),
    jobId: v.optional(v.id('generationJobs')),
    concepts: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.concepts.length === 0) {
      return { conceptIds: [] };
    }

    const now = Date.now();
    const createdIds: Id<'concepts'>[] = [];
    const normalizedExistingTitles = new Set<string>();

    const existingConcepts = await ctx.db
      .query('concepts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .take(MAX_EXISTING_TITLES);

    for (const concept of existingConcepts) {
      normalizedExistingTitles.add(concept.title.trim().toLowerCase());
    }

    for (const concept of args.concepts) {
      const title = concept.title.trim();
      const description = concept.description?.trim();

      if (title.length < 5) {
        continue;
      }

      const titleKey = title.toLowerCase();
      if (normalizedExistingTitles.has(titleKey)) {
        continue;
      }

      normalizedExistingTitles.add(titleKey);

      const fsrs = initializeConceptFsrs(new Date(now));

      const conceptId = await ctx.db.insert('concepts', {
        userId: args.userId,
        title,
        description,
        fsrs,
        phrasingCount: 0,
        conflictScore: undefined,
        thinScore: undefined,
        qualityScore: undefined,
        canonicalPhrasingId: undefined,
        embedding: undefined,
        embeddingGeneratedAt: undefined,
        createdAt: now,
        updatedAt: now,
        generationJobId: args.jobId,
      });

      createdIds.push(conceptId);
    }

    return { conceptIds: createdIds };
  },
});

export const getDue = query({
  args: {
    _refreshTimestamp: v.optional(v.number()),
  },
  handler: async (ctx) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const now = new Date();
    const nowMs = now.getTime();

    const dueConcepts = await ctx.db
      .query('concepts')
      .withIndex('by_user_next_review', (q) => q.eq('userId', userId).lte('fsrs.nextReview', nowMs))
      .take(MAX_CONCEPT_CANDIDATES);

    let candidates = dueConcepts;

    if (candidates.length === 0) {
      const newConcepts = await ctx.db
        .query('concepts')
        .withIndex('by_user_next_review', (q) => q.eq('userId', userId))
        .filter((q) => q.eq(q.field('fsrs.state'), 'new'))
        .take(MAX_CONCEPT_CANDIDATES);

      if (newConcepts.length === 0) {
        // Never return future-scheduled concepts—breaks FSRS intervals.
        return null;
      }

      candidates = newConcepts;
    }

    const prioritized = prioritizeConcepts(candidates, now);
    for (const candidate of prioritized) {
      const phrasingSelection = await selectActivePhrasing(ctx, candidate.concept, userId);
      if (!phrasingSelection) {
        continue;
      }

      const interactions = await ctx.db
        .query('interactions')
        .withIndex('by_user_phrasing', (q) =>
          q.eq('userId', userId).eq('phrasingId', phrasingSelection.phrasing._id)
        )
        .order('desc')
        .take(MAX_INTERACTIONS);

      const legacyQuestion = await ctx.db
        .query('questions')
        .withIndex('by_concept', (q) => q.eq('conceptId', candidate.concept._id))
        .filter((q) =>
          q.and(
            q.eq(q.field('userId'), userId),
            q.eq(q.field('deletedAt'), undefined),
            q.eq(q.field('archivedAt'), undefined)
          )
        )
        .first();

      return {
        concept: candidate.concept,
        phrasing: phrasingSelection.phrasing,
        selectionReason: phrasingSelection.selectionReason,
        retrievability: candidate.retrievability,
        interactions,
        legacyQuestionId: legacyQuestion?._id ?? null,
        serverTime: nowMs,
      };
    }

    return null;
  },
});

export const getConceptsDueCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const nowMs = Date.now();

    // Count due concepts with phrasings (DB-level filtering)
    const dueConcepts = await ctx.db
      .query('concepts')
      .withIndex('by_user_next_review', (q) => q.eq('userId', userId).lte('fsrs.nextReview', nowMs))
      .filter((q) => q.gt(q.field('phrasingCount'), 0))
      .take(1000); // Safety limit for large collections

    // Count orphaned questions (questions without conceptId)
    const orphanedQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user_active', (q) =>
        q.eq('userId', userId).eq('deletedAt', undefined).eq('archivedAt', undefined)
      )
      .filter((q) => q.eq(q.field('conceptId'), undefined))
      .take(5000); // Higher limit for legacy data

    return {
      conceptsDue: dueConcepts.length,
      orphanedQuestions: orphanedQuestions.length,
    };
  },
});

export const recordInteraction = mutation({
  args: {
    conceptId: v.id('concepts'),
    phrasingId: v.id('phrasings'),
    userAnswer: v.string(),
    isCorrect: v.boolean(),
    timeSpent: v.optional(v.number()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    const concept = await ctx.db.get(args.conceptId);
    if (!concept || concept.userId !== userId) {
      throw new Error('Concept not found or unauthorized');
    }

    const phrasing = await ctx.db.get(args.phrasingId);
    if (!phrasing || phrasing.userId !== userId || phrasing.conceptId !== concept._id) {
      throw new Error('Phrasing not found or unauthorized');
    }

    const legacyQuestion = await ctx.db
      .query('questions')
      .withIndex('by_concept', (q) => q.eq('conceptId', concept._id))
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), userId),
          q.eq(q.field('deletedAt'), undefined),
          q.eq(q.field('archivedAt'), undefined)
        )
      )
      .first();

    const nowMs = Date.now();
    const now = new Date(nowMs);

    await ctx.db.insert('interactions', {
      userId,
      conceptId: concept._id,
      phrasingId: phrasing._id,
      userAnswer: args.userAnswer,
      isCorrect: args.isCorrect,
      attemptedAt: nowMs,
      timeSpent: args.timeSpent,
      context: args.sessionId ? { sessionId: args.sessionId } : undefined,
    });

    await ctx.db.patch(phrasing._id, {
      attemptCount: (phrasing.attemptCount ?? 0) + 1,
      correctCount: (phrasing.correctCount ?? 0) + (args.isCorrect ? 1 : 0),
      lastAttemptedAt: nowMs,
    });

    const scheduleResult = scheduleConceptReview(concept, args.isCorrect, { now });

    await ctx.db.patch(concept._id, {
      fsrs: scheduleResult.fsrs,
      updatedAt: nowMs,
    });

    const statsDelta = calculateConceptStatsDelta({
      oldState: concept.fsrs.state ?? 'new',
      newState: scheduleResult.state,
      oldNextReview: concept.fsrs.nextReview,
      newNextReview: scheduleResult.nextReview,
      nowMs,
    });

    if (statsDelta) {
      await updateStatsCounters(ctx, userId, statsDelta);
    }

    if (legacyQuestion) {
      await ctx.db.patch(legacyQuestion._id, {
        attemptCount: (legacyQuestion.attemptCount ?? 0) + 1,
        correctCount: (legacyQuestion.correctCount ?? 0) + (args.isCorrect ? 1 : 0),
        lastAttemptedAt: nowMs,
      });
    }

    return {
      conceptId: concept._id,
      phrasingId: phrasing._id,
      legacyQuestionId: legacyQuestion?._id ?? null,
      nextReview: scheduleResult.nextReview,
      scheduledDays: scheduleResult.scheduledDays,
      newState: scheduleResult.state,
    };
  },
});

function prioritizeConcepts(concepts: ConceptDoc[], now: Date) {
  const prioritized = concepts
    .filter((concept) => concept.phrasingCount > 0)
    .map((concept) => ({
      concept,
      retrievability:
        concept.fsrs.retrievability ?? conceptEngine.getRetrievability(concept.fsrs, now),
    }))
    .sort((a, b) => a.retrievability - b.retrievability);

  const base = prioritized[0]?.retrievability;
  if (base === undefined) {
    return [];
  }

  const URGENCY_DELTA = 0.05;
  const urgentTier: typeof prioritized = [];
  for (const item of prioritized) {
    if (Math.abs(item.retrievability - base) <= URGENCY_DELTA) {
      urgentTier.push(item);
    } else {
      break;
    }
  }

  for (let i = urgentTier.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [urgentTier[i], urgentTier[j]] = [urgentTier[j], urgentTier[i]];
  }

  return [...urgentTier, ...prioritized.slice(urgentTier.length)];
}

async function selectActivePhrasing(
  ctx: QueryCtx,
  concept: ConceptDoc,
  userId: Id<'users'>
): Promise<SelectionResult | null> {
  const phrasings = await ctx.db
    .query('phrasings')
    .withIndex('by_user_concept', (q) => q.eq('userId', userId).eq('conceptId', concept._id))
    .filter((q) =>
      q.and(q.eq(q.field('archivedAt'), undefined), q.eq(q.field('deletedAt'), undefined))
    )
    .take(MAX_PHRASINGS);

  if (phrasings.length === 0) {
    return null;
  }

  const selection = selectPhrasingForConcept(phrasings, {
    canonicalPhrasingId: concept.canonicalPhrasingId,
  });
  if (!selection.phrasing) {
    return null;
  }

  return {
    concept,
    phrasing: selection.phrasing,
    selectionReason: selection.reason,
  };
}

export const getConceptById = internalQuery({
  args: {
    conceptId: v.id('concepts'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conceptId);
  },
});

export const applyPhrasingGenerationUpdate = internalMutation({
  args: {
    conceptId: v.id('concepts'),
    phrasingCount: v.number(),
    thinScore: v.optional(v.number()),
    conflictScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conceptId, {
      phrasingCount: args.phrasingCount,
      thinScore: args.thinScore,
      conflictScore: args.conflictScore,
      updatedAt: Date.now(),
    });
  },
});

export const listForLibrary = query({
  args: {
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
    view: v.optional(
      v.union(v.literal('all'), v.literal('due'), v.literal('thin'), v.literal('conflict'))
    ),
    search: v.optional(v.string()),
    sort: v.optional(v.union(v.literal('recent'), v.literal('nextReview'))),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const now = Date.now();
    const pageSize = clampPageSize(args.pageSize);
    const view = (args.view ?? 'all') as ConceptLibraryView;
    const sort = (args.sort ?? 'nextReview') as ConceptLibrarySort;
    const searchTerm = args.search?.trim() ?? '';
    const cursor = args.cursor ?? null;

    if (searchTerm.length >= 2) {
      let searchQuery = ctx.db
        .query('concepts')
        .withSearchIndex('search_concepts', (q) => q.search('title', searchTerm));

      searchQuery = searchQuery.filter((q) => q.eq(q.field('userId'), user._id));

      const searchResults = await searchQuery.take(Math.min(pageSize, 50));
      const filteredResults = searchResults.filter((concept) =>
        matchesConceptView(concept, now, view)
      );

      return {
        concepts: filteredResults.slice(0, pageSize),
        continueCursor: null,
        isDone: true,
        serverTime: now,
        mode: 'search' as const,
      };
    }

    const baseQuery =
      sort === 'recent'
        ? ctx.db
            .query('concepts')
            .withIndex('by_user', (q) => q.eq('userId', user._id))
            .order('desc')
        : ctx.db
            .query('concepts')
            .withIndex('by_user_next_review', (q) => q.eq('userId', user._id));

    const concepts = await collectConceptPage({
      baseQuery,
      targetSize: pageSize,
      cursor,
      view,
      now,
    });

    return {
      concepts: concepts.items,
      continueCursor: concepts.continueCursor,
      isDone: concepts.isDone,
      serverTime: now,
      mode: 'standard' as const,
    };
  },
});

async function collectConceptPage({
  baseQuery,
  cursor,
  targetSize,
  view,
  now,
}: {
  // Convex query builder for concepts (with chosen index/sort)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseQuery: any;
  cursor: string | null;
  targetSize: number;
  view: ConceptLibraryView;
  now: number;
}) {
  const items: ConceptDoc[] = [];
  let nextCursor: string | null = cursor;
  let isDone = false;
  let safetyCounter = 0;

  while (items.length < targetSize && !isDone) {
    safetyCounter += 1;
    if (safetyCounter > 10) {
      break;
    }

    const page = await baseQuery.paginate({
      cursor: nextCursor,
      numItems: targetSize,
    });

    const filtered = page.page.filter((concept: ConceptDoc) =>
      matchesConceptView(concept, now, view)
    );
    items.push(...filtered);

    isDone = page.isDone;
    nextCursor = page.isDone ? null : (page.continueCursor ?? null);

    if (!nextCursor) {
      isDone = true;
    }
  }

  return {
    items: items.slice(0, targetSize),
    continueCursor: nextCursor,
    isDone,
  };
}

function clampPageSize(pageSize?: number | null) {
  if (!pageSize) {
    return DEFAULT_LIBRARY_PAGE_SIZE;
  }
  return Math.max(MIN_LIBRARY_PAGE_SIZE, Math.min(MAX_LIBRARY_PAGE_SIZE, pageSize));
}

function matchesConceptView(concept: ConceptDoc, now: number, view: ConceptLibraryView) {
  if (view === 'all') {
    return true;
  }

  const isDue = concept.fsrs.nextReview <= now;
  const isThin = (concept.thinScore ?? 0) > 0;
  const isConflict = (concept.conflictScore ?? 0) > 0;

  if (view === 'due') {
    return isDue;
  }
  if (view === 'thin') {
    return isThin;
  }
  if (view === 'conflict') {
    return isConflict;
  }
  return true;
}

export const getDetail = query({
  args: {
    conceptId: v.id('concepts'),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const concept = await ctx.db.get(args.conceptId);

    if (!concept || concept.userId !== user._id) {
      return null;
    }

    const phrasings = await ctx.db
      .query('phrasings')
      .withIndex('by_user_concept', (q) => q.eq('userId', user._id).eq('conceptId', concept._id))
      .filter((q) =>
        q.and(q.eq(q.field('archivedAt'), undefined), q.eq(q.field('deletedAt'), undefined))
      )
      .order('desc')
      .take(100);

    const pendingJob = await findActiveGenerationJob(ctx, user._id, concept._id);

    return {
      concept,
      phrasings,
      pendingGeneration: Boolean(pendingJob),
    };
  },
});

export const setCanonicalPhrasing = mutation({
  args: {
    conceptId: v.id('concepts'),
    phrasingId: v.optional(v.id('phrasings')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const concept = await ctx.db.get(args.conceptId);
    if (!concept || concept.userId !== user._id) {
      throw new Error('Concept not found or unauthorized');
    }

    if (args.phrasingId) {
      const phrasing = await ctx.db.get(args.phrasingId);
      if (
        !phrasing ||
        phrasing.userId !== user._id ||
        phrasing.conceptId !== concept._id ||
        phrasing.archivedAt
      ) {
        throw new Error('Phrasing not found or unavailable');
      }
    }

    await ctx.db.patch(concept._id, {
      canonicalPhrasingId: args.phrasingId ?? undefined,
      updatedAt: Date.now(),
    });

    return { canonicalPhrasingId: args.phrasingId ?? null };
  },
});

export const archivePhrasing = mutation({
  args: {
    conceptId: v.id('concepts'),
    phrasingId: v.id('phrasings'),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const concept = await ctx.db.get(args.conceptId);
    if (!concept || concept.userId !== user._id) {
      throw new Error('Concept not found or unauthorized');
    }

    const phrasing = await ctx.db.get(args.phrasingId);
    if (!phrasing || phrasing.userId !== user._id || phrasing.conceptId !== concept._id) {
      throw new Error('Phrasing not found or unauthorized');
    }

    if (phrasing.archivedAt) {
      return { phrasingId: phrasing._id };
    }

    const now = Date.now();
    await ctx.db.patch(phrasing._id, {
      archivedAt: now,
      updatedAt: now,
    });

    const newCount = Math.max(0, concept.phrasingCount - 1);
    const thinScore = computeThinScoreFromCount(newCount);

    const conceptPatch: Partial<ConceptDoc> = {
      phrasingCount: newCount,
      thinScore,
      updatedAt: now,
    };

    if (concept.canonicalPhrasingId === phrasing._id) {
      conceptPatch.canonicalPhrasingId = undefined;
    }

    await ctx.db.patch(concept._id, conceptPatch);

    return { phrasingId: phrasing._id };
  },
});

export const requestPhrasingGeneration = mutation({
  args: {
    conceptId: v.id('concepts'),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const concept = await ctx.db.get(args.conceptId);
    if (!concept || concept.userId !== user._id) {
      throw new Error('Concept not found or unauthorized');
    }

    const existingJob = await findActiveGenerationJob(ctx, user._id, concept._id);
    if (existingJob) {
      throw new Error('Generation already in progress for this concept');
    }

    const now = Date.now();
    const jobId = await ctx.db.insert('generationJobs', {
      userId: user._id,
      prompt: `Manual concept phrasing request: ${concept.title}`,
      status: 'pending',
      phase: 'phrasing_generation',
      questionsGenerated: 0,
      questionsSaved: 0,
      estimatedTotal: TARGET_PHRASINGS_PER_CONCEPT,
      topic: concept.title,
      questionIds: [],
      conceptIds: [],
      pendingConceptIds: [],
      durationMs: undefined,
      errorMessage: undefined,
      errorCode: undefined,
      retryable: undefined,
      createdAt: now,
      startedAt: undefined,
      completedAt: undefined,
      ipAddress: undefined,
    });

    await ctx.runMutation(internal.generationJobs.setConceptWork, {
      jobId,
      conceptIds: [concept._id],
    });

    await ctx.runMutation(internal.generationJobs.updateProgress, {
      jobId,
      phase: 'phrasing_generation',
      estimatedTotal: TARGET_PHRASINGS_PER_CONCEPT,
    });

    await ctx.scheduler.runAfter(0, internal.aiGeneration.generatePhrasingsForConcept, {
      conceptId: concept._id,
      jobId,
    });

    return { jobId };
  },
});

function computeThinScoreFromCount(count: number) {
  if (count >= TARGET_PHRASINGS_PER_CONCEPT) {
    return undefined;
  }
  const delta = TARGET_PHRASINGS_PER_CONCEPT - Math.max(0, count);
  return delta > 0 ? delta : undefined;
}

async function findActiveGenerationJob(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  conceptId: Id<'concepts'>
) {
  const statuses: Array<'pending' | 'processing'> = ['pending', 'processing'];

  for (const status of statuses) {
    const jobs = await ctx.db
      .query('generationJobs')
      .withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', status))
      .order('desc')
      .take(25);

    const match = jobs.find((job) => {
      const pending = job.pendingConceptIds ?? [];
      const knownConcepts = job.conceptIds ?? [];
      return pending.some((id) => id === conceptId) || knownConcepts.some((id) => id === conceptId);
    });

    if (match) {
      return match;
    }
  }

  return null;
}
