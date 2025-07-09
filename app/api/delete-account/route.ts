import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptionsMonitored as authOptions } from '@/lib/auth-monitored'
import { prismaMonitored as prisma } from '@/lib/prisma-monitored'

const requestSchema = z.object({
  confirmationEmail: z.string().email('Please enter a valid email address'),
})

export async function DELETE(request: NextRequest) {
  try {
    // Check for authenticated session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || !session?.user?.email) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const validationResult = requestSchema.safeParse(body)
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data',
          details: validationResult.error.issues 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const { confirmationEmail } = validationResult.data
    
    // Verify that the confirmation email matches the user's email
    if (confirmationEmail.toLowerCase() !== session.user.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          error: 'Email confirmation does not match your account email' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Log the account deletion attempt
    console.log(`Account deletion initiated for user: ${session.user.id} (${session.user.email})`)
    
    try {
      // Delete the user record - cascade deletes will handle related data
      await prisma.user.delete({
        where: {
          id: session.user.id,
        },
      })
      
      console.log(`Account successfully deleted for user: ${session.user.id} (${session.user.email})`)
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Account successfully deleted'
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' }
        }
      )
    } catch (dbError) {
      console.error('Database error during account deletion:', dbError)
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete account. Please try again or contact support.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Account deletion error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred. Please try again.' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}