import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    email: v.string(),
    clerkId: v.optional(v.string()), // Clerk user ID for auth integration
    name: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    image: v.optional(v.string()),
    currentStreak: v.optional(v.number()), // Consecutive days with >0 reviews
    lastStreakDate: v.optional(v.number()), // Last date streak was calculated
  })
    .index('by_email', ['email'])
    .index('by_clerk_id', ['clerkId']),

  // Cached card statistics per user (O(1) reads vs O(N) collection scans)
  // Updated incrementally on card state transitions for bandwidth optimization
  userStats: defineTable({
    userId: v.id('users'),
    totalCards: v.number(), // Total non-deleted cards
    newCount: v.number(), // Cards in 'new' state
    learningCount: v.number(), // Cards in 'learning' state
    matureCount: v.number(), // Cards in 'review' state
    dueNowCount: v.number(), // Cards where nextReview <= now (maintained by scheduleReview)
    nextReviewTime: v.optional(v.number()), // Earliest nextReview timestamp across all cards
    lastCalculated: v.number(), // Timestamp of last stats update
  }).index('by_user', ['userId']),

  // Note: 'difficulty' field removed in v2.0 (2025-01)
  // - Never used by FSRS algorithm (uses fsrsDifficulty parameter instead)
  // - Removed to simplify schema and avoid confusion with FSRS difficulty
  // - Existing records migrated via migrations.ts:removeDifficultyFromQuestions
  questions: defineTable({
    userId: v.id('users'),
    question: v.string(),
    type: v.union(v.literal('multiple-choice'), v.literal('true-false')),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.optional(v.string()),
    generatedAt: v.number(),
    // Denormalized fields for query performance
    attemptCount: v.number(), // Default: 0
    correctCount: v.number(), // Default: 0
    lastAttemptedAt: v.optional(v.number()),
    // FSRS spaced repetition fields
    nextReview: v.optional(v.number()), // Timestamp of next review
    stability: v.optional(v.number()), // FSRS stability parameter
    fsrsDifficulty: v.optional(v.number()), // FSRS difficulty (not quiz difficulty)
    elapsedDays: v.optional(v.number()),
    scheduledDays: v.optional(v.number()),
    reps: v.optional(v.number()),
    lapses: v.optional(v.number()),
    state: v.optional(
      v.union(v.literal('new'), v.literal('learning'), v.literal('review'), v.literal('relearning'))
    ),
    lastReview: v.optional(v.number()),
    // Soft delete and update tracking
    deletedAt: v.optional(v.number()), // For soft delete
    updatedAt: v.optional(v.number()), // Track last update time
    // Archive and generation tracking
    archivedAt: v.optional(v.number()), // For pausing questions without deleting
    generationJobId: v.optional(v.id('generationJobs')), // Link to source generation job
    // Concepts & Phrasings migration (Phase 1: Add optional field)
    // Will be backfilled via migration, then enforced in Phase 3
    conceptId: v.optional(v.id('concepts')), // Link to parent concept (added in v2.3.0)
    // Vector embeddings for semantic search
    embedding: v.optional(v.array(v.float64())), // 768-dimensional vector from text-embedding-004
    embeddingGeneratedAt: v.optional(v.number()), // Timestamp when embedding was generated
  })
    .index('by_user', ['userId', 'generatedAt'])
    .index('by_user_unattempted', ['userId', 'attemptCount'])
    .index('by_user_next_review', ['userId', 'nextReview'])
    .index('by_concept', ['conceptId'])
    // Compound indexes for efficient filtering (eliminates client-side .filter())
    // Enables DB-level filtering for active/archived/deleted views at scale (10k+ cards)
    .index('by_user_active', ['userId', 'deletedAt', 'archivedAt', 'generatedAt'])
    .index('by_user_state', ['userId', 'state', 'deletedAt', 'archivedAt'])
    // Vector index for semantic search
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 768, // Google text-embedding-004
      filterFields: ['userId', 'deletedAt', 'archivedAt'],
    })
    // Full-text search index for comprehensive text search
    // Enables searching entire collection efficiently (not just first N results)
    .searchIndex('search_questions', {
      searchField: 'question',
      filterFields: ['userId', 'deletedAt', 'archivedAt'],
    }),

  interactions: defineTable({
    userId: v.id('users'),
    questionId: v.optional(v.id('questions')),
    conceptId: v.optional(v.id('concepts')),
    phrasingId: v.optional(v.id('phrasings')),
    userAnswer: v.string(),
    isCorrect: v.boolean(),
    attemptedAt: v.number(),
    timeSpent: v.optional(v.number()), // milliseconds
    context: v.optional(
      v.object({
        sessionId: v.optional(v.string()), // for grouping quiz attempts
        isRetry: v.optional(v.boolean()),
      })
    ),
  })
    .index('by_user', ['userId', 'attemptedAt'])
    .index('by_question', ['questionId', 'attemptedAt'])
    .index('by_user_question', ['userId', 'questionId'])
    .index('by_user_concept', ['userId', 'conceptId', 'attemptedAt'])
    .index('by_concept', ['conceptId', 'attemptedAt']),

  /**
   * @deprecated This table is deprecated and should not be used.
   *
   * The quiz concept has been replaced with a pure FSRS review system.
   * Individual questions and interactions are tracked in the following tables:
   * - `questions`: Stores individual question data with FSRS parameters
   * - `interactions`: Records each user answer attempt
   *
   * Migration notes:
   * - No new data should be written to this table
   * - Existing data can be accessed read-only for historical purposes
   * - Use `questions` and `interactions` tables for all new functionality
   *
   * This table will be removed in a future release.
   */
  quizResults: defineTable({
    userId: v.id('users'),
    topic: v.string(),
    difficulty: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    sessionId: v.optional(v.string()), // Add sessionId for linking with interactions
    answers: v.array(
      v.object({
        questionId: v.string(),
        question: v.string(),
        type: v.optional(v.union(v.literal('multiple-choice'), v.literal('true-false'))),
        userAnswer: v.string(),
        correctAnswer: v.string(),
        isCorrect: v.boolean(),
        options: v.array(v.string()),
      })
    ),
    completedAt: v.number(),
  })
    .index('by_user', ['userId', 'completedAt'])
    .index('by_user_topic', ['userId', 'topic', 'completedAt']),

  deployments: defineTable({
    environment: v.string(), // 'development' | 'production' | 'preview'
    deployedBy: v.optional(v.string()), // User email or system identifier
    commitSha: v.optional(v.string()), // Git commit SHA
    commitMessage: v.optional(v.string()), // Git commit message
    branch: v.optional(v.string()), // Git branch name
    deploymentType: v.string(), // 'manual' | 'ci' | 'scheduled'
    status: v.string(), // 'started' | 'success' | 'failed'
    schemaVersion: v.optional(v.string()), // Schema version identifier
    functionCount: v.optional(v.number()), // Number of functions deployed
    duration: v.optional(v.number()), // Deployment duration in ms
    error: v.optional(v.string()), // Error message if failed
    metadata: v.optional(
      v.object({
        buildId: v.optional(v.string()),
        vercelDeploymentId: v.optional(v.string()),
        convexVersion: v.optional(v.string()),
        nodeVersion: v.optional(v.string()),
      })
    ),
    deployedAt: v.number(), // Timestamp
  })
    .index('by_environment', ['environment', 'deployedAt'])
    .index('by_status', ['status', 'deployedAt'])
    .index('by_branch', ['branch', 'deployedAt']),

  rateLimits: defineTable({
    identifier: v.string(), // Email address or IP address
    operation: v.string(), // Type of operation (magicLink, questionGeneration, etc.)
    timestamp: v.number(), // When the attempt was made
    metadata: v.optional(v.any()), // Additional data about the attempt
  })
    .index('by_identifier', ['identifier', 'timestamp'])
    .index('by_operation', ['operation', 'timestamp']),

  generationJobs: defineTable({
    // Ownership
    userId: v.id('users'),

    // Input
    prompt: v.string(), // Raw user input (sanitized)

    // Status (simple state machine)
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('cancelled')
    ),

    // Progress (flat fields, no nesting)
    phase: v.union(
      v.literal('clarifying'),
      v.literal('concept_synthesis'),
      v.literal('generating'),
      v.literal('phrasing_generation'),
      v.literal('finalizing')
    ),
    questionsGenerated: v.number(), // Total AI generated
    questionsSaved: v.number(), // Successfully saved to DB
    estimatedTotal: v.optional(v.number()), // AI's estimate

    // Results (flat fields)
    // Note: topic field kept here for generation metadata/grouping
    // Removed from questions table (PR #44) but still used here for job classification
    topic: v.optional(v.string()), // Extracted topic
    questionIds: v.array(v.id('questions')), // All saved questions
    conceptIds: v.array(v.id('concepts')), // Concepts generated in Stage A
    pendingConceptIds: v.array(v.id('concepts')), // Concepts remaining for Stage B
    durationMs: v.optional(v.number()), // Total generation time

    // Error handling (flat fields)
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()), // 'RATE_LIMIT' | 'API_KEY' | 'NETWORK' | 'UNKNOWN'
    retryable: v.optional(v.boolean()),

    // Timestamps
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    // Rate limiting
    ipAddress: v.optional(v.string()),
  })
    .index('by_user_status', ['userId', 'status', 'createdAt'])
    .index('by_status_created', ['status', 'createdAt']),

  // ============================================================================
  // Concepts & Phrasings Architecture (v2.3.0)
  // ============================================================================
  // New table architecture supporting atomic knowledge concepts with multiple
  // phrasing variations. FSRS scheduling moves to concept-level to eliminate
  // duplicate scheduling pressure from near-identical questions.
  //
  // Migration Path (3-phase):
  // - Phase 1: Add tables + optional conceptId to questions (this deployment)
  // - Phase 2: Run backfill migration (1 concept per existing question)
  // - Phase 3: Enforce conceptId requirement, deprecate question-level FSRS

  // Concepts: Atomic units of knowledge with concept-level FSRS scheduling
  concepts: defineTable({
    userId: v.id('users'),
    title: v.string(), // Concise, user-facing concept name
    description: v.optional(v.string()), // Optional detailed explanation

    // FSRS state (single source of truth for scheduling)
    fsrs: v.object({
      stability: v.number(),
      difficulty: v.number(),
      lastReview: v.optional(v.number()),
      nextReview: v.number(),
      elapsedDays: v.optional(v.number()),
      retrievability: v.optional(v.number()),
      scheduledDays: v.optional(v.number()),
      reps: v.optional(v.number()),
      lapses: v.optional(v.number()),
      state: v.optional(
        v.union(v.literal('new'), v.literal('learning'), v.literal('review'), v.literal('relearning'))
      ),
    }),
    canonicalPhrasingId: v.optional(v.id('phrasings')),

    // IQC (Intelligent Quality Control) signals
    phrasingCount: v.number(), // Number of phrasings for this concept
    conflictScore: v.optional(v.number()), // Heuristic for "overloaded" concepts
    thinScore: v.optional(v.number()), // Heuristic for "needs more phrasings"
    qualityScore: v.optional(v.number()), // Overall quality signal

    // Vector embeddings for semantic search and clustering
    embedding: v.optional(v.array(v.float64())), // 768-dim from text-embedding-004
    embeddingGeneratedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    generationJobId: v.optional(v.id('generationJobs')),
  })
    .index('by_user', ['userId', 'createdAt'])
    .index('by_user_next_review', ['userId', 'fsrs.nextReview'])
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 768,
      filterFields: ['userId'],
    })
    .searchIndex('search_concepts', {
      searchField: 'title',
      filterFields: ['userId'],
    }),

  // Phrasings: Different ways to test the same concept
  phrasings: defineTable({
    userId: v.id('users'),
    conceptId: v.id('concepts'),

    // Question content (preserves compatibility with existing question schema)
    question: v.string(),
    explanation: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal('multiple-choice'),
        v.literal('true-false'),
        v.literal('cloze'),
        v.literal('short-answer') // Scaffold for future free-response
      )
    ),
    options: v.optional(v.array(v.string())), // For MCQ
    correctAnswer: v.optional(v.string()),

    // Local attempt statistics (analytics only, not scheduling)
    attemptCount: v.optional(v.number()),
    correctCount: v.optional(v.number()),
    lastAttemptedAt: v.optional(v.number()),

    // Soft delete and update tracking
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),

    // Vector embeddings per phrasing (for similarity detection)
    embedding: v.optional(v.array(v.float64())),
    embeddingGeneratedAt: v.optional(v.number()),
  })
    .index('by_user_concept', ['userId', 'conceptId', 'createdAt'])
    .index('by_user_active', ['userId', 'deletedAt', 'archivedAt', 'createdAt'])
    .searchIndex('search_phrasings', {
      searchField: 'question',
      filterFields: ['userId', 'deletedAt', 'archivedAt'],
    })
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 768,
      filterFields: ['userId', 'deletedAt', 'archivedAt'],
    }),

  // Reclustering Jobs: Track IQC background processing
  reclusterJobs: defineTable({
    userId: v.id('users'),
    status: v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('done'),
      v.literal('failed')
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    stats: v.optional(v.any()), // Job statistics (concepts processed, proposals created, etc.)
  }).index('by_user_status', ['userId', 'status', 'createdAt']),

  // Action Cards: IQC proposals for user review
  actionCards: defineTable({
    userId: v.id('users'),
    kind: v.union(
      v.literal('MERGE_CONCEPTS'), // Duplicate concepts detected
      v.literal('SPLIT_CONCEPT'), // Overloaded concept detected
      v.literal('ASSIGN_ORPHANS'), // Orphaned phrasings need concept
      v.literal('FILL_OUT_CONCEPT'), // Thin concept needs more phrasings
      v.literal('RENAME_CONCEPT') // Ambiguous concept title
    ),
    payload: v.any(), // Concrete proposal (concept IDs, reason strings, preview diffs)

    // Lifecycle
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // Auto-expire stale proposals
    resolvedAt: v.optional(v.number()), // When user accepted/rejected
    resolution: v.optional(v.union(v.literal('accepted'), v.literal('rejected'))),
  }).index('by_user_open', ['userId', 'resolvedAt', 'createdAt']),
});
