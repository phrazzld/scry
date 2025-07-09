import NextAuth, { NextAuthOptions, User, Account, Profile, Session } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import { JWT } from 'next-auth/jwt'
import { prismaMonitored } from './prisma-monitored'
import { performanceMonitor } from './performance-monitor'
import { authLogger, loggers } from './logger'

// Enhanced email provider with performance monitoring
function createMonitoredEmailProvider() {
  return EmailProvider({
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
    
    // Override sendVerificationRequest to add performance monitoring
    async sendVerificationRequest({ identifier: email, url, provider }) {
      return performanceMonitor.trackEmail(
        'send_magic_link',
        async () => {
          const { host } = new URL(url)
          
          // Import nodemailer dynamically to avoid issues
          const nodemailer = await import('nodemailer')
          
          const transport = nodemailer.createTransport(provider.server)
          
          await transport.sendMail({
            to: email,
            from: provider.from,
            subject: `Sign in to ${host}`,
            text: `Sign in to ${host}\n${url}\n\n`,
            html: `
              <body>
                <h2>Sign in to ${host}</h2>
                <p>Click the link below to sign in:</p>
                <p><a href="${url}">Sign in</a></p>
                <p>If you did not request this email you can safely ignore it.</p>
              </body>
            `,
          })
        },
        {
          email: email.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]'),
          host: new URL(url).host
        }
      )
    }
  })
}

// Use the base Prisma adapter with monitoring in the actual database operations
// The monitoring happens at the Prisma level via the monitored client

// Type for signIn event message
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

// Enhanced auth options with performance monitoring
export const authOptionsMonitored: NextAuthOptions = {
  adapter: PrismaAdapter(prismaMonitored),
  
  providers: [
    createMonitoredEmailProvider(),
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
      return performanceMonitor.trackSession(
        'callback.jwt',
        async () => {
          // On sign-in, add user id to the token
          if (user) {
            token.id = user.id
          }
          return token
        },
        { hasUser: !!user, hasToken: !!token }
      )
    },
    
    async session({ session, token }) {
      return performanceMonitor.trackSession(
        'callback.session',
        async () => {
          // Add user id to the session from the token
          if (session?.user) {
            session.user.id = token.id as string
          }
          return session
        },
        { hasSession: !!session, hasToken: !!token }
      )
    },
    
    async redirect({ url, baseUrl }) {
      return performanceMonitor.trackSession(
        'callback.redirect',
        async () => {
          // Allows relative callback URLs
          if (url.startsWith('/')) return `${baseUrl}${url}`
          // Allows callback URLs on the same origin
          else if (new URL(url).origin === baseUrl) return url
          return baseUrl
        },
        { url: url.substring(0, 100), baseUrl } // Truncate URL for logging
      )
    },
  },
  
  // Enhanced event logging with performance tracking
  events: {
    signIn(message: SignInEventMessage) {
      if (message.error) {
        // Track failed sign-in performance
        performanceMonitor.trackEmail(
          'signin.failure',
          async () => {
            // Use centralized error logging utility
            loggers.error(
              message.error!,
              'auth',
              {
                event: 'next-auth.signin.failure',
                errorType: message.error!.name?.includes('Email') ? 'EMAIL_PROVIDER' : 
                          message.error!.name?.includes('SMTP') ? 'SMTP_CONNECTION' :
                          'code' in message.error! && message.error!.code === 'EMAIL_SEND_ERROR' ? 'EMAIL_SEND' :
                          message.error!.cause && typeof message.error!.cause === 'object' && 'statusCode' in message.error!.cause && message.error!.cause.statusCode === 429 ? 'RATE_LIMIT' : 'UNKNOWN',
              },
              `NextAuth.js Sign In Error: ${message.error!.name} - ${message.error!.message}`
            )
          }
        ).catch(() => {
          // If performance tracking fails, still log the error directly
          loggers.error(
            message.error!,
            'auth',
            { event: 'next-auth.signin.failure' },
            `NextAuth.js Sign In Error: ${message.error!.name} - ${message.error!.message}`
          )
        })
      } else if (process.env.NODE_ENV === 'development') {
        // Track successful sign-in performance (development only)
        performanceMonitor.trackSession(
          'signin.success',
          async () => {
            authLogger.debug({
              event: 'next-auth.signin.success',
              user: {
                id: message.user?.id,
                hasEmail: !!message.user?.email,
              },
              account: message.account ? {
                provider: message.account.provider,
                type: message.account.type,
              } : undefined,
            }, 'NextAuth.js Sign In Success')
          }
        ).catch(() => {
          // Fallback to direct logging
          authLogger.debug({
            event: 'next-auth.signin.success',
            user: {
              id: message.user?.id,
              hasEmail: !!message.user?.email,
            },
          }, 'NextAuth.js Sign In Success')
        })
      }
    },

    async createUser(message: { user: User }) {
      performanceMonitor.trackSession(
        'event.createUser',
        async () => {
          authLogger.info({
            event: 'next-auth.user.created',
            user: {
              id: message.user.id,
              hasEmail: !!message.user.email,
              hasName: !!message.user.name
            }
          }, 'New user created')
        }
      ).catch(() => {
        authLogger.info({
          event: 'next-auth.user.created',
          user: { id: message.user.id }
        }, 'New user created')
      })
    },

    async session(message: { session: Session; token: JWT }) {
      // Only track session events in development to avoid excessive logging
      if (process.env.NODE_ENV === 'development') {
        performanceMonitor.trackSession(
          'event.session',
          async () => {
            authLogger.debug({
              event: 'next-auth.session.accessed',
              user: {
                id: message.session.user?.id,
                hasEmail: !!message.session.user?.email
              }
            }, 'Session accessed')
          }
        ).catch(() => {
          // Silent failure for session events to avoid noise
        })
      }
    }
  },
  
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

