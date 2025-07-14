# CI/CD Setup Guide

This guide provides comprehensive instructions for setting up the CI/CD pipeline for Scry with GitHub Actions, Vercel, and Convex.

**Last Updated**: July 2025  
**Prerequisites**: GitHub repository, Vercel account, Convex account

## Overview

The CI/CD pipeline consists of:
- **Secret Validation**: Verifies all required secrets are configured (fail-fast approach)
- **Linting and Type Checking**: Ensures code quality and TypeScript compliance
- **Testing**: Runs unit and integration tests (if configured)
- **Building**: Verifies the application builds successfully with Convex type generation
- **Preview Deployments**: Deploys PRs to preview environments with retry logic
- **Production Deployments**: Deploys main branch to production with Convex + Vercel coordination

### Key Features
- Automatic retry logic for transient failures (3 attempts)
- Comprehensive error messages with fix instructions
- GitHub Step Summaries for better visibility
- Log artifact uploads for failed deployments
- PR comments with deployment URLs and status

## Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

### Vercel Secrets
1. **VERCEL_ORG_ID**: Your Vercel organization ID
   - Find it at: https://vercel.com/account
   - Look for "Your ID" under your team/personal account
   - Format: Starts with `team_` for teams, or your username for personal accounts
   - Example: `team_AbCdEfGhIjKlMnOpQrSt`

2. **VERCEL_PROJECT_ID**: Your Vercel project ID
   - Find it in your project settings on Vercel
   - URL: https://vercel.com/[your-team]/[your-project]/settings
   - Format: Starts with `prj_`
   - Example: `prj_AbCdEfGhIjKlMnOpQrStUvWxYz`
   - Alternative: Run `vercel link` locally and check `.vercel/project.json`

3. **VERCEL_TOKEN**: Your Vercel API token
   - Create at: https://vercel.com/account/tokens
   - Click "Create Token"
   - Name: "GitHub Actions CI/CD" (or similar)
   - Scope: Full access (required for deployments)
   - Expiration: No expiration (for CI/CD)
   - Format: Long alphanumeric string
   - **Security**: Never commit this token to your repository!

📚 **Note**: For detailed instructions on setting up Vercel project configuration and finding these values, see [Vercel Project Setup Guide](./vercel-project-setup.md)

### Convex Secrets
4. **CONVEX_DEPLOY_KEY**: Your Convex production deploy key
   - Get it from Convex dashboard → Settings → Deploy Keys
   - Or run: `npx convex dashboard` and navigate to settings
   - Click "Generate production deploy key"
   - Format: Starts with `prod:`
   - Example: `prod:abcdef123456...`
   - **Important**: This key has full write access to your Convex deployment
   - **Free Tier Note**: Preview deploy keys require Convex Pro subscription

5. **NEXT_PUBLIC_CONVEX_URL**: Your Convex deployment URL
   - Format: `https://[your-deployment].convex.cloud`
   - Find it in your Convex dashboard main page
   - Or run: `npx convex dev` and look for the URL in output
   - Example: `https://excited-penguin-123.convex.cloud`
   - **Note**: This is a public URL, safe to expose in client code

### Application Secrets
6. **GOOGLE_AI_API_KEY**: Your Google AI API key for quiz generation
   - Get it from: https://makersuite.google.com/app/apikey
   - Or: https://console.cloud.google.com/apis/credentials
   - Click "Create API Key"
   - Format: Starts with `AIzaSy`
   - Example: `AIzaSyAbCdEfGhIjKlMnOpQrStUvWx`
   - **Restrictions**: Consider adding API restrictions for production
   - **Usage**: Powers the AI quiz generation feature

## Adding Secrets to GitHub

### Step-by-Step Instructions

1. **Navigate to Repository Settings**
   - Go to your GitHub repository
   - Click "Settings" tab
   - In left sidebar: "Secrets and variables" → "Actions"

2. **Add Each Secret**
   - Click "New repository secret"
   - Enter the secret name EXACTLY as shown above (case-sensitive)
   - Paste the secret value
   - Click "Add secret"

3. **Verify All Secrets Are Added**
   You should see all 6 secrets listed:
   - ✓ CONVEX_DEPLOY_KEY
   - ✓ GOOGLE_AI_API_KEY
   - ✓ NEXT_PUBLIC_CONVEX_URL
   - ✓ VERCEL_ORG_ID
   - ✓ VERCEL_PROJECT_ID
   - ✓ VERCEL_TOKEN

### Security Best Practices

1. **Never expose secrets in logs**: The CI pipeline masks secrets automatically
2. **Rotate tokens regularly**: Especially if you suspect they've been compromised
3. **Use minimal permissions**: Only grant the access level needed
4. **Monitor usage**: Check Vercel and Convex dashboards for unexpected activity

## Setting Up Vercel

### 1. Link Your Repository

```bash
# Install Vercel CLI if not already installed
pnpm i -g vercel

# Link your project (follow prompts)
vercel link

# This creates .vercel/project.json with your project IDs
```

### 2. Configure Environment Variables in Vercel Dashboard

**Required for Production Environment:**
- `NEXT_PUBLIC_CONVEX_URL` - Your Convex deployment URL
- `GOOGLE_AI_API_KEY` - Your Google AI API key
- `CONVEX_DEPLOY_KEY` - Your Convex production deploy key
- `RESEND_API_KEY` - Your Resend API key (for email authentication)
- `EMAIL_FROM` - Email sender address (e.g., "Scry <noreply@yourdomain.com>")
- `NEXT_PUBLIC_APP_URL` - Your production URL (optional, for magic links)

