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
    // Vector embeddings for semantic search
    embedding: v.optional(v.array(v.float64())), // 768-dimensional vector from text-embedding-004
    embeddingGeneratedAt: v.optional(v.number()), // Timestamp when embedding was generated
  })
    .index('by_user', ['userId', 'generatedAt'])
    .index('by_user_unattempted', ['userId', 'attemptCount'])
    .index('by_user_next_review', ['userId', 'nextReview'])
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
    questionId: v.id('questions'),
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
    .index('by_user_question', ['userId', 'questionId']),

  // Vector embeddings for semantic search (separated from questions for bandwidth optimization)
  // Stores 768-dimensional embeddings from Google text-embedding-004
  // Each embedding is ~6.1 KB - keeping separate prevents fetching on non-search queries
  questionEmbeddings: defineTable({
    questionId: v.id('questions'), // Foreign key to questions table
    userId: v.id('users'), // DUPLICATE from questions - immutable, security-critical
    embedding: v.array(v.float64()), // 768-dimensional vector (6.1 KB)
    embeddingGeneratedAt: v.number(), // Timestamp when embedding was generated
  })
    .index('by_question', ['questionId'])
    .index('by_user', ['userId'])
    // Vector index for semantic search
    // filterFields: userId only (post-filter deletedAt/archivedAt like current implementation)
    // Convex limitation: vector search doesn't support AND conditions for complex filters
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 768, // Google text-embedding-004
      filterFields: ['userId'], // Only userId - post-filter view state in memory
    }),

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
    phase: v.union(v.literal('clarifying'), v.literal('generating'), v.literal('finalizing')),
    questionsGenerated: v.number(), // Total AI generated
    questionsSaved: v.number(), // Successfully saved to DB
    estimatedTotal: v.optional(v.number()), // AI's estimate

    // Results (flat fields)
    // Note: topic field kept here for generation metadata/grouping
    // Removed from questions table (PR #44) but still used here for job classification
    topic: v.optional(v.string()), // Extracted topic
    questionIds: v.array(v.id('questions')), // All saved questions
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
});
