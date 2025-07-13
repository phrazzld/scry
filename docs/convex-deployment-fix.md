# Fix Convex Deployment Key Issue

## Problem
Vercel deployments are failing with the error:
```
Error: CONVEX_DEPLOY_KEY is not set
```

This happens because:
1. `vercel.json` uses build command: `npx convex deploy --cmd 'pnpm build'`
2. This command requires `CONVEX_DEPLOY_KEY` environment variable
3. The key is not configured in Vercel environment variables

## Solution Steps

### Step 1: Generate Convex Deployment Keys

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Navigate to **Settings** → **URL and Deploy Key**
4. Generate keys:
   - Click **Generate production deploy key** → Copy the key
   - Click **Generate preview deploy key** → Copy the key

### Step 2: Add Keys to Vercel Environment Variables

#### Using Vercel Dashboard:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add production key:
   - **Name**: `CONVEX_DEPLOY_KEY`
   - **Value**: [paste production deploy key]
   - **Environment**: ✅ Production ❌ Preview ❌ Development
5. Add preview key:
   - **Name**: `CONVEX_DEPLOY_KEY`
   - **Value**: [paste preview deploy key]  
   - **Environment**: ❌ Production ✅ Preview ❌ Development

#### Using Vercel CLI:
```bash
# Add production key
vercel env add CONVEX_DEPLOY_KEY production

# Add preview key  
vercel env add CONVEX_DEPLOY_KEY preview
```

### Step 3: Verify Other Required Environment Variables

Ensure these are also set in Vercel:

```bash
# Check existing environment variables
vercel env ls

# Add missing variables if needed:
vercel env add NEXT_PUBLIC_CONVEX_URL
vercel env add GOOGLE_AI_API_KEY
vercel env add RESEND_API_KEY
vercel env add EMAIL_FROM
```

### Step 4: Test Deployments

#### Test Preview Deployment:
```bash
# Trigger a preview deployment
vercel

# Check deployment logs for success
vercel logs --follow
```

#### Test Production Deployment:
```bash
# Deploy to production
vercel --prod

# Check production logs
vercel logs --prod --follow
```

## Verification

### Successful Deployment Should Show:
```
✓ Convex functions deployed successfully
✓ Next.js build completed
✓ Deployment ready at https://your-domain.vercel.app
```

### If Still Failing:
1. Verify keys are correctly copied (no extra spaces)
2. Check that environment is set correctly (Production vs Preview)
3. Regenerate keys if needed
4. Check Convex dashboard for deployment logs

## Security Notes

- **Never commit** deployment keys to git
- **Rotate keys** periodically for security
- **Use different keys** for production and preview environments
- **Limit access** to deployment keys in your team

## Related Documentation

- [Convex Dashboard](https://dashboard.convex.dev)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Original CI/CD Setup Guide](./ci-cd-setup.md)