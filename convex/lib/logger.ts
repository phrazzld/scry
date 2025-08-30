/**
 * Convex-compatible structured logger
 * 
 * Since Convex functions run in a constrained environment without access to Node.js modules,
 * this provides a simple structured logging utility that works within Convex's runtime.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  event?: string;
  [key: string]: unknown;
}

/**
 * Determines if logging should be enabled based on environment
 */
function shouldLog(level: LogLevel): boolean {
  // In production, only log info and above
  if (process.env.NODE_ENV === 'production') {
    return level !== 'debug';
  }
  return true;
}

/**
 * Formats log message with structured data
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...context,
  };
  
  // In development, pretty print for readability
  if (process.env.NODE_ENV === 'development') {
    return JSON.stringify(logData, null, 2);
  }
  
  // In production, use compact JSON for log aggregation
  return JSON.stringify(logData);
}

/**
 * Convex-compatible logger
 */
export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) {
      console.log(formatLog('debug', message, context));
    }
  },
  
  info(message: string, context?: LogContext) {
    if (shouldLog('info')) {
      console.log(formatLog('info', message, context));
    }
  },
  
  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, context));
    }
  },
  
  error(message: string, error?: Error | unknown, context?: LogContext) {
    if (shouldLog('error')) {
      const errorContext: LogContext = {
        ...context,
        event: context?.event || 'error',
      };
      
      if (error instanceof Error) {
        errorContext.errorName = error.name;
        errorContext.errorMessage = error.message;
        errorContext.errorStack = error.stack;
      } else if (error) {
        errorContext.error = error;
      }
      
      console.error(formatLog('error', message, errorContext));
    }
  }
};

/**
 * Create a logger with a specific context
 */
export function createLogger(defaultContext: Partial<LogContext>) {
  return {
    debug: (message: string, context?: LogContext) => 
      logger.debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) => 
      logger.info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) => 
      logger.warn(message, { ...defaultContext, ...context }),
    error: (message: string, error?: Error | unknown, context?: LogContext) => 
      logger.error(message, error, { ...defaultContext, ...context }),
  };
}