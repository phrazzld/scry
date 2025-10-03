'use client';

import { useMutation } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2Icon,
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
    <Card className="p-4">
      <div className="space-y-3">
        {/* Header with status icon */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Status Icon */}
            {isPendingJob(job) && (
              <ClockIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            {isProcessingJob(job) && (
              <LoaderIcon className="size-5 text-primary shrink-0 mt-0.5 animate-spin" />
            )}
            {isCompletedJob(job) && (
              <CheckCircle2Icon className="size-5 text-green-600 shrink-0 mt-0.5" />
            )}
            {isFailedJob(job) && (
              <XCircleIcon className="size-5 text-destructive shrink-0 mt-0.5" />
            )}
            {isCancelledJob(job) && (
              <CircleSlashIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{job.prompt}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {job.createdAt && formatDistanceToNow(job.createdAt, { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>

        {/* Status-specific content */}
        {isPendingJob(job) && (
          <div className="text-xs text-muted-foreground">Waiting to start...</div>
        )}

        {isProcessingJob(job) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground capitalize">{job.phase}</span>
              <span className="font-medium">
                {job.questionsSaved}
                {job.estimatedTotal && ` / ${job.estimatedTotal}`}
              </span>
            </div>
            {job.estimatedTotal && job.estimatedTotal > 0 && (
              <Progress value={progressValue} className="h-2" />
            )}
            <Button variant="outline" size="sm" onClick={handleCancel} className="w-full">
              Cancel
            </Button>
          </div>
        )}

        {isCompletedJob(job) && (
          <div className="text-sm text-muted-foreground">
            Generated {job.questionIds.length} question{job.questionIds.length !== 1 ? 's' : ''}
            {job.durationMs && ` in ${Math.round(job.durationMs / 1000)}s`}
          </div>
        )}

        {isFailedJob(job) && (
          <div className="space-y-2">
            <div className="text-sm text-destructive">{job.errorMessage}</div>
            {isRetryableError(job) && (
              <Button variant="outline" size="sm" onClick={handleRetry} className="w-full">
                <RefreshCwIcon className="size-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        )}

        {isCancelledJob(job) && job.questionIds.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Saved {job.questionIds.length} partial question
            {job.questionIds.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </Card>
  );
}