**For Preview Environments (Free Convex Tier Solution):**

We've implemented a solution that allows preview deployments without Convex Pro:

1. **Convex generated types are committed to the repository** (`convex/_generated/`)
2. Preview builds use these pre-committed types instead of generating new ones
3. **No CONVEX_DEPLOY_KEY needed for preview environments**
4. Preview deployments connect to the production Convex backend (read-only usage recommended)

This approach:
- ✅ Eliminates the need for any deployment keys in preview
- ✅ Speeds up preview builds (no type generation needed)
- ✅ Works perfectly with Convex free tier
- ⚠️ Preview writes will affect production data (use caution)

For more details, see [Vercel Preview Deployment Workaround](./vercel-preview-workaround.md)

### 3. Verify Vercel Configuration

```bash
# List all environment variables
vercel env ls

# Pull environment variables locally for testing
vercel env pull .env.local
```

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

### Secret Validation Failures

#### "GitHub Secrets validation failed" Error
The CI pipeline validates all secrets before running. If you see this error:

1. Check the error message for which secret is missing
2. Add the missing secret to GitHub repository settings
3. Common issues:
   - Secret name typo (must match exactly, case-sensitive)
   - Empty secret value
   - Secret added to wrong repository

### Build Failures

#### "CONVEX_DEPLOY_KEY is not set" Error
- **Cause**: Vercel is trying to deploy Convex but can't find the deploy key
- **Solution**: 
  1. Add `CONVEX_DEPLOY_KEY` to Vercel environment variables
  2. Go to Vercel Dashboard → Settings → Environment Variables
  3. Add key for appropriate environment (Production/Preview)
  4. Get the key from Convex Dashboard → Settings → Deploy Keys

#### "Error: Cannot find module 'convex'" 
- **Cause**: Convex codegen hasn't run
- **Solution**: The build script should handle this automatically. If not:
  ```bash
  npx convex codegen
  ```

#### "Build exceeded maximum duration"
- **Cause**: Build taking too long (>20 minutes)
- **Solutions**:
  - Check for infinite loops in build scripts
  - Optimize build performance
  - Contact Vercel support for limit increase

#### TypeScript Errors
- **Cause**: Type checking failures
- **Solution**: 
  ```bash
  # Run locally to see detailed errors
  pnpm tsc --noEmit
  ```

### Deployment Failures

#### "No existing credentials found. Please run `vercel login`"
- **Cause**: VERCEL_TOKEN not recognized or invalid
- **Solutions**:
  1. Verify VERCEL_TOKEN is set in GitHub Secrets
  2. Check token hasn't expired
  3. Ensure token has full access scope
  4. Regenerate token if necessary

#### "Project not found"
- **Cause**: VERCEL_PROJECT_ID or VERCEL_ORG_ID incorrect
- **Solutions**:
  1. Run `vercel link` locally to verify project IDs
  2. Check `.vercel/project.json` for correct values
  3. Update GitHub Secrets with correct IDs

#### Deployment Succeeds but Site Shows Error
- **Common Issues**:
  1. Missing environment variables in Vercel
  2. Convex functions not deployed
  3. CORS issues with API routes
- **Debug Steps**:
  ```bash
  # Check Vercel logs
  vercel logs --prod
  
  # Check Convex logs
  npx convex logs --prod
  ```

### Preview Deployment Issues

#### "Please set CONVEX_DEPLOY_KEY to a new key" in Preview
- **Cause**: Trying to use production key in preview without proper handling
- **Solution**: Our build script handles this. Ensure you're using the latest version
- **Verify**: Check `scripts/vercel-build.cjs` exists and is referenced in `vercel.json`

### Test Failures
- Unit tests are currently allowed to fail (no tests implemented yet)
- E2E tests run locally but not in CI (requires more setup)

## Local Testing

### Test the CI Pipeline Locally

```bash
# 1. Run all quality checks (mimics CI)
pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build

# 2. Test Convex deployment
CONVEX_DEPLOY_KEY=your-key npx convex deploy --prod

# 3. Test Vercel deployment
vercel --prod

# 4. Verify deployment
curl -I https://your-production-url.vercel.app
```

### Debugging CI Failures Locally

```bash
# Simulate preview build
VERCEL_ENV=preview node scripts/vercel-build.cjs

# Check generated Convex files
ls -la convex/_generated/

# Run with verbose logging
DEBUG=* pnpm build
```

## CI/CD Pipeline Architecture

### Job Dependencies
```
validate-secrets (fail-fast)
    ↓
┌───────┬────────┬──────┬───────┐
│ lint  │ type   │ test │ build │
│       │ check  │      │       │
└───────┴────────┴──────┴───────┘
    ↓ (on PR)           ↓ (on main)
deploy-preview      deploy-production
```

### Retry Logic
- Preview deployments: 3 attempts with 30s delay
- Production deployments: 3 attempts with 60s delay  
- Validation checks: 5 attempts with exponential backoff

## Additional Resources

- [Vercel Project Setup Guide](./vercel-project-setup.md) - Detailed Vercel configuration
- [Convex Deployment Fix](./convex-deployment-fix.md) - Troubleshooting Convex deployments
- [Environment Setup](./environment-setup.md) - Local development environment
- [Deployment Checklist](./deployment-checklist.md) - Pre-deployment verification

## Getting Help

1. **Check GitHub Actions logs**: Click on failed workflow run for detailed error messages
2. **Review Step Summaries**: Each job creates summaries with helpful information
3. **Download artifacts**: Failed deployments upload logs as artifacts
4. **Vercel Support**: https://vercel.com/support
5. **Convex Discord**: https://discord.gg/convex