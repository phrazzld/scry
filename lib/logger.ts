import pino from 'pino';

// Utility to generate UUID that works in both Node.js and browser
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    // Browser or Node.js with Web Crypto API
    return crypto.randomUUID();
  }
  // Fallback for older environments (shouldn't happen in modern Next.js)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Define application-specific log contexts
export type LogContext =
  | 'auth'
  | 'api'
  | 'database'
  | 'ai'
  | 'email'
  | 'quiz'
  | 'user'
  | 'security'
  | 'performance'
  | 'system'
  | 'concepts';

// Enhanced log levels for application-specific events
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Standard log metadata interface
export interface LogMetadata {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  path?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

// Create base logger configuration
const createBaseLogger = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return pino({
    // Set appropriate log level based on environment
    level: isDevelopment ? 'debug' : isProduction ? 'info' : 'info',

    // Custom formatters for log structure
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        app: 'scry',
        version: process.env.npm_package_version || '0.1.0',
      }),
    },

    // Use high-precision timestamps
    timestamp: pino.stdTimeFunctions.isoTime,

    // Enhanced serializers for security and error handling
    serializers: {
      // Error serialization with stack trace and cause chain
      error: (err: Error & { cause?: unknown; code?: string }) => ({
        name: err.name,
        message: err.message,
        code: err.code,
        stack: isDevelopment ? err.stack : undefined, // Stack traces only in dev
        cause: err.cause
          ? {
              name: (err.cause as Error)?.name,
              message: (err.cause as Error)?.message,
              code: (err.cause as Record<string, unknown>)?.code,
              statusCode: (err.cause as Record<string, unknown>)?.statusCode,
              // Redact sensitive data from API responses
              response:
                typeof (err.cause as Record<string, unknown>)?.response === 'string'
                  ? ((err.cause as Record<string, unknown>).response as string).replace(
                      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                      '[EMAIL_REDACTED]'
                    )
                  : (err.cause as Record<string, unknown>)?.response,
            }
          : undefined,
      }),

      // Request serialization with sensitive data redaction
      req: (req: Record<string, unknown>) => ({
        method: req.method,
        url: req.url,
        path: req.path,
        headers: {
          'user-agent': (req.headers as Record<string, unknown>)?.['user-agent'],
          'content-type': (req.headers as Record<string, unknown>)?.['content-type'],
          accept: (req.headers as Record<string, unknown>)?.['accept'],
          // Explicitly exclude authorization headers and cookies
        },
        query: req.query,
        ip: req.ip || (req.connection as Record<string, unknown>)?.remoteAddress,
      }),

      // Response serialization
      res: (res: Record<string, unknown>) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type':
            res.getHeader && typeof res.getHeader === 'function'
              ? res.getHeader('content-type')
              : undefined,
          'content-length':
            res.getHeader && typeof res.getHeader === 'function'
              ? res.getHeader('content-length')
              : undefined,
        },
      }),

      // User serialization (minimal PII)
      user: (user: { id?: string; email?: string; name?: string }) => ({
        id: user.id,
        hasEmail: !!user.email,
        hasName: !!user.name,
      }),
    },

    // Base metadata for all logs
    base: {
      pid: process.pid,
      hostname: 'scry-server',
      app: 'scry',
      env: process.env.NODE_ENV || 'development',
    },
  });
};

// Create singleton base logger instance
const baseLogger = createBaseLogger();

// Export base logger for direct use
export { baseLogger as logger };

// Context-specific logger factory
export function createContextLogger(context: LogContext, metadata: Partial<LogMetadata> = {}) {
  return baseLogger.child({
    context,
    ...metadata,
  });
}

// Request-scoped logger with correlation ID
export function createRequestLogger(
  context: LogContext,
  req?: {
    method?: string;
    url?: string;
    path?: string;
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
  },
  additionalMetadata: Partial<LogMetadata> = {}
) {
  const requestId = generateUUID();
  const metadata: LogMetadata = {
    requestId,
    method: req?.method,
    path: req?.path || req?.url,
    userAgent: Array.isArray(req?.headers?.['user-agent'])
      ? req.headers['user-agent'][0]
      : req?.headers?.['user-agent'],
    ip: req?.ip,
    ...additionalMetadata,
  };

  return baseLogger.child({
    context,
    ...metadata,
  });
}

// Pre-configured loggers for common application domains
export const authLogger = createContextLogger('auth');
export const apiLogger = createContextLogger('api');
export const databaseLogger = createContextLogger('database');
export const aiLogger = createContextLogger('ai');
export const emailLogger = createContextLogger('email');
export const quizLogger = createContextLogger('quiz');
export const userLogger = createContextLogger('user');
export const securityLogger = createContextLogger('security');
export const performanceLogger = createContextLogger('performance');
export const systemLogger = createContextLogger('system');
export const conceptsLogger = createContextLogger('concepts', {
  domains: ['ai', 'database'],
});

// Utility functions for common logging patterns
export const loggers = {
  // Performance timing utilities
  time: (label: string, context: LogContext = 'performance') => {
    const logger = createContextLogger(context);
    const start = performance.now();

    return {
      end: (metadata?: Partial<LogMetadata>) => {
        const duration = Math.round(performance.now() - start);
        logger.info(
          {
            event: 'performance.timer',
            timer: label,
            duration,
            ...metadata,
          },
          `Timer "${label}" completed in ${duration}ms`
        );

        return duration;
      },
    };
  },

  // Error logging with automatic categorization
  error: (error: Error, context: LogContext, metadata?: Partial<LogMetadata>, message?: string) => {
    const logger = createContextLogger(context);
    const errorType = error.name?.includes('Email')
      ? 'EMAIL_ERROR'
      : error.name?.includes('SMTP')
        ? 'SMTP_ERROR'
        : error.name?.includes('Database')
          ? 'DATABASE_ERROR'
          : error.name?.includes('Auth')
            ? 'AUTH_ERROR'
            : 'UNKNOWN_ERROR';

    logger.error(
      {
        error,
        errorType,
        event: `${context}.error`,
        ...metadata,
      },
      message || `${context} error: ${error.message}`
    );
  },

  // User action logging
  userAction: (action: string, userId: string, metadata?: Partial<LogMetadata>) => {
    userLogger.info(
      {
        event: 'user.action',
        action,
        userId,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      `User action: ${action}`
    );
  },

  // Security event logging
  securityEvent: (
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Partial<LogMetadata>
  ) => {
    const level =
      severity === 'critical'
        ? 'fatal'
        : severity === 'high'
          ? 'error'
          : severity === 'medium'
            ? 'warn'
            : 'info';

    securityLogger[level](
      {
        event: 'security.event',
        securityEvent: event,
        severity,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      `Security event: ${event} (${severity})`
    );
  },

  // API endpoint logging
  apiRequest: (
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    metadata?: Partial<LogMetadata>
  ) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    apiLogger[level](
      {
        event: 'api.request',
        method,
        path,
        statusCode,
        duration,
        ...metadata,
      },
      `${method} ${path} ${statusCode} ${duration}ms`
    );
  },
};

// Environment-specific logger configuration
export const getLoggerConfig = () => ({
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  logLevel: baseLogger.level,
  pinoVersion: '9.7.0', // Hard-coded version to avoid require()
});

// Export types for external use
export type {
  LogContext as LogContextType,
  LogLevel as LogLevelType,
  LogMetadata as LogMetadataType,
};
