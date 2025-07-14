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
  currentIndex: number
  score: number
}

export interface QuizGenerationRequest {
  topic: string
}