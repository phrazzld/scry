'use client'

import { useAuth } from '@/contexts/auth-context'
import { ReviewQueue } from '@/components/review-queue'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'

export default function ReviewPage() {
  const { user } = useAuth()
  
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Sign in to Review
                </h2>
                <p className="text-gray-500 mb-4">
                  You need to be signed in to review your flashcards.
                </p>
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Review Queue
        </h1>
        <p className="text-gray-600">
          Review your flashcards using spaced repetition to maximize retention.
        </p>
      </div>
      
      <ReviewQueue />
    </div>
  )
}