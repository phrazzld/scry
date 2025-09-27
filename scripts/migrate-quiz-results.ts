#!/usr/bin/env npx tsx

/**
 * Migration script template for converting quiz results to individual questions.
 * This is an example script showing the migration logic.
 * The actual migration runs via Convex internal mutation.
 *
 * To run the migration:
 * npx convex run migrations:migrateQuizResultsToQuestions --dryRun true --batchSize 10
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
// import { api } from "../convex/_generated/api";
import { createHash } from 'crypto';
import { ConvexHttpClient } from 'convex/browser';

// Configuration
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to dry run for safety

if (!CONVEX_URL) {
  console.error('Error: NEXT_PUBLIC_CONVEX_URL environment variable is required');
  process.exit(1);
}

// const client = new ConvexHttpClient(CONVEX_URL);

interface QuizResult {
  _id: string;
  userId: string;
  topic: string;
  difficulty: string;
  score: number;
  totalQuestions: number;
  sessionId?: string;
  answers: Array<{
    questionId: string;
    question: string;
    type?: 'multiple-choice' | 'true-false';
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    options: string[];
  }>;
  completedAt: number;
}

// Generate a deterministic question ID based on question content
function generateQuestionHash(question: string, options: string[], correctAnswer: string): string {
  const content = `${question}|${options.join(',')}|${correctAnswer}`;
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

async function migrateQuizResults() {
  console.log(`Starting quiz results migration (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);
  console.log(`Convex URL: ${CONVEX_URL}`);
  console.log('-------------------------------------------');

  try {
    // Note: This is a simplified example. In a real migration, you'd need to:
    // 1. Create a Convex function that can access all quiz results
    // 2. Process them in batches
    // 3. Handle authentication properly

    console.log('\nMigration script ready.');
    console.log('\nTo run the actual migration, you need to:');
    console.log('1. Create a Convex migration function that can access all quizResults');
    console.log('2. Implement batch processing to handle large datasets');
    console.log('3. Add proper authentication for admin access');
    console.log('4. Implement rollback functionality');

    console.log('\nExample migration logic:');
    console.log(`
// For each quiz result:
// 1. Generate sessionId if missing
const sessionId = quizResult.sessionId || generateSessionId(quizResult._id);

// 2. For each answer in the quiz result:
for (const answer of quizResult.answers) {
  // a. Create question if it doesn't exist
  const questionHash = generateQuestionHash(answer.question, answer.options, answer.correctAnswer);
  
  // Check if question already exists (by hash or content)
  // If not, create it:
  const questionId = await createQuestion({
    userId: quizResult.userId,
    topic: quizResult.topic,
    difficulty: quizResult.difficulty,
    question: answer.question,
    type: answer.type || 'multiple-choice',
    options: answer.options,
    correctAnswer: answer.correctAnswer,
    explanation: undefined, // Not available in old data
    generatedAt: quizResult.completedAt, // Best approximation
    attemptCount: 1, // Will be updated by interaction
    correctCount: answer.isCorrect ? 1 : 0,
    lastAttemptedAt: quizResult.completedAt,
  });
  
  // b. Create interaction record
  await createInteraction({
    userId: quizResult.userId,
    questionId: questionId,
    userAnswer: answer.userAnswer,
    isCorrect: answer.isCorrect,
    attemptedAt: quizResult.completedAt,
    timeSpent: undefined, // Not available in old data
    context: { sessionId: sessionId },
  });
}
    `);

    console.log('\nMigration statistics would show:');
    console.log('- Total quiz results to migrate');
    console.log('- Questions created');
    console.log('- Interactions created');
    console.log('- Duplicate questions found');
    console.log('- Errors encountered');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Helper function to generate session ID from quiz result ID
function generateSessionId(quizResultId: string): string {
  return `migrated_${quizResultId.substring(0, 8)}`;
}

// Run migration
migrateQuizResults()
  .then(() => {
    console.log('\nMigration script completed');
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
