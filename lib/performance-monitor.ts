import { createContextLogger, loggers, type LogMetadata } from './logger'

const performanceLogger = createContextLogger('performance')

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  email: {
    warning: 5000,   // 5 seconds
    critical: 10000  // 10 seconds
  },
  database: {
    warning: 1000,   // 1 second
    critical: 3000   // 3 seconds
  },
  session: {
    warning: 2000,   // 2 seconds
    critical: 5000   // 5 seconds
  },
  api: {
    warning: 3000,   // 3 seconds
    critical: 8000   // 8 seconds
  }
} as const

export type PerformanceMetricType = keyof typeof PERFORMANCE_THRESHOLDS

// Performance metrics data structure
export interface PerformanceMetric {
  id: string
  type: PerformanceMetricType
  operation: string
  duration: number
  success: boolean
  error?: string
  metadata?: Record<string, unknown>
  timestamp: Date
  userId?: string
  requestId?: string
}

// In-memory performance metrics store (could be replaced with Redis/KV)
class PerformanceMetricsStore {
  private metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 1000 // Keep last 1000 metrics in memory

  add(metric: PerformanceMetric) {
    this.metrics.push(metric)
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Log performance data
    this.logMetric(metric)
    
    // Check for alerts
    this.checkAlerts(metric)
  }

  private logMetric(metric: PerformanceMetric) {
    const level = this.getLogLevel(metric)
    const message = `${metric.type} operation "${metric.operation}" completed in ${metric.duration}ms`
    
    performanceLogger[level]({
      event: 'performance.metric',
      type: metric.type,
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
      error: metric.error,
      userId: metric.userId,
      requestId: metric.requestId,
      ...metric.metadata
    }, message)
  }

  private getLogLevel(metric: PerformanceMetric): 'info' | 'warn' | 'error' {
    if (!metric.success) return 'error'
    
    const thresholds = PERFORMANCE_THRESHOLDS[metric.type]
    if (metric.duration > thresholds.critical) return 'error'
    if (metric.duration > thresholds.warning) return 'warn'
    
    return 'info'
  }

  private checkAlerts(metric: PerformanceMetric) {
    const thresholds = PERFORMANCE_THRESHOLDS[metric.type]
    
    if (!metric.success) {
      loggers.securityEvent(
        `${metric.type}_operation_failure`,
        'medium',
        {
          operation: metric.operation,
          duration: metric.duration,
          error: metric.error,
          userId: metric.userId,
          requestId: metric.requestId
        }
      )
    } else if (metric.duration > thresholds.critical) {
      loggers.securityEvent(
        `${metric.type}_critical_slow_response`,
        'high',
        {
          operation: metric.operation,
          duration: metric.duration,
          threshold: thresholds.critical,
          userId: metric.userId,
          requestId: metric.requestId
        }
      )
    } else if (metric.duration > thresholds.warning) {
      performanceLogger.warn({
        event: 'performance.slow_operation',
        type: metric.type,
        operation: metric.operation,
        duration: metric.duration,
        threshold: thresholds.warning,
        userId: metric.userId,
        requestId: metric.requestId
      }, `Slow ${metric.type} operation detected: ${metric.operation} (${metric.duration}ms)`)
    }
  }

  getMetrics(filters?: {
    type?: PerformanceMetricType
    since?: Date
    limit?: number
  }): PerformanceMetric[] {
    let filtered = this.metrics

    if (filters?.type) {
      filtered = filtered.filter(m => m.type === filters.type)
    }

    if (filters?.since) {
      filtered = filtered.filter(m => m.timestamp >= filters.since!)
    }

    if (filters?.limit) {
      filtered = filtered.slice(-filters.limit)
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  getAggregatedStats(
    type?: PerformanceMetricType,
    since?: Date
  ): {
    count: number
    averageDuration: number
    successRate: number
    slowOperations: number
    criticalOperations: number
  } {
    const metrics = this.getMetrics({ type, since })
    
    if (metrics.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        successRate: 100,
        slowOperations: 0,
        criticalOperations: 0
      }
    }

    const successCount = metrics.filter(m => m.success).length
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0)
    
    const thresholds = type ? PERFORMANCE_THRESHOLDS[type] : PERFORMANCE_THRESHOLDS.api
    const slowCount = metrics.filter(m => m.duration > thresholds.warning).length
    const criticalCount = metrics.filter(m => m.duration > thresholds.critical).length

    return {
      count: metrics.length,
      averageDuration: Math.round(totalDuration / metrics.length),
      successRate: Math.round((successCount / metrics.length) * 100),
      slowOperations: slowCount,
      criticalOperations: criticalCount
    }
  }
}

