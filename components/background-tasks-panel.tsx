'use client';

import Link from 'next/link';
import { useQuery } from 'convex/react';

import { GenerationTaskCard } from '@/components/generation-task-card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

interface BackgroundTasksPanelProps {
  open: boolean;
  onClose: () => void;
}

export function BackgroundTasksPanel({ open, onClose }: BackgroundTasksPanelProps) {
  // Show only 5 most recent jobs in quick peek sheet
  const jobs = useQuery(api.generationJobs.getRecentJobs, { limit: 5 });

  // Group jobs by status
  const activeJobs =
    jobs?.filter((j: Doc<'generationJobs'>) => ['pending', 'processing'].includes(j.status)) || [];
  const completedJobs = jobs?.filter((j: Doc<'generationJobs'>) => j.status === 'completed') || [];
  const failedJobs = jobs?.filter((j: Doc<'generationJobs'>) => j.status === 'failed') || [];
  const cancelledJobs = jobs?.filter((j: Doc<'generationJobs'>) => j.status === 'cancelled') || [];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-5 py-3 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div>
              <SheetTitle className="text-base">Recent Tasks</SheetTitle>
              {jobs && jobs.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeJobs.length > 0 && `${activeJobs.length} active`}
                  {activeJobs.length > 0 && failedJobs.length > 0 && ' · '}
                  {failedJobs.length > 0 && `${failedJobs.length} failed`}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!jobs && (
            <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
          )}

          {jobs && jobs.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <div className="text-5xl">📋</div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No recent tasks</p>
                <p className="text-xs text-muted-foreground">Generate questions to see them here</p>
              </div>
            </div>
          )}

          {/* Active Jobs */}
          {activeJobs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active ({activeJobs.length})
              </h3>
              {activeJobs.map((job: Doc<'generationJobs'>) => (
                <GenerationTaskCard key={job._id} job={job} />
              ))}
            </div>
          )}

          {/* Recent Jobs */}
          {(completedJobs.length > 0 || cancelledJobs.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recent ({completedJobs.length + cancelledJobs.length})
              </h3>
              {[...completedJobs, ...cancelledJobs].map((job: Doc<'generationJobs'>) => (
                <GenerationTaskCard key={job._id} job={job} />
              ))}
            </div>
          )}

          {/* Failed Jobs */}
          {failedJobs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Failed ({failedJobs.length})
              </h3>
              {failedJobs.map((job: Doc<'generationJobs'>) => (
                <GenerationTaskCard key={job._id} job={job} />
              ))}
            </div>
          )}

          {/* View All Tasks Link */}
          {jobs && jobs.length > 0 && (
            <Link
              href="/tasks"
              className="block text-sm text-primary hover:underline text-center py-3 border-t"
              onClick={onClose}
            >
              View All Tasks →
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
