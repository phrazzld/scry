import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    clerkId: v.optional(v.string()), // Clerk user ID for auth integration
    name: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    image: v.optional(v.string()),
    currentStreak: v.optional(v.number()), // Consecutive days with >0 reviews
    lastStreakDate: v.optional(v.number()), // Last date streak was calculated
  }).index("by_email", ["email"])
    .index("by_clerk_id", ["clerkId"]),

  questions: defineTable({
    userId: v.id("users"),
    topic: v.string(),
    difficulty: v.string(),
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
    stability: v.optional(v.number()),   // FSRS stability parameter
    fsrsDifficulty: v.optional(v.number()), // FSRS difficulty (not quiz difficulty)
    elapsedDays: v.optional(v.number()),
    scheduledDays: v.optional(v.number()),
    reps: v.optional(v.number()),
    lapses: v.optional(v.number()),
    state: v.optional(v.union(
      v.literal("new"),
      v.literal("learning"), 
      v.literal("review"),
      v.literal("relearning")
    )),
    lastReview: v.optional(v.number()),
    // Soft delete and update tracking
    deletedAt: v.optional(v.number()), // For soft delete
    updatedAt: v.optional(v.number()), // Track last update time
  }).index("by_user", ["userId", "generatedAt"])
    .index("by_user_topic", ["userId", "topic", "generatedAt"])
    .index("by_user_unattempted", ["userId", "attemptCount"])
    .index("by_user_next_review", ["userId", "nextReview"])
    .index("by_user_active", ["userId", "deletedAt"]), // For filtering deleted questions

  interactions: defineTable({
    userId: v.id("users"),
    questionId: v.id("questions"),
    userAnswer: v.string(),
    isCorrect: v.boolean(),
    attemptedAt: v.number(),
    timeSpent: v.optional(v.number()), // milliseconds
    context: v.optional(v.object({
      sessionId: v.optional(v.string()), // for grouping quiz attempts
      isRetry: v.optional(v.boolean()),
    })),
  }).index("by_user", ["userId", "attemptedAt"])
    .index("by_question", ["questionId", "attemptedAt"])
    .index("by_user_question", ["userId", "questionId"]),

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
    userId: v.id("users"),
    topic: v.string(),
    difficulty: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    sessionId: v.optional(v.string()), // Add sessionId for linking with interactions
    answers: v.array(v.object({
      questionId: v.string(),
      question: v.string(),
      type: v.optional(v.union(v.literal('multiple-choice'), v.literal('true-false'))),
      userAnswer: v.string(),
      correctAnswer: v.string(),
      isCorrect: v.boolean(),
      options: v.array(v.string()),
    })),
    completedAt: v.number(),
  }).index("by_user", ["userId", "completedAt"])
    .index("by_user_topic", ["userId", "topic", "completedAt"]),

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
    metadata: v.optional(v.object({
      buildId: v.optional(v.string()),
      vercelDeploymentId: v.optional(v.string()),
      convexVersion: v.optional(v.string()),
      nodeVersion: v.optional(v.string()),
    })),
    deployedAt: v.number(), // Timestamp
  }).index("by_environment", ["environment", "deployedAt"])
    .index("by_status", ["status", "deployedAt"])
    .index("by_branch", ["branch", "deployedAt"]),

  rateLimits: defineTable({
    identifier: v.string(), // Email address or IP address
    operation: v.string(), // Type of operation (magicLink, questionGeneration, etc.)
    timestamp: v.number(), // When the attempt was made
    metadata: v.optional(v.any()), // Additional data about the attempt
  }).index("by_identifier", ["identifier", "timestamp"])
    .index("by_operation", ["operation", "timestamp"]),
});