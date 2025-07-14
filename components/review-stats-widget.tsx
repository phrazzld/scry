'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Calendar, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'

export function ReviewStatsWidget() {
  const { user } = useAuth()
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('scry_session_token') : null
  
  // Fetch review queue count
  const reviewQueue = useQuery(api.spacedRepetition.getReviewQueue, {
    sessionToken: sessionToken || undefined,
    limit: 1 // We just need the count
  })
  
  if (!user) {
    return null
  }
  
  const cardsDue = reviewQueue?.total || 0
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Review Queue
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {cardsDue > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{cardsDue}</p>
                  <p className="text-sm text-muted-foreground">
                    Cards due for review
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              
              <Link href="/review" className="block">
                <Button className="w-full">
                  Start Review Session
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="p-3 bg-green-100 rounded-full inline-flex mb-3">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">All caught up!</p>
              <p className="text-sm text-gray-500 mt-1">
                No cards due for review
              </p>
            </div>
          )}
          
          <div className="pt-3 border-t">
            <Link 
              href="/review" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View all cards</span>
              <TrendingUp className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}