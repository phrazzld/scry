import type { Id } from '@/convex/_generated/dataModel';

// Re-export concept types for convenience
export type { ConceptDoc, PhrasingDoc, FsrsState, IqcScores } from './concepts';

export type QuestionType = 'multiple-choice' | 'true-false';

export interface SimpleQuestion {
  question: string;
  type?: QuestionType; // Optional for backwards compatibility, defaults to 'multiple-choice'
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface QuizGenerationRequest {
  prompt: string;
}

// Types matching Convex schema for questions table
export interface Question {
  _id: Id<'questions'>;
  _creationTime: number;
  userId: Id<'users'>;
  question: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  generatedAt: number;
  attemptCount: number;
  correctCount: number;
  lastAttemptedAt?: number;
  // Concepts & Phrasings migration (Phase 1: Add optional field)
  conceptId?: Id<'concepts'>;
}

// Types matching Convex schema for interactions table
export interface Interaction {
  _id: Id<'interactions'>;
  _creationTime: number;
  userId: Id<'users'>;
  questionId?: Id<'questions'>;
  conceptId?: Id<'concepts'>;
  phrasingId?: Id<'phrasings'>;
  userAnswer: string;
  isCorrect: boolean;
  attemptedAt: number;
  timeSpent?: number;
  context?: {
    sessionId?: string;
    isRetry?: boolean;
  };
}

// Type for interaction stats used in UI
export interface InteractionStats {
  totalInteractions: number;
  correctInteractions: number;
  accuracy: number;
}
