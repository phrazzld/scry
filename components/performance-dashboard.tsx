'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Mail, 
  Shield, 
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react'

interface PerformanceStats {
  count: number
  averageDuration: number
  successRate: number
  slowOperations: number
  criticalOperations: number
}

interface PerformanceMetric {
  id: string
  type: 'email' | 'database' | 'session' | 'api'
  operation: string
  duration: number
  success: boolean
  error?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

interface HealthData {
  system: {
    healthy: boolean
    issues: string[]
    metrics: Record<string, PerformanceStats>
  }
  auth: {
    email: PerformanceStats
    session: PerformanceStats
    overall: {
      healthy: boolean
      issues: string[]
    }
  }
  database: {
    healthy: boolean
    stats: PerformanceStats
    issues: string[]
  }
}

interface StatsData {
  stats: Record<string, PerformanceStats>
  trends: Record<string, {
    duration: number
    successRate: number
    count: number
  }>
  period: {
    minutes: number
    since: string
    until: string
  }
}

export function PerformanceDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [statsData, setStatsData] = useState<StatsData | null>(null)
  const [slowOperations, setSlowOperations] = useState<PerformanceMetric[]>([])
  const [timeRange, setTimeRange] = useState(10) // minutes
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealthData = async () => {
    try {
      const response = await fetch(`/api/performance?action=health`)
      if (response.ok) {
        const data = await response.json()
        setHealthData(data)
      }
    } catch (error) {
      console.error('Error fetching health data:', error)
    }
  }

  const fetchStatsData = async () => {
    try {
      const response = await fetch(`/api/performance?action=stats&minutes=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setStatsData(data)
      }
    } catch (error) {
      console.error('Error fetching stats data:', error)
    }
  }

  const fetchSlowOperations = async () => {
    try {
      const response = await fetch(`/api/performance?action=slow&minutes=${timeRange}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        setSlowOperations(data.slowOperations)
      }
    } catch (error) {
      console.error('Error fetching slow operations:', error)
    }
  }

  const fetchAllData = async () => {
    setIsLoading(true)
    await Promise.all([
      fetchHealthData(),
      fetchStatsData(),
      fetchSlowOperations()
    ])
    setLastUpdated(new Date())
    setIsLoading(false)
  }

  useEffect(() => {
    fetchAllData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchAllData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, timeRange])

  const getHealthIcon = (healthy: boolean) => {
    return healthy ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-red-500" />
    )
  }

  const getHealthBadge = (healthy: boolean) => {
    return (
      <Badge variant={healthy ? 'default' : 'destructive'}>
        {healthy ? 'Healthy' : 'Issues'}
      </Badge>
    )
  }

  const getTrendIcon = (trend: number, isInverted = false) => {
    const isPositive = isInverted ? trend < 0 : trend > 0
    if (Math.abs(trend) < 1) return null // No significant change
    
    return isPositive ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    )
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading performance data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of authentication and database performance
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-3 py-1 border rounded-md"
          >
            <option value={5}>Last 5 min</option>
            <option value={10}>Last 10 min</option>
            <option value={30}>Last 30 min</option>
            <option value={60}>Last hour</option>
          </select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-sm text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* System Health Overview */}
      {healthData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              {getHealthIcon(healthData.system.healthy)}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getHealthBadge(healthData.system.healthy)}
              </div>
              {healthData.system.issues.length > 0 && (
                <div className="mt-2">
                  {healthData.system.issues.map((issue, index) => (
                    <p key={index} className="text-xs text-red-600">{issue}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Authentication</CardTitle>
              {getHealthIcon(healthData.auth.overall.healthy)}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getHealthBadge(healthData.auth.overall.healthy)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Email: {healthData.auth.email.successRate}% success
                <br />
                Session: {healthData.auth.session.successRate}% success
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
              {getHealthIcon(healthData.database.healthy)}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getHealthBadge(healthData.database.healthy)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {healthData.database.stats.count} operations
                <br />
                Avg: {formatDuration(healthData.database.stats.averageDuration)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Metrics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="session">Session</TabsTrigger>
          <TabsTrigger value="slow">Slow Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {statsData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(statsData.stats).map(([type, stats]) => {
                const trend = statsData.trends[type]
                const icon = type === 'email' ? Mail : 
                           type === 'database' ? Database :
                           type === 'session' ? Shield : Activity

                return (
                  <Card key={type}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium capitalize">
                        {type}
                      </CardTitle>
                      {React.createElement(icon, { className: "h-4 w-4 text-muted-foreground" })}
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.count}</div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(stats.averageDuration)}
                        {getTrendIcon(trend.duration, true)}
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs">
                          <span>Success Rate</span>
                          <span>{stats.successRate}%</span>
                        </div>
                        <Progress value={stats.successRate} className="h-1 mt-1" />
                      </div>
                      {stats.criticalOperations > 0 && (
                        <Badge variant="destructive" className="mt-2 text-xs">
                          {stats.criticalOperations} critical
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="slow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slowest Operations</CardTitle>
              <CardDescription>
                Operations that exceeded performance thresholds in the last {timeRange} minutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slowOperations.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No slow operations detected
                </div>
              ) : (
                <div className="space-y-2">
                  {slowOperations.map((operation) => (
                    <div
                      key={operation.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{operation.type}</Badge>
                          <span className="font-medium">{operation.operation}</span>
                          {!operation.success && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </div>
                        {operation.error && (
                          <p className="text-xs text-red-600 mt-1">{operation.error}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-600">
                          {formatDuration(operation.duration)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(operation.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add other tabs for detailed views */}
        {['email', 'database', 'session'].map((type) => (
          <TabsContent key={type} value={type}>
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{type} Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {statsData && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Operations</h4>
                      <p className="text-2xl font-bold">{statsData.stats[type]?.count || 0}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Avg Duration</h4>
                      <p className="text-2xl font-bold">
                        {formatDuration(statsData.stats[type]?.averageDuration || 0)}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Success Rate</h4>
                      <p className="text-2xl font-bold">{statsData.stats[type]?.successRate || 0}%</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Slow Operations</h4>
                      <p className="text-2xl font-bold">{statsData.stats[type]?.slowOperations || 0}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Health Issues Alert */}
      {healthData && !healthData.system.healthy && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Performance Issues Detected</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              {healthData.system.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}