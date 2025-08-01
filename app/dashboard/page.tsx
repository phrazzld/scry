import { QuizHistoryRealtime } from '@/components/quiz-history-realtime'
import { QuizStatsRealtime } from '@/components/quiz-stats-realtime'
import { QuizQuestionsGrid } from '@/components/quiz-questions-grid'
import { ReviewIndicator } from '@/components/review-indicator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Clock, Brain } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content with tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Quizzes
                </TabsTrigger>
                <TabsTrigger value="questions" className="flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  All Questions
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="history" className="mt-0 space-y-6">
                <QuizHistoryRealtime />
              </TabsContent>
              
              <TabsContent value="questions" className="mt-0 space-y-6">
                <QuizQuestionsGrid />
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Sidebar - Stats and Activity */}
          <div className="space-y-6">
            <ReviewIndicator />
            <QuizStatsRealtime />
          </div>
        </div>
      </div>
    </div>
  )
}