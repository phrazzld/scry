# Vercel Environment Variable Setup Guide

**Date Created**: 2025-11-03
**Purpose**: Configure Convex deploy keys for preview and production deployments

---

## Overview

Vercel needs different Convex deploy keys for Preview vs Production environments:
- **Preview**: Creates isolated, branch-specific Convex backends for each PR
- **Production**: Deploys to the main production Convex backend

## Required Configuration

### Step 1: Access Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your `scry` project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Preview Deploy Key

**⚠️ IMPORTANT**: This must be set for **Preview environment only**

```
Key: CONVEX_DEPLOY_KEY
Value: preview:phaedrus:scry|eyJ2MiI6IjhmZmZjNjhkYmIwMjRmODY4NTI1ZWRkY2VlZTg5OWY2In0=
Environment: ✓ Preview (ONLY - uncheck Production and Development)
```

**Click "Save"**

### Step 3: Verify Production Deploy Key

**⚠️ IMPORTANT**: This must be set for **Production environment only**

Check that this exists:
```
Key: CONVEX_DEPLOY_KEY
Value: prod:uncommon-axolotl-639|eyJ2MiI6IjA0Mjc1NDZhOTAwYTQ0NjZhNmQ1MzA4MzQ3ZGQ2ZDE4In0=
Environment: ✓ Production (ONLY - uncheck Preview and Development)
```

If not present, click "Add Another" and create it.

### Step 4: Verify Other Required Variables

These should already be configured for **both Preview and Production**:

- ✅ `GOOGLE_AI_API_KEY` - From Convex Dashboard
- ✅ `CLERK_SECRET_KEY` - From Clerk Dashboard
- ✅ `CLERK_WEBHOOK_SECRET` - From Clerk Dashboard
- ✅ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk Dashboard

### Step 5: Verify Auto-Set Variables

These should **NOT** be manually configured (auto-set by Convex):

- ❌ **DO NOT ADD**: `NEXT_PUBLIC_CONVEX_URL` - This is automatically set by `npx convex deploy --cmd` during the build process

---

## How It Works

### Preview Deployments (PRs)

When you push to a PR:
1. Vercel detects change
2. Reads `CONVEX_DEPLOY_KEY` from **Preview** environment
3. Runs `./scripts/vercel-build.sh`
4. Script runs: `npx convex deploy --cmd 'pnpm build'`
5. Convex CLI sees `preview:` key prefix
6. Creates isolated backend: `https://phaedrus-scry-{branch-name}.convex.cloud`
7. Auto-sets `NEXT_PUBLIC_CONVEX_URL` for frontend
8. Frontend deployed connecting to preview backend

### Production Deployments (Merge to Master)

When you merge to master:
1. Vercel detects master branch change
2. Reads `CONVEX_DEPLOY_KEY` from **Production** environment
3. Runs `./scripts/vercel-build.sh`
4. Script runs: `npx convex deploy --cmd 'pnpm build'`
5. Convex CLI sees `prod:` key prefix
6. Deploys to production: `https://uncommon-axolotl-639.convex.cloud`
7. Auto-sets `NEXT_PUBLIC_CONVEX_URL` for frontend
8. Frontend deployed connecting to production backend

---

## Verification

### Test Preview Deployment

1. Create a test branch and push
2. Open a PR
3. Check Vercel dashboard → Deployments
4. Look for preview URL
5. Preview should connect to branch-specific Convex backend
6. Verify in Convex dashboard → Deployments (should see preview deployment)

### Test Production Deployment

1. Merge a PR to master
2. Check Vercel dashboard → Deployments
3. Production deployment should trigger
4. Verify functions deployed to `uncommon-axolotl-639` backend
5. Check production site works correctly

---

## Troubleshooting

### Issue: Preview deployment fails

**Check**: Is `CONVEX_DEPLOY_KEY` configured for Preview environment?
- Go to Vercel Settings → Environment Variables
- Verify the key starts with `preview:`
- Verify it's ONLY checked for Preview environment

### Issue: Production deployment fails

**Check**: Is `CONVEX_DEPLOY_KEY` configured for Production environment?
- Go to Vercel Settings → Environment Variables
- Verify the key starts with `prod:`
- Verify it's ONLY checked for Production environment

### Issue: "NEXT_PUBLIC_CONVEX_URL not set" error

**This is normal during CI** - the URL is only set during Vercel builds.

If you see this in Vercel builds:
- Check that `vercel-build.sh` is set as the build command
- Verify the script runs `npx convex deploy --cmd 'pnpm build'`
- The `--cmd` flag is what sets `NEXT_PUBLIC_CONVEX_URL`

---

## Reference

- Deploy Keys: From `.env.local` (preview) and `.env.production` (production)
- Convex Docs: https://docs.convex.dev/production/hosting/vercel
- Vercel Docs: https://vercel.com/docs/environment-variables

---

## Completion Checklist

After following this guide:

- [ ] Preview deploy key added to Vercel (Preview environment only)
- [ ] Production deploy key verified in Vercel (Production environment only)
- [ ] Other required variables present in both environments
- [ ] Test PR created and preview deployment successful
- [ ] Convex dashboard shows branch-specific preview backend
- [ ] Preview smoke test passes

**Status**: ⏸️ **ACTION REQUIRED** - Complete Vercel dashboard configuration before proceeding
