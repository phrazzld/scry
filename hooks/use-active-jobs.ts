import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

/**
 * Hook to fetch and filter generation jobs
 *
 * Returns all recent jobs plus filtered active jobs (pending or processing).
 * Updates reactively as job statuses change.
 * Skips query when user is not authenticated to prevent race conditions.
 */
export function useActiveJobs() {
  const { isSignedIn } = useUser();

  // Skip query when not authenticated to prevent "Authentication required" errors
  // during Clerk auth loading phase
  const paginationData = useQuery(
    api.generationJobs.getRecentJobs,
    isSignedIn ? { pageSize: 50 } : 'skip'
  );

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
