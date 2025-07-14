import { QuizHistoryRealtime } from '@/components/quiz-history-realtime'
import { QuizStatsRealtime } from '@/components/quiz-stats-realtime'
import { ActivityFeedRealtime } from '@/components/activity-feed-realtime'
import { ReviewStatsWidget } from '@/components/review-stats-widget'

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content - Quiz History */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Recent Quizzes</h2>
              <QuizHistoryRealtime />
            </div>
          </div>
          
          {/* Sidebar - Stats and Activity */}
          <div className="space-y-6">
            <QuizStatsRealtime />
            <ReviewStatsWidget />
            <ActivityFeedRealtime />
          </div>
        </div>
      </div>
    </div>
  )
}