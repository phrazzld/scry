import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    image: v.optional(v.string()),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    expiresAt: v.number(),
    token: v.string(),
    environment: v.optional(v.string()), // Track where session was created (production, preview, development)
  }).index("by_token", ["token"])
    .index("by_user", ["userId"])
    .index("by_environment", ["environment"]),

  magicLinks: defineTable({
    email: v.string(),
    token: v.string(),
    expiresAt: v.number(),
    used: v.optional(v.boolean()),
    environment: v.optional(v.string()), // Track environment for session creation
  }).index("by_token", ["token"])
    .index("by_email", ["email"]),

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
  }).index("by_user", ["userId", "generatedAt"])
    .index("by_user_topic", ["userId", "topic", "generatedAt"])
    .index("by_user_unattempted", ["userId", "attemptCount"])
    .index("by_user_next_review", ["userId", "nextReview"]),

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
});