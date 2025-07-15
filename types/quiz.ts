import type { Id } from '@/convex/_generated/dataModel'

export type QuestionType = 'multiple-choice' | 'true-false'

export interface SimpleQuestion {
  question: string
  type?: QuestionType // Optional for backwards compatibility, defaults to 'multiple-choice'
  options: string[]
  correctAnswer: string
  explanation?: string
}

export interface SimpleQuiz {
  topic: string
  questions: SimpleQuestion[]
  questionIds?: string[] // IDs of persisted questions
  currentIndex: number
  score: number
}

export interface QuizGenerationRequest {
  topic: string
}

// Types matching Convex schema for questions table
export interface Question {
  _id: Id<"questions">
  _creationTime: number
  userId: Id<"users">
  topic: string
  difficulty: string
  question: string
  type: QuestionType
  options: string[]
  correctAnswer: string
  explanation?: string
  generatedAt: number
  attemptCount: number
  correctCount: number
  lastAttemptedAt?: number
}

// Types matching Convex schema for interactions table
export interface Interaction {
  _id: Id<"interactions">
  _creationTime: number
  userId: Id<"users">
  questionId: Id<"questions">
  userAnswer: string
  isCorrect: boolean
  attemptedAt: number
  timeSpent?: number
  context?: {
    sessionId?: string
    isRetry?: boolean
  }
}

// Type for interaction stats used in UI
export interface InteractionStats {
  totalInteractions: number
  correctInteractions: number
  accuracy: number
}

// Type for quiz session tracking
export interface QuizSession {
  sessionId: string
  startTime: number
  endTime?: number
  questionIds: string[]
  currentQuestionIndex: number
}