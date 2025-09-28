'use client';

import { useEffect, useRef } from 'react';

import { FRAME_BUDGET_MS } from '@/lib/constants/ui';

/**
 * Render tracking data structure
 */
export interface RenderData {
  component: string;
  count: number;
  avgMs: number;
  reasons: string[];
  lastRenderMs: number;
  renders: Array<{
    timestamp: number;
    duration: number;
    reason: string;
  }>;
}

/**
 * Global render tracking store (only in development)
 */
const globalRenderData = new Map<string, RenderData>();

// Export for debugging tools
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as Window & { __RENDER_TRACKER_DATA?: Map<string, RenderData> }).__RENDER_TRACKER_DATA =
    globalRenderData;
}

/**
 * Hook for tracking component render performance
 * Logs render count, duration, and reasons for re-renders
 * Only runs in development mode with zero production overhead
 *
 * @param componentName - Name of the component being tracked
 * @param props - Component props to track changes
 * @returns Render data for this component
 *
 * @example
 * ```tsx
 * function MyComponent({ data, onClick }) {
 *   const renderData = useRenderTracker('MyComponent', { data, onClick })
 *   // Component implementation
 * }
 * ```
 */
export function useRenderTracker(
  componentName: string,
  props?: Record<string, unknown>
): RenderData | null {
  // Skip entirely in production
  const isProduction = process.env.NODE_ENV === 'production';

  // Use refs to avoid causing additional renders
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const previousProps = useRef<Record<string, unknown> | undefined>(undefined);
  const renderHistory = useRef<Array<{ timestamp: number; duration: number; reason: string }>>([]);

  // Start timing immediately on render
  if (!isProduction && renderStartTime.current === 0) {
    renderStartTime.current = performance.now();
  }

  useEffect(() => {
    // Skip in production
    if (isProduction) return;

    // Calculate render duration
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;

    // Increment render count
    renderCount.current++;

    // Determine render reason
    let renderReason = 'initial mount';

    if (renderCount.current > 1) {
      renderReason = 'unknown';

      if (props && previousProps.current) {
        const changedProps: string[] = [];

        // Check which props changed
        for (const key in props) {
          if (props[key] !== previousProps.current[key]) {
            changedProps.push(key);
          }
        }

        // Check for removed props
        for (const key in previousProps.current) {
          if (!(key in props)) {
            changedProps.push(`-${key}`);
          }
        }

        if (changedProps.length > 0) {
          renderReason = `props changed: ${changedProps.join(', ')}`;
        } else {
          renderReason = 'parent re-rendered or state changed';
        }
      }
    }

    // Store render info
    const renderInfo = {
      timestamp: Date.now(),
      duration: renderDuration,
      reason: renderReason,
    };

    renderHistory.current.push(renderInfo);

    // Keep only last 100 renders to prevent memory leak
    if (renderHistory.current.length > 100) {
      renderHistory.current.shift();
    }

    // Calculate average render duration
    const totalMs = renderHistory.current.reduce((sum, r) => sum + r.duration, 0);
    const avgMs = totalMs / renderHistory.current.length;

    // Update global tracking data
    const data: RenderData = {
      component: componentName,
      count: renderCount.current,
      avgMs: avgMs,
      lastRenderMs: renderDuration,
      reasons: renderHistory.current.map((r) => r.reason),
      renders: renderHistory.current,
    };

    globalRenderData.set(componentName, data);

    // Log if render exceeds frame budget (16ms at 60fps)
    if (renderDuration > FRAME_BUDGET_MS && process.env.NODE_ENV === 'development') {
      console.warn(
        `⚠️ [RenderTracker] ${componentName} render took ${renderDuration.toFixed(2)}ms (exceeded ${FRAME_BUDGET_MS}ms frame budget)`,
        `\n  Reason: ${renderReason}`,
        `\n  Render count: ${renderCount.current}`,
        `\n  Average: ${avgMs.toFixed(2)}ms`
      );
    }

    // Store current props for next comparison
    previousProps.current = props ? { ...props } : undefined;

    // Reset start time for next render
    renderStartTime.current = performance.now();
  });

  // Return null in production, data in development
  if (isProduction) return null;

  return (
    globalRenderData.get(componentName) || {
      component: componentName,
      count: 0,
      avgMs: 0,
      lastRenderMs: 0,
      reasons: [],
      renders: [],
    }
  );
}

/**
 * Get all tracked render data
 * Useful for debugging and performance analysis
 *
 * @returns Map of all component render data
 */
export function getAllRenderData(): Map<string, RenderData> {
  if (process.env.NODE_ENV === 'production') {
    return new Map();
  }
  return globalRenderData;
}

/**
 * Clear all render tracking data
 * Useful for resetting metrics during testing
 */
export function clearRenderData(): void {
  if (process.env.NODE_ENV === 'production') return;
  globalRenderData.clear();
}

/**
 * Get render summary for logging or analysis
 *
 * @returns Summary object with render statistics
 */
export function getRenderSummary() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const summary = {
    totalComponents: globalRenderData.size,
    totalRenders: 0,
    slowestComponent: '',
    slowestAvgMs: 0,
    mostRenderedComponent: '',
    mostRenderCount: 0,
    componentsOverBudget: [] as string[],
  };

  const FRAME_BUDGET = 16;

  globalRenderData.forEach((data, component) => {
    summary.totalRenders += data.count;

    if (data.avgMs > summary.slowestAvgMs) {
      summary.slowestAvgMs = data.avgMs;
      summary.slowestComponent = component;
    }

    if (data.count > summary.mostRenderCount) {
      summary.mostRenderCount = data.count;
      summary.mostRenderedComponent = component;
    }

    if (data.avgMs > FRAME_BUDGET) {
      summary.componentsOverBudget.push(`${component} (${data.avgMs.toFixed(2)}ms)`);
    }
  });

  return summary;
}
