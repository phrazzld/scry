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
      <div className="rounded-2xl border border-border bg-background/80 p-6">
        <p className="text-sm font-medium text-muted-foreground">No previous attempts yet.</p>
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
    <div className="rounded-2xl border border-border bg-background/80 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Previous attempts</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalAttempts} {totalAttempts === 1 ? 'attempt' : 'attempts'} • {successRate}% correct
          </p>
        </div>
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
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
      <div className="mt-4 divide-y divide-border">
        {recentInteractions.map((interaction) => (
          <div
            key={interaction._id}
            className="flex items-start gap-3 py-3"
          >
            <div
              className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full border ${
                interaction.isCorrect
                  ? 'border-success-border bg-success-background text-success'
                  : 'border-error-border bg-error-background text-error'
              }`}
            >
              {interaction.isCorrect ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {interaction.userAnswer}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDistanceToNow(new Date(interaction.attemptedAt), { addSuffix: true })}</span>
                {interaction.timeSpent && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{formatTimeSpent(interaction.timeSpent)}</span>
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
    <div className="rounded-2xl border border-border bg-background/80 p-6">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        <div className="h-3 w-48 rounded bg-muted animate-pulse" />
      </div>
      <div className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
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
