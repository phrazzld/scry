import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, type LanguageModel } from 'ai';
import { v } from 'convex/values';
import OpenAI from 'openai';
import { z } from 'zod';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { ActionCtx, internalAction, internalMutation, mutation, query } from './_generated/server';
import { requireUserFromClerk } from './clerk';
import { chunkArray } from './lib/chunkArray';
import { calculateConceptStatsDelta } from './lib/conceptFsrsHelpers';
import { getSecretDiagnostics } from './lib/envDiagnostics';
import { DEFAULT_REPLAY_LIMIT, replayInteractionsIntoState } from './lib/fsrsReplay';
import { createConceptsLogger, generateCorrelationId, logConceptEvent } from './lib/logger';
import { generateObjectWithResponsesApi } from './lib/responsesApi';
import type { StatDeltas } from './lib/userStatsHelpers';
import { updateStatsCounters } from './lib/userStatsHelpers';

type ConceptDoc = Doc<'concepts'>;
const logger = createConceptsLogger({
  module: 'iqc',
  function: 'scanAndPropose',
});

const IQC_SCAN_CONFIG = {
  maxConceptSamples: 60,
  maxUsersPerRun: 8,
  perUserConceptLimit: 6,
  neighborLimit: 6,
  minVectorScore: 0.92,
  minTitleSimilarity: 0.7,
  maxPairsPerRun: 15,
  maxCardsPerUser: 5,
  runTimeBudgetMs: 25_000,
  proposalTtlHours: 48,
} as const;

const mergeDecisionSchema = z.object({
  decision: z.enum(['MERGE', 'KEEP']),
  reason: z.string().min(12),
  confidence: z.number().min(0).max(1),
  canonical: z.enum(['SOURCE', 'TARGET']),
});

type MergeDecision = z.infer<typeof mergeDecisionSchema>;

