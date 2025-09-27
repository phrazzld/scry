import { NextResponse } from 'next/server';

import { createContextLogger } from '@/lib/logger';

const healthLogger = createContextLogger('system');

export async function GET() {
  try {
    // Basic health check - no authentication required
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || '0.1.0',
    };

    healthLogger.debug(
      {
        event: 'health_check',
        status: 'success',
        uptime: healthStatus.uptime,
        memory: healthStatus.memory,
      },
      'Health check completed successfully'
    );

    return NextResponse.json(healthStatus, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    healthLogger.error(
      {
        event: 'health_check',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      },
      'Health check failed'
    );

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
