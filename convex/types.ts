// Import Id for use in this file
import type { Id } from './_generated/dataModel';

/**
 * Convex type exports
 *
 * This file re-exports commonly used Convex types for easy importing
 * throughout the application.
 */

export type { Doc, Id } from './_generated/dataModel';
export { api } from './_generated/api';

// Define specific document types based on schema
export type User = {
  _id: Id<'users'>;
  _creationTime: number;
  email: string;
  name?: string;
  emailVerified?: boolean;
  image?: string;
  createdAt?: number;
};

/**
 * @deprecated The quizResults table is deprecated. Use questions and interactions tables instead.
 * This type is kept for backward compatibility but should not be used for new features.
 */
export type QuizResult = {
  _id: Id<'quizResults'>;
  _creationTime: number;
  userId: Id<'users'>;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  score: number;
  totalQuestions: number;
  completedAt: number;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    userAnswer: number;
    isCorrect: boolean;
  }>;
};

// Re-export Id type with specific table names for convenience
export type UserId = Id<'users'>;
export type QuizResultId = Id<'quizResults'>;
