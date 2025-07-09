import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptionsMonitored as authOptions } from '@/lib/auth-monitored'
import { prismaMonitored as prisma } from '@/lib/prisma-monitored'

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

    // Add metadata to sessions
    const sessionsWithMetadata = userSessions.map((userSession: { id: string; expires: Date; sessionToken: string; userId: string }) => {
      // Check if this is the current session by comparing with current session data
      const isCurrent = userSession.expires > new Date()
      
      return {
        id: userSession.id,
        expires: userSession.expires,
        isCurrent,
        createdAt: userSession.id, // cuid contains timestamp info
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
      // Revoke all sessions for the user
      await prisma.session.deleteMany({
        where: {
          userId: session.user.id,
        },
      })
      
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