import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";

/**
 * A custom hook that wraps Convex's useQuery with polling functionality.
 * This is useful for time-based queries that need to refresh periodically.
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
  
  // Set up polling interval
  useEffect(() => {
    if (args === "skip") return;
    
    const interval = setInterval(() => {
      setRefreshTimestamp(Date.now());
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, [args === "skip", intervalMs]);
  
  // Add the refresh timestamp to the query args
  const queryArgs = args === "skip" 
    ? "skip" 
    : { ...args, _refreshTimestamp: refreshTimestamp };
  
  // Use the query with the augmented args
  // @ts-expect-error - TypeScript can't infer that we're adding the required _refreshTimestamp field
  const result = useQuery(query, queryArgs);
  
  return result;
}