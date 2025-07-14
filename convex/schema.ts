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

  cards: defineTable({
    userId: v.id("users"),
    quizResultId: v.id("quizResults"),
    questionIndex: v.number(), // Index in the quiz result's answers array
    // FSRS Card properties
    due: v.number(), // Timestamp when card is due for review
    stability: v.number(),
    difficulty: v.number(),
    elapsedDays: v.number(),
    scheduledDays: v.number(),
    learningSteps: v.number(),
    reps: v.number(),
    lapses: v.number(),
    state: v.union(
      v.literal("New"),
      v.literal("Learning"),
      v.literal("Review"),
      v.literal("Relearning")
    ),
    lastReview: v.optional(v.number()), // Timestamp of last review
  }).index("by_user_due", ["userId", "due"])
    .index("by_quiz_result", ["quizResultId"])
    .index("by_user", ["userId"]),
});