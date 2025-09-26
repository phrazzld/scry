"use client"

import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react"
import { useState, memo } from "react"
import { Doc } from "@/convex/_generated/dataModel"

interface QuestionHistoryProps {
  interactions: Doc<"interactions">[]
  loading?: boolean
}

function QuestionHistoryComponent({ interactions, loading }: QuestionHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (loading) {
    return <QuestionHistorySkeleton />
  }

  if (!interactions || interactions.length === 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">No previous attempts yet.</p>
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
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Previous attempts: {totalAttempts} • {successRate}% success rate
        </p>
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
      <div className="mt-2 divide-y divide-border/30">
        {recentInteractions.map((interaction) => (
          <div
            key={interaction._id}
            className="flex items-start gap-2 py-2 first:pt-0"
          >
            <div className="mt-0.5">
              {interaction.isCorrect ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-error" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/80 truncate">
                {interaction.userAnswer}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
    <div>
      <div className="h-4 w-48 rounded bg-muted animate-pulse" />
      <div className="mt-2 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="h-4 w-4 rounded-full bg-muted animate-pulse mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
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

/**
 * Custom comparison function for React.memo
 * Only re-renders if:
 * - Loading state changes
 * - Interactions array length changes
 * - Or if any interaction data has actually changed
 */
function arePropsEqual(
  prevProps: QuestionHistoryProps,
  nextProps: QuestionHistoryProps
): boolean {
  // Check if loading state changed
  if (prevProps.loading !== nextProps.loading) {
    return false; // Props changed, re-render needed
  }

  // Check if interactions array reference changed
  if (prevProps.interactions === nextProps.interactions) {
    return true; // Same reference, no re-render needed
  }

  // Check array length
  if (prevProps.interactions?.length !== nextProps.interactions?.length) {
    return false; // Length changed, re-render needed
  }

  // If both are empty or null, they're equal
  if (!prevProps.interactions && !nextProps.interactions) {
    return true;
  }

  // Deep comparison of interaction IDs to detect actual changes
  // This is more efficient than comparing full objects
  if (prevProps.interactions && nextProps.interactions) {
    for (let i = 0; i < prevProps.interactions.length; i++) {
      if (prevProps.interactions[i]._id !== nextProps.interactions[i]._id ||
          prevProps.interactions[i].isCorrect !== nextProps.interactions[i].isCorrect) {
        return false; // Content changed, re-render needed
      }
    }
  }

  return true; // Props are functionally equal, no re-render needed
}

// Export the memoized component
export const QuestionHistory = memo(QuestionHistoryComponent, arePropsEqual);
