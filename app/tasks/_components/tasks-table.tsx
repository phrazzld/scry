'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/convex/_generated/api';
import { formatErrorDetails, getErrorSummary } from '@/lib/error-summary';
import {
  isCancelledJob,
  isCompletedJob,
  isFailedJob,
  isPendingJob,
  isProcessingJob,
  type GenerationJob,
} from '@/types/generation-jobs';

interface TasksTableProps {
  jobs: GenerationJob[];
}

function StatusBadge({ job }: { job: GenerationJob }) {
  if (isPendingJob(job)) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  }

  if (isProcessingJob(job)) {
    return (
      <Badge variant="default" className="gap-1 bg-blue-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </Badge>
    );
  }

  if (isCompletedJob(job)) {
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    );
  }

  if (isCancelledJob(job)) {
    return (
      <Badge variant="secondary" className="gap-1">
        <CircleSlash className="h-3 w-3" />
        Cancelled
      </Badge>
    );
  }

  if (isFailedJob(job)) {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }

  return <Badge variant="secondary">Unknown</Badge>;
}

function TaskRow({ job }: { job: GenerationJob }) {
  const [expanded, setExpanded] = useState(false);
  const cancelJob = useMutation(api.generationJobs.cancelJob);

  const handleCancel = async () => {
    try {
      await cancelJob({ jobId: job._id });
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const progressValue =
    isProcessingJob(job) && job.estimatedTotal
      ? Math.min(100, Math.round((job.questionsSaved / job.estimatedTotal) * 100))
      : 0;

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <TableCell className="w-[140px]">
          <StatusBadge job={job} />
        </TableCell>
        <TableCell className="max-w-md">
          <div className="flex items-center gap-2">
            <span className="truncate">{job.prompt}</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground w-[180px]">
          {job.createdAt && formatDistanceToNow(job.createdAt, { addSuffix: true })}
        </TableCell>
        <TableCell className="text-muted-foreground w-[120px]">
          {isCompletedJob(job) && job.durationMs
            ? `${Math.round(job.durationMs / 1000)}s`
            : isProcessingJob(job)
              ? 'In progress'
              : '—'}
        </TableCell>
        <TableCell className="w-[100px]">
          {(isPendingJob(job) || isProcessingJob(job)) && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
            >
              Cancel
            </Button>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded details row */}
      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30">
            <div className="py-3 space-y-3">
              {/* Full prompt */}
              <div>
                <p className="text-sm font-medium mb-1">Full Prompt:</p>
                <p className="text-sm text-muted-foreground">{job.prompt}</p>
              </div>

              {/* Processing details */}
              {isProcessingJob(job) && (
                <div>
                  <p className="text-sm font-medium mb-2">Progress:</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{job.phase}</span>
                      <span className="font-medium tabular-nums">
                        {job.questionsSaved}
                        {job.estimatedTotal && ` / ${job.estimatedTotal}`}
                      </span>
                    </div>
                    {job.estimatedTotal && job.estimatedTotal > 0 && (
                      <Progress value={progressValue} className="h-2" />
                    )}
                  </div>
                </div>
              )}

              {/* Completed details */}
              {isCompletedJob(job) && (
                <div>
                  <p className="text-sm font-medium mb-1">Results:</p>
                  <p className="text-sm text-muted-foreground">
                    Generated {job.questionIds.length} question
                    {job.questionIds.length !== 1 ? 's' : ''}
                    {job.durationMs && ` in ${Math.round(job.durationMs / 1000)} seconds`}
                  </p>
                </div>
              )}

              {/* Failed details */}
              {isFailedJob(job) &&
                (() => {
                  const { summary } = getErrorSummary(job.errorMessage, job.errorCode);
                  return (
                    <div>
                      <p className="text-sm font-medium mb-1">Error:</p>
                      <p className="text-sm text-red-600 dark:text-red-400 mb-2">{summary}</p>
                      <div className="rounded-sm bg-muted/50 p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                        {formatErrorDetails(job.errorMessage, job.errorCode)}
                      </div>
                    </div>
                  );
                })()}

              {/* Cancelled details */}
              {isCancelledJob(job) && job.questionIds.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Partial Results:</p>
                  <p className="text-sm text-muted-foreground">
                    Saved {job.questionIds.length} partial question
                    {job.questionIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function TasksTable({ jobs }: TasksTableProps) {
  return (
    <div className="w-full border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead>Prompt</TableHead>
            <TableHead className="w-[180px]">Created</TableHead>
            <TableHead className="w-[120px]">Duration</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TaskRow key={job._id} job={job} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
