import NextAuth, { NextAuthOptions, User, Account, Profile } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import { prisma } from './prisma'
import { authLogger, loggers } from './logger'
import { createDevAuthProvider, isDevAuthAvailable } from './dev-auth'

// Type for signIn event message that covers both success and error scenarios
type SignInEventMessage =
  | {
      user: User
      account: Account | null
      profile?: Profile
      isNewUser?: boolean
      error?: undefined
    }
  | {
      user?: User
      account?: Account | null
      profile?: Profile
      isNewUser?: boolean
      error: Error & { cause?: unknown }
    }

// Create providers array with conditional development shortcuts
const createProviders = () => {
  const providers = [
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
  ]

  // Add development authentication shortcuts only in development environment
  if (isDevAuthAvailable()) {
    try {
      providers.push(createDevAuthProvider() as never)
      authLogger.debug({
        event: 'auth.dev-provider-enabled',
        environment: process.env.NODE_ENV
      }, 'Development authentication shortcuts enabled')
    } catch (error) {
      authLogger.warn({
        event: 'auth.dev-provider-failed',
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to enable development authentication shortcuts')
    }
  }

  return providers
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  
  providers: createProviders(),
  
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
  
  // Comprehensive event logging for authentication
  events: {
    signIn(message: SignInEventMessage) {
      if (message.error) {
        // Use centralized error logging utility
        loggers.error(
          message.error,
          'auth',
          {
            event: 'next-auth.signin.failure',
            errorType: message.error.name?.includes('Email') ? 'EMAIL_PROVIDER' : 
                      message.error.name?.includes('SMTP') ? 'SMTP_CONNECTION' :
                      'code' in message.error && message.error.code === 'EMAIL_SEND_ERROR' ? 'EMAIL_SEND' :
                      message.error.cause && typeof message.error.cause === 'object' && 'statusCode' in message.error.cause && message.error.cause.statusCode === 429 ? 'RATE_LIMIT' : 'UNKNOWN',
          },
          `NextAuth.js Sign In Error: ${message.error.name} - ${message.error.message}`
        )
      } else if (process.env.NODE_ENV === 'development') {
        // Log successful sign-ins (in development only) for debugging
        authLogger.debug({
          event: 'next-auth.signin.success',
          user: {
            id: message.user?.id,
            // Never log email addresses - just indicate if email is present
            hasEmail: !!message.user?.email,
          },
          account: message.account ? {
            provider: message.account.provider,
            type: message.account.type,
          } : undefined,
        }, 'NextAuth.js Sign In Success')
      }
    }
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