// Singleton metrics store
export const metricsStore = new PerformanceMetricsStore()

// Performance monitoring utilities
export const performanceMonitor = {
  // Track an operation with automatic timing
  async trackOperation<T>(
    type: PerformanceMetricType,
    operation: string,
    fn: () => Promise<T>,
    metadata?: LogMetadata
  ): Promise<T> {
    const startTime = performance.now()
    const metricId = `${type}-${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const result = await fn()
      const duration = Math.round(performance.now() - startTime)
      
      metricsStore.add({
        id: metricId,
        type,
        operation,
        duration,
        success: true,
        timestamp: new Date(),
        userId: metadata?.userId,
        requestId: metadata?.requestId,
        metadata
      })
      
      return result
    } catch (error) {
      const duration = Math.round(performance.now() - startTime)
      
      metricsStore.add({
        id: metricId,
        type,
        operation,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        userId: metadata?.userId,
        requestId: metadata?.requestId,
        metadata
      })
      
      throw error
    }
  },

  // Track email operations
  trackEmail: async <T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: LogMetadata
  ): Promise<T> => {
    return performanceMonitor.trackOperation('email', operation, fn, metadata)
  },

  // Track database operations  
  trackDatabase: async <T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: LogMetadata
  ): Promise<T> => {
    return performanceMonitor.trackOperation('database', operation, fn, metadata)
  },

  // Track session operations
  trackSession: async <T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: LogMetadata
  ): Promise<T> => {
    return performanceMonitor.trackOperation('session', operation, fn, metadata)
  },

  // Track API operations
  trackAPI: async <T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: LogMetadata
  ): Promise<T> => {
    return performanceMonitor.trackOperation('api', operation, fn, metadata)
  },

  // Get performance statistics
  getStats: (type?: PerformanceMetricType, since?: Date) => {
    return metricsStore.getAggregatedStats(type, since)
  },

  // Get recent metrics
  getMetrics: (filters?: {
    type?: PerformanceMetricType
    since?: Date
    limit?: number
  }) => {
    return metricsStore.getMetrics(filters)
  }
}

// Middleware for automatic API performance tracking
export function withPerformanceMonitoring<T extends unknown[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    return performanceMonitor.trackAPI(operation, () => fn(...args))
  }
}

// Health check utilities
export const healthChecks = {
  // Check if performance is healthy across all types
  async getSystemHealth(): Promise<{
    healthy: boolean
    issues: string[]
    metrics: Record<PerformanceMetricType, ReturnType<typeof metricsStore.getAggregatedStats>>
  }> {
    const since = new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
    const issues: string[] = []
    
    const metrics = {
      email: metricsStore.getAggregatedStats('email', since),
      database: metricsStore.getAggregatedStats('database', since),
      session: metricsStore.getAggregatedStats('session', since),
      api: metricsStore.getAggregatedStats('api', since)
    }

    // Check each type for issues
    Object.entries(metrics).forEach(([type, stats]) => {
      if (stats.successRate < 95) {
        issues.push(`${type} success rate is low (${stats.successRate}%)`)
      }
      
      if (stats.criticalOperations > 0) {
        issues.push(`${type} has ${stats.criticalOperations} critical slow operations`)
      }
      
      const threshold = PERFORMANCE_THRESHOLDS[type as PerformanceMetricType]
      if (stats.averageDuration > threshold.warning) {
        issues.push(`${type} average response time is high (${stats.averageDuration}ms)`)
      }
    })

    return {
      healthy: issues.length === 0,
      issues,
      metrics
    }
  }
}