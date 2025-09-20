# Console Output Policy

## Overview
This project enforces a pragmatic console output policy that balances debugging needs with production cleanliness.

## Rules

### ✅ Allowed Everywhere
- `console.error()` - For actual errors that need attention
- `console.warn()` - For warnings about deprecated features or potential issues

### ❌ Restricted in Production Code
- `console.log()` - Only allowed in scripts and tests
- `console.debug()` - Should be removed before committing
- `console.info()` - Use sparingly, prefer structured logging

### 📁 Exceptions
The following directories allow all console methods:
- `/scripts/**` - Build scripts need console output
- `/tests/**` - Tests can log for debugging
- `*.config.*` - Configuration files
- `*.setup.*` - Setup files

## ESLint Configuration

```javascript
// Default rule for production code
"no-console": ["warn", { allow: ["warn", "error"] }]

// Exceptions for scripts and tests
files: ["scripts/**/*", "**/*.test.ts"]
"no-console": "off"
```

## Best Practices

1. **Use console.error() for actual errors**: When something goes wrong that needs investigation
2. **Use console.warn() for deprecations**: When old patterns are being used
3. **Remove console.log() before committing**: Use debugger or conditional logging instead
4. **Consider structured logging**: For complex applications, use a proper logging library

## Why This Policy?

- **Production cleanliness**: Reduces noise in browser console for end users
- **Performance**: Console statements can impact performance in tight loops
- **Security**: Prevents accidental exposure of sensitive data
- **Debugging flexibility**: Still allows console in development via scripts and tests

*Last updated: 2025-01-19*