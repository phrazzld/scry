'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Doc } from '@/convex/_generated/dataModel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

export default function DeploymentsPage() {
  const recentDeployments = useQuery(api.deployments.getRecentDeployments, {
    limit: 50
  })
  
  const stats = useQuery(api.deployments.getDeploymentStats, {
    days: 30
  })

  if (!recentDeployments || !stats) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Deployment History</h1>
        <div>Loading deployment data...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Deployment History</h1>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Total Deployments</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.successRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Failed Deployments</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Avg Duration</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(stats.avgDuration / 1000).toFixed(1)}s
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Top Deployers */}
      {stats.topDeployers.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top Deployers</CardTitle>
            <CardDescription>Most active in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topDeployers.map((deployer: { name: string; count: number }, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="font-medium">{deployer.name}</span>
                  <Badge variant="secondary">{deployer.count} deployments</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Recent Deployments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deployments</CardTitle>
          <CardDescription>All deployments across environments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Environment</th>
                  <th className="text-left p-2">Branch</th>
                  <th className="text-left p-2">Deployed By</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Duration</th>
                  <th className="text-left p-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentDeployments.map((deployment: Doc<"deployments">) => (
                  <tr key={deployment._id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <Badge variant={
                        deployment.environment === 'production' ? 'destructive' :
                        deployment.environment === 'preview' ? 'secondary' :
                        'default'
                      }>
                        {deployment.environment}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono text-sm">
                      {deployment.branch || 'N/A'}
                    </td>
                    <td className="p-2 text-sm">
                      {deployment.deployedBy || 'System'}
                    </td>
                    <td className="p-2">
                      <Badge variant={
                        deployment.status === 'success' ? 'default' :
                        deployment.status === 'failed' ? 'destructive' :
                        'secondary'
                      }>
                        {deployment.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-sm">
                      {deployment.duration 
                        ? `${(deployment.duration / 1000).toFixed(1)}s` 
                        : '-'}
                    </td>
                    <td className="p-2 text-sm text-gray-600">
                      {formatDistanceToNow(new Date(deployment.deployedAt), { 
                        addSuffix: true 
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}