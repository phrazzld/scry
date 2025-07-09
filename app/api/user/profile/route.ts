import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authLogger } from '@/lib/logger'
import { z } from 'zod'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email address').optional(),
  image: z.string().url('Invalid image URL').optional().nullable()
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    })

  } catch (error) {
    authLogger.error({
      event: 'user-profile.get-error',
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to get user profile')

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const result = updateProfileSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    const { name, email, image } = result.data

    // Check if email is being changed
    if (email) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true }
      })

      if (currentUser && currentUser.email !== email) {
        // Check if new email is already taken
        const existingUser = await prisma.user.findUnique({
          where: { email }
        })

        if (existingUser) {
          return NextResponse.json(
            { error: 'Email address is already in use' },
            { status: 400 }
          )
        }

        // TODO: In a real application, you would need to verify the new email
        // For now, we'll update it directly but mark as unverified
        authLogger.info({
          event: 'user-profile.email-change',
          userId: session.user.id,
          oldEmail: currentUser.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
          newEmail: email.replace(/(.{2}).*(@.*)/, '$1***$2')
        }, 'User email change requested')
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        ...(email && { email, emailVerified: email === session.user.email ? undefined : null }),
        ...(image !== undefined && { image })
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        updatedAt: true
      }
    })

    authLogger.info({
      event: 'user-profile.updated',
      userId: session.user.id,
      updatedFields: {
        name: !!name,
        email: !!email,
        image: image !== undefined
      }
    }, 'User profile updated successfully')

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: updatedUser
    })

  } catch (error) {
    const session = await getServerSession(authOptions)
    authLogger.error({
      event: 'user-profile.update-error',
      userId: session?.user?.id,
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to update user profile')

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}