import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import type { FunctionReference, FunctionReturnType } from 'convex/server';

/**
 * A simple polling hook that refetches a Convex query at regular intervals.
 * Minimal implementation with no visibility API, debouncing, or complex state management.
 *
 * @param query The Convex query function reference
 * @param args The arguments to pass to the query (or "skip" to skip the query)
 * @param intervalMs The polling interval in milliseconds
 * @returns The query result with isLoading flag
 */
export function useSimplePoll<Query extends FunctionReference<'query'>>(
  query: Query,
  args: Query['_args'] | 'skip',
  intervalMs: number
): {
  data: FunctionReturnType<Query> | undefined;
  isLoading: boolean;
  refetch: () => void;
} {
  // Simple refresh trigger - just a counter
  const [refreshCount, setRefreshCount] = useState(0);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  // Manual refetch function - memoized for stable reference
  const refetch = useCallback(() => setRefreshCount((c) => c + 1), []);

  // Clear any existing interval - extracted for reuse
  const clearExistingInterval = () => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  };

  // Track if polling should be active
  const shouldPoll = args !== 'skip' && intervalMs > 0;

  // Set up simple interval
  useEffect(() => {
    // Mark as active
    isActiveRef.current = true;

    // Skip if conditions aren't met
    if (!shouldPoll) {
      clearExistingInterval();
      return;
    }

    // Clear any existing interval before setting up new one
    clearExistingInterval();

    // Set up new interval only if component is still active
    if (isActiveRef.current) {
      intervalIdRef.current = setInterval(() => {
        // Only refetch if still active
        if (isActiveRef.current) {
          refetch();
        }
      }, intervalMs);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      isActiveRef.current = false;
      clearExistingInterval();
    };
  }, [intervalMs, shouldPoll, refetch]);

  // Additional cleanup on component unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      clearExistingInterval();
    };
  }, []);

  // Add refresh trigger to force re-evaluation
  const queryArgs = args === 'skip' ? 'skip' : { ...args, _refreshTimestamp: refreshCount };

  // Use the query with refresh trigger
  // @ts-expect-error - Adding _refreshTimestamp field for polling
  const data = useQuery(query, queryArgs);

  return {
    data,
    isLoading: data === undefined && args !== 'skip',
    refetch,
  };
}
