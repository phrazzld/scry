'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'

export function QuizStatsRealtime() {
  const { user } = useAuth()
  
  if (!user) {
    return null
  }
  
  // Placeholder data until Convex is connected
  const totalQuizzes = 0
  const averageScore = 0
  const totalQuestions = 0
  const uniqueTopics = 0
  
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
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 text-center">
            Real-time statistics will be available when connected to Convex backend
          </p>
        </div>
      </CardContent>
    </Card>
  )
}