// Create monitored NextAuth instance
const handler = NextAuth(authOptionsMonitored)

// Export handlers for route.ts
export { handler as GET, handler as POST }

// Auth performance utilities
export const authPerformance = {
  // Get auth system performance stats
  getAuthStats() {
    const emailStats = performanceMonitor.getStats('email', new Date(Date.now() - 10 * 60 * 1000))
    const sessionStats = performanceMonitor.getStats('session', new Date(Date.now() - 10 * 60 * 1000))
    
    return {
      email: emailStats,
      session: sessionStats,
      overall: {
        healthy: emailStats.successRate > 90 && sessionStats.successRate > 95,
        issues: [
          ...(emailStats.successRate <= 90 ? [`Email success rate low: ${emailStats.successRate}%`] : []),
          ...(sessionStats.successRate <= 95 ? [`Session success rate low: ${sessionStats.successRate}%`] : []),
          ...(emailStats.averageDuration > 5000 ? [`Email operations slow: ${emailStats.averageDuration}ms avg`] : []),
          ...(sessionStats.averageDuration > 2000 ? [`Session operations slow: ${sessionStats.averageDuration}ms avg`] : [])
        ]
      }
    }
  },

  // Get recent auth performance metrics
  getRecentMetrics(minutes = 10) {
    const since = new Date(Date.now() - minutes * 60 * 1000)
    
    return {
      email: performanceMonitor.getMetrics({ type: 'email', since, limit: 50 }),
      session: performanceMonitor.getMetrics({ type: 'session', since, limit: 50 })
    }
  },

  // Get slow auth operations
  getSlowOperations(minutes = 60) {
    const since = new Date(Date.now() - minutes * 60 * 1000)
    const allMetrics = [
      ...performanceMonitor.getMetrics({ type: 'email', since }),
      ...performanceMonitor.getMetrics({ type: 'session', since })
    ]
    
    return allMetrics
      .filter(metric => metric.duration > 2000) // > 2 seconds
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20) // Top 20 slowest
  }
}

// For backward compatibility with existing code
export { authOptionsMonitored as authOptions }