'use client';

import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/convex/_generated/api';
import type { JobStatus } from '@/types/generation-jobs';

import { TasksTable } from './tasks-table';

type StatusFilter = 'all' | 'active' | 'completed' | 'failed';

export function TasksClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Query jobs with larger limit for dedicated page
  const allJobs = useQuery(api.generationJobs.getRecentJobs, { limit: 100 });

  // Client-side filtering by status
  const filteredJobs = useMemo(() => {
    if (!allJobs) return undefined;

    switch (statusFilter) {
      case 'all':
        return allJobs;
      case 'active':
        return allJobs.filter(
          (job: { status: JobStatus }) => job.status === 'pending' || job.status === 'processing'
        );
      case 'completed':
        return allJobs.filter((job: { status: JobStatus }) => job.status === 'completed');
      case 'failed':
        return allJobs.filter(
          (job: { status: JobStatus }) => job.status === 'failed' || job.status === 'cancelled'
        );
      default:
        return allJobs;
    }
  }, [allJobs, statusFilter]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Background Tasks</h1>
        <p className="text-muted-foreground mt-1">Manage AI question generation jobs</p>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">
            All
            {allJobs && <span className="ml-2 text-xs">({allJobs.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="active">
            Active
            {allJobs && (
              <span className="ml-2 text-xs">
                (
                {
                  allJobs.filter(
                    (j: { status: JobStatus }) =>
                      j.status === 'pending' || j.status === 'processing'
                  ).length
                }
                )
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            {allJobs && (
              <span className="ml-2 text-xs">
                ({allJobs.filter((j: { status: JobStatus }) => j.status === 'completed').length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed
            {allJobs && (
              <span className="ml-2 text-xs">
                (
                {
                  allJobs.filter(
                    (j: { status: JobStatus }) => j.status === 'failed' || j.status === 'cancelled'
                  ).length
                }
                )
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {filteredJobs === undefined ? (
            <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {statusFilter === 'all'
                ? 'No tasks yet. Generate questions to see them here.'
                : `No ${statusFilter} tasks.`}
            </div>
          ) : (
            <TasksTable jobs={filteredJobs} />
          )}
        </div>
      </Tabs>
    </div>
  );
}
