// Enhanced Prisma client with Neon adapter and performance monitoring
import { PrismaClient } from './generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import { databaseLogger } from './logger'

// Extend the global scope to include a cached PrismaClient
declare const globalThis: {
  prisma: PrismaClient | undefined
} & typeof global

// Create a new Neon DB pool
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined')
}

// For Node.js environments, specify the WebSocket constructor
neonConfig.webSocketConstructor = ws

// Create a new Prisma adapter using the pool configuration
const adapter = new PrismaNeon({ connectionString })

// Create Prisma client with enhanced logging configuration
const createPrismaClient = () => {
  if (process.env.NODE_ENV === 'development') {
    return new PrismaClient({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' }
      ]
    })
  } else {
    return new PrismaClient({ adapter })
  }
}

// Instantiate the PrismaClient, reusing the instance in development
const prisma = globalThis.prisma ?? createPrismaClient()

// Add performance monitoring for queries in development
if (process.env.NODE_ENV === 'development') {
  // Define query event interface
  interface QueryEvent {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }
  
  // Type-safe event listener for query logging with structured logging
  (prisma as { $on: (event: 'query', callback: (e: QueryEvent) => void) => void }).$on('query', (e) => {
    const duration = Number(e.duration)
    const queryPreview = e.query.slice(0, 80) + (e.query.length > 80 ? '...' : '')
    const hasParams = e.params && e.params !== '[]'
    
    // Log very slow queries (>500ms) as errors
    if (duration > 500) {
      databaseLogger.error({
        event: 'database.query.very-slow',
        duration,
        query: queryPreview,
        params: hasParams ? e.params : undefined,
        target: e.target,
        timestamp: e.timestamp
      }, `🚨 Very Slow Query (${duration}ms): ${queryPreview}`)
    }
    // Log slow queries (>100ms) as warnings
    else if (duration > 100) {
      databaseLogger.warn({
        event: 'database.query.slow',
        duration,
        query: queryPreview,
        params: hasParams ? e.params : undefined,
        target: e.target,
        timestamp: e.timestamp
      }, `🐌 Slow Query (${duration}ms): ${queryPreview}`)
    } 
    // Log fast queries (development only) as debug
    else {
      databaseLogger.debug({
        event: 'database.query.fast',
        duration,
        query: queryPreview,
        target: e.target,
        timestamp: e.timestamp
      }, `⚡ Query (${duration}ms): ${queryPreview}`)
    }
  })
}

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export { prisma }