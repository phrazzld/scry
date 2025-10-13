# Development Authentication Shortcuts

This document provides comprehensive instructions for using the development authentication shortcuts in the Scry application.

## Overview

The development authentication system provides quick sign-in capabilities for testing and development purposes. **These shortcuts are completely disabled in production environments** and will throw errors if accessed outside of development.

## Security Features

### Automatic Environment Detection
- **Production Safety**: All shortcuts are disabled in production environment
- **Test Environment**: Also disabled in test environment to prevent accidental usage
- **Development Only**: Only available when `NODE_ENV === 'development'`

### Security Monitoring
- All unauthorized access attempts are logged
- Security violations are tracked and reported
- Comprehensive error logging for debugging

### Automated Testing
- 34 test cases ensure production safety
- Environment validation tests
- Security boundary tests
- Error handling tests

## Getting Started

### 1. Environment Setup

Ensure your environment is properly configured:

```bash
# Check current environment
echo $NODE_ENV

# Set to development for shortcuts
export NODE_ENV=development

# Or in your .env.local file
NODE_ENV=development
```

### 2. Development Sign-In Page

Visit the development authentication page:

```
http://localhost:3000/auth/dev-signin
```

This page provides:
- Quick test user buttons
- Custom user creation form
- Current session status
- Security information

### 3. API Endpoints

The development authentication system provides several API endpoints:

#### GET /api/dev-auth
Returns development authentication status and available shortcuts.

**Response:**
```json
{
  "status": "available",
  "environment": "development",
  "currentSession": {
    "user": {
      "id": "dev-user-123",
      "email": "test@dev.local",
      "name": "Test User"
    },
    "authenticated": true
  },
  "testUsers": ["admin", "user", "tester"],
  "shortcuts": {
    "quickSignIn": "/api/dev-auth/signin",
    "testUsers": "/api/dev-auth/test-users",
    "signOut": "/api/auth/signout"
  }
}
```

#### POST /api/dev-auth
Quick development sign-in with test user or custom user.

**Request with test user:**
```json
{
  "testUser": "admin"
}
```

**Request with custom user:**
```json
{
  "email": "custom@dev.local",
  "name": "Custom User"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "dev-customdevlocal-1234567890",
    "email": "custom@dev.local",
    "name": "Custom User"
  },
  "message": "Development user created. Use this data with signIn() on the client."
}
```

#### DELETE /api/dev-auth
Sign out from development session.

**Response:**
```json
{
  "success": true,
  "message": "Development sign-out initiated"
}
```

## Usage Examples

### 1. Quick Test Users

The system provides three predefined test users:

```typescript
// Available test users
const testUsers = {
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
}
```

### 2. Client-Side Authentication

Use NextAuth's signIn function with the development provider:

```typescript
import { signIn } from 'next-auth/react'

// Sign in with development provider
const handleDevSignIn = async () => {
  const result = await signIn('credentials', {
    email: 'test@dev.local',
    name: 'Test User',
    redirect: false
  })
  
  if (result?.error) {
    console.error('Sign in failed:', result.error)
  } else {
    console.log('Sign in successful')
  }
}
```

### 3. Programmatic API Usage

```typescript
// Get development auth status
const getDevAuthStatus = async () => {
  const response = await fetch('/api/dev-auth')
  return response.json()
}

// Quick sign in with test user
const signInWithTestUser = async (userType: 'admin' | 'user' | 'tester') => {
  const response = await fetch('/api/dev-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testUser: userType })
  })
  return response.json()
}

// Sign in with custom user
const signInWithCustomUser = async (email: string, name?: string) => {
  const response = await fetch('/api/dev-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name })
  })
  return response.json()
}
```

## Integration with Main Auth System

The development authentication provider is automatically integrated with the main NextAuth configuration:

