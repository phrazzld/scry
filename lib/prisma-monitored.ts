// Import the existing Prisma instance
import { performanceMonitor } from './performance-monitor'

// Import the existing Prisma instance and use it directly
import { prisma as basePrisma } from './prisma'

// For now, use the base Prisma client
// Performance monitoring will be added via middleware in a future iteration
export function createMonitoredPrismaClient() {
  return basePrisma
}

// Export enhanced Prisma client
export const prismaMonitored = createMonitoredPrismaClient()

// Utility functions for common database operations with monitoring
export const databaseOperations = {
  // User operations
  async createUser(data: { email: string; name?: string }) {
    return performanceMonitor.trackDatabase(
      'user.create',
      () => prismaMonitored.user.create({ data }),
      { operation: 'create', model: 'user' }
    )
  },

  async findUserByEmail(email: string) {
    return performanceMonitor.trackDatabase(
      'user.findByEmail',
      () => prismaMonitored.user.findUnique({ 
        where: { email },
        include: { accounts: true, sessions: true }
      }),
      { operation: 'findUnique', model: 'user', hasEmail: true }
    )
  },

  async findUserById(id: string) {
    return performanceMonitor.trackDatabase(
      'user.findById',
      () => prismaMonitored.user.findUnique({ 
        where: { id },
        include: { accounts: true }
      }),
      { operation: 'findUnique', model: 'user' }
    )
  },

  // Account operations
  async findAccountByProvider(userId: string, provider: string) {
    return performanceMonitor.trackDatabase(
      'account.findByProvider',
      () => prismaMonitored.account.findFirst({
        where: { userId, provider }
      }),
      { operation: 'findFirst', model: 'account', provider }
    )
  },

  // Session operations
  async createSession(data: { sessionToken: string; userId: string; expires: Date }) {
    return performanceMonitor.trackDatabase(
      'session.create',
      () => prismaMonitored.session.create({ data }),
      { operation: 'create', model: 'session' }
    )
  },

  async findSessionByToken(sessionToken: string) {
    return performanceMonitor.trackDatabase(
      'session.findByToken',
      () => prismaMonitored.session.findUnique({
        where: { sessionToken },
        include: { user: true }
      }),
      { operation: 'findUnique', model: 'session' }
    )
  },

  async updateSession(sessionToken: string, data: Partial<{ expires: Date }>) {
    return performanceMonitor.trackDatabase(
      'session.update',
      () => prismaMonitored.session.update({
        where: { sessionToken },
        data
      }),
      { operation: 'update', model: 'session' }
    )
  },

  async deleteSession(sessionToken: string) {
    return performanceMonitor.trackDatabase(
      'session.delete',
      () => prismaMonitored.session.delete({
        where: { sessionToken }
      }),
      { operation: 'delete', model: 'session' }
    )
  },

  // Quiz operations
  // Note: Quiz operations will be added when quiz models are implemented
  // These are placeholder functions for when the quiz models are available

  // Verification token operations (for email magic links)
  async createVerificationToken(data: {
    identifier: string
    token: string
    expires: Date
  }) {
    return performanceMonitor.trackDatabase(
      'verificationToken.create',
      () => prismaMonitored.verificationToken.create({ data }),
      { operation: 'create', model: 'verificationToken' }
    )
  },

  async findVerificationToken(identifier: string, token: string) {
    return performanceMonitor.trackDatabase(
      'verificationToken.find',
      () => prismaMonitored.verificationToken.findUnique({
        where: { identifier_token: { identifier, token } }
      }),
      { operation: 'findUnique', model: 'verificationToken' }
    )
  },

  async deleteVerificationToken(identifier: string, token: string) {
    return performanceMonitor.trackDatabase(
      'verificationToken.delete',
      () => prismaMonitored.verificationToken.delete({
        where: { identifier_token: { identifier, token } }
      }),
      { operation: 'delete', model: 'verificationToken' }
    )
  },

  // Performance analytics
  async getSlowQueries(since?: Date) {
    const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    return performanceMonitor.getMetrics({
      type: 'database',
      since: sinceDate
    }).filter(metric => metric.duration > 1000) // Queries > 1 second
  },

  // Health check for database performance
  async getDatabaseHealth() {
    const stats = performanceMonitor.getStats('database', new Date(Date.now() - 10 * 60 * 1000))
    
    return {
      healthy: stats.successRate > 95 && stats.averageDuration < 1000,
      stats,
      issues: [
        ...(stats.successRate <= 95 ? [`Low success rate: ${stats.successRate}%`] : []),
        ...(stats.averageDuration >= 1000 ? [`High average duration: ${stats.averageDuration}ms`] : []),
        ...(stats.criticalOperations > 0 ? [`${stats.criticalOperations} critical slow operations`] : [])
      ]
    }
  }
}

// Export for backward compatibility (gradually migrate to monitoredClient)
export { prismaMonitored as prisma }