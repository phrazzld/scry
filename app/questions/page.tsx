import { Suspense } from 'react'
import { QuizQuestionsGrid } from '@/components/quiz-questions-grid'

export default function QuestionsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Questions</h1>
          <p className="text-muted-foreground">
            Browse, search, edit, and delete the questions you&apos;ve created
          </p>
        </div>
        <Suspense>
          <QuizQuestionsGrid />
        </Suspense>
      </div>
    </div>
  )
}

