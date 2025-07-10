/* eslint-disable @typescript-eslint/no-explicit-any */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to get authenticated user ID from session token
async function getAuthenticatedUserId(ctx: any, sessionToken: string | undefined) {
  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session");
  }

  return session.userId;
}

export const completeQuiz = mutation({
  args: {
    sessionToken: v.string(),
    topic: v.string(),
    difficulty: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    answers: v.array(v.object({
      questionId: v.string(),
      question: v.string(),
      userAnswer: v.string(),
      correctAnswer: v.string(),
      isCorrect: v.boolean(),
      options: v.array(v.string()),
    })),
  },
  handler: async (ctx: any, args: any) => {
    // Verify authentication
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);

    // Validate score
    if (args.score > args.totalQuestions) {
      throw new Error("Score cannot exceed total questions");
    }

    // Store quiz result
    const quizResultId = await ctx.db.insert("quizResults", {
      userId,
      topic: args.topic,
      difficulty: args.difficulty,
      score: args.score,
      totalQuestions: args.totalQuestions,
      answers: args.answers,
      completedAt: Date.now(),
    });

    return {
      success: true,
      quizResultId,
      message: "Quiz results saved successfully",
    };
  },
});

export const getQuizHistory = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    if (!args.sessionToken) {
      return { quizzes: [], total: 0 };
    }

    // Verify authentication
    let userId;
    try {
      userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    } catch {
      return { quizzes: [], total: 0 };
    }

    const limit = args.limit || 10;
    const offset = args.offset || 0;

    // Get total count
    const allQuizzes = await ctx.db
      .query("quizResults")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    
    const total = allQuizzes.length;

    // Get paginated results
    const quizzes = await ctx.db
      .query("quizResults")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(limit + offset);

    // Manual pagination since Convex doesn't have skip
    const paginatedQuizzes = quizzes.slice(offset, offset + limit);

    return {
      quizzes: paginatedQuizzes.map((quiz: any) => ({
        id: quiz._id,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        score: quiz.score,
        totalQuestions: quiz.totalQuestions,
        percentage: Math.round((quiz.score / quiz.totalQuestions) * 100),
        completedAt: quiz.completedAt,
      })),
      total,
      hasMore: offset + limit < total,
    };
  },
});

export const getQuizStatsByTopic = query({
  args: {
    sessionToken: v.optional(v.string()),
    topic: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    if (!args.sessionToken) {
      return null;
    }

    // Verify authentication
    let userId;
    try {
      userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    } catch {
      return null;
    }

    // Get all quizzes for this topic
    const quizzes = await ctx.db
      .query("quizResults")
      .withIndex("by_user_topic", (q: any) => 
        q.eq("userId", userId).eq("topic", args.topic)
      )
      .collect();

    if (quizzes.length === 0) {
      return null;
    }

    // Calculate statistics
    const totalQuizzes = quizzes.length;
    const totalScore = quizzes.reduce((sum: any, quiz: any) => sum + quiz.score, 0);
    const totalQuestions = quizzes.reduce((sum: any, quiz: any) => sum + quiz.totalQuestions, 0);
    const averageScore = totalScore / totalQuestions;

    const latestQuiz = quizzes[quizzes.length - 1];

    return {
      topic: args.topic,
      totalQuizzes,
      averageScore: Math.round(averageScore * 100),
      lastAttempt: latestQuiz.completedAt,
      bestScore: Math.max(...quizzes.map((q: any) => Math.round((q.score / q.totalQuestions) * 100))),
    };
  },
});

export const getQuizStatsByTopicAuth = query({
  args: {},
  handler: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", identity.email!))
      .first();

    if (!user) {
      return [];
    }

    // Get all quiz results for the user
    const results = await ctx.db
      .query("quizResults")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();

    // Group by topic and calculate stats
    const topicMap = new Map<string, { count: number; totalScore: number; totalQuestions: number }>();

    for (const result of results) {
      const current = topicMap.get(result.topic) || { count: 0, totalScore: 0, totalQuestions: 0 };
      topicMap.set(result.topic, {
        count: current.count + 1,
        totalScore: current.totalScore + result.score,
        totalQuestions: current.totalQuestions + result.totalQuestions,
      });
    }

    // Convert to array and return
    return Array.from(topicMap.entries()).map(([topic, stats]) => ({
      topic,
      ...stats,
    }));
  },
});