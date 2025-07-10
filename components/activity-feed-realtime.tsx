'use client'

// import { useQuery } from 'convex/react'
// import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Trophy, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// Add this query to convex/quiz.ts to get recent activity
// For now, we'll create a placeholder component

export function ActivityFeedRealtime() {
  // This would subscribe to a real-time feed of recent quiz completions
  // const recentActivity = useQuery(api.quiz.getRecentActivity)
  
  // Placeholder data for demonstration
  const recentActivity = [
    {
      id: '1',
      topic: 'JavaScript Fundamentals',
      score: 4,
      totalQuestions: 5,
      difficulty: 'easy' as const,
      completedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      isCurrentUser: false
    },
    {
      id: '2', 
      topic: 'React Hooks',
      score: 3,
      totalQuestions: 5,
      difficulty: 'medium' as const,
      completedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
      isCurrentUser: true
    },
    {
      id: '3',
      topic: 'TypeScript Generics',
      score: 5,
      totalQuestions: 5,
      difficulty: 'hard' as const,
      completedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      isCurrentUser: false
    }
  ]
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Live Activity Feed</span>
          <span className="text-xs font-normal text-gray-500">Updates in real-time</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!recentActivity ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : recentActivity.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No recent activity</p>
        ) : (
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  activity.isCurrentUser ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {activity.isCurrentUser ? 'You' : 'Someone'} completed
                    </span>
                    <Badge variant="outline" className={getDifficultyColor(activity.difficulty)}>
                      {activity.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{activity.topic}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-gray-400" />
                      <span className={`font-medium ${getScoreColor(activity.score, activity.totalQuestions)}`}>
                        {activity.score}/{activity.totalQuestions}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(activity.completedAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Showing recent quiz completions across all users
          </p>
        </div>
      </CardContent>
    </Card>
  )
}