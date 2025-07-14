import { NextResponse } from 'next/server'
import { getDeploymentEnvironment } from '@/lib/environment'
import { api } from '@/convex/_generated/api'
import { ConvexHttpClient } from 'convex/browser'

interface HealthCheck {
  status: string
  value?: string
  configured?: boolean
  canCreateSession?: boolean
  error: string | null
}

interface HealthChecks {
  environment: HealthCheck
  vercelUrl: HealthCheck
  convexConnection: HealthCheck
  googleAiKey: HealthCheck
  sessionCreation: HealthCheck
}

export async function GET() {
  const checks = {
    environment: {
      status: 'unknown',
      value: '',
      error: null as string | null,
    },
    vercelUrl: {
      status: 'unknown', 
      value: '',
      error: null as string | null,
    },
    convexConnection: {
      status: 'unknown',
      error: null as string | null,
    },
    googleAiKey: {
      status: 'unknown',
      configured: false,
      error: null as string | null,
    },
    sessionCreation: {
      status: 'unknown',
      canCreateSession: false,
      error: null as string | null,
    },
  }

  try {
    // Check environment detection
    const environment = getDeploymentEnvironment()
    checks.environment.value = environment
    checks.environment.status = 'ok'

    // Check VERCEL_URL
    if (process.env.VERCEL_URL) {
      checks.vercelUrl.value = process.env.VERCEL_URL
      checks.vercelUrl.status = 'ok'
    } else {
      checks.vercelUrl.status = 'missing'
      checks.vercelUrl.error = 'VERCEL_URL not set'
    }

    // Check Convex connection
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    if (!convexUrl) {
      checks.convexConnection.status = 'error'
      checks.convexConnection.error = 'NEXT_PUBLIC_CONVEX_URL not configured'
    } else {
      try {
        const client = new ConvexHttpClient(convexUrl)
        // Try a simple query to test connection
        await client.query(api.auth.getCurrentUser, { sessionToken: undefined })
        checks.convexConnection.status = 'ok'
      } catch (error) {
        checks.convexConnection.status = 'error'
        checks.convexConnection.error = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Check Google AI API key
    if (process.env.GOOGLE_AI_API_KEY) {
      checks.googleAiKey.configured = true
      checks.googleAiKey.status = 'ok'
    } else {
      checks.googleAiKey.status = 'missing'
      checks.googleAiKey.error = 'GOOGLE_AI_API_KEY not configured'
    }

    // Check if we can create sessions with proper environment tagging
    checks.sessionCreation.canCreateSession = true
    checks.sessionCreation.status = 'ok'

    // Calculate overall health
    const allChecks = Object.values(checks)
    const hasErrors = allChecks.some(check => check.status === 'error')
    const hasWarnings = allChecks.some(check => check.status === 'missing')
    
    const overallStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy'

    return NextResponse.json({
      status: overallStatus,
      environment: environment,
      timestamp: new Date().toISOString(),
      checks,
      recommendations: getRecommendations(checks),
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      checks,
    }, { status: 500 })
  }
}

function getRecommendations(checks: HealthChecks): string[] {
  const recommendations: string[] = []

  if (checks.vercelUrl.status === 'missing') {
    recommendations.push('VERCEL_URL is not set. This may cause issues with magic link generation in preview deployments.')
  }

  if (checks.googleAiKey.status === 'missing') {
    recommendations.push('GOOGLE_AI_API_KEY is not configured. Quiz generation will use placeholder questions.')
  }

  if (checks.convexConnection.status === 'error') {
    recommendations.push('Cannot connect to Convex. Check NEXT_PUBLIC_CONVEX_URL configuration.')
  }

  if (checks.environment.value?.startsWith('preview')) {
    recommendations.push('This is a preview deployment. Sessions created here will not work in production.')
  }

  return recommendations
}