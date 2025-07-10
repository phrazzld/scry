'use client'

import { Card, CardContent } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

export function QuizHistoryRealtime() {
  const { user } = useAuth()
  
  if (!user) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <p className="text-gray-500">Please sign in to view your quiz history</p>
        </CardContent>
      </Card>
    )
  }
  
  // Placeholder until Convex is connected
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