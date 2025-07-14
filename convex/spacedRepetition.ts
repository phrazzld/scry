import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { createEmptyCard, fsrs, generatorParameters, Rating, Card as FSRSCard, State } from "ts-fsrs";

// Helper to get authenticated user ID from session token
async function getAuthenticatedUserId(ctx: QueryCtx | MutationCtx, sessionToken: string | undefined) {
  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session");
  }

  return session.userId;
}

// Create cards for a completed quiz
export const createCardsForQuiz = mutation({
  args: {
    sessionToken: v.string(),
    quizResultId: v.id("quizResults"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    
    // Get the quiz result
    const quizResult = await ctx.db.get(args.quizResultId);
    if (!quizResult || quizResult.userId !== userId) {
      throw new Error("Quiz result not found");
    }
    
    // Check if cards already exist for this quiz
    const existingCards = await ctx.db
      .query("cards")
      .withIndex("by_quiz_result", (q) => q.eq("quizResultId", args.quizResultId))
      .collect();
    
    if (existingCards.length > 0) {
      return { message: "Cards already exist for this quiz", cardsCreated: 0 };
    }
    
    // Create FSRS instance
    const f = fsrs(generatorParameters({ enable_fuzz: true }));
    
    // Create a card for each question
    const cardIds = [];
    for (let i = 0; i < quizResult.answers.length; i++) {
      const answer = quizResult.answers[i];
      
      // Create empty FSRS card
      const emptyCard = createEmptyCard(new Date(quizResult.completedAt));
      
      // If the answer was correct on first try, treat it as "Good" rating
      // Otherwise, treat as "New" card that needs review
      let fsrsCard = emptyCard;
      if (answer.isCorrect) {
        const schedulingCards = f.repeat(emptyCard, new Date(quizResult.completedAt));
        fsrsCard = schedulingCards[Rating.Good].card;
      }
      
      // Convert FSRS card to our database format
      const cardId = await ctx.db.insert("cards", {
        userId,
        quizResultId: args.quizResultId,
        questionIndex: i,
        due: fsrsCard.due.getTime(),
        stability: fsrsCard.stability,
        difficulty: fsrsCard.difficulty,
        elapsedDays: fsrsCard.elapsed_days,
        scheduledDays: fsrsCard.scheduled_days,
        learningSteps: fsrsCard.learning_steps,
        reps: fsrsCard.reps,
        lapses: fsrsCard.lapses,
        state: mapFSRSState(fsrsCard.state),
        lastReview: fsrsCard.last_review ? fsrsCard.last_review.getTime() : undefined,
      });
      
      cardIds.push(cardId);
    }
    
    return { 
      message: "Cards created successfully", 
      cardsCreated: cardIds.length,
      cardIds 
    };
  },
});

// Get cards due for review
export const getReviewQueue = query({
  args: {
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.sessionToken) {
      return { cards: [], total: 0 };
    }
    
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    const limit = args.limit || 20;
    const now = Date.now();
    
    // Get cards due for review (due <= now)
    const dueCards = await ctx.db
      .query("cards")
      .withIndex("by_user_due", (q) => 
        q.eq("userId", userId)
          .lte("due", now)
      )
      .take(limit);
    
    // Fetch quiz results and format response
    const cardsWithQuestions = await Promise.all(
      dueCards.map(async (card) => {
        const quizResult = await ctx.db.get(card.quizResultId);
        if (!quizResult || card.questionIndex >= quizResult.answers.length) {
          return null;
        }
        
        const answer = quizResult.answers[card.questionIndex];
        return {
          cardId: card._id,
          question: answer.question,
          type: answer.type,
          options: answer.options,
          correctAnswer: answer.correctAnswer,
          topic: quizResult.topic,
          difficulty: quizResult.difficulty,
          // Card metadata
          state: card.state,
          reps: card.reps,
          lapses: card.lapses,
          due: card.due,
          lastReview: card.lastReview,
        };
      })
    );
    
    const validCards = cardsWithQuestions.filter(card => card !== null);
    
    return {
      cards: validCards,
      total: validCards.length,
    };
  },
});

// Review a card
export const reviewCard = mutation({
  args: {
    sessionToken: v.string(),
    cardId: v.id("cards"),
    rating: v.union(
      v.literal("Again"),
      v.literal("Hard"),
      v.literal("Good"),
      v.literal("Easy")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx, args.sessionToken);
    
    // Get the card
    const card = await ctx.db.get(args.cardId);
    if (!card || card.userId !== userId) {
      throw new Error("Card not found");
    }
    
    // Convert database card to FSRS card
    const fsrsCard: FSRSCard = {
      due: new Date(card.due),
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsedDays,
      scheduled_days: card.scheduledDays,
      learning_steps: card.learningSteps,
      reps: card.reps,
      lapses: card.lapses,
      state: mapStateToFSRS(card.state),
      last_review: card.lastReview ? new Date(card.lastReview) : undefined,
    };
    
    // Create FSRS instance and calculate next review
    const f = fsrs(generatorParameters({ enable_fuzz: true }));
    const now = new Date();
    const schedulingCards = f.repeat(fsrsCard, now);
    
    // Get the new card based on rating
    let newCard: FSRSCard;
    switch (args.rating) {
      case "Again":
        newCard = schedulingCards[Rating.Again].card;
        break;
      case "Hard":
        newCard = schedulingCards[Rating.Hard].card;
        break;
      case "Good":
        newCard = schedulingCards[Rating.Good].card;
        break;
      case "Easy":
        newCard = schedulingCards[Rating.Easy].card;
        break;
    }
    
    // Update the card in database
    await ctx.db.patch(args.cardId, {
      due: newCard.due.getTime(),
      stability: newCard.stability,
      difficulty: newCard.difficulty,
      elapsedDays: newCard.elapsed_days,
      scheduledDays: newCard.scheduled_days,
      learningSteps: newCard.learning_steps,
      reps: newCard.reps,
      lapses: newCard.lapses,
      state: mapFSRSState(newCard.state),
      lastReview: now.getTime(),
    });
    
    return {
      message: "Card reviewed successfully",
      nextDue: newCard.due.toISOString(),
      newState: mapFSRSState(newCard.state),
    };
  },
});

// Helper functions to map between FSRS states and our database states
function mapFSRSState(state: State): "New" | "Learning" | "Review" | "Relearning" {
  switch (state) {
    case State.New: return "New";
    case State.Learning: return "Learning";
    case State.Review: return "Review";
    case State.Relearning: return "Relearning";
    default: return "New";
  }
}

function mapStateToFSRS(state: "New" | "Learning" | "Review" | "Relearning"): State {
  switch (state) {
    case "New": return State.New;
    case "Learning": return State.Learning;
    case "Review": return State.Review;
    case "Relearning": return State.Relearning;
  }
}