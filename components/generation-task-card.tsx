'use client';

import { useRouter } from 'next/navigation';
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
import type { Doc } from '@/convex/_generated/dataModel';

interface GenerationTaskCardProps {
  job: Doc<'generationJobs'>;
}

export function GenerationTaskCard({ job }: GenerationTaskCardProps) {
  const router = useRouter();
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

  const handleViewQuestions = () => {
    router.push(`/my-questions?topic=${encodeURIComponent(job.topic || job.prompt)}`);
  };

  // Calculate progress percentage
  const progressValue =
    job.status === 'processing' && job.estimatedTotal
      ? Math.min(100, Math.round((job.questionsSaved / job.estimatedTotal) * 100))
      : 0;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Header with status icon */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Status Icon */}
            {job.status === 'pending' && (
              <ClockIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            {job.status === 'processing' && (
              <LoaderIcon className="size-5 text-primary shrink-0 mt-0.5 animate-spin" />
            )}
            {job.status === 'completed' && (
              <CheckCircle2Icon className="size-5 text-green-600 shrink-0 mt-0.5" />
            )}
            {job.status === 'failed' && (
              <XCircleIcon className="size-5 text-destructive shrink-0 mt-0.5" />
            )}
            {job.status === 'cancelled' && (
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
        {job.status === 'pending' && (
          <div className="text-xs text-muted-foreground">Waiting to start...</div>
        )}

        {job.status === 'processing' && (
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

        {job.status === 'completed' && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Generated {job.questionIds.length} question{job.questionIds.length !== 1 ? 's' : ''}
              {job.durationMs && ` in ${Math.round(job.durationMs / 1000)}s`}
            </div>
            <Button variant="outline" size="sm" onClick={handleViewQuestions} className="w-full">
              View Questions
            </Button>
          </div>
        )}

        {job.status === 'failed' && (
          <div className="space-y-2">
            <div className="text-sm text-destructive">{job.errorMessage}</div>
            {job.retryable && (
              <Button variant="outline" size="sm" onClick={handleRetry} className="w-full">
                <RefreshCwIcon className="size-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        )}

        {job.status === 'cancelled' && job.questionIds.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Saved {job.questionIds.length} partial question
              {job.questionIds.length !== 1 ? 's' : ''}
            </div>
            <Button variant="outline" size="sm" onClick={handleViewQuestions} className="w-full">
              View Partial Results
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
