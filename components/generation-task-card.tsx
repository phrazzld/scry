'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleSlashIcon,
  ClockIcon,
  LoaderIcon,
  RefreshCwIcon,
  XCircleIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/convex/_generated/api';
import { formatErrorDetails, getErrorSummary } from '@/lib/error-summary';
import { cn } from '@/lib/utils';
import {
  isCancelledJob,
  isCompletedJob,
  isFailedJob,
  isPendingJob,
  isProcessingJob,
  isRetryableError,
  type GenerationJob,
} from '@/types/generation-jobs';

interface GenerationTaskCardProps {
  job: GenerationJob;
}

export function GenerationTaskCard({ job }: GenerationTaskCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const cancelJob = useMutation(api.generationJobs.cancelJob);
  const createJob = useMutation(api.generationJobs.createJob);

  const handleCancel = async () => {
    try {
      await cancelJob({ jobId: job._id });
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const handleRetry = async () => {
    try {
      await createJob({ prompt: job.prompt });
    } catch (error) {
      console.error('Failed to retry job:', error);
    }
  };

  // Calculate progress percentage
  const progressValue =
    isProcessingJob(job) && job.estimatedTotal
      ? Math.min(100, Math.round((job.questionsSaved / job.estimatedTotal) * 100))
      : 0;

  return (
    <Card
      className={cn(
        'p-3',
        isCompletedJob(job) &&
          'bg-green-50/30 dark:bg-green-950/10 border-green-200/50 dark:border-green-900/50',
        isFailedJob(job) &&
          'bg-red-50/30 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/50',
        isProcessingJob(job) &&
          'bg-blue-50/30 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-900/50'
      )}
    >
      <div className="space-y-1.5">
        {/* Header with status icon */}
        <div className="flex items-start gap-2">
          {/* Status Icon */}
          {isPendingJob(job) && (
            <ClockIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          )}
          {isProcessingJob(job) && (
            <LoaderIcon className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 animate-spin" />
          )}
          {isCompletedJob(job) && (
            <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          )}
          {isFailedJob(job) && (
            <XCircleIcon className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          )}
          {isCancelledJob(job) && (
            <CircleSlashIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-semibold leading-tight line-clamp-2 flex-1">
                {job.prompt}
              </p>
              <span className="text-xs text-muted-foreground shrink-0">
                {job.createdAt && formatDistanceToNow(job.createdAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Status-specific content */}
        {isPendingJob(job) && (
          <div className="text-xs text-muted-foreground pl-6">Waiting to start...</div>
        )}

        {isProcessingJob(job) && (
          <div className="space-y-2 pl-6">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground capitalize">{job.phase}</span>
              <span className="font-medium tabular-nums">
                {job.questionsSaved}
                {job.estimatedTotal && ` / ${job.estimatedTotal}`}
              </span>
            </div>
            {job.estimatedTotal && job.estimatedTotal > 0 && (
              <Progress value={progressValue} className="h-1.5" />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="w-full h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        )}

        {isCompletedJob(job) && (
          <div className="text-xs text-muted-foreground pl-6">
            {job.questionIds.length} question{job.questionIds.length !== 1 ? 's' : ''}
            {job.durationMs && ` · ${Math.round(job.durationMs / 1000)}s`}
          </div>
        )}

        {isFailedJob(job) &&
          (() => {
            const { summary, hasDetails } = getErrorSummary(job.errorMessage, job.errorCode);
            return (
              <div className="space-y-2 pl-6">
                <p className="text-xs text-muted-foreground">{summary}</p>

                {showDetails && (
                  <div className="rounded-sm bg-muted/50 p-2 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                    {formatErrorDetails(job.errorMessage, job.errorCode)}
                  </div>
                )}

                <div className="flex gap-2">
                  {isRetryableError(job) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      className="h-7 text-xs"
                    >
                      <RefreshCwIcon className="size-3 mr-1.5" />
                      Retry
                    </Button>
                  )}
                  {hasDetails && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDetails(!showDetails)}
                      className="h-7 text-xs"
                    >
                      {showDetails ? (
                        <>
                          <ChevronUpIcon className="size-3 mr-1.5" />
                          Hide
                        </>
                      ) : (
                        <>
                          <ChevronDownIcon className="size-3 mr-1.5" />
                          Details
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

        {isCancelledJob(job) && job.questionIds.length > 0 && (
          <div className="text-xs text-muted-foreground pl-6">
            Saved {job.questionIds.length} partial question
            {job.questionIds.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </Card>
  );
}
