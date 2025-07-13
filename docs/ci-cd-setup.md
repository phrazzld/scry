# CI/CD Setup Guide

This guide explains how to set up the CI/CD pipeline for Scry with GitHub Actions, Vercel, and Convex.

## Overview

The CI/CD pipeline consists of:
- **Linting and Type Checking**: Ensures code quality
- **Testing**: Runs unit and integration tests
- **Building**: Verifies the application builds successfully
- **Preview Deployments**: Deploys PRs to preview environments
- **Production Deployments**: Deploys main branch to production

## Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

### Vercel Secrets
1. **VERCEL_ORG_ID**: Your Vercel organization ID
   - Find it at: https://vercel.com/account
   - Look for "Your ID" under your team/personal account

2. **VERCEL_PROJECT_ID**: Your Vercel project ID
   - Find it in your project settings on Vercel
   - URL: https://vercel.com/[your-team]/[your-project]/settings

3. **VERCEL_TOKEN**: Your Vercel API token
   - Create at: https://vercel.com/account/tokens
   - Scope: Full access

### Convex Secrets
4. **CONVEX_DEPLOY_KEY**: Your Convex production deploy key
   - Get it from Convex dashboard → Settings → Deploy Keys
   - Or run: `npx convex dashboard` and navigate to settings

5. **NEXT_PUBLIC_CONVEX_URL**: Your Convex deployment URL
   - Format: `https://[your-deployment].convex.cloud`
   - Find it in your Convex dashboard

### Application Secrets
6. **GOOGLE_AI_API_KEY**: Your Google AI API key for quiz generation
   - Get it from: https://makersuite.google.com/app/apikey

## Setting Up Vercel

1. Link your GitHub repository to Vercel:
   ```bash
   vercel link
   ```

2. Configure environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_CONVEX_URL` - Your Convex deployment URL
   - `GOOGLE_AI_API_KEY` - Your Google AI API key
   - `CONVEX_DEPLOY_KEY` - Your Convex deploy key (REQUIRED)
     - For Production: Use production deploy key from Convex dashboard
     - For Preview: Use preview deploy key (optional, creates separate preview instances)

3. Set the build command in Vercel to:
   ```bash
   npx convex deploy --cmd 'pnpm build'
   ```

## Setting Up Convex

1. Generate a production deploy key:
   ```bash
   npx convex dashboard
   # Navigate to Settings → Deploy Keys → Generate
   ```

2. Add Convex environment variables for production:
   ```bash
   npx convex env set RESEND_API_KEY [your-key] --prod
   npx convex env set EMAIL_FROM "Scry <noreply@yourdomain.com>" --prod
   npx convex env set NEXT_PUBLIC_APP_URL https://yourdomain.com --prod
   ```

## Workflow Triggers

The CI/CD pipeline runs on:
- **Push to main/master/develop**: Full pipeline with production deployment
- **Pull requests**: Linting, testing, building, and preview deployment
- **Manual dispatch**: Can be triggered manually from GitHub Actions tab

## Preview Deployments

For pull requests:
1. The workflow deploys to a Vercel preview environment
2. A comment is added to the PR with the preview URL
3. Each commit updates the preview deployment

## Production Deployments

When pushing to main/master:
1. Convex functions are deployed first
2. Then the Next.js app is deployed to Vercel
3. Both deployments must succeed for the pipeline to pass

## Troubleshooting

### Build Failures

#### "CONVEX_DEPLOY_KEY is not set" Error
- This means Vercel is trying to deploy Convex but can't find the deploy key
- Solution: Add `CONVEX_DEPLOY_KEY` to Vercel environment variables
- Go to Vercel Dashboard → Settings → Environment Variables
- Get the key from Convex Dashboard → Settings → Deploy Keys

#### Other Build Issues
- Check that all environment variables are set in GitHub Secrets
- Verify Convex URL is accessible
- Ensure all dependencies are in package.json

### Deployment Failures
- Verify Vercel and Convex tokens are valid
- Check that the Convex project exists
- Ensure Vercel project is linked correctly

### Test Failures
- Unit tests are currently allowed to fail (no tests implemented yet)
- E2E tests run locally but not in CI (requires more setup)

## Local Testing

Test the CI pipeline locally:
```bash
# Run all checks
pnpm lint && pnpm tsc --noEmit && pnpm build

# Test deployment (requires tokens)
CONVEX_DEPLOY_KEY=your-key npx convex deploy --prod
vercel --prod
```