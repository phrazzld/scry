import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

/**
 * Hook to fetch and filter generation jobs
 *
 * Returns all recent jobs plus filtered active jobs (pending or processing).
 * Updates reactively as job statuses change.
 */
export function useActiveJobs() {
  const paginationData = useQuery(api.generationJobs.getRecentJobs, { pageSize: 50 });

  // Extract results from pagination response
  const jobs = paginationData?.results;

  if (!jobs) {
    return {
      jobs: undefined,
      activeJobs: [],
      activeCount: 0,
      hasActive: false,
    };
  }

  const activeJobs = jobs.filter(
    (job: Doc<'generationJobs'>) => job.status === 'pending' || job.status === 'processing'
  );

  return {
    jobs,
    activeJobs,
    activeCount: activeJobs.length,
    hasActive: activeJobs.length > 0,
  };
}
