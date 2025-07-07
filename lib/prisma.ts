import { PrismaClient } from './generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

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
  
  // Type-safe event listener for query logging
  (prisma as { $on: (event: 'query', callback: (e: QueryEvent) => void) => void }).$on('query', (e) => {
    const duration = Number(e.duration)
    
    // Log very slow queries (>500ms) with red error
    if (duration > 500) {
      console.error(`🚨 Very Slow Query (${duration}ms):`, e.query)
      if (e.params && e.params !== '[]') {
        console.error('   Params:', e.params)
      }
    }
    // Log slow queries (>100ms) with yellow warning
    else if (duration > 100) {
      console.warn(`🐌 Slow Query (${duration}ms):`, e.query)
      if (e.params && e.params !== '[]') {
        console.warn('   Params:', e.params)
      }
    } 
    // Log all queries with performance timing in development (truncated for readability)
    else {
      console.log(`⚡ Query (${duration}ms):`, e.query.slice(0, 80) + (e.query.length > 80 ? '...' : ''))
    }
  })
}

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export { prisma }