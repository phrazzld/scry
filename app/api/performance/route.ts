import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptionsMonitored } from '@/lib/auth-monitored'
import { performanceMonitor, healthChecks } from '@/lib/performance-monitor'
import { authPerformance } from '@/lib/auth-monitored'
import { databaseOperations } from '@/lib/prisma-monitored'
import { createRequestLogger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const logger = createRequestLogger('api', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  })

  try {
    // Check authentication
    const session = await getServerSession(authOptionsMonitored)
    if (!session?.user?.id) {
      logger.warn({
        event: 'api.performance.unauthorized',
        reason: 'no_session'
      }, 'Unauthorized access to performance API')
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'email' | 'database' | 'session' | 'api' | null
    const minutes = parseInt(searchParams.get('minutes') || '10')
    const limit = parseInt(searchParams.get('limit') || '50')

    logger.info({
      event: 'api.performance.request',
      userId: session.user.id,
      type,
      minutes,
      limit
    }, 'Performance data requested')

    const since = new Date(Date.now() - minutes * 60 * 1000)

    // Get different types of performance data based on request
    const action = searchParams.get('action') || 'stats'

    switch (action) {
      case 'health':
        const systemHealth = await healthChecks.getSystemHealth()
        const authStats = authPerformance.getAuthStats()
        const dbHealth = await databaseOperations.getDatabaseHealth()
        
        return NextResponse.json({
          system: systemHealth,
          auth: authStats,
          database: dbHealth,
          timestamp: new Date().toISOString()
        })

      case 'metrics':
        const metrics = performanceMonitor.getMetrics({
          type: type || undefined,
          since,
          limit
        })
        
        return NextResponse.json({
          metrics,
          filters: { type, since: since.toISOString(), limit },
          count: metrics.length
        })

      case 'slow':
        const slowOperations = [
          ...performanceMonitor.getMetrics({ type: 'email', since })
            .filter(m => m.duration > 5000),
          ...performanceMonitor.getMetrics({ type: 'database', since })
            .filter(m => m.duration > 1000),
          ...performanceMonitor.getMetrics({ type: 'session', since })
            .filter(m => m.duration > 2000),
          ...performanceMonitor.getMetrics({ type: 'api', since })
            .filter(m => m.duration > 3000)
        ].sort((a, b) => b.duration - a.duration).slice(0, limit)
        
        return NextResponse.json({
          slowOperations,
          filters: { since: since.toISOString(), limit }
        })

      case 'stats':
      default:
        const stats = {
          email: performanceMonitor.getStats('email', since),
          database: performanceMonitor.getStats('database', since),
          session: performanceMonitor.getStats('session', since),
          api: performanceMonitor.getStats('api', since)
        }
        
        // Add trend analysis (comparing to previous period)
        const previousSince = new Date(since.getTime() - (minutes * 60 * 1000))
        const previousStats = {
          email: performanceMonitor.getStats('email', previousSince),
          database: performanceMonitor.getStats('database', previousSince),
          session: performanceMonitor.getStats('session', previousSince),
          api: performanceMonitor.getStats('api', previousSince)
        }

        const trends = Object.keys(stats).reduce((acc, key) => {
          const current = stats[key as keyof typeof stats]
          const previous = previousStats[key as keyof typeof previousStats]
          
          acc[key] = {
            duration: previous.averageDuration > 0 
              ? ((current.averageDuration - previous.averageDuration) / previous.averageDuration) * 100
              : 0,
            successRate: previous.successRate > 0
              ? current.successRate - previous.successRate
              : 0,
            count: previous.count > 0
              ? ((current.count - previous.count) / previous.count) * 100
              : 0
          }
          
          return acc
        }, {} as Record<string, { duration: number; successRate: number; count: number }>)
        
        return NextResponse.json({
          stats,
          trends,
          period: {
            minutes,
            since: since.toISOString(),
            until: new Date().toISOString()
          }
        })
    }

  } catch (error) {
    logger.error({
      event: 'api.performance.error',
      error: error instanceof Error ? error.message : String(error)
    }, 'Error fetching performance data')

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST endpoint for triggering performance tests or clearing metrics
export async function POST(request: NextRequest) {
  const logger = createRequestLogger('api', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  })

  try {
    // Check authentication
    const session = await getServerSession(authOptionsMonitored)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action } = body

    logger.info({
      event: 'api.performance.action',
      userId: session.user.id,
      action
    }, `Performance action requested: ${action}`)

    switch (action) {
      case 'test-database':
        // Run a simple database performance test
        const testResult = await performanceMonitor.trackDatabase(
          'performance_test',
          async () => {
            const start = Date.now()
            await databaseOperations.findUserById(session.user.id)
            return Date.now() - start
          }
        )
        
        return NextResponse.json({
          success: true,
          message: 'Database performance test completed',
          duration: testResult
        })

      case 'test-session':
        // Test session performance
        const sessionTest = await performanceMonitor.trackSession(
          'performance_test',
          async () => {
            const start = Date.now()
            // Simulate session validation
            await new Promise(resolve => setTimeout(resolve, 50))
            return Date.now() - start
          }
        )
        
        return NextResponse.json({
          success: true,
          message: 'Session performance test completed',
          duration: sessionTest
        })

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

  } catch (error) {
    logger.error({
      event: 'api.performance.post_error',
      error: error instanceof Error ? error.message : String(error)
    }, 'Error processing performance action')

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}