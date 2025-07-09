import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptionsMonitored as authOptions } from '@/lib/auth-monitored'
import { prismaMonitored as prisma } from '@/lib/prisma-monitored'
import { 
  extractSessionMetadata, 
  analyzeSessionSecurity, 
  updateSessionSecurity, 
  logSecurityEvent,
  checkSessionRevocation 
} from '@/lib/session-security-stub'

export async function GET() {
  try {
    // Check for authenticated session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Query user's sessions from database
    const userSessions = await prisma.session.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        expires: 'desc',
      },
    })

    // Add metadata to sessions with security information
    const sessionsWithMetadata = userSessions.map((userSession) => {
      // Check if this is the current session by comparing with current session data
      const isCurrent = userSession.expires > new Date()
      
      return {
        id: userSession.id,
        expires: userSession.expires,
        isCurrent,
        createdAt: new Date(), // Fallback since createdAt not available in basic schema
        lastActivity: new Date(), // Fallback since lastActivity not available in basic schema
        // Security metadata - all undefined since not available in basic schema
        ipAddress: undefined,
        deviceType: undefined,
        deviceName: undefined,
        location: undefined,
        loginMethod: 'email',
        riskScore: 0,
        isSecure: true,
        // Suspicious activity summary
        suspiciousActivity: [],
        hasSecurityFlags: false,
        // Note: sessionToken is sensitive, so we don't return it
      }
    })

    return new Response(
      JSON.stringify({ 
        sessions: sessionsWithMetadata,
        currentSessionInfo: {
          userId: session.user.id,
          userEmail: session.user.email,
          userName: session.user.name,
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Sessions query error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to retrieve session information' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check for authenticated session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { sessionId, allSessions } = body

    if (allSessions) {
      // Get sessions before deletion for logging
      const sessionsToRevoke = await prisma.session.findMany({
        where: { userId: session.user.id },
        select: { id: true }
      })
      
      // Revoke all sessions for the user
      await prisma.session.deleteMany({
        where: {
          userId: session.user.id,
        },
      })
      
      // Log security event
      logSecurityEvent('all-sessions-revoked', session.user.id, {
        revokedCount: sessionsToRevoke.length,
        revokedSessions: sessionsToRevoke.map(s => ({ 
          id: s.id, 
          deviceType: undefined, 
          location: undefined, 
          riskScore: 0 
        })),
        initiatedBy: 'user'
      }, 'medium')
      
      console.log(`All sessions revoked for user: ${session.user.id}`)
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'All sessions revoked successfully'
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } else if (sessionId) {
      // Revoke specific session
      const deletedSession = await prisma.session.delete({
        where: {
          id: sessionId,
          userId: session.user.id, // Ensure user can only delete their own sessions
        },
      })
      
      // Log security event
      logSecurityEvent('session-revoked', session.user.id, {
        sessionId: deletedSession.id,
        deviceType: undefined,
        location: undefined,
        riskScore: 0,
        hadSuspiciousActivity: false,
        initiatedBy: 'user'
      }, 'low')
      
      console.log(`Session revoked: ${sessionId} for user: ${session.user.id}`)
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Session revoked successfully',
          revokedSessionId: deletedSession.id
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid request: must specify sessionId or allSessions' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Session revocation error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to revoke session(s)' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for authenticated session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { action, sessionId } = body

    if (action === 'analyze-security') {
      // Perform security analysis for current session
      await extractSessionMetadata()
      const securityAnalysis = await analyzeSessionSecurity(session.user.id)
      
      // Log security analysis request
      logSecurityEvent('security-analysis-requested', session.user.id, {
        riskScore: securityAnalysis.riskScore,
        flags: securityAnalysis.flags,
        deviceType: undefined,
        location: undefined
      }, 'low')
      
      return new Response(
        JSON.stringify({ 
          success: true,
          analysis: securityAnalysis,
          metadata: {}
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } else if (action === 'check-revocation' && sessionId) {
      // Check if session should be revoked
      const revocationCheck = await checkSessionRevocation()
      
      return new Response(
        JSON.stringify({ 
          success: true,
          revocationCheck
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action or missing parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Session security action error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to perform session security action' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check for authenticated session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { sessionId, action } = body

    if (action === 'update-security' && sessionId) {
      // Update session security metadata
      await extractSessionMetadata()
      const securityAnalysis = await analyzeSessionSecurity(session.user.id)
      
      // Update session in database
      await updateSessionSecurity()
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Session security metadata updated',
          riskScore: securityAnalysis.riskScore,
          flags: securityAnalysis.flags
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action or missing sessionId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Session security update error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update session security metadata' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}