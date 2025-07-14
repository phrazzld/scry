import { NextRequest, NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import { ConvexHttpClient } from 'convex/browser'
import { getDeploymentEnvironment } from '@/lib/environment'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Get the deployment URL from Vercel environment or use the origin from the request
    const deploymentUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : request.headers.get('origin') || undefined

    // Get the current environment for session tagging
    const environment = getDeploymentEnvironment()

    // Initialize Convex client
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) {
      throw new Error('NEXT_PUBLIC_CONVEX_URL is not configured')
    }

    const client = new ConvexHttpClient(convexUrl)

    // Call the Convex mutation with deployment URL and environment
    const result = await client.mutation(api.auth.sendMagicLink, {
      email,
      deploymentUrl,
      environment
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to send magic link:', error)
    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 }
    )
  }
}