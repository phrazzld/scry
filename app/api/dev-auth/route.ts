/**
 * Development Authentication Shortcuts API
 * 
 * SECURITY: This endpoint is only available in development environment.
 * It provides quick authentication methods for testing and development.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  isDevAuthAvailable, 
  getTestUser, 
  getDevAuthStatus,
  DEV_TEST_USERS
} from '@/lib/dev-auth'
import { authLogger, loggers } from '@/lib/logger'

/**
 * GET /api/dev-auth - Get development authentication status and available shortcuts
 */
export async function GET() {
  // Critical security check
  if (!isDevAuthAvailable()) {
    authLogger.error({
      event: 'dev-auth.api.production-access',
      environment: process.env.NODE_ENV,
      ip: 'unknown', // Could get from headers
      timestamp: new Date().toISOString()
    }, 'Attempted to access development auth API in production')
    
    return NextResponse.json(
      { error: 'Development authentication is not available in this environment' },
      { status: 403 }
    )
  }

  try {
    const session = await getServerSession(authOptions)
    const status = getDevAuthStatus()
    
    authLogger.debug({
      event: 'dev-auth.api.status-request',
      hasSession: !!session,
      userEmail: session?.user?.email
    }, 'Development auth status requested')
    
    return NextResponse.json({
      status: 'available',
      currentSession: session ? {
        user: session.user,
        authenticated: true
      } : null,
      shortcuts: {
        quickSignIn: '/api/dev-auth/signin',
        testUsers: '/api/dev-auth/test-users',
        signOut: '/api/auth/signout'
      },
      ...status
    })
  } catch (error) {
    loggers.error(
      error as Error,
      'api',
      { event: 'dev-auth.api.status-error' },
      'Error getting development auth status'
    )
    
    return NextResponse.json(
      { error: 'Failed to get development auth status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dev-auth - Quick development sign-in
 * Body: { email: string, name?: string } or { testUser: 'admin' | 'user' | 'tester' }
 */
export async function POST(request: NextRequest) {
  // Critical security check
  if (!isDevAuthAvailable()) {
    authLogger.error({
      event: 'dev-auth.api.signin-production-attempt',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, 'Attempted development sign-in in production')
    
    return NextResponse.json(
      { error: 'Development authentication is not available in this environment' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    let user

    if (body.testUser) {
      // Use predefined test user
      if (!Object.keys(DEV_TEST_USERS).includes(body.testUser)) {
        return NextResponse.json(
          { error: `Invalid test user type. Available: ${Object.keys(DEV_TEST_USERS).join(', ')}` },
          { status: 400 }
        )
      }
      
      user = getTestUser(body.testUser as keyof typeof DEV_TEST_USERS)
      authLogger.debug({
        event: 'dev-auth.api.test-user-signin',
        testUserType: body.testUser,
        email: user.email
      }, `Development sign-in with test user: ${body.testUser}`)
      
    } else if (body.email) {
      // Custom user
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }
      
      user = {
        id: `dev-${body.email.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`,
        email: body.email,
        name: body.name || body.email.split('@')[0]
      }
      
      authLogger.debug({
        event: 'dev-auth.api.custom-user-signin',
        email: user.email,
        name: user.name
      }, 'Development sign-in with custom user')
      
    } else {
      return NextResponse.json(
        { error: 'Either email or testUser is required' },
        { status: 400 }
      )
    }

    // Note: This is a simplified version. In a real implementation,
    // you would need to integrate with NextAuth's session creation
    // For now, return the user data that could be used with signIn()
    
    return NextResponse.json({
      success: true,
      user,
      message: 'Development user created. Use this data with signIn() on the client.',
      instructions: {
        client: 'Use signIn("dev-shortcut", { email: user.email, name: user.name })',
        note: 'This endpoint provides user data for development. Actual sign-in happens on client.'
      }
    })
    
  } catch (error) {
    loggers.error(
      error as Error,
      'api',
      { event: 'dev-auth.api.signin-error' },
      'Error in development authentication'
    )
    
    return NextResponse.json(
      { error: 'Failed to process development authentication' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dev-auth - Clear development session (sign out)
 */
export async function DELETE() {
  if (!isDevAuthAvailable()) {
    return NextResponse.json(
      { error: 'Development authentication is not available in this environment' },
      { status: 403 }
    )
  }

  try {
    const session = await getServerSession(authOptions)
    
    authLogger.debug({
      event: 'dev-auth.api.signout',
      hadSession: !!session,
      userEmail: session?.user?.email
    }, 'Development sign-out requested')
    
    // Note: Actual sign-out would need to be handled by NextAuth
    // This endpoint just confirms the request
    
    return NextResponse.json({
      success: true,
      message: 'Development sign-out initiated',
      instructions: {
        client: 'Use signOut() from next-auth/react on the client side'
      }
    })
    
  } catch (error) {
    loggers.error(
      error as Error,
      'api',
      { event: 'dev-auth.api.signout-error' },
      'Error in development sign-out'
    )
    
    return NextResponse.json(
      { error: 'Failed to process development sign-out' },
      { status: 500 }
    )
  }
}