'use client';

import { useQuery } from 'convex/react';
import { XIcon } from 'lucide-react';

import { GenerationTaskCard } from '@/components/generation-task-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

interface BackgroundTasksPanelProps {
  open: boolean;
  onClose: () => void;
}

export function BackgroundTasksPanel({ open, onClose }: BackgroundTasksPanelProps) {
  const jobs = useQuery(api.generationJobs.getRecentJobs, { limit: 20 });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          'fixed right-0 top-0 h-full max-w-md w-full',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          'rounded-l-lg rounded-r-none border-r-0',
          'p-0 gap-0'
        )}
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Background Tasks</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {!jobs && (
            <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
          )}

          {jobs && jobs.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No background tasks
            </div>
          )}

          {jobs &&
            jobs.length > 0 &&
            jobs.map((job: Doc<'generationJobs'>) => (
              <GenerationTaskCard key={job._id} job={job} />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
