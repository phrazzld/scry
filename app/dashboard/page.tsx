import { QuizHistoryRealtime } from '@/components/quiz-history-realtime'
import { QuizStatsRealtime } from '@/components/quiz-stats-realtime'
import { ReviewIndicator } from '@/components/review-indicator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  Plus, 
  Clock, 
  Brain, 
  TrendingUp,
  BookOpen,
  Target,
  ArrowRight
} from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with welcome message */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s your learning overview at a glance.
          </p>
        </div>
        
        {/* Quick Actions Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Create Quiz CTA */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/create">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Plus className="h-6 w-6 text-blue-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base font-semibold mb-1">
                  Create Quiz
                </CardTitle>
                <CardDescription className="text-sm">
                  Generate a new AI-powered quiz
                </CardDescription>
              </CardContent>
            </Link>
          </Card>

          {/* Start Review CTA */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/review">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Target className="h-6 w-6 text-green-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base font-semibold mb-1">
                  Start Review
                </CardTitle>
                <CardDescription className="text-sm">
                  Practice spaced repetition
                </CardDescription>
              </CardContent>
            </Link>
          </Card>

          {/* View History CTA */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/quizzes">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock className="h-6 w-6 text-purple-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base font-semibold mb-1">
                  Quiz History
                </CardTitle>
                <CardDescription className="text-sm">
                  View all past quizzes
                </CardDescription>
              </CardContent>
            </Link>
          </Card>

          {/* Manage Questions CTA */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/questions">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Brain className="h-6 w-6 text-orange-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base font-semibold mb-1">
                  My Questions
                </CardTitle>
                <CardDescription className="text-sm">
                  Browse & manage questions
                </CardDescription>
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Stats Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Stats */}
            <QuizStatsRealtime />

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>
                      Your latest quiz results
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/quizzes">
                      View All
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Limited recent quiz history - only last 3 */}
                <QuizHistoryRealtime limit={3} compact />
              </CardContent>
            </Card>

            {/* Learning Streak or Progress Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Learning Progress
                </CardTitle>
                <CardDescription>
                  Your study patterns this week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Questions Reviewed</span>
                    <span className="text-2xl font-bold text-blue-600">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Quizzes Completed</span>
                    <span className="text-2xl font-bold text-green-600">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Topics Explored</span>
                    <span className="text-2xl font-bold text-purple-600">0</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Sidebar - Review & Quick Stats */}
          <div className="space-y-6">
            {/* Review Indicator - Primary CTA */}
            <ReviewIndicator />
            
            {/* Quick Tips or Motivation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">💡 Study Tip</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Regular review sessions help strengthen long-term memory retention. 
                  Try to review questions just as they&apos;re about to fade from memory!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}