import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Middleware logic can be added here if needed
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
)

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