import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";

/**
 * A simple polling hook that refetches a Convex query at regular intervals.
 * Minimal implementation with no visibility API, debouncing, or complex state management.
 *
 * @param query The Convex query function reference
 * @param args The arguments to pass to the query (or "skip" to skip the query)
 * @param intervalMs The polling interval in milliseconds
 * @returns The query result with isLoading flag
 */
export function useSimplePoll<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"] | "skip",
  intervalMs: number
): {
  data: FunctionReturnType<Query> | undefined;
  isLoading: boolean;
  refetch: () => void;
} {
  // Simple refresh trigger - just a counter
  const [refreshCount, setRefreshCount] = useState(0);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  // Manual refetch function
  const refetch = () => setRefreshCount(c => c + 1);

  // Set up simple interval
  useEffect(() => {
    if (args === "skip" || intervalMs <= 0) return;

    // Clear any existing interval
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }

    // Set up new interval
    intervalIdRef.current = setInterval(refetch, intervalMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [intervalMs, args]);

  // Add refresh trigger to force re-evaluation
  const queryArgs = args === "skip"
    ? "skip"
    : { ...args, _refreshTimestamp: refreshCount };

  // Use the query with refresh trigger
  // @ts-expect-error - TypeScript can't infer that we're adding the _refreshTimestamp field
  const data = useQuery(query, queryArgs);

  return {
    data,
    isLoading: data === undefined && args !== "skip",
    refetch
  };
}