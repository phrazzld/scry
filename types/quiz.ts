export interface SimpleQuestion {
  question: string
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