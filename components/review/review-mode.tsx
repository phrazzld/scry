"use client";

import { useReviewFlow } from "@/hooks/use-review-flow";
import { useRenderTracker } from "@/hooks/use-render-tracker";
import { ReviewSession } from "@/components/review-session";
import { ReviewEmptyState } from "./review-empty-state";
import { QuizFlowSkeleton } from "@/components/ui/loading-skeletons";
import { Profiler, ProfilerOnRenderCallback, useEffect } from "react";

// Circular buffer for storing last 100 render profiles
const MAX_PROFILE_ENTRIES = 100;

// Initialize global performance data store if not exists
if (typeof window !== 'undefined' && !window.__REVIEW_PERF_DATA) {
  window.__REVIEW_PERF_DATA = {
    renders: [],
    totalRenders: 0,
    exceedsFrameBudget: 0,
    avgActualDuration: 0,
    avgBaseDuration: 0,
    p95ActualDuration: 0,
    lastUpdate: Date.now()
  };
}

/**
 * Profiler callback to capture render performance data
 * Stores data in circular buffer and calculates statistics
 */
const logProfileData: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  if (typeof window === 'undefined') return;

  const entry = {
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    timestamp: Date.now(),
    exceedsFrameBudget: actualDuration > 16 // 16ms for 60fps
  };

  // Ensure data store exists
  if (!window.__REVIEW_PERF_DATA) {
    window.__REVIEW_PERF_DATA = {
      renders: [],
      totalRenders: 0,
      exceedsFrameBudget: 0,
      avgActualDuration: 0,
      avgBaseDuration: 0,
      p95ActualDuration: 0,
      lastUpdate: Date.now()
    };
  }

  // Add to circular buffer
  if (window.__REVIEW_PERF_DATA.renders.length >= MAX_PROFILE_ENTRIES) {
    window.__REVIEW_PERF_DATA.renders.shift(); // Remove oldest
  }
  window.__REVIEW_PERF_DATA.renders.push(entry);

  // Update statistics
  window.__REVIEW_PERF_DATA.totalRenders++;
  if (entry.exceedsFrameBudget) {
    window.__REVIEW_PERF_DATA.exceedsFrameBudget++;
  }

  // Calculate averages and percentiles
  const durations = window.__REVIEW_PERF_DATA.renders.map(r => r.actualDuration);
  window.__REVIEW_PERF_DATA.avgActualDuration =
    durations.reduce((a, b) => a + b, 0) / durations.length;

  const baseDurations = window.__REVIEW_PERF_DATA.renders.map(r => r.baseDuration);
  window.__REVIEW_PERF_DATA.avgBaseDuration =
    baseDurations.reduce((a, b) => a + b, 0) / baseDurations.length;

  // Calculate P95
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedDurations.length * 0.95);
  window.__REVIEW_PERF_DATA.p95ActualDuration = sortedDurations[p95Index] || 0;

  window.__REVIEW_PERF_DATA.lastUpdate = Date.now();

  // Log warnings for performance issues
  if (process.env.NODE_ENV === 'development' && entry.exceedsFrameBudget) {
    console.warn(`[ReviewMode] Render exceeded 16ms frame budget: ${actualDuration.toFixed(2)}ms`);
  }
};

/**
 * Pure presentation component for review mode
 * All business logic is handled by useReviewFlow hook
 * This component only handles rendering based on the state
 */
export function ReviewMode() {
  // Get review state and handlers from custom hook
  const { phase, question, questionId, interactions, errorMessage, handlers } = useReviewFlow();

  // Add render tracking for performance monitoring
  useRenderTracker('ReviewMode', {
    phase,
    questionId
  });

  // Export performance data periodically for automated testing
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return;

    // Log performance summary every 30 seconds in development
    const interval = setInterval(() => {
      if (window.__REVIEW_PERF_DATA && window.__REVIEW_PERF_DATA.renders.length > 0) {
        // Store metrics for external access instead of logging
        window.__REVIEW_PERF_DATA.summary = {
          totalRenders: window.__REVIEW_PERF_DATA.totalRenders,
          avgActualDuration: window.__REVIEW_PERF_DATA.avgActualDuration.toFixed(2) + 'ms',
          p95ActualDuration: window.__REVIEW_PERF_DATA.p95ActualDuration.toFixed(2) + 'ms',
          exceedsFrameBudget: window.__REVIEW_PERF_DATA.exceedsFrameBudget,
          frameBudgetViolationRate:
            ((window.__REVIEW_PERF_DATA.exceedsFrameBudget / window.__REVIEW_PERF_DATA.totalRenders) * 100).toFixed(1) + '%'
        };
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Pure render based on state, wrapped with Profiler
  return (
    <Profiler id="ReviewMode" onRender={logProfileData}>
      <div className="min-h-[400px] flex items-start justify-center">
        {phase === "loading" && <QuizFlowSkeleton />}

        {phase === "empty" && <ReviewEmptyState />}

        {phase === "error" && (
          <div className="w-full max-w-2xl px-4 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <svg
                className="mx-auto h-12 w-12 text-red-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                {errorMessage || "Something went wrong"}
              </h3>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )}

        {phase === "reviewing" && question && (
          <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
            <ReviewSession
              question={question}
              questionId={questionId || undefined}
              onComplete={handlers.onReviewComplete}
              mode="review"
              questionHistory={interactions}
            />
          </div>
        )}
      </div>
    </Profiler>
  );
}