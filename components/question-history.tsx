"use client"

import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { Doc } from "@/convex/_generated/dataModel"

interface QuestionHistoryProps {
  interactions: Doc<"interactions">[]
  loading?: boolean
}

export function QuestionHistory({ interactions, loading }: QuestionHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (loading) {
    return <QuestionHistorySkeleton />
  }

  if (!interactions || interactions.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No previous attempts</p>
        </CardContent>
      </Card>
    )
  }

  // Sort interactions by most recent first
  const sortedInteractions = [...interactions].sort((a, b) => b.attemptedAt - a.attemptedAt)
  const recentInteractions = isExpanded ? sortedInteractions : sortedInteractions.slice(0, 3)
  const hasMore = interactions.length > 3

  const totalAttempts = interactions.length
  const correctAttempts = interactions.filter(i => i.isCorrect).length
  const successRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Previous Attempts</CardTitle>
            <CardDescription>
              {totalAttempts} {totalAttempts === 1 ? 'attempt' : 'attempts'} • {successRate}% success rate
            </CardDescription>
          </div>
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Show all</span>
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentInteractions.map((interaction, index) => (
            <div 
              key={interaction._id} 
              className={`flex items-start gap-3 pb-3 ${
                index < recentInteractions.length - 1 ? 'border-b' : ''
              }`}
            >
              <div className="mt-0.5">
                {interaction.isCorrect ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={interaction.isCorrect ? "secondary" : "destructive"}>
                    {interaction.isCorrect ? "Correct" : "Incorrect"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(interaction.attemptedAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Your answer: </span>
                  <span className="font-medium">{interaction.userAnswer}</span>
                </div>
                {interaction.timeSpent && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTimeSpent(interaction.timeSpent)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function QuestionHistorySkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0">
              <Skeleton className="h-5 w-5 rounded-full mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-full max-w-xs" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function formatTimeSpent(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}