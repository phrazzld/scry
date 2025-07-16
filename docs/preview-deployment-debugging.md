# Preview Deployment Debugging Guide

This guide helps troubleshoot common issues with preview deployments in the Convex + Vercel setup.

## Quick Diagnostics

### 1. Run Health Check
```bash
curl https://your-preview-url.vercel.app/api/health/preview | jq
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "preview-main",
  "checks": {
    "environment": { "status": "ok", "value": "preview-main" },
    "vercelUrl": { "status": "ok", "value": "scry-main-abc123.vercel.app" },
    "convexConnection": { "status": "ok" },
    "googleAiKey": { "status": "ok", "configured": true },
    "sessionCreation": { "status": "ok", "canCreateSession": true }
  }
}
```

### 2. Check Browser Console
Open DevTools and look for:
- Environment mismatch warnings
- Failed API calls
- CORS errors
- Missing environment variables

## Common Error Patterns

### Error: "Session environment mismatch"

**Console message:**
```
Session environment mismatch: session=production, current=preview-main
```

**Cause:** Trying to use a production session in preview (or vice versa)

**Solution:**
1. Clear all storage:
   ```javascript
   localStorage.clear()
   document.cookie.split(";").forEach(c => {
     document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/"
   })
   ```
2. Sign in fresh in the preview environment

### Error: "Failed to send magic link"

**Symptoms:**
- Magic link form submission fails
- Network tab shows 500 error on `/api/auth/send-magic-link`

**Debug steps:**
1. Check API endpoint logs:
   ```bash
   vercel logs --prod | grep "send-magic-link"
   ```

2. Verify Convex connection:
   ```bash
   curl -X POST https://your-preview-url.vercel.app/api/auth/send-magic-link \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

3. Check environment variables:
   ```bash
   vercel env list preview | grep CONVEX
   ```

### Error: Placeholder quiz questions

**Symptoms:**
- Quiz generates with "Option A, Option B, Option C, Option D"
- Single generic question instead of 10 real questions

**Cause:** Missing GOOGLE_AI_API_KEY in preview environment

**Solution:**
```bash
# Add the key to preview environment
vercel env add GOOGLE_AI_API_KEY preview

# Verify it's set
vercel env list preview | grep GOOGLE_AI_API_KEY
```

### Error: 404 on protected routes

**Symptoms:**
- `/dashboard`, `/profile`, etc. return 404
- Middleware not triggering

**Debug:**
1. Check middleware configuration:
   ```typescript
   // middleware.ts should include all protected routes
   matcher: ['/dashboard', '/profile', ...]
   ```

2. Verify build output:
   ```bash
   vercel inspect [deployment-url] | grep middleware
   ```

## Environment Detection Issues

### Verify Environment Detection

1. **Server-side check:**
   ```bash
   # Should show preview-{branch}
   curl https://your-preview-url.vercel.app/api/health/preview | jq .environment
   ```

2. **Client-side check:**
   ```javascript
   // In browser console
   import { getClientEnvironment } from '/lib/environment-client'
   console.log(getClientEnvironment())
   ```

### Manual Environment Override

If automatic detection fails, you can manually set environment:
```javascript
// In API routes
const environment = process.env.VERCEL_ENV === 'preview' 
  ? `preview-${process.env.VERCEL_GIT_COMMIT_REF}` 
  : 'development'
```

## Session Debugging

### Inspect Session Details

```javascript
// Get current session info
const token = localStorage.getItem('scry_session_token')
console.log('Session token:', token)

// Check cookie
console.log('Session cookie:', document.cookie)
```

### Verify Session in Convex

```bash
# List recent sessions
npx convex run --prod sessions:list

# Check specific session
npx convex run --prod sessions:get --token "your-token"
```

### Force Session Refresh

```javascript
// Force a new session check
localStorage.removeItem('scry_session_token')
window.location.reload()
```

## Network Debugging

### Check CORS Issues

Preview deployments might have CORS issues if:
- Convex URL is incorrect
- CSP headers are too restrictive

**Verify CSP headers:**
```bash
curl -I https://your-preview-url.vercel.app | grep -i content-security
```

### Monitor API Calls

```javascript
// Log all fetch requests
const originalFetch = window.fetch
window.fetch = function(...args) {
  console.log('Fetch:', args[0])
  return originalFetch.apply(this, args)
}
```

## Vercel CLI Commands

### Get deployment details
```bash
vercel inspect [deployment-url]
```

### Check deployment logs
```bash
vercel logs [deployment-url] --follow
```

### List environment variables
```bash
vercel env list preview
```

### Redeploy with fresh build
```bash
vercel --force
```

## Advanced Debugging

### Enable Verbose Logging

1. **Add debug environment variable:**
   ```bash
   vercel env add DEBUG "*" preview
   ```

2. **Add console logs to critical paths:**
   ```typescript
   // In convex/auth.ts
   console.log('[AUTH] Environment:', environment)
   console.log('[AUTH] Session lookup:', { token, environment })
   ```

### Test Convex Connection Directly

```javascript
// Test Convex connection from browser
import { ConvexHttpClient } from "convex/browser"
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
const result = await client.query("auth:getCurrentUser", { sessionToken: null })
console.log('Convex test:', result)
```

### Database Inspection

```bash
# View magic links
npx convex run --prod magicLinks:list --email "test@example.com"

# View user sessions
npx convex run --prod sessions:listByUser --email "test@example.com"
```

## Emergency Fixes

### Reset Everything
```bash
# Clear all sessions for a user
npx convex run --prod sessions:clearUser --email "user@example.com"

# Force new deployment
vercel --prod --force
```

### Bypass Environment Check (Temporary)
```typescript
// In convex/auth.ts getCurrentUser
// WARNING: Only for debugging!
if (process.env.DEBUG_BYPASS_ENV_CHECK) {
  console.warn('BYPASSING ENVIRONMENT CHECK')
  // Skip environment validation
}
```

## Getting Help

If issues persist:

1. **Collect diagnostics:**
   ```bash
   # Save all debug info
   curl https://your-preview-url.vercel.app/api/health/preview > health.json
   vercel logs [url] --output=logs.txt
   vercel env list > env.txt
   ```

2. **Check recent changes:**
   ```bash
   git log --oneline -10
   git diff main..HEAD
   ```

3. **File issue with:**
   - Health check output
   - Browser console errors
   - Network tab HAR export
   - Deployment URL
   - Steps to reproduce