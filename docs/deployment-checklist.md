# Deployment Checklist

## Pre-Deployment Checks

### 1. Convex Deploy Key Setup ⚠️ REQUIRED
- [ ] Open Convex Dashboard: `npx convex dashboard`
- [ ] Navigate to: Settings → Deploy Keys
- [ ] Generate Production Deploy Key
- [ ] Copy the key (starts with `prod:`)

### 2. Vercel Environment Variables
- [ ] Open Vercel Dashboard: https://vercel.com/phrazzld/scry/settings/environment-variables
- [ ] Add `CONVEX_DEPLOY_KEY`:
  - Key: `CONVEX_DEPLOY_KEY`
  - Value: [Your production deploy key]
  - Environment: ✅ Production
- [ ] Verify other required variables are set:
  - [ ] `NEXT_PUBLIC_CONVEX_URL`
  - [ ] `GOOGLE_AI_API_KEY`
  - [ ] `RESEND_API_KEY` (if using email features)
  - [ ] `EMAIL_FROM` (if using email features)

### 3. Local Verification
- [ ] Run: `node scripts/check-vercel-env.js`
- [ ] Confirm all required variables show as ✅

### 4. Deployment
- [ ] Commit any pending changes
- [ ] Push to your branch
- [ ] Deploy: `vercel --prod`

### 5. Post-Deployment Verification
- [ ] Check build logs in Vercel Dashboard
- [ ] Look for "Convex functions deployed successfully"
- [ ] Visit your production URL
- [ ] Test the health endpoint: `/api/health`
- [ ] Try creating a quiz to verify functionality

## Troubleshooting

### If deployment still fails:
1. Check the exact error message in Vercel logs
2. Verify the deploy key was copied correctly (no spaces)
3. Ensure the key is set for the correct environment
4. Try regenerating the deploy key if needed

### Common Issues:
- **"CONVEX_DEPLOY_KEY is not set"**: The environment variable isn't configured in Vercel
- **"Invalid deploy key"**: The key might be malformed or for the wrong environment
- **Build timeout**: Convex deployment might be taking too long - check Convex Dashboard

## Alternative: Manual Deployment

If you prefer to deploy Convex separately:
1. Replace `vercel.json` with `vercel-alternative.json`
2. Deploy Convex manually: `npx convex deploy --prod`
3. Then deploy to Vercel: `vercel --prod`

## Preview Deployments

As of the latest update, preview deployments no longer require Convex Pro subscription:
- Preview deployments automatically skip Convex deployment
- They use the production Convex backend (via NEXT_PUBLIC_CONVEX_URL)
- Only production deployments will deploy Convex functions
- This is handled automatically by the `scripts/vercel-build.cjs` script