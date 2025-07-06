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

// Instantiate the PrismaClient, reusing the instance in development
const prisma = globalThis.prisma ?? new PrismaClient({ 
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : []
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export { prisma }