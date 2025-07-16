# Preview Deployment Testing Guide

This guide provides step-by-step procedures for testing preview deployments with the Convex integration.

## Pre-Test Setup

1. **Deploy to Preview**
   ```bash
   git push origin your-branch
   ```
   Wait for Vercel to create the preview deployment.

2. **Get Preview URL**
   - Check Vercel dashboard or GitHub PR comments
   - Format: `https://scry-{branch}-{hash}.vercel.app`

3. **Verify Health Check**
   ```bash
   curl https://your-preview-url.vercel.app/api/health/preview
   ```
   - Ensure all checks pass
   - Note any warnings about missing environment variables

## Test Cases

### 1. Magic Link Generation in Preview

**Steps:**
1. Navigate to preview URL
2. Click "Sign In" 
3. Enter test email address
4. Submit form

**Expected:**
- Success message appears
- Check Convex logs for magic link URL
- URL should point to preview deployment, not production

**Verify:**
```bash
# Check the magic link URL in Convex logs
npx convex logs --prod | grep "magicLinkUrl"
```

### 2. Magic Link Redemption 

**Steps:**
1. Copy magic link URL from logs/email
2. Verify URL domain matches preview deployment
3. Click the link
4. Should redirect to `/auth/verify?token=...`

**Expected:**
- Successful authentication
- Redirect to dashboard or original destination
- Session cookie set with preview environment tag

**Debug:**
```javascript
// In browser console
localStorage.getItem('scry_session_token')
```

### 3. Dashboard Access When Authenticated

**Steps:**
1. Complete magic link authentication
2. Navigate to `/dashboard`
3. Refresh the page

**Expected:**
- Dashboard loads without redirect
- User data displays correctly
- No authentication errors

**Verify:**
- Check Network tab for `getCurrentUser` query
- Should include environment parameter

### 4. Quiz Generation with Real AI

**Steps:**
1. Navigate to `/create`
2. Enter a topic (e.g., "JavaScript promises")
3. Select difficulty
4. Click "Generate Quiz"

**Expected:**
- Loading state appears
- 10 real questions generated (not placeholders)
- Questions are relevant to the topic

**Debug:**
```bash
# Check if GOOGLE_AI_API_KEY is set for preview
vercel env list | grep GOOGLE_AI_API_KEY
```

### 5. Session Isolation Between Environments

**Steps:**
1. Sign in to production site
2. Copy session token from localStorage
3. Navigate to preview deployment
4. Try to access protected routes

**Expected:**
- Preview deployment should NOT accept production session
- User should be redirected to sign in
- Console should show environment mismatch warning

**Verify:**
```javascript
// Check console for warnings like:
// "Session environment mismatch: session=production, current=preview-main"
```

## Common Issues and Solutions

### Issue: Magic links point to production

**Solution:** 
- Verify `/api/auth/send-magic-link` endpoint is deployed
- Check that `deploymentUrl` is being passed to Convex

### Issue: 404 on protected routes

**Solution:**
- Ensure middleware.ts includes the route in matcher
- Verify session cookie is set correctly

### Issue: Placeholder quiz questions

**Solution:**
```bash
# Add Google AI key to preview environment
vercel env add GOOGLE_AI_API_KEY preview
```

### Issue: Session rejected in preview

**Solution:**
- Clear localStorage and cookies
- Sign in fresh in preview environment
- Check session has correct environment tag

## Debugging Commands

### Check Environment Variables
```bash
# List all preview env vars
vercel env list preview

# Pull env vars locally
vercel env pull .env.preview
```

### Monitor Convex Logs
```bash
# Real-time logs
npx convex logs --prod --follow

# Filter for auth events
npx convex logs --prod | grep -E "(sendMagicLink|verifyMagicLink|getCurrentUser)"
```

### Verify Deployment Status
```bash
# List recent deployments
vercel list

# Get deployment details
vercel inspect [deployment-url]
```

## Automated Testing Script

Create `scripts/test-preview.js`:
```javascript
const PREVIEW_URL = process.env.PREVIEW_URL || 'https://your-preview.vercel.app'

async function testPreviewDeployment() {
  console.log('Testing preview deployment:', PREVIEW_URL)
  
  // Test health check
  const health = await fetch(`${PREVIEW_URL}/api/health/preview`)
  const healthData = await health.json()
  console.log('Health check:', healthData.status)
  
  // Test magic link generation
  const magicLink = await fetch(`${PREVIEW_URL}/api/auth/send-magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com' })
  })
  console.log('Magic link API:', magicLink.status)
  
  // Add more tests...
}

testPreviewDeployment().catch(console.error)
```

Run with:
```bash
PREVIEW_URL=https://your-preview.vercel.app node scripts/test-preview.js
```

## Success Criteria

All tests pass when:
- [ ] Magic links use preview URL
- [ ] Sessions are environment-isolated
- [ ] Protected routes require authentication
- [ ] AI quiz generation works
- [ ] No cross-environment session leakage
- [ ] Health check shows all green