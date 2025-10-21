'use client';

import { CheckCircle2, Clock } from 'lucide-react';

interface ReviewProgressIndicatorProps {
  reviewedCount: number;
  remainingCount: number;
}

/**
 * Subtle progress indicator showing session progress and remaining reviews
 * Displays at the top of the review flow to give learners context
 */
export function ReviewProgressIndicator({
  reviewedCount,
  remainingCount,
}: ReviewProgressIndicatorProps) {
  // Calculate total for the session (reviewed + remaining)
  const total = reviewedCount + remainingCount;

  // Calculate percentage for visual progress
  const percentage = total > 0 ? (reviewedCount / total) * 100 : 0;

  return (
    <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
          <span>
            Reviewed: <span className="font-medium text-foreground">{reviewedCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-500" />
          <span>
            Remaining: <span className="font-medium text-foreground">{remainingCount}</span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 dark:bg-green-500 transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs tabular-nums">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}
