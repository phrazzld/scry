/**
 * Development Authentication API Tests
 * 
 * Critical security tests for the development authentication API endpoint
 * to ensure it's completely disabled in production environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from './route'

// Type for process.env to avoid any usage
interface ProcessEnv {
  NODE_ENV?: string
  [key: string]: string | undefined
}

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}))

vi.mock('@/lib/dev-auth', () => ({
  isDevAuthAvailable: vi.fn(),
  getTestUser: vi.fn(),
  getDevAuthStatus: vi.fn(),
  DEV_TEST_USERS: {
    admin: { email: 'admin@dev.local', name: 'Dev Admin', role: 'admin' },
    user: { email: 'user@dev.local', name: 'Dev User', role: 'user' },
    tester: { email: 'tester@dev.local', name: 'Dev Tester', role: 'tester' }
  },
  validateProductionSafety: vi.fn()
}))

vi.mock('@/lib/logger', () => ({
  authLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
  },
  loggers: {
    error: vi.fn()
  }
}))

// Import mocked modules
import { getServerSession } from 'next-auth'
import { isDevAuthAvailable, getTestUser, getDevAuthStatus } from '@/lib/dev-auth'
import { authLogger, loggers } from '@/lib/logger'

describe('Development Authentication API Security', () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalNodeEnv) {
      (process.env as ProcessEnv).NODE_ENV = originalNodeEnv
    } else {
      delete (process.env as ProcessEnv).NODE_ENV
    }
  })

  describe('Production Security - Critical Tests', () => {
    beforeEach(() => {
      (process.env as ProcessEnv).NODE_ENV = 'production'
      vi.mocked(isDevAuthAvailable).mockReturnValue(false)
    })

    describe('GET /api/dev-auth', () => {
      it('should deny access in production environment', async () => {
        const response = await GET()
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.error).toContain('Development authentication is not available')
        expect(authLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'dev-auth.api.production-access',
            environment: 'production'
          }),
          expect.stringContaining('production')
        )
      })
    })

    describe('POST /api/dev-auth', () => {
      it('should deny sign-in attempts in production', async () => {
        const request = new NextRequest('http://localhost:3000/api/dev-auth', {
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.error).toContain('Development authentication is not available')
        expect(authLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'dev-auth.api.signin-production-attempt',
            environment: 'production'
          }),
          expect.stringContaining('production')
        )
      })
    })

    describe('DELETE /api/dev-auth', () => {
      it('should deny sign-out attempts in production', async () => {
        const response = await DELETE()
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.error).toContain('Development authentication is not available')
      })
    })
  })

  describe('Development Functionality', () => {
    beforeEach(() => {
      (process.env as ProcessEnv).NODE_ENV = 'development'
      vi.mocked(isDevAuthAvailable).mockReturnValue(true)
      vi.mocked(getServerSession).mockResolvedValue(null)
      vi.mocked(getDevAuthStatus).mockReturnValue({
        available: true,
        environment: 'development',
        testUsers: ['admin', 'user', 'tester'],
        timestamp: new Date().toISOString()
      })
    })

    describe('GET /api/dev-auth', () => {
      it('should return development auth status', async () => {
        const response = await GET()
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.status).toBe('available')
        expect(data.environment).toBe('development')
        expect(data.testUsers).toEqual(['admin', 'user', 'tester'])
        expect(data.shortcuts).toBeDefined()
      })

      it('should include current session if authenticated', async () => {
        const mockSession = {
          user: {
            id: 'test-id',
            email: 'test@dev.local',
            name: 'Test User',
            role: 'user'
          }
        }
        vi.mocked(getServerSession).mockResolvedValue(mockSession as never)

        const response = await GET()
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.currentSession).toBeDefined()
        expect(data.currentSession.user.email).toBe('test@dev.local')
        expect(data.currentSession.authenticated).toBe(true)
      })

      it('should handle errors gracefully', async () => {
        vi.mocked(getDevAuthStatus).mockImplementation(() => {
          throw new Error('Test error')
        })

        const response = await GET()
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to get development auth status')
        expect(loggers.error).toHaveBeenCalled()
      })
    })

    describe('POST /api/dev-auth', () => {
      it('should handle test user sign-in', async () => {
        const mockUser = {
          id: 'dev-admin-123',
          email: 'admin@dev.local',
          name: 'Dev Admin',
          role: 'admin' as const
        }
        vi.mocked(getTestUser).mockReturnValue(mockUser)

        const request = new NextRequest('http://localhost:3000/api/dev-auth', {
          method: 'POST',
          body: JSON.stringify({ testUser: 'admin' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.user.email).toBe('admin@dev.local')
        expect(getTestUser).toHaveBeenCalledWith('admin')
      })

      it('should handle custom user sign-in', async () => {
        const request = new NextRequest('http://localhost:3000/api/dev-auth', {
          method: 'POST',
          body: JSON.stringify({ 
            email: 'custom@dev.local',
            name: 'Custom User'
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.user.email).toBe('custom@dev.local')
        expect(data.user.name).toBe('Custom User')
      })

      it('should validate email format', async () => {
        const request = new NextRequest('http://localhost:3000/api/dev-auth', {
          method: 'POST',
          body: JSON.stringify({ email: 'invalid-email' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid email format')
      })

      it('should reject invalid test user types', async () => {
        const request = new NextRequest('http://localhost:3000/api/dev-auth', {
          method: 'POST',
          body: JSON.stringify({ testUser: 'invalid' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toContain('Invalid test user type')
      })

      it('should require email or testUser', async () => {
        const request = new NextRequest('http://localhost:3000/api/dev-auth', {
          method: 'POST',
          body: JSON.stringify({})
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Either email or testUser is required')
      })

      it('should handle JSON parsing errors', async () => {
        const request = new NextRequest('http://localhost:3000/api/dev-auth', {
          method: 'POST',
          body: 'invalid-json'
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to process development authentication')
      })
    })

    describe('DELETE /api/dev-auth', () => {
      it('should handle sign-out request', async () => {
        const mockSession = {
          user: { 
            email: 'test@dev.local',
            role: 'user' as const
          }
        }
        vi.mocked(getServerSession).mockResolvedValue(mockSession as never)

        const response = await DELETE()
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.message).toContain('sign-out initiated')
      })

      it('should handle sign-out without session', async () => {
        vi.mocked(getServerSession).mockResolvedValue(null)

        const response = await DELETE()
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      it('should handle errors gracefully', async () => {
        vi.mocked(getServerSession).mockRejectedValue(new Error('Test error'))

        const response = await DELETE()
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to process development sign-out')
      })
    })
  })

  describe('Test Environment Behavior', () => {
    beforeEach(() => {
      (process.env as ProcessEnv).NODE_ENV = 'test'
      vi.mocked(isDevAuthAvailable).mockReturnValue(false)
    })

    it('should deny access in test environment', async () => {
      const response = await GET()
      expect(response.status).toBe(403)
    })

    it('should deny POST requests in test environment', async () => {
      const request = new NextRequest('http://localhost:3000/api/dev-auth', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('should deny DELETE requests in test environment', async () => {
      const response = await DELETE()
      expect(response.status).toBe(403)
    })
  })

  describe('Security Boundary Tests', () => {
    it('should maintain security across environment changes', async () => {
      // Start in development
      const originalEnv = process.env.NODE_ENV
      
      // Test development environment
      ;(process.env as ProcessEnv).NODE_ENV = 'development'
      vi.mocked(isDevAuthAvailable).mockReturnValue(true)
      vi.mocked(getServerSession).mockResolvedValue(null)
      vi.mocked(getDevAuthStatus).mockReturnValue({
        available: true,
        environment: 'development',
        testUsers: ['admin', 'user', 'tester'],
        timestamp: new Date().toISOString()
      })
      
      let response = await GET()
      expect(response.status).toBe(200)

      // Switch to production
      ;(process.env as ProcessEnv).NODE_ENV = 'production'
      vi.mocked(isDevAuthAvailable).mockReturnValue(false)
      
      response = await GET()
      expect(response.status).toBe(403)
      
      // Restore environment
      ;(process.env as ProcessEnv).NODE_ENV = originalEnv
    })

    it('should log security violations consistently', async () => {
      (process.env as ProcessEnv).NODE_ENV = 'production'
      vi.mocked(isDevAuthAvailable).mockReturnValue(false)

      await GET()
      await POST(new NextRequest('http://localhost:3000/api/dev-auth', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      }))

      // Should have logged multiple security violations
      expect(authLogger.error).toHaveBeenCalledTimes(2)
      expect(authLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'dev-auth.api.production-access'
        }),
        expect.any(String)
      )
      expect(authLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'dev-auth.api.signin-production-attempt'
        }),
        expect.any(String)
      )
    })
  })

  describe('Input Validation and Sanitization', () => {
    beforeEach(() => {
      (process.env as ProcessEnv).NODE_ENV = 'development'
      vi.mocked(isDevAuthAvailable).mockReturnValue(true)
    })

    it('should handle various email formats correctly', async () => {
      const validEmails = [
        'test@dev.local',
        'user.name@example.com',
        'test+tag@domain.co.uk'
      ]

      for (const email of validEmails) {
        const request = new NextRequest('http://localhost:3000/api/dev-auth', {
          method: 'POST',
          body: JSON.stringify({ email })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.user.email).toBe(email)
      }
    })

    it('should sanitize user input for ID generation', async () => {
      const request = new NextRequest('http://localhost:3000/api/dev-auth', {
        method: 'POST',
        body: JSON.stringify({ 
          email: 'test+special@dev.local',
          name: 'Test User'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.user.id).toMatch(/^dev-testspecialdevlocal-\d+$/)
    })
  })
})