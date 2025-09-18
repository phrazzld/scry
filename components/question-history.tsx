"use client"

import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react"
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
      <div className="w-full bg-gray-50/50 rounded-xl p-4">
        <p className="text-center text-sm text-gray-500">No previous attempts</p>
      </div>
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
    <div className="w-full bg-gray-50/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Previous Attempts</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalAttempts} {totalAttempts === 1 ? 'attempt' : 'attempts'} • {successRate}% success rate
          </p>
        </div>
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {isExpanded ? (
              <>
                <span>Show less</span>
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <span>Show all</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {recentInteractions.map((interaction) => (
          <div
            key={interaction._id}
            className="flex items-start gap-2.5 py-2"
          >
            <div className="mt-0.5">
              {interaction.isCorrect ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600 font-medium">
                  {interaction.userAnswer}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">
                  {formatDistanceToNow(new Date(interaction.attemptedAt), { addSuffix: true })}
                </span>
                {interaction.timeSpent && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">
                      {formatTimeSpent(interaction.timeSpent)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuestionHistorySkeleton() {
  return (
    <div className="w-full bg-gray-50/50 rounded-xl p-4">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-48 bg-gray-200 rounded animate-pulse mt-1" />
      </div>
      <div className="space-y-2 mt-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2.5 py-2">
            <div className="h-4 w-4 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-full max-w-xs bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
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