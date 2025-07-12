'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Loader2 } from 'lucide-react'

export function QuizStatsRealtime() {
  const { user } = useAuth()
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('scry_session_token') : null
  
  // Fetch quiz history to calculate stats
  const quizHistory = useQuery(api.quiz.getQuizHistory, {
    sessionToken: sessionToken || undefined,
    limit: 100 // Get more quizzes for better stats
  })
  
  if (!user) {
    return null
  }
  
  // Loading state
  if (quizHistory === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live Quiz Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Calculate statistics from quiz history
  const quizzes = quizHistory?.quizzes || []
  const totalQuizzes = quizzes.length
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const totalQuestions = quizzes.reduce((sum: number, quiz: any) => sum + quiz.totalQuestions, 0)
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const totalScore = quizzes.reduce((sum: number, quiz: any) => sum + quiz.score, 0)
  const averageScore = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const uniqueTopics = new Set(quizzes.map((q: any) => q.topic)).size
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Quiz Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {totalQuizzes}
            </div>
            <div className="text-sm text-gray-600">Total Quizzes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {averageScore}%
            </div>
            <div className="text-sm text-gray-600">Average Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {totalQuestions}
            </div>
            <div className="text-sm text-gray-600">Questions Answered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {uniqueTopics}
            </div>
            <div className="text-sm text-gray-600">Unique Topics</div>
          </div>
        </div>
        
        {totalQuizzes === 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              Complete your first quiz to see statistics!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}