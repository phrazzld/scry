'use client';

import { useState } from 'react';
import { ActivityIcon } from 'lucide-react';

import { BackgroundTasksPanel } from '@/components/background-tasks-panel';
import { Button } from '@/components/ui/button';
import { useActiveJobs } from '@/hooks/use-active-jobs';
import { cn } from '@/lib/utils';

export function BackgroundTasksBadge() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { activeCount, hasActive } = useActiveJobs();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsPanelOpen(true)}
        className={cn('relative size-9 rounded-full', hasActive && 'text-primary')}
        aria-label={`Background tasks${hasActive ? ` (${activeCount} active)` : ''}`}
      >
        <ActivityIcon className="h-4 w-4" />
        {hasActive && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <BackgroundTasksPanel open={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </>
  );
}
