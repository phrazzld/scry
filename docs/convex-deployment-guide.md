# Convex Deployment Guide

This guide explains how to deploy Convex functions and schema changes in the Scry project, which uses a dual-instance setup for development and production environments.

## Architecture Overview

Scry uses two separate Convex instances to isolate development and production data:

```
┌─────────────────────────────────────────────────────────────┐
│                        Local Development                      │
│                                                               │
│  Next.js App ──────────► Development Convex Instance         │
│  (localhost:3000)         (amicable-lobster-935)             │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Vercel Deployments                         │
│                                                               │
│  Production/Preview ────► Production Convex Instance         │
│  (*.vercel.app)           (uncommon-axolotl-639)            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## When to Deploy

### Deploy to Development Convex
- When developing new features locally
- After modifying schema or functions during development
- To test changes before production deployment

### Deploy to Production Convex
- **ALWAYS** before merging PR with schema changes
- After completing feature development
- Before running preview deployments
- When fixing production-specific issues

## Step-by-Step Deployment Commands

### 1. Development Deployment (Local)

```bash
# Deploy to development Convex instance
pnpm convex:deploy:dev

# Or using npx directly
npx convex deploy
```

### 2. Production Deployment

```bash
# Ensure you have the production deploy key in .env.local
# CONVEX_DEPLOY_KEY_PROD=prod:uncommon-axolotl-639|...

# Deploy to production Convex instance
pnpm convex:deploy:prod

# Regenerate types after production deployment
pnpm convex:codegen:prod

# Commit the regenerated types
git add convex/_generated
git commit -m "chore: sync Convex types after production deployment"
```

### 3. Complete Deployment Workflow

Follow this checklist for schema changes:

1. **Develop and test locally**
   ```bash
   pnpm dev  # Starts both Next.js and Convex dev
   ```

2. **Deploy to development**
   ```bash
   pnpm convex:deploy:dev
   ```

3. **Deploy to production before merging**
   ```bash
   pnpm convex:deploy:prod
   pnpm convex:codegen:prod
   git add convex/_generated
   git commit -m "chore: sync Convex types"
   ```

4. **Push and create PR**
   ```bash
   git push origin your-branch
   ```

## Common Errors and Solutions

### Error: "Server Error" on preview deployments

**Cause**: Schema mismatch between frontend and production Convex.

**Solution**:
1. Deploy to production Convex: `pnpm convex:deploy:prod`
2. Regenerate types: `pnpm convex:codegen:prod`
3. Commit and push generated types

### Error: "CONVEX_DEPLOY_KEY_PROD not found"

**Cause**: Missing production deploy key in environment.

**Solution**:
1. Get the production deploy key from Convex dashboard
2. Add to `.env.local`:
   ```bash
   CONVEX_DEPLOY_KEY_PROD="prod:uncommon-axolotl-639|..."
   ```

### Error: "getCurrentUser is missing environment parameter"

**Cause**: Production Convex is out of sync with code changes.

**Solution**:
```bash
pnpm convex:deploy:prod
```

### Error: Preview builds fail with type errors

**Cause**: Generated types not committed after schema changes.

**Solution**:
```bash
pnpm convex:codegen:prod
git add convex/_generated
git commit -m "chore: sync Convex types"
```

## Validation and Monitoring

### Check Deployment Status

Validate that your Convex instances are properly configured:

```bash
# Check development instance
npx convex dev --once

# Check production instance
pnpm convex:validate:prod
```

### Environment Variable Check

Ensure your environment is properly configured:

```bash
# Should show both dev and prod URLs
grep CONVEX .env.local

# Expected output:
# NEXT_PUBLIC_CONVEX_URL_DEV=https://amicable-lobster-935.convex.cloud
# NEXT_PUBLIC_CONVEX_URL_PROD=https://uncommon-axolotl-639.convex.cloud
# CONVEX_DEPLOY_KEY_PROD=prod:uncommon-axolotl-639|...
```

## Best Practices

1. **Always deploy to production before merging** - This prevents schema mismatches in preview deployments.

2. **Commit generated types** - Preview deployments can't generate types without Convex Pro.

3. **Use convenience scripts** - Prefer `pnpm convex:deploy:prod` over manual commands.

4. **Test locally first** - Ensure changes work in development before production deployment.

5. **Monitor deployment logs** - Check Convex dashboard for deployment status and errors.

## Troubleshooting Checklist

If you encounter deployment issues:

- [ ] Verify `.env.local` contains `CONVEX_DEPLOY_KEY_PROD`
- [ ] Check that generated types are committed
- [ ] Ensure both dev and prod deployments succeeded
- [ ] Validate using `pnpm convex:validate:prod`
- [ ] Check Convex dashboard for error logs
- [ ] Verify environment variables in Vercel dashboard

## Additional Resources

- [Convex Documentation](https://docs.convex.dev)
- [Project README](../README.md)
- [Environment Setup Guide](../.env.example)