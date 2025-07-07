import NextAuth, { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST || 'smtp.resend.com',
        port: process.env.EMAIL_SERVER_PORT ? parseInt(process.env.EMAIL_SERVER_PORT) : 587,
        auth: {
          user: process.env.EMAIL_SERVER_USER || 'resend',
          pass: process.env.RESEND_API_KEY!,
        },
      },
      from: process.env.EMAIL_FROM!,
      maxAge: 60 * 60, // Magic link valid for 1 hour
    }),
  ],
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes idle timeout
    updateAge: 5 * 60, // Update session every 5 minutes
  },
  
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, add user id to the token
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      // Add user id to the session from the token
      if (session?.user) {
        session.user.id = token.id as string
      }
      return session
    },
    
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET,
  
  debug: process.env.NODE_ENV === 'development',
}

// Create NextAuth instance
const handler = NextAuth(authOptions)

// Export handlers for route.ts
export { handler as GET, handler as POST }

// For client components, import from 'next-auth/react':
// import { signIn, signOut, useSession } from 'next-auth/react'