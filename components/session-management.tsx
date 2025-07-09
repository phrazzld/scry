'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { 
  Monitor, 
  Clock, 
  Shield, 
  LogOut, 
  Loader2,
  AlertTriangle,
  Smartphone,
  MapPin,
  Activity,
  Eye,
  Lock,
  Unlock
} from 'lucide-react'

interface SessionInfo {
  id: string
  expires: string
  isCurrent: boolean
  createdAt: string
  lastActivity: string
  // Security metadata
  ipAddress?: string
  deviceType?: string
  deviceName?: string
  location?: string
  loginMethod?: string
  riskScore?: number
  isSecure?: boolean
  suspiciousActivity?: { type?: string; severity?: string }[]
  hasSecurityFlags?: boolean
}

interface SessionData {
  sessions: SessionInfo[]
  currentSessionInfo: {
    userId: string
    userEmail: string
    userName: string
  }
}

export function SessionManagement() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [analyzingSession, setAnalyzingSession] = useState<string | null>(null)
  const [securityAnalysis, setSecurityAnalysis] = useState<{
    riskScore: number
    flags: string[]
    recommendations: string[]
    suspiciousEvents: { type: string; severity: string }[]
  } | null>(null)

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions')
      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }
      const data = await response.json()
      setSessionData(data)
    } catch (error) {
      console.error('Error fetching sessions:', error)
      toast.error('Failed to load session information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    setRevoking(sessionId)

    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        throw new Error('Failed to revoke session')
      }

      toast.success('Session revoked successfully')

      if (isCurrent) {
        // If revoking current session, sign out and redirect
        toast.info('Signing out...')
        await signOut({ callbackUrl: '/' })
      } else {
        // Refresh session list
        await fetchSessions()
      }
    } catch (error) {
      console.error('Error revoking session:', error)
      toast.error('Failed to revoke session')
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeAllSessions = async () => {
    setRevoking('all')

    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ allSessions: true }),
      })

      if (!response.ok) {
        throw new Error('Failed to revoke all sessions')
      }

      toast.success('All sessions revoked successfully')
      toast.info('Signing out...')
      
      // Sign out and redirect
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Error revoking all sessions:', error)
      toast.error('Failed to revoke all sessions')
    } finally {
      setRevoking(null)
    }
  }

  const handleAnalyzeSecurity = async () => {
    setAnalyzingSession('current')

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'analyze-security' }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze security')
      }

      const data = await response.json()
      setSecurityAnalysis(data.analysis)
      toast.success('Security analysis complete')
    } catch (error) {
      console.error('Error analyzing security:', error)
      toast.error('Failed to analyze security')
    } finally {
      setAnalyzingSession(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getSessionDuration = (expires: string) => {
    const expiryDate = new Date(expires)
    const now = new Date()
    const diffMs = expiryDate.getTime() - now.getTime()
    
    if (diffMs <= 0) {
      return 'Expired'
    }
    
    const diffMins = Math.floor(diffMs / (1000 * 60))
    if (diffMins < 60) {
      return `${diffMins} minutes remaining`
    }
    
    const diffHours = Math.floor(diffMins / 60)
    return `${diffHours} hours remaining`
  }

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />
      case 'tablet':
        return <Smartphone className="w-4 h-4" />
      case 'desktop':
        return <Monitor className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  const getRiskColor = (riskScore?: number) => {
    if (!riskScore) return 'text-green-600'
    if (riskScore < 30) return 'text-green-600'
    if (riskScore < 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRiskLabel = (riskScore?: number) => {
    if (!riskScore) return 'Low Risk'
    if (riskScore < 30) return 'Low Risk'
    if (riskScore < 70) return 'Medium Risk'
    return 'High Risk'
  }

  const getSecurityIcon = (isSecure?: boolean) => {
    return isSecure ? <Lock className="w-4 h-4 text-green-600" /> : <Unlock className="w-4 h-4 text-red-600" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Loading session information...</span>
      </div>
    )
  }

  if (!sessionData) {
    return (
      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
          <span className="text-yellow-800 text-sm">
            Unable to load session information. Please try refreshing the page.
          </span>
        </div>
      </div>
    )
  }

  const activeSessions = sessionData.sessions.filter(session => 
    new Date(session.expires) > new Date()
  )

  return (
    <div className="space-y-4">
      {/* Current Session Info */}
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Monitor className="w-5 h-5 text-green-600 mr-2" />
            <h3 className="font-medium text-green-900">Current Session</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyzeSecurity}
            disabled={analyzingSession === 'current'}
          >
            {analyzingSession === 'current' ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1" />
                Analyze Security
              </>
            )}
          </Button>
        </div>
        <div className="text-green-800 text-sm space-y-1">
          <p><strong>User:</strong> {sessionData.currentSessionInfo.userName || sessionData.currentSessionInfo.userEmail}</p>
          <p><strong>Authentication:</strong> Email Magic Link</p>
          <p><strong>Status:</strong> Active</p>
        </div>
        
        {/* Security Analysis Results */}
        {securityAnalysis && (
          <div className="mt-4 p-3 bg-white rounded border">
            <h4 className="font-medium mb-2 flex items-center">
              <Shield className="w-4 h-4 mr-1" />
              Security Analysis
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Risk Score:</span>
                <span className={`font-medium ${getRiskColor(securityAnalysis.riskScore)}`}>
                  {securityAnalysis.riskScore}/100 ({getRiskLabel(securityAnalysis.riskScore)})
                </span>
              </div>
              {securityAnalysis.flags && securityAnalysis.flags.length > 0 && (
                <div>
                  <span className="text-yellow-600">Security Flags:</span>
                  <ul className="ml-2 mt-1">
                    {securityAnalysis.flags.map((flag: string, index: number) => (
                      <li key={index} className="text-yellow-700">• {flag.replace(/_/g, ' ')}</li>
                    ))}
                  </ul>
                </div>
              )}
              {securityAnalysis.recommendations && securityAnalysis.recommendations.length > 0 && (
                <div>
                  <span className="text-blue-600">Recommendations:</span>
                  <ul className="ml-2 mt-1">
                    {securityAnalysis.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="text-blue-700">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Session List */}
      {activeSessions.length > 0 ? (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="sessions">
            <AccordionTrigger>
              <div className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Active Sessions ({activeSessions.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className={`p-3 border rounded-lg ${
                      session.hasSecurityFlags ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-gray-500" />
                          <span className="text-sm font-medium">
                            {session.isCurrent ? 'Current Session' : 'Session'}
                          </span>
                          {session.isCurrent && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                              Active
                            </span>
                          )}
                          {session.hasSecurityFlags && (
                            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                              Security Alert
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600">
                          Expires: {formatDate(session.expires)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {getSessionDuration(session.expires)}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id, session.isCurrent)}
                        disabled={revoking === session.id}
                      >
                        {revoking === session.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Revoking...
                          </>
                        ) : (
                          <>
                            <LogOut className="w-4 h-4 mr-1" />
                            Revoke
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Security Metadata */}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            {getDeviceIcon(session.deviceType)}
                            <span className="ml-1 text-gray-600">
                              {session.deviceName || 'Unknown Device'}
                            </span>
                          </div>
                          {session.location && (
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1 text-gray-500" />
                              <span className="text-gray-600">{session.location}</span>
                            </div>
                          )}
                          {session.loginMethod && (
                            <div className="flex items-center">
                              <Activity className="w-4 h-4 mr-1 text-gray-500" />
                              <span className="text-gray-600">
                                {session.loginMethod === 'email' ? 'Magic Link' : session.loginMethod}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center">
                            {getSecurityIcon(session.isSecure)}
                            <span className="ml-1 text-gray-600">
                              {session.isSecure ? 'Secure' : 'Insecure'}
                            </span>
                          </div>
                          {session.riskScore !== undefined && (
                            <div className="flex items-center">
                              <Shield className="w-4 h-4 mr-1 text-gray-500" />
                              <span className={`${getRiskColor(session.riskScore)}`}>
                                {getRiskLabel(session.riskScore)} ({session.riskScore}/100)
                              </span>
                            </div>
                          )}
                          {session.lastActivity && (
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1 text-gray-500" />
                              <span className="text-gray-600">
                                Last: {formatDate(session.lastActivity)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Suspicious Activity Warning */}
                      {session.suspiciousActivity && session.suspiciousActivity.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-100 rounded border border-yellow-200">
                          <div className="flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-1 text-yellow-600" />
                            <span className="text-yellow-800 text-xs font-medium">
                              Suspicious Activity Detected
                            </span>
                          </div>
                          <ul className="mt-1 text-xs text-yellow-700">
                            {session.suspiciousActivity.slice(0, 2).map((activity: { type?: string }, index: number) => (
                              <li key={index}>• {activity.type?.replace(/_/g, ' ')}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {activeSessions.length > 1 && (
                  <div className="pt-3 border-t">
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleRevokeAllSessions}
                      disabled={revoking === 'all'}
                    >
                      {revoking === 'all' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Revoking All Sessions...
                        </>
                      ) : (
                        <>
                          <LogOut className="w-4 h-4 mr-2" />
                          Revoke All Sessions
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <div className="p-4 bg-gray-50 rounded-lg border">
          <p className="text-sm text-gray-600">
            No active sessions found. This may be because sessions are managed via JWT tokens.
          </p>
        </div>
      )}

      {/* Sign Out Current Session */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out Current Session
        </Button>
      </div>
    </div>
  )
}