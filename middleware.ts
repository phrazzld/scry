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
      // Redirect to sign in page if no session token
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protected routes that require authentication
    '/create',
    '/quizzes',
    '/quizzes/:path*',
    '/settings',
    '/settings/:path*',
    '/profile',
    '/profile/:path*',
  ],
}