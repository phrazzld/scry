/**
 * Development Sign-In Page
 * 
 * SECURITY: This page is only available in development environment.
 * Provides quick authentication shortcuts for testing and development.
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, User, Mail, Zap, LogOut, Home } from 'lucide-react'
import { toast } from 'sonner'

// Development environment check
const isDevelopment = process.env.NODE_ENV === 'development'

interface DevAuthStatus {
  available: boolean
  environment: string
  testUsers: string[]
  currentSession?: {
    user: {
      id: string
      email: string
      name: string
    }
    authenticated: boolean
  }
}

export default function DevSignInPage() {
  const { user, isAuthenticated, sendMagicLink, signOut } = useAuth()
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState<DevAuthStatus | null>(null)
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirect if not in development
  useEffect(() => {
    if (!isDevelopment) {
      router.push('/')
      return
    }
    
    // Set mock auth status for development
    setAuthStatus({
      available: true,
      environment: 'development',
      testUsers: ['admin', 'user', 'tester'],
      currentSession: user ? {
        user: {
          id: user.id,
          email: user.email || '',
          name: user.name || ''
        },
        authenticated: true
      } : undefined
    })
  }, [router, user])

  // Redirect if not development environment
  if (!isDevelopment) {
    return (
      <div className="container mx-auto max-w-md mt-8 p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Development authentication is only available in development environment.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleTestUserSignIn = async (testUser: string) => {
    setLoading(true)
    setError('')
    
    try {
      // In development, we'll send a magic link to the test email
      const email = `${testUser}@dev.local`
      const result = await sendMagicLink(email)
      
      if (!result.success) {
        setError('Failed to send magic link')
      } else {
        toast.success(`Magic link sent to ${email}. Check the Convex dashboard for the link in development.`)
      }
    } catch {
      setError('Failed to sign in with test user')
    }
    
    setLoading(false)
  }

  const handleCustomSignIn = async () => {
    if (!customEmail) {
      setError('Email is required')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const result = await sendMagicLink(customEmail)
      
      if (!result.success) {
        setError('Failed to send magic link')
      } else {
        toast.success(`Magic link sent to ${customEmail}. Check your email or the Convex dashboard in development.`)
      }
    } catch {
      setError('Failed to sign in with custom user')
    }
    
    setLoading(false)
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut()
    } catch {
      setError('Failed to sign out')
    }
    setLoading(false)
  }

  return (
    <div className="container mx-auto max-w-2xl mt-8 p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">Development Authentication</h1>
        </div>
        <p className="text-muted-foreground">
          Quick authentication shortcuts for development and testing
        </p>
        <Badge variant="outline" className="mt-2">
          Environment: {authStatus?.environment || 'unknown'}
        </Badge>
      </div>

      {/* Security Warning */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Notice:</strong> This page is only available in development environment. 
          All shortcuts are automatically disabled in production.
        </AlertDescription>
      </Alert>

      {/* Current Session Status */}
      {isAuthenticated && user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Currently Signed In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.name || 'Not set'}</p>
              <p><strong>ID:</strong> {user.id}</p>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => router.push('/')} variant="outline">
                  <Home className="h-4 w-4 mr-2" />
                  Go to App
                </Button>
                <Button onClick={handleSignOut} variant="destructive" disabled={loading}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Test Users */}
      {!isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Test Users</CardTitle>
            <CardDescription>
              Pre-configured test accounts for common development scenarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {['admin', 'user', 'tester'].map(userType => (
                <Button
                  key={userType}
                  onClick={() => handleTestUserSignIn(userType)}
                  disabled={loading}
                  variant="outline"
                  className="justify-start"
                >
                  <User className="h-4 w-4 mr-2" />
                  Sign in as {userType}@dev.local
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom User Sign-In */}
      {!isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Development User</CardTitle>
            <CardDescription>
              Create a custom user for specific testing scenarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="test@dev.local"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Display Name (optional)
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Test User"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button 
                onClick={handleCustomSignIn}
                disabled={loading || !customEmail}
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Sign In with Custom User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Developer Information */}
      <Card>
        <CardHeader>
          <CardTitle>Developer Information</CardTitle>
          <CardDescription>
            Useful information for development and testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong>Available Endpoints:</strong>
              <ul className="mt-1 ml-4 space-y-1">
                <li>• <code>GET /api/dev-auth</code> - Get auth status</li>
                <li>• <code>POST /api/dev-auth</code> - Quick sign-in</li>
                <li>• <code>DELETE /api/dev-auth</code> - Sign out</li>
              </ul>
            </div>
            <Separator />
            <div>
              <strong>Security Features:</strong>
              <ul className="mt-1 ml-4 space-y-1">
                <li>• Automatic production environment detection</li>
                <li>• All shortcuts disabled outside development</li>
                <li>• Comprehensive logging for debugging</li>
                <li>• Automatic tests prevent production leakage</li>
              </ul>
            </div>
            <Separator />
            <div>
              <strong>Test Coverage:</strong>
              <ul className="mt-1 ml-4 space-y-1">
                <li>• Environment validation tests</li>
                <li>• Production safety tests</li>
                <li>• Error handling tests</li>
                <li>• Security boundary tests</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}