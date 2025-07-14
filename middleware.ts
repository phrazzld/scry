import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_TOKEN_KEY = 'scry_session_token'

export function middleware(request: NextRequest) {
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
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protected routes that require authentication
    '/create',
    '/dashboard',
    '/quizzes',
    '/quizzes/:path*',
    '/settings',
    '/settings/:path*',
    '/profile',
    '/profile/:path*',
  ],
}