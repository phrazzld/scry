import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptionsMonitored as authOptions } from '@/lib/auth-monitored'
import { prismaMonitored as prisma } from '@/lib/prisma-monitored'

const emailPreferencesSchema = z.object({
  marketingEmails: z.boolean().default(false),
  quizReminders: z.boolean().default(true),
  securityNotifications: z.boolean().default(true),
  accountUpdates: z.boolean().default(true),
})

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

    // Fetch user with email preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailPreferences: true }
    })

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse email preferences with defaults
    const defaultPreferences = {
      marketingEmails: false,
      quizReminders: true,
      securityNotifications: true,
      accountUpdates: true,
    }

    let preferences = defaultPreferences
    if (user.emailPreferences && typeof user.emailPreferences === 'object') {
      preferences = { ...defaultPreferences, ...(user.emailPreferences as Record<string, unknown>) }
    }

    return new Response(
      JSON.stringify({ preferences }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Email preferences fetch error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred. Please try again.' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    const validationResult = emailPreferencesSchema.safeParse(body)
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data',
          details: validationResult.error.issues 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const preferences = validationResult.data

    // Log the preferences update
    console.log(`Email preferences update for user: ${session.user.id}`, preferences)
    
    try {
      // Update user's email preferences
      await prisma.user.update({
        where: { id: session.user.id },
        data: { emailPreferences: preferences },
      })
      
      console.log(`Email preferences successfully updated for user: ${session.user.id}`)
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Email preferences updated successfully',
          preferences
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } catch (dbError) {
      console.error('Database error during email preferences update:', dbError)
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update email preferences. Please try again.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Email preferences update error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred. Please try again.' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}