'use client'

import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Trophy, Calendar } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { formatDistanceToNow } from 'date-fns'
import { Loader2 } from 'lucide-react'

export function QuizHistoryRealtime() {
  const { user } = useAuth()
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('scry_session_token') : null
  
  // Fetch quiz history from Convex
  const quizHistory = useQuery(api.quiz.getQuizHistory, {
    sessionToken: sessionToken || undefined,
    limit: 10
  })
  
  if (!user) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <p className="text-gray-500">Please sign in to view your quiz history</p>
        </CardContent>
      </Card>
    )
  }
  
  // Loading state
  if (quizHistory === undefined) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-4">Loading quiz history...</p>
        </CardContent>
      </Card>
    )
  }
  
  // No quizzes yet
  if (!quizHistory || quizHistory.quizzes.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No quizzes yet
              </h3>
              <p className="text-gray-500 mb-4">
                Start your learning journey by creating your first quiz!
              </p>
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Your First Quiz
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Display quiz history
  return (
    <div className="space-y-4">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {quizHistory.quizzes.map((quiz: any) => (
        <Card key={quiz.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {quiz.topic}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    Score: {quiz.score}/{quiz.totalQuestions} ({quiz.percentage}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDistanceToNow(new Date(quiz.completedAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className={`text-2xl font-bold ${quiz.percentage >= 80 ? 'text-green-600' : quiz.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {quiz.percentage}%
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {quizHistory.hasMore && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">Showing most recent {quizHistory.quizzes.length} quizzes</p>
        </div>
      )}
    </div>
  )
}