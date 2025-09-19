import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFromClerk, requireUserFromClerk } from "./clerk";

export const completeQuiz = mutation({
  args: {
    topic: v.string(),
    difficulty: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    sessionId: v.optional(v.string()), // Add sessionId parameter
    answers: v.array(v.object({
      questionId: v.string(),
      question: v.string(),
      type: v.optional(v.union(v.literal('multiple-choice'), v.literal('true-false'))),
      userAnswer: v.string(),
      correctAnswer: v.string(),
      isCorrect: v.boolean(),
      options: v.array(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

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
      sessionId: args.sessionId, // Store sessionId if provided
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
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const user = await getUserFromClerk(ctx);
    if (!user) {
      return { quizzes: [], total: 0 };
    }
    const userId = user._id;

    const limit = args.limit || 10;
    const offset = args.offset || 0;

    // Efficient pagination: fetch limit + 1 to determine if there are more results
    // This avoids the expensive .collect() operation that loads all results
    const requestLimit = limit + offset + 1;
    const quizzes = await ctx.db
      .query("quizResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(requestLimit);

    // Apply offset if provided (for backward compatibility)
    // Note: offset-based pagination is less efficient than cursor-based
    const offsetQuizzes = offset > 0 ? quizzes.slice(offset) : quizzes;
    
    // Check if we have more items than requested limit
    const hasMore = offsetQuizzes.length > limit;
    
    // Return only the requested number of items
    const paginatedQuizzes = offsetQuizzes.slice(0, limit);

    // For backward compatibility, we still return a total count
    // But we estimate it as at least the number of items we've seen
    // This avoids the expensive .collect() operation
    const minTotal = offset + paginatedQuizzes.length + (hasMore ? 1 : 0);

    return {
      quizzes: paginatedQuizzes.map((quiz) => ({
        id: quiz._id,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        score: quiz.score,
        totalQuestions: quiz.totalQuestions,
        percentage: Math.round((quiz.score / quiz.totalQuestions) * 100),
        completedAt: quiz.completedAt,
        sessionId: quiz.sessionId, // Include sessionId for interaction lookup
      })),
      total: minTotal,  // Estimated minimum total to avoid expensive count
      hasMore,
    };
  },
});

export const getQuizStatsByTopic = query({
  args: {
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const user = await getUserFromClerk(ctx);
    if (!user) {
      return null;
    }
    const userId = user._id;

    // Get all quizzes for this topic
    const quizzes = await ctx.db
      .query("quizResults")
      .withIndex("by_user_topic", (q) => 
        q.eq("userId", userId).eq("topic", args.topic)
      )
      .collect();

    if (quizzes.length === 0) {
      return null;
    }

    // Calculate statistics
    const totalQuizzes = quizzes.length;
    const totalScore = quizzes.reduce((sum, quiz) => sum + quiz.score, 0);
    const totalQuestions = quizzes.reduce((sum, quiz) => sum + quiz.totalQuestions, 0);
    const averageScore = totalScore / totalQuestions;

    const latestQuiz = quizzes[quizzes.length - 1];

    return {
      topic: args.topic,
      totalQuizzes,
      averageScore: Math.round(averageScore * 100),
      lastAttempt: latestQuiz.completedAt,
      bestScore: Math.max(...quizzes.map((q) => Math.round((q.score / q.totalQuestions) * 100))),
    };
  },
});

export const getQuizStatsByTopicAuth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) {
      return [];
    }

    // Get all quiz results for the user
    const results = await ctx.db
      .query("quizResults")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
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

export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    // Get recent quiz results across all users
    const recentQuizzes = await ctx.db
      .query("quizResults")
      .order("desc")
      .take(limit);
    
    // Get user information for each quiz
    const activityWithUsers = await Promise.all(
      recentQuizzes.map(async (quiz) => {
        const user = await ctx.db.get(quiz.userId);
        return {
          id: quiz._id,
          topic: quiz.topic,
          score: quiz.score,
          totalQuestions: quiz.totalQuestions,
          difficulty: quiz.difficulty,
          completedAt: quiz.completedAt,
          userEmail: user?.email || 'Anonymous',
          percentage: Math.round((quiz.score / quiz.totalQuestions) * 100),
        };
      })
    );
    
    return activityWithUsers;
  },
});