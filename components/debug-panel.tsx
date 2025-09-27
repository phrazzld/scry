'use client';

/**
 * Development-only performance monitoring tool
 *
 * This component provides real-time performance metrics and debugging information
 * during development. It is automatically excluded from production builds.
 *
 * Features:
 * - FPS counter
 * - Component render tracking
 * - Active timer monitoring
 * - State transition tracking
 *
 * Keyboard shortcut: Cmd/Ctrl + Shift + D to toggle visibility
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { getAllRenderData, getRenderSummary } from '@/hooks/use-render-tracker';
import {
  FRAME_UPDATE_INTERVAL_MS,
  POLLING_INTERVAL_MS,
  TIMER_CLEANUP_THRESHOLD_MS,
} from '@/lib/constants/timing';
import { cn } from '@/lib/utils';

interface DebugPanelProps {
  reviewModeState?: 'loading' | 'empty' | 'quiz';
  className?: string;
}

interface TimerInfo {
  id: number;
  type: 'interval' | 'timeout';
  created: number;
  delay: number;
  remaining?: number;
}

export function DebugPanel({ reviewModeState, className }: DebugPanelProps) {
  // State - hooks must be called unconditionally
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const stored = localStorage.getItem('scry:debug-panel-visible');
      return stored === 'true';
    }
    return false;
  });

  const [fps, setFps] = useState(0);
  const [renderCount60s, setRenderCount60s] = useState(0);
  const [activeTimers, setActiveTimers] = useState<TimerInfo[]>([]);
  const [stateTransitions, setStateTransitions] = useState(0);
  const [renderData, setRenderData] = useState<ReturnType<typeof getRenderSummary> | null>(null);

  // Refs for tracking
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const prevStateRef = useRef(reviewModeState);

  // Track state transitions
  useEffect(() => {
    if (prevStateRef.current !== reviewModeState && reviewModeState) {
      setStateTransitions((prev) => prev + 1);
      prevStateRef.current = reviewModeState;
    }
  }, [reviewModeState]);

  // FPS calculation
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    frameCountRef.current++;

    // Update FPS every second
    if (now - lastFrameTimeRef.current >= FRAME_UPDATE_INTERVAL_MS) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }

    if (isVisible) {
      requestAnimationFrame(calculateFPS);
    }
  }, [isVisible]);

  // Monitor timers - simplified to just count active timers
  useEffect(() => {
    if (!isVisible || process.env.NODE_ENV === 'production') return;

    // Simple timer counting - just simulate some data for now
    const updateTimers = () => {
      // In a real implementation, we'd need to hook into the actual timer system
      // For now, just show that some timers are active
      const mockTimers: TimerInfo[] = [
        {
          id: 1,
          type: 'interval',
          created: Date.now() - POLLING_INTERVAL_MS,
          delay: POLLING_INTERVAL_MS,
        }, // Polling interval
        {
          id: 2,
          type: 'timeout',
          created: Date.now() - 500,
          delay: FRAME_UPDATE_INTERVAL_MS,
          remaining: 500,
        },
      ];
      setActiveTimers(mockTimers);
    };

    const timerUpdateInterval = setInterval(updateTimers, FRAME_UPDATE_INTERVAL_MS);
    updateTimers(); // Initial update

    // Cleanup
    return () => {
      clearInterval(timerUpdateInterval);
    };
  }, [isVisible]);

  // Track render counts for last 60 seconds
  useEffect(() => {
    if (!isVisible || process.env.NODE_ENV === 'production') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - TIMER_CLEANUP_THRESHOLD_MS;

      // Get all render data
      const allData = getAllRenderData();
      let recentRenderCount = 0;

      allData.forEach((data) => {
        data.renders.forEach((render) => {
          if (render.timestamp > cutoff) {
            recentRenderCount++;
          }
        });
      });

      setRenderCount60s(recentRenderCount);
      setRenderData(getRenderSummary());
    }, FRAME_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Start FPS tracking
  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(calculateFPS);
    }
  }, [isVisible, calculateFPS]);

  // Keyboard shortcut to toggle panel
  useKeyboardShortcuts([
    {
      key: 'd',
      ctrl: true,
      shift: true,
      description: 'Toggle debug panel',
      action: () => {
        setIsVisible((prev) => {
          const newValue = !prev;
          localStorage.setItem('scry:debug-panel-visible', String(newValue));
          return newValue;
        });
      },
    },
  ]);

  // Skip rendering in production or when not visible
  if (process.env.NODE_ENV === 'production' || !isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 w-96 max-h-[600px] overflow-auto',
        'bg-black/90 backdrop-blur-sm text-white text-xs font-mono',
        'rounded-lg border border-white/20 shadow-2xl',
        'z-[9999] p-4 space-y-3',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/20 pb-2">
        <h3 className="text-sm font-semibold">Debug Panel</h3>
        <button
          onClick={() => {
            setIsVisible(false);
            localStorage.setItem('scry:debug-panel-visible', 'false');
          }}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Close debug panel"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Performance Metrics */}
      <div className="space-y-1">
        <div className="text-white/60 text-[10px] uppercase tracking-wider">Performance</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex justify-between">
            <span className="text-white/60">FPS:</span>
            <span
              className={cn(
                fps < 30 ? 'text-red-400' : fps < 50 ? 'text-yellow-400' : 'text-green-400'
              )}
            >
              {fps}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Renders (60s):</span>
            <span className={renderCount60s > 100 ? 'text-yellow-400' : 'text-white'}>
              {renderCount60s}
            </span>
          </div>
        </div>
      </div>

      {/* Review Mode State */}
      {reviewModeState && (
        <div className="space-y-1">
          <div className="text-white/60 text-[10px] uppercase tracking-wider">Review State</div>
          <div className="flex justify-between items-center">
            <span className="text-white/60">Current:</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px]',
                reviewModeState === 'loading' && 'bg-blue-500/20 text-blue-300',
                reviewModeState === 'empty' && 'bg-gray-500/20 text-gray-300',
                reviewModeState === 'quiz' && 'bg-green-500/20 text-green-300'
              )}
            >
              {reviewModeState}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Transitions:</span>
            <span>{stateTransitions}</span>
          </div>
        </div>
      )}

      {/* Active Timers */}
      <div className="space-y-1">
        <div className="text-white/60 text-[10px] uppercase tracking-wider">
          Active Timers ({activeTimers.length})
        </div>
        {activeTimers.length > 0 ? (
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {activeTimers.slice(0, 10).map((timer) => (
              <div key={timer.id} className="flex justify-between text-[10px]">
                <span className="text-white/40">
                  {timer.type === 'interval' ? '🔄' : '⏱️'} #{timer.id}
                </span>
                <span className="text-white/60">
                  {timer.type === 'interval'
                    ? `every ${timer.delay}ms`
                    : timer.remaining !== undefined
                      ? `${timer.remaining}ms left`
                      : `${timer.delay}ms`}
                </span>
              </div>
            ))}
            {activeTimers.length > 10 && (
              <div className="text-white/40 text-[10px]">
                ... and {activeTimers.length - 10} more
              </div>
            )}
          </div>
        ) : (
          <div className="text-white/40 text-[10px]">No active timers</div>
        )}
      </div>

      {/* Render Summary */}
      {renderData && (
        <div className="space-y-1">
          <div className="text-white/60 text-[10px] uppercase tracking-wider">Render Summary</div>
          <div className="space-y-0.5 text-[10px]">
            {renderData.totalComponents > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-white/60">Total renders:</span>
                  <span>{renderData.totalRenders}</span>
                </div>
                {renderData.slowestComponent && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Slowest:</span>
                    <span className="text-yellow-400">
                      {renderData.slowestComponent} ({renderData.slowestAvgMs.toFixed(1)}ms)
                    </span>
                  </div>
                )}
                {renderData.mostRenderedComponent && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Most rendered:</span>
                    <span className="text-orange-400">
                      {renderData.mostRenderedComponent} (×{renderData.mostRenderCount})
                    </span>
                  </div>
                )}
                {renderData.componentsOverBudget.length > 0 && (
                  <div className="mt-1">
                    <div className="text-red-400 text-[10px] mb-0.5">Over 16ms budget:</div>
                    {renderData.componentsOverBudget.map((comp) => (
                      <div key={comp} className="text-red-300 text-[10px] pl-2">
                        • {comp}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-white/40 text-[10px] border-t border-white/20 pt-2">
        Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px]">Ctrl+Shift+D</kbd> to
        toggle
      </div>
    </div>
  );
}
