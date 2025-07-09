/**
 * Development Authentication Shortcuts
 * 
 * SECURITY WARNING: This module provides authentication shortcuts for development only.
 * All functions in this module MUST be disabled in production and will throw errors
 * if called outside of development environment.
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { authLogger } from './logger'

/**
 * Critical security check - ensures development features are disabled in production
 */
const validateDevelopmentEnvironment = () => {
  if (process.env.NODE_ENV !== 'development') {
    const error = new Error(
      'Development authentication shortcuts are strictly prohibited in production environment'
    )
    authLogger.error({
      event: 'dev-auth.production-access-attempt',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      securityViolation: true
    }, 'Attempted to use development authentication in production')
    throw error
  }
}

/**
 * Check if development authentication features are available
 */
export const isDevAuthAvailable = (): boolean => {
  return process.env.NODE_ENV === 'development'
}

/**
 * Common development test users for consistent testing
 */
export const DEV_TEST_USERS = {
  admin: {
    email: 'admin@dev.local',
    name: 'Dev Admin',
    role: 'admin'
  },
  user: {
    email: 'user@dev.local', 
    name: 'Dev User',
    role: 'user'
  },
  tester: {
    email: 'tester@dev.local',
    name: 'Dev Tester', 
    role: 'tester'
  }
} as const

/**
 * Create development authentication provider for NextAuth
 * Only available in development environment
 */
export const createDevAuthProvider = () => {
  validateDevelopmentEnvironment()
  
  return CredentialsProvider({
    id: 'dev-shortcut',
    name: 'Development Shortcut',
    credentials: {
      email: { 
        label: 'Email', 
        type: 'email',
        placeholder: 'user@dev.local'
      },
      name: { 
        label: 'Name', 
        type: 'text',
        placeholder: 'Dev User'
      }
    },
    async authorize(credentials) {
      // Double-check environment in authorize function
      validateDevelopmentEnvironment()
      
      if (!credentials?.email) {
        authLogger.warn({
          event: 'dev-auth.invalid-credentials',
          provided: !!credentials
        }, 'Dev auth attempt without email')
        return null
      }

      // Validate email format (basic check)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(credentials.email)) {
        authLogger.warn({
          event: 'dev-auth.invalid-email-format',
          email: credentials.email
        }, 'Dev auth attempt with invalid email format')
        return null
      }

      // Add microseconds to ensure uniqueness
      const timestamp = Date.now() + Math.floor(Math.random() * 1000)
      
      const user = {
        id: `dev-${credentials.email.replace(/[^a-zA-Z0-9]/g, '')}-${timestamp}`,
        email: credentials.email,
        name: credentials.name || credentials.email.split('@')[0],
        role: 'user'
      }

      authLogger.debug({
        event: 'dev-auth.user-created',
        userId: user.id,
        email: user.email,
        name: user.name
      }, 'Development user authenticated')

      return user
    }
  })
}

/**
 * Helper to create development user object
 */
export const createDevUser = (email: string, name?: string) => {
  validateDevelopmentEnvironment()
  
  if (!email) {
    throw new Error('Email is required for development user')
  }

  // Add microseconds to ensure uniqueness
  const timestamp = Date.now() + Math.floor(Math.random() * 1000)

  return {
    id: `dev-${email.replace(/[^a-zA-Z0-9]/g, '')}-${timestamp}`,
    email,
    name: name || email.split('@')[0],
    role: 'user'
  }
}

/**
 * Get a predefined development test user
 */
export const getTestUser = (userType: keyof typeof DEV_TEST_USERS) => {
  validateDevelopmentEnvironment()
  
  const user = DEV_TEST_USERS[userType]
  if (!user) {
    throw new Error(`Unknown test user type: ${userType}`)
  }
  
  return createDevUser(user.email, user.name)
}

/**
 * Development auth configuration that can be merged with production auth
 */
export const getDevAuthConfig = (): Partial<NextAuthOptions> => {
  validateDevelopmentEnvironment()
  
  return {
    providers: [createDevAuthProvider()],
    
    // Add development-specific page overrides if needed
    pages: {
      signIn: '/auth/dev-signin'  // Optional: separate dev sign-in page
    },
    
    // Enhanced debugging for development
    debug: true,
    
    callbacks: {
      async signIn({ user, account }) {
        // Log all dev sign-ins for debugging
        authLogger.debug({
          event: 'dev-auth.signin-attempt',
          userId: user.id,
          email: user.email,
          provider: account?.provider
        }, 'Development sign-in attempt')
        
        return true
      }
    }
  }
}

/**
 * Environment validation for tests
 */
export const validateProductionSafety = () => {
  if (process.env.NODE_ENV === 'production') {
    // In production, these functions should not be callable
    try {
      validateDevelopmentEnvironment()
      return false // Should never reach here in production
    } catch {
      return true // Expected to throw in production
    }
  }
  return true
}

/**
 * Development authentication status
 */
export const getDevAuthStatus = () => {
  return {
    available: isDevAuthAvailable(),
    environment: process.env.NODE_ENV,
    testUsers: Object.keys(DEV_TEST_USERS),
    timestamp: new Date().toISOString()
  }
}