interface PerformanceRenderEntry {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  timestamp: number;
  exceedsFrameBudget: boolean;
}

interface ReviewPerfData {
  renders: PerformanceRenderEntry[];
  totalRenders: number;
  exceedsFrameBudget: number;
  avgActualDuration: number;
  avgBaseDuration: number;
  p95ActualDuration: number;
  lastUpdate: number;
  summary?: {
    totalRenders: number;
    avgActualDuration: string;
    p95ActualDuration: string;
    exceedsFrameBudget: number;
    frameBudgetViolationRate: string;
  };
}

declare global {
  interface Window {
    __REVIEW_PERF_DATA?: ReviewPerfData;
    __PERF_DATA?: {
      renders: Array<{ timestamp: number; component?: string; mutations?: number }>;
      questionTimings: number[];
      questionStartTime: number | null;
      firstQuestionTime: number | null;
      pageLoadTime: number;
    };
  }
}

export {};