# Logging Architecture

## Overview

Scry implements a comprehensive structured logging system using Pino.js, designed for production monitoring and debugging across the entire application stack.

## Architecture

### Central Logger (`lib/logger.ts`)
- **Base Logger**: Singleton pino instance with production-optimized configuration
- **Context Loggers**: Domain-specific child loggers for different application areas
- **Request Loggers**: Per-request loggers with correlation IDs for distributed tracing

### Log Contexts

| Context | Purpose | Usage |
|---------|---------|-------|
| `auth` | Authentication events | NextAuth callbacks, login attempts, session management |
| `api` | API endpoint logging | Request/response cycles, validation errors, performance |
| `database` | Database operations | Query performance, slow query detection, connection issues |
| `ai` | AI/ML operations | Quiz generation, model interactions, fallback behavior |
| `email` | Email operations | Send attempts, provider errors, delivery tracking |
| `quiz` | Quiz logic | Generation, scoring, user interactions |
| `user` | User actions | Profile changes, preferences, account operations |
| `security` | Security events | Rate limiting, suspicious activity, access control |
| `performance` | Performance metrics | Timing data, bottleneck identification |
| `system` | System events | Errors, startup, configuration |

## Features

### Structured Data
```typescript
// Example log entry
{
  "level": 30,
  "time": "2025-07-08T19:10:20.123Z",
  "context": "api",
  "event": "api.generate-quiz.success",
  "requestId": "req_abc123",
  "userId": "user_xyz789", 
  "topic": "javascript",
  "duration": 1250,
  "questionCount": 10,
  "msg": "Successfully generated 10 questions for javascript"
}
```

### Request Correlation
- **Request ID**: Unique UUID per request for tracing
- **User Context**: User ID included when available
- **Performance Timing**: Built-in request duration tracking
- **Error Chain**: Complete error cause tracking with stack traces (dev only)

### Security & Privacy
- **Email Redaction**: Automatic PII redaction in error messages
- **No Stack Traces**: Stack traces disabled in production
- **Selective Headers**: Only safe headers logged (User-Agent, Content-Type)
- **No Auth Tokens**: Authorization headers explicitly excluded

### Performance Optimizations
- **Environment-based Levels**: Debug in development, Info+ in production
- **Lazy Evaluation**: Expensive operations only run when log level permits
- **Efficient Serialization**: Custom serializers for common object types
- **Minimal Overhead**: Pino's high-performance JSON serialization

## Usage Patterns

### Basic Logging
```typescript
import { apiLogger } from '@/lib/logger'

apiLogger.info({
  event: 'user.action',
  userId: 'user_123',
  action: 'profile_update'
}, 'User updated profile')
```

### Request Logging
```typescript
import { createRequestLogger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const logger = createRequestLogger('api', {
    method: request.method,
    path: '/api/quiz',
    ip: request.headers.get('x-forwarded-for')
  })
  
  logger.info({ event: 'api.request.start' }, 'Processing quiz request')
}
```

### Error Logging
```typescript
import { loggers } from '@/lib/logger'

try {
  await riskyOperation()
} catch (error) {
  loggers.error(error, 'api', {
    event: 'api.operation.failed',
    operationType: 'quiz-generation'
  }, 'Quiz generation failed')
}
```

### Performance Timing
```typescript
import { loggers } from '@/lib/logger'

const timer = loggers.time('database.query', 'database')
const result = await complexQuery()
const duration = timer.end({ queryType: 'user-lookup' })
// Automatically logs: Query completed in 45ms
```

### Security Events
```typescript
import { loggers } from '@/lib/logger'

loggers.securityEvent('failed_login_attempt', 'medium', {
  ip: request.ip,
  userAgent: request.headers['user-agent'],
  attemptedEmail: '[REDACTED]'
})
```

## Configuration

### Environment-based Behavior
- **Development**: Debug level, stack traces, detailed query logging
- **Production**: Info level, no stack traces, error-only database logs
- **Test**: Silent or minimal logging

### Log Levels
- **trace (10)**: Verbose debugging information
- **debug (20)**: Development debugging
- **info (30)**: General information (default production level)
- **warn (40)**: Warning conditions
- **error (50)**: Error conditions
- **fatal (60)**: Fatal errors (triggers sync flush)

## Integration Points

### Current Integrations
- ✅ **Authentication System** (`lib/auth.ts`): Sign-in events, errors, user tracking
- ✅ **AI Client** (`lib/ai-client.ts`): Quiz generation timing, fallback behavior
- ✅ **Database Layer** (`lib/prisma.ts`): Query performance monitoring
- ✅ **API Routes** (`app/api/generate-questions/route.ts`): Request lifecycle tracking
- ✅ **Error Boundaries** (`app/error.tsx`): Unhandled error capture

### Planned Integrations
- **Rate Limiting**: Authentication attempt tracking
- **Email Service**: Delivery status and error tracking  
- **User Interface**: Client-side error reporting
- **Performance Monitoring**: Core Web Vitals integration

## Vercel Integration

### Automatic Collection
- All structured logs automatically collected by Vercel
- Available in deployment logs dashboard
- Real-time streaming with `vercel logs --prod --follow`

### Log Drains (Future)
- **DataDog**: Structured log forwarding for advanced analytics
- **LogRocket**: Session replay integration
- **Elastic Stack**: Search and aggregation capabilities

## Monitoring Queries

### Common Log Searches
```bash
# Authentication failures
vercel logs --prod | grep "auth.signin.failure"

# Slow database queries  
vercel logs --prod | grep "database.query.slow"

# API performance
vercel logs --prod | grep "api.request" | grep "duration"

# Security events
vercel logs --prod | grep "security.event"
```

### Performance Analysis
```bash
# Quiz generation performance
vercel logs --prod | grep "ai.quiz-generation" | grep "duration"

# Database query analysis
vercel logs --prod | grep "database.query" | head -100
```

## Best Practices

### Event Naming
- Use dot notation: `context.operation.status`
- Be specific: `auth.signin.failure` not `auth.error`
- Include outcome: `api.request.success` vs `api.request.failure`

### Metadata Guidelines
- Always include relevant IDs (userId, sessionId, requestId)
- Add timing data for operations
- Include error context but never sensitive data
- Use consistent field names across contexts

### Performance Considerations
- Log at appropriate levels (avoid debug in production)
- Use structured data over string interpolation
- Include timing for operations > 100ms
- Aggregate similar events when possible

## Troubleshooting

### Common Issues
- **Missing Logs**: Check log level configuration
- **Performance Impact**: Review debug level usage in production
- **PII Exposure**: Verify email redaction is working
- **Missing Context**: Ensure request loggers are used for API routes

### Debug Mode
```typescript
// Enable verbose logging in development
process.env.NODE_ENV = 'development'
// Logger automatically switches to debug level
```

This logging architecture provides comprehensive observability while maintaining performance and security requirements for production deployment.