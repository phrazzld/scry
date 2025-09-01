import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { getDeploymentEnvironment } from '@/lib/environment'

const SESSION_TOKEN_KEY = 'scry_session_token'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if the request is for a protected route
  const isProtectedRoute = config.matcher.some(pattern => {
    if (pattern.endsWith(':path*')) {
      const basePattern = pattern.replace(':path*', '')
      return pathname.startsWith(basePattern)
    }
    return pathname === pattern
  })
  
  if (isProtectedRoute) {
    // Check for session token in cookies
    const sessionToken = request.cookies.get(SESSION_TOKEN_KEY)
    
    if (!sessionToken) {
      // Redirect to homepage with auth parameter to trigger auth modal
      const homeUrl = new URL('/', request.url)
      homeUrl.searchParams.set('auth', 'required')
      homeUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(homeUrl)
    }
    
    // Validate token with Convex
    try {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
      const environment = getDeploymentEnvironment()
      const session = await convex.query(api.auth.validateSession, { 
        sessionToken: sessionToken.value,
        environment
      })
      
      if (!session || !session.isValid) {
        // Invalid session - redirect to auth
        const homeUrl = new URL('/', request.url)
        homeUrl.searchParams.set('auth', 'required')
        homeUrl.searchParams.set('from', pathname)
        return NextResponse.redirect(homeUrl)
      }
    } catch (error) {
      // On any error, fail closed - redirect to auth
      console.error('Session validation error:', error)
      const homeUrl = new URL('/', request.url)
      homeUrl.searchParams.set('auth', 'required')
      homeUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(homeUrl)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protected routes that require authentication
    '/settings',
    '/settings/:path*',
  ],
}