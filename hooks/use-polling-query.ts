import { useEffect, useState, useRef } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";

/**
 * A custom hook that wraps Convex's useQuery with polling functionality.
 * This is useful for time-based queries that need to refresh periodically.
 *
 * Battery-efficient features:
 * - Pauses polling when tab is hidden (using Page Visibility API)
 * - Immediately refreshes data when tab becomes visible again
 * - Supports dynamic intervals (e.g., from smart-polling utility)
 *
 * The query function must accept a _refreshTimestamp parameter to force re-evaluation.
 *
 * @param query The Convex query function reference
 * @param args The base arguments to pass to the query (or "skip" to skip the query)
 * @param intervalMs The polling interval in milliseconds (default: 60000 = 1 minute)
 * @returns The query result, which updates both on data changes and periodically
 */
export function usePollingQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Omit<Query["_args"], "_refreshTimestamp"> | "skip",
  intervalMs: number = 60000 // Default to 1 minute
): FunctionReturnType<Query> | undefined {
  // Use a timestamp to force query re-evaluation
  const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now());
  // Track document visibility to pause polling when tab is hidden
  const [isVisible, setIsVisible] = useState(typeof document !== 'undefined' ? !document.hidden : true);
  // Track last update time to avoid aggressive refreshes
  const lastUpdateRef = useRef(Date.now());

  // Listen for visibility changes with debouncing
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let debounceTimer: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      setIsVisible(nowVisible);

      // If becoming visible, refresh data with debounce to avoid flicker
      if (nowVisible) {
        // Only refresh if data is stale (older than 30 seconds)
        const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
        const isStale = timeSinceLastUpdate > 30000;

        if (isStale) {
          // Debounce the refresh by 500ms to avoid immediate flicker
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            setRefreshTimestamp(Date.now());
            lastUpdateRef.current = Date.now();
          }, 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(debounceTimer);
    };
  }, []);
  
  // Set up polling interval with visibility-aware battery efficiency
  useEffect(() => {
    const isSkip = args === "skip";
    if (isSkip) return;

    let interval: NodeJS.Timeout;

    // Only set up interval if document is visible (battery efficiency)
    if (isVisible && intervalMs > 0) {
      interval = setInterval(() => {
        // Double-check visibility before updating (defensive programming)
        if (!document.hidden) {
          const now = Date.now();
          setRefreshTimestamp(now);
          lastUpdateRef.current = now;
        }
      }, intervalMs);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, isVisible]);
  
  // Add the refresh timestamp to the query args
  const queryArgs = args === "skip" 
    ? "skip" 
    : { ...args, _refreshTimestamp: refreshTimestamp };
  
  // Use the query with the augmented args
  // @ts-expect-error - TypeScript can't infer that we're adding the required _refreshTimestamp field
  const result = useQuery(query, queryArgs);
  
  // Note: Convex queries throw errors that are caught by error boundaries
  // We can't catch them here directly, but components using this hook
  // should wrap their usage in error boundaries or handle undefined results
  
  return result;
}