const mergeActionPayloadSchema = z.object({
  proposalKey: z.string(),
  similarity: z.number(),
  titleSimilarity: z.number(),
  canonicalConceptId: z.string(),
  mergeConceptId: z.string(),
  conceptSnapshots: z
    .array(
      z.object({
        conceptId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        phrasingCount: z.number().optional(),
        conflictScore: z.number().optional(),
        thinScore: z.number().optional(),
      })
    )
    .optional(),
  llmDecision: z
    .object({
      provider: z.string().optional(),
      reason: z.string().optional(),
      confidence: z.number().optional(),
      canonicalPreference: z.enum(['SOURCE', 'TARGET']).optional(),
      keyDiagnostics: z
        .object({
          present: z.boolean().optional(),
          length: z.number().optional(),
          fingerprint: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

type MergeActionPayload = z.infer<typeof mergeActionPayloadSchema>;

type MergeCandidate = {
  source: ConceptDoc;
  target: ConceptDoc;
  vectorScore: number;
  titleSimilarity: number;
};

/**
 * Internal action that scans recent concepts, finds near-duplicates, and
 * enqueues MERGE_CONCEPTS action cards for user review.
 */
export const scanAndPropose = internalAction({
  args: {
    maxUsers: v.optional(v.number()),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const correlationId = args.correlationId ?? generateCorrelationId('iqc-scan');
    const stats = {
      usersConsidered: 0,
      conceptsScanned: 0,
      candidatePairs: 0,
      cardsInserted: 0,
      cardsSkipped: 0,
      errors: 0,
    };

    const maxUsers = Math.min(args.maxUsers ?? IQC_SCAN_CONFIG.maxUsersPerRun, 25);

    logConceptEvent(logger, 'info', 'IQC scan started', {
      phase: 'iqc_scan',
      event: 'start',
      correlationId,
      maxUsers,
    });

    const conceptSamples = await ctx.runMutation(internal.iqc.getRecentConceptSamples, {
      limit: IQC_SCAN_CONFIG.maxConceptSamples,
    });

    const conceptsByUser = new Map<string, ConceptDoc[]>();
    for (const concept of conceptSamples) {
      if (!concept.embedding || concept.embedding.length === 0) {
        continue;
      }
      const key = concept.userId.toString();
      const list = conceptsByUser.get(key) ?? [];
      if (list.length >= IQC_SCAN_CONFIG.perUserConceptLimit) {
        continue;
      }
      list.push(concept);
      conceptsByUser.set(key, list);
    }

    const users = Array.from(conceptsByUser.entries()).slice(0, maxUsers);

    const provider = process.env.AI_PROVIDER || 'openai';
    const modelName = process.env.AI_MODEL || 'gpt-5-mini';
    const reasoningEffort = process.env.AI_REASONING_EFFORT || 'medium';
    const verbosity = process.env.AI_VERBOSITY || 'low';

    let model: LanguageModel | undefined;
    let openaiClient: OpenAI | undefined;
    let keyDiagnostics = { present: false, length: 0, fingerprint: null as string | null };

    if (provider === 'google') {
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      keyDiagnostics = getSecretDiagnostics(apiKey);
      if (apiKey) {
        const google = createGoogleGenerativeAI({ apiKey });
        model = google(modelName) as unknown as LanguageModel;
      }
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      keyDiagnostics = getSecretDiagnostics(apiKey);
      if (apiKey) {
        openaiClient = new OpenAI({ apiKey });
      }
    }

    let reachedCardLimit = false;

    for (const [, concepts] of users) {
      if (reachedCardLimit) {
        break;
      }
      if (Date.now() - startTime > IQC_SCAN_CONFIG.runTimeBudgetMs) {
        logger.info('IQC scan aborted due to runtime budget', {
          event: 'iqc.scan.timeout',
          stats,
          correlationId,
        });
        break;
      }

      stats.usersConsidered += 1;
      const userId = concepts[0].userId;

      const openCards = await ctx.runMutation(internal.iqc.getOpenActionCardsForUser, {
        userId,
        limit: IQC_SCAN_CONFIG.maxCardsPerUser * 2,
      });

      const existingKeys = new Set<string>();
      for (const card of openCards) {
        const payload = card.payload as { proposalKey?: string };
        if (payload?.proposalKey) {
          existingKeys.add(payload.proposalKey);
        }
      }

      stats.conceptsScanned += concepts.length;

      const candidates: MergeCandidate[] = [];
      const seenPairs = new Set<string>();

      for (const concept of concepts) {
        const neighbors = await fetchNeighborConcepts(ctx, concept, IQC_SCAN_CONFIG.neighborLimit);
        for (const neighbor of neighbors) {
          if (!neighbor.embedding) {
            continue;
          }

          const pairKey = buildProposalKey(concept._id, neighbor._id);
          if (seenPairs.has(pairKey)) {
            continue;
          }
          seenPairs.add(pairKey);

          const titleSimilarity = computeTitleSimilarity(concept.title, neighbor.title);
          if (
            !shouldConsiderMerge(
              neighbor._score ?? 0,
              titleSimilarity,
              concept.phrasingCount,
              neighbor.phrasingCount
            )
          ) {
            continue;
          }

          candidates.push({
            source: neighbor._id > concept._id ? concept : neighbor,
            target: neighbor._id > concept._id ? neighbor : concept,
            vectorScore: neighbor._score ?? 0,
            titleSimilarity,
          });
        }
      }

      stats.candidatePairs += candidates.length;

      for (const candidate of candidates.slice(0, IQC_SCAN_CONFIG.maxPairsPerRun)) {
        const proposalKey = buildProposalKey(candidate.source._id, candidate.target._id);
        if (existingKeys.has(proposalKey)) {
          stats.cardsSkipped += 1;
          continue;
        }

        let decision: MergeDecision | null = null;
        try {
          decision = await adjudicateMergeCandidate({
            candidate,
            provider,
            modelName,
            reasoningEffort,
            verbosity,
            model,
            openaiClient,
          });
        } catch (error) {
          logger.warn('LLM adjudication failed, falling back to heuristic', {
            event: 'iqc.scan.llm.failure',
            userId,
            error: error instanceof Error ? error.message : String(error),
            correlationId,
          });
        }

        if (!decision && candidate.vectorScore >= 0.97) {
          decision = {
            decision: 'MERGE',
            reason: 'High similarity fallback without LLM approval',
            confidence: 0.4,
            canonical:
              candidate.target.phrasingCount >= candidate.source.phrasingCount
                ? 'TARGET'
                : 'SOURCE',
          };
        }

        if (!decision || decision.decision !== 'MERGE') {
          stats.cardsSkipped += 1;
          continue;
        }

        const payload = buildMergePayload(
          candidate,
          decision,
          proposalKey,
          provider,
          keyDiagnostics
        );

        const actionCardId = await ctx.runMutation(internal.iqc.insertActionCard, {
          userId,
          kind: 'MERGE_CONCEPTS',
          payload,
          createdAt: Date.now(),
          expiresAt: Date.now() + IQC_SCAN_CONFIG.proposalTtlHours * 60 * 60 * 1000,
        });

        logConceptEvent(logger, 'info', 'IQC merge action card created', {
          phase: 'iqc_scan',
          event: 'card_created',
          correlationId,
          actionCardId,
          conceptIds: [candidate.source._id.toString(), candidate.target._id.toString()],
          proposalKey,
          similarity: candidate.vectorScore,
          titleSimilarity: candidate.titleSimilarity,
        });

        existingKeys.add(proposalKey);
        stats.cardsInserted += 1;

        if (stats.cardsInserted >= IQC_SCAN_CONFIG.maxPairsPerRun) {
          reachedCardLimit = true;
          break;
        }
      }
    }

    const duration = Date.now() - startTime;
    logConceptEvent(logger, 'info', 'IQC scan completed', {
      phase: 'iqc_scan',
      event: 'completed',
      correlationId,
      duration,
      stats,
    });

    return { stats, duration };
  },
});

export const applyActionCard = mutation({
  args: {
    actionCardId: v.id('actionCards'),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const correlationId = args.correlationId ?? generateCorrelationId('iqc-apply');
    const actionLogger = createConceptsLogger({
      module: 'iqc',
      function: 'applyActionCard',
      correlationId,
      actionCardId: args.actionCardId,
    });

    const card = await ctx.db.get(args.actionCardId);
    if (!card) {
      throw new Error('Action card not found');
    }

    if (card.userId !== user._id) {
      throw new Error('Unauthorized action card access');
    }

    if (card.kind !== 'MERGE_CONCEPTS') {
      throw new Error('Only MERGE_CONCEPTS cards are supported');
    }

    if (card.resolution === 'accepted') {
      return {
        status: 'already_applied',
        resolvedAt: card.resolvedAt ?? null,
      };
    }

    if (card.resolution === 'rejected') {
      throw new Error('This action card has already been rejected');
    }

    const payload = mergeActionPayloadSchema.parse(card.payload) as MergeActionPayload;
    const canonicalConceptId = payload.canonicalConceptId as Id<'concepts'>;
    const mergeConceptId = payload.mergeConceptId as Id<'concepts'>;

    if (canonicalConceptId === mergeConceptId) {
      throw new Error('Cannot merge a concept into itself');
    }

    const [canonicalConcept, mergeConcept] = await Promise.all([
      ctx.db.get(canonicalConceptId),
      ctx.db.get(mergeConceptId),
    ]);

    if (!canonicalConcept) {
      throw new Error('Canonical concept not found');
    }

    if (!mergeConcept) {
      await ctx.db.patch(card._id, {
        resolution: 'accepted',
        resolvedAt: Date.now(),
      });

      actionLogger.warn('Merge concept missing; resolving card as no-op', {
        event: 'iqc.apply_action.skip',
        canonicalConceptId,
        mergeConceptId,
        correlationId,
      });

      logConceptEvent(actionLogger, 'warn', 'IQC merge apply skipped - missing source', {
        phase: 'iqc_apply',
        event: 'skipped_missing_source',
        correlationId,
        actionCardId: args.actionCardId,
        conceptIds: [canonicalConceptId.toString(), mergeConceptId.toString()],
      });

      return { status: 'skipped_missing_source' };
    }

    if (canonicalConcept.userId !== user._id || mergeConcept.userId !== user._id) {
      throw new Error('Concept ownership mismatch');
    }

    const conceptIdStrings = [canonicalConceptId.toString(), mergeConceptId.toString()];

    logConceptEvent(actionLogger, 'info', 'IQC merge apply started', {
      phase: 'iqc_apply',
      event: 'start',
      correlationId,
      actionCardId: args.actionCardId,
      conceptIds: conceptIdStrings,
      userId: user._id,
    });

    const nowMs = Date.now();
    const statsDelta: StatDeltas = { totalCards: -1 };

    const mergePhrasings = await ctx.db
      .query('phrasings')
      .withIndex('by_user_concept', (q) =>
        q.eq('userId', user._id).eq('conceptId', mergeConcept._id)
      )
      .collect();

    if (mergePhrasings.length > 0) {
      for (const chunk of chunkArray(mergePhrasings, 25)) {
        await Promise.all(
          chunk.map((phrasing) =>
            ctx.db.patch(phrasing._id, {
              conceptId: canonicalConcept._id,
              updatedAt: nowMs,
            })
          )
        );
      }
    }

    const relatedQuestions = await ctx.db
      .query('questions')
      .withIndex('by_concept', (q) => q.eq('conceptId', mergeConcept._id))
      .collect();

    if (relatedQuestions.length > 0) {
      for (const chunk of chunkArray(relatedQuestions, 25)) {
        await Promise.all(
          chunk.map((question) =>
            ctx.db.patch(question._id, {
              conceptId: canonicalConcept._id,
            })
          )
        );
      }
    }

    const mergeInteractions = await ctx.db
      .query('interactions')
      .withIndex('by_concept', (q) => q.eq('conceptId', mergeConcept._id))
      .collect();

    const interactionsForReplay = [...mergeInteractions]
      .sort((a, b) => b.attemptedAt - a.attemptedAt)
      .slice(0, DEFAULT_REPLAY_LIMIT);

    if (mergeInteractions.length > 0) {
      for (const chunk of chunkArray(mergeInteractions, 50)) {
        await Promise.all(
          chunk.map((interaction) =>
            ctx.db.patch(interaction._id, {
              conceptId: canonicalConcept._id,
            })
          )
        );
      }
    }

    let updatedFsrs = canonicalConcept.fsrs;
    let interactionsReplayed = 0;
    if (interactionsForReplay.length > 0) {
      const replayResult = replayInteractionsIntoState(canonicalConcept, interactionsForReplay, {
        limit: DEFAULT_REPLAY_LIMIT,
      });
      updatedFsrs = replayResult.fsrs;
      interactionsReplayed = replayResult.applied;
    }

    const canonicalStatsDelta = calculateConceptStatsDelta({
      oldState: canonicalConcept.fsrs.state ?? 'new',
      newState: updatedFsrs.state ?? 'new',
      oldNextReview: canonicalConcept.fsrs.nextReview,
      newNextReview: updatedFsrs.nextReview,
      nowMs,
    });

    const removalStatsDelta = calculateConceptStatsDelta({
      oldState: mergeConcept.fsrs.state ?? 'new',
      newState: undefined,
      oldNextReview: mergeConcept.fsrs.nextReview,
      newNextReview: undefined,
      nowMs,
    });

    accumulateStatDelta(statsDelta, canonicalStatsDelta);
    accumulateStatDelta(statsDelta, removalStatsDelta);

    const totalPhrasings = canonicalConcept.phrasingCount + mergePhrasings.length;

    await ctx.db.patch(canonicalConcept._id, {
      fsrs: updatedFsrs,
      phrasingCount: totalPhrasings,
      conflictScore: undefined,
      thinScore: undefined,
      updatedAt: nowMs,
    });

    await ctx.db.delete(mergeConcept._id);

    await ctx.db.patch(card._id, {
      resolution: 'accepted',
      resolvedAt: nowMs,
    });

    if (Object.keys(statsDelta).length > 0) {
      await updateStatsCounters(ctx, user._id, statsDelta);
    }

    actionLogger.info('Applied IQC merge action card', {
      event: 'iqc.apply_action.success',
      canonicalConceptId,
      mergeConceptId,
      movedPhrasings: mergePhrasings.length,
      movedQuestions: relatedQuestions.length,
      interactionsReassigned: mergeInteractions.length,
      interactionsReplayed,
      correlationId,
      actionCardId: args.actionCardId,
    });

    logConceptEvent(actionLogger, 'info', 'IQC merge apply completed', {
      phase: 'iqc_apply',
      event: 'completed',
      correlationId,
      actionCardId: args.actionCardId,
      conceptIds: conceptIdStrings,
      movedPhrasings: mergePhrasings.length,
      movedQuestions: relatedQuestions.length,
      interactionsReassigned: mergeInteractions.length,
      interactionsReplayed,
    });

    return {
      status: 'applied',
      canonicalConceptId,
      mergeConceptId,
      movedPhrasings: mergePhrasings.length,
      movedQuestions: relatedQuestions.length,
      interactionsReassigned: mergeInteractions.length,
      interactionsReplayed,
    };
  },
});

export const getOpenCards = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserFromClerk(ctx);
    const limit = Math.min(Math.max(args.limit ?? 25, 5), 100);

    const cards = await ctx.db
      .query('actionCards')
      .withIndex('by_user_open', (q) => q.eq('userId', user._id).eq('resolvedAt', undefined))
      .order('desc')
      .take(limit);

    return cards;
  },
});

export const rejectActionCard = mutation({
  args: {
    actionCardId: v.id('actionCards'),
  },
  handler: async (ctx, args) => {
    const correlationId = generateCorrelationId('iqc-reject');
    const user = await requireUserFromClerk(ctx);
    const card = await ctx.db.get(args.actionCardId);

    if (!card || card.userId !== user._id) {
      throw new Error('Action card not found or unauthorized');
    }

    if (card.resolution) {
      return { status: card.resolution };
    }

    await ctx.db.patch(card._id, {
      resolution: 'rejected',
      resolvedAt: Date.now(),
    });

    logger.info('Action card rejected by user', {
      event: 'iqc.card.reject',
      actionCardId: card._id,
      kind: card.kind,
      userId: user._id,
      correlationId,
    });

    return { status: 'rejected' as const };
  },
});

// Internal helpers for scanAndPropose action
export const getRecentConceptSamples = internalMutation({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query('concepts').order('desc').take(args.limit);
  },
});

export const getOpenActionCardsForUser = internalMutation({
  args: {
    userId: v.id('users'),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('actionCards')
      .withIndex('by_user_open', (q) => q.eq('userId', args.userId).eq('resolvedAt', undefined))
      .take(args.limit);
  },
});

export const insertActionCard = internalMutation({
  args: {
    userId: v.id('users'),
    kind: v.string(),
    payload: v.any(),
    createdAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('actionCards', {
      userId: args.userId,
      kind: args.kind as 'MERGE_CONCEPTS',
      payload: args.payload,
      createdAt: args.createdAt,
      expiresAt: args.expiresAt,
    });
  },
});

export const getConceptById = internalMutation({
  args: {
    conceptId: v.id('concepts'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conceptId);
  },
});

async function fetchNeighborConcepts(
  ctx: ActionCtx,
  concept: ConceptDoc,
  limit: number
): Promise<Array<ConceptDoc & { _score?: number }>> {
  if (!concept.embedding || concept.embedding.length === 0) {
    return [];
  }

  const raw = await ctx.vectorSearch('concepts', 'by_embedding', {
    vector: concept.embedding,
    limit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: (q: any) => q.eq('userId', concept.userId),
  });

  const neighbors: Array<ConceptDoc & { _score?: number }> = [];
  for (const result of raw) {
    if (result._id === concept._id) {
      continue;
    }
    const doc = await ctx.runMutation(internal.iqc.getConceptById, { conceptId: result._id });
    if (!doc) {
      continue;
    }
    neighbors.push({ ...doc, _score: result._score });
  }
  return neighbors;
}

async function adjudicateMergeCandidate({
  candidate,
  provider,
  modelName,
  reasoningEffort,
  verbosity,
  model,
  openaiClient,
}: {
  candidate: MergeCandidate;
  provider: string;
  modelName: string;
  reasoningEffort: string;
  verbosity: string;
  model?: LanguageModel;
  openaiClient?: OpenAI;
}): Promise<MergeDecision | null> {
  const prompt = buildMergePrompt(candidate);

  if (provider === 'google' && model) {
    const response = await generateObject({
      model,
      prompt,
      schema: mergeDecisionSchema,
    });
    return response.object;
  }

  if (provider === 'openai' && openaiClient) {
    const response = await generateObjectWithResponsesApi({
      client: openaiClient,
      model: modelName,
      input: prompt,
      schema: mergeDecisionSchema,
      schemaName: 'iqc_merge_decision',
      reasoningEffort: reasoningEffort as 'minimal' | 'low' | 'medium' | 'high',
      verbosity: verbosity as 'low' | 'medium' | 'high',
    });
    return response.object;
  }

  return null;
}

function buildMergePrompt(candidate: MergeCandidate): string {
  const { source, target, vectorScore, titleSimilarity } = candidate;
  return `You are an IQC reviewer that decides whether two study concepts are duplicates.

Provide a JSON response with:
- decision: MERGE or KEEP
- reason: short explanation
- confidence: 0-1
- canonical: SOURCE or TARGET (which concept should remain)

SOURCE concept:
Title: ${source.title}
Description: ${source.description ?? 'n/a'}
Phrasing count: ${source.phrasingCount}

TARGET concept:
Title: ${target.title}
Description: ${target.description ?? 'n/a'}
Phrasing count: ${target.phrasingCount}

Similarity stats:
- Vector similarity: ${vectorScore.toFixed(3)}
- Title similarity: ${titleSimilarity.toFixed(3)}

Decide MERGE only if they are clearly duplicates or paraphrases.`;
}

export function buildProposalKey(a: Id<'concepts'>, b: Id<'concepts'>): string {
  const ids = [a.toString(), b.toString()].sort();
  return `${ids[0]}::${ids[1]}`;
}

export function computeTitleSimilarity(a: string, b: string): number {
  const tokensA = tokenizeTitle(a);
  const tokensB = tokenizeTitle(b);

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

function tokenizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

export function shouldConsiderMerge(
  vectorScore: number,
  titleSimilarity: number,
  sourceCount: number,
  targetCount: number
): boolean {
  if (vectorScore >= 0.97) {
    return true;
  }
  if (vectorScore < IQC_SCAN_CONFIG.minVectorScore) {
    return false;
  }
  if (titleSimilarity >= IQC_SCAN_CONFIG.minTitleSimilarity) {
    return true;
  }
  const bothThin = sourceCount <= 2 && targetCount <= 2;
  return vectorScore >= 0.94 && titleSimilarity >= 0.5 && bothThin;
}

function buildMergePayload(
  candidate: MergeCandidate,
  decision: MergeDecision,
  proposalKey: string,
  provider: string,
  keyDiagnostics: { present: boolean; length: number; fingerprint: string | null }
) {
  const canonicalConcept = decision.canonical === 'TARGET' ? candidate.target : candidate.source;
  const mergeConcept =
    canonicalConcept._id === candidate.target._id ? candidate.source : candidate.target;

  return {
    proposalKey,
    similarity: candidate.vectorScore,
    titleSimilarity: candidate.titleSimilarity,
    canonicalConceptId: canonicalConcept._id,
    mergeConceptId: mergeConcept._id,
    conceptSnapshots: [snapshotConcept(candidate.source), snapshotConcept(candidate.target)],
    llmDecision: {
      provider,
      reason: decision.reason,
      confidence: decision.confidence,
      canonicalPreference: decision.canonical,
      keyDiagnostics,
    },
  };
}

function snapshotConcept(concept: ConceptDoc) {
  return {
    conceptId: concept._id,
    title: concept.title,
    description: concept.description,
    phrasingCount: concept.phrasingCount,
    conflictScore: concept.conflictScore,
    thinScore: concept.thinScore,
    fsrs: concept.fsrs,
  };
}

function accumulateStatDelta(target: StatDeltas, delta?: StatDeltas | null) {
  if (!delta) {
    return;
  }

  for (const [key, value] of Object.entries(delta)) {
    if (value === undefined) {
      continue;
    }
    const statKey = key as keyof StatDeltas;
    target[statKey] = (target[statKey] ?? 0) + value;
  }
}