```typescript
// In lib/auth.ts
import { createDevAuthProvider, isDevAuthAvailable } from './dev-auth'

const createProviders = () => {
  const providers = [
    EmailProvider({
      // ... email provider configuration
    }),
  ]

  // Add development provider only in development environment
  if (isDevAuthAvailable()) {
    providers.push(createDevAuthProvider())
  }

  return providers
}

export const authOptions: NextAuthOptions = {
  providers: createProviders(),
  // ... other configuration
}
```

## Testing Integration

### Unit Tests

The development authentication system includes comprehensive unit tests:

```bash
# Run all development auth tests
pnpm test lib/dev-auth.test.ts

# Run specific test category
pnpm test lib/dev-auth.test.ts -t "Production Safety"

# Run with coverage
pnpm test:coverage lib/dev-auth.test.ts
```

### Test Categories

1. **Environment Detection Tests**
   - Correctly identifies development/production/test environments
   - Handles undefined and empty NODE_ENV values

2. **Production Safety Tests**
   - Ensures all functions throw errors in production
   - Validates security boundaries
   - Tests environment manipulation attempts

3. **Development Functionality Tests**
   - Provider creation and configuration
   - User authentication flow
   - Test user management

4. **Security Boundary Tests**
   - Prevents global scope leakage
   - Validates concurrent environment checks
   - Tests logging and monitoring

### API Route Tests

```bash
# Run API route tests
pnpm test app/api/dev-auth/route.test.ts

# Test specific HTTP methods
pnpm test app/api/dev-auth/route.test.ts -t "GET"
pnpm test app/api/dev-auth/route.test.ts -t "POST"
pnpm test app/api/dev-auth/route.test.ts -t "DELETE"
```

## Security Considerations

### What's Protected

✅ **Automatic Production Blocking**: All functions throw errors in production
✅ **Environment Validation**: Multiple layers of environment checking
✅ **Security Logging**: All unauthorized access attempts are logged
✅ **Test Coverage**: 34 test cases covering security scenarios
✅ **No Global Leakage**: Functions are not exposed to global scope

### What to Monitor

⚠️ **Production Logs**: Monitor for security violation attempts
⚠️ **Test Coverage**: Ensure tests pass in CI/CD pipeline
⚠️ **Environment Variables**: Verify NODE_ENV is correctly set
⚠️ **Access Patterns**: Watch for unusual authentication patterns

### Security Alerts

The system logs security violations when:
- Development functions are called in production
- Invalid environment access is attempted
- Unauthorized API access occurs

Example log entry:
```json
{
  "event": "dev-auth.production-access-attempt",
  "environment": "production",
  "securityViolation": true,
  "timestamp": "2025-01-10T12:00:00.000Z"
}
```

## Common Issues and Solutions

### Issue: Development shortcuts not working

**Symptoms:**
- 403 errors when accessing dev auth endpoints
- Functions throwing "not available" errors

**Solution:**
```bash
# Check environment
echo $NODE_ENV

# Set to development
export NODE_ENV=development

# Restart development server
pnpm dev
```

### Issue: Tests failing in CI/CD

**Symptoms:**
- Production safety tests failing
- Environment detection errors

**Solution:**
```bash
# Ensure NODE_ENV is set correctly in CI
export NODE_ENV=test

# Run tests with explicit environment
NODE_ENV=test pnpm test lib/dev-auth.test.ts
```

### Issue: API endpoints returning 403

**Symptoms:**
- Development auth API returning 403 errors
- "Not available in this environment" messages

**Solution:**
1. Verify `NODE_ENV=development` in your environment
2. Check that the development server is running
3. Ensure no production environment variables are set

### Issue: NextAuth provider not found

**Symptoms:**
- "credentials" provider not found
- Sign-in attempts failing

**Solution:**
1. Ensure the development provider is added to auth config
2. Check that `isDevAuthAvailable()` returns true
3. Verify no errors in provider creation

## Best Practices

### Development Workflow

1. **Start Development Server**
   ```bash
   NODE_ENV=development pnpm dev
   ```

