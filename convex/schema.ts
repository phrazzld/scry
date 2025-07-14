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
  }).index("by_user", ["userId", "generatedAt"])
    .index("by_user_topic", ["userId", "topic", "generatedAt"])
    .index("by_user_unattempted", ["userId", "attemptCount"]),

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
});