2. **Use Development Sign-In Page**
   - Navigate to `/auth/dev-signin`
   - Use test users for common scenarios
   - Create custom users for specific testing

3. **Monitor Logs**
   - Check console for authentication events
   - Monitor structured logs for debugging
   - Watch for security violation alerts

### Testing Workflow

1. **Run Tests Before Deployment**
   ```bash
   pnpm test lib/dev-auth.test.ts
   pnpm test app/api/dev-auth/route.test.ts
   ```

2. **Validate Production Safety**
   ```bash
   NODE_ENV=production pnpm test lib/dev-auth.test.ts -t "Production Safety"
   ```

3. **Check Environment Variables**
   ```bash
   pnpm env:validate
   pnpm deploy:check
   ```

### Security Workflow

1. **Regular Security Audits**
   - Review access logs for violations
   - Check test coverage remains high
   - Validate environment separation

2. **Monitor Production Logs**
   ```bash
   vercel logs <deployment-url> --grep "dev-auth"
   ```

3. **Update Security Tests**
   - Add tests for new development features
   - Validate new environment scenarios
   - Test edge cases and error conditions

## API Reference

### Functions

#### `isDevAuthAvailable(): boolean`
Checks if development authentication features are available.

**Returns:** `true` if `NODE_ENV === 'development'`, `false` otherwise

#### `createDevAuthProvider(): Provider`
Creates a NextAuth credentials provider for development authentication.

**Returns:** CredentialsProvider configured for development use
**Throws:** Error if called outside development environment

#### `createDevUser(email: string, name?: string): User`
Creates a development user object with unique ID.

**Parameters:**
- `email`: Valid email address
- `name`: Optional display name

**Returns:** User object with development ID
**Throws:** Error if called outside development environment

#### `getTestUser(userType: 'admin' | 'user' | 'tester'): User`
Gets a predefined test user.

**Parameters:**
- `userType`: Type of test user to create

**Returns:** Test user object
**Throws:** Error if userType is invalid or called outside development

#### `getDevAuthStatus(): Status`
Gets current development authentication status.

**Returns:** Status object with environment info and available features
**Throws:** Error if called outside development environment

### Types

```typescript
interface DevUser {
  id: string          // Format: dev-{sanitizedEmail}-{timestamp}
  email: string       // Valid email address
  name: string        // Display name
  role: 'user'        // Default role
}

interface DevAuthStatus {
  available: boolean
  environment: string
  testUsers: string[]
  timestamp: string
}
```

## Troubleshooting

### Debug Mode

Enable debug logging for development authentication:

```bash
# Set debug environment
DEBUG=dev-auth* pnpm dev

# Check logs
tail -f .next/trace
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Development authentication shortcuts are strictly prohibited in production" | Called in production | Set NODE_ENV=development |
| "Email is required for development user" | Missing email parameter | Provide valid email address |
| "Unknown test user type" | Invalid test user type | Use 'admin', 'user', or 'tester' |
| "Invalid email format" | Malformed email | Provide valid email format |

### Logs Location

Development logs are written to:
- **Console**: Real-time development logs
- **Structured Logs**: JSON format for production monitoring
- **Test Output**: Vitest test runner output

## Contributing

When adding new development authentication features:

1. **Add Security Tests**: Ensure production safety
2. **Update Documentation**: Keep this guide current
3. **Test All Environments**: Verify behavior in dev/test/prod
4. **Log Security Events**: Add appropriate logging
5. **Follow Patterns**: Use existing code patterns

### Code Review Checklist

- [ ] All functions have environment validation
- [ ] Security tests cover new functionality
- [ ] Documentation is updated
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate
- [ ] No global scope leakage
- [ ] Production safety is verified

---

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Authentication System Overview](./authentication-task-analysis.md)
- [Error Handling Documentation](./error-handling.md)
- [Environment Setup Guide](./environment-setup.md)
- [Security Best Practices](./security-best-practices.md)

---

*Last updated: 2025-07-09*
*Next review: 2025-08-09*