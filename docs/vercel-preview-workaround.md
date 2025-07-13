# Vercel Preview Deployment Workaround

## The Issue

When deploying to Vercel preview environments without Convex Pro, the build fails because:
1. Convex CLI detects the Vercel environment
2. It requires `CONVEX_DEPLOY_KEY` even for just generating TypeScript types
3. Without Convex Pro, you can't create preview deployment keys

## Quick Solution

Add a dummy `CONVEX_DEPLOY_KEY` to your Vercel preview environment variables:

### Steps:

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add a new variable:
   - **Key**: `CONVEX_DEPLOY_KEY`
   - **Value**: `preview:dummy_key_for_type_generation_only`
   - **Environment**: ✅ Preview only (uncheck Production and Development)

This dummy key will:
- Allow `convex codegen` to run and generate types
- NOT deploy anything (our build script skips deployment for preview)
- Use your production Convex backend for data

### Why This Works

- The build script checks for production environment before attempting deployment
- For preview builds, it only runs `convex codegen` to generate TypeScript types
- The dummy key satisfies the CLI's environment check
- No actual deployment happens, so the key doesn't need to be valid

## Alternative Solutions

1. **Use GitHub Actions** (Recommended)
   - Let GitHub Actions handle the build and deploy to Vercel
   - The CI/CD pipeline handles type generation properly

2. **Upgrade to Convex Pro**
   - Get proper preview deployment keys
   - Each preview gets its own Convex instance

3. **Deploy from Local**
   - Run `vercel` locally where Convex CLI doesn't enforce the key requirement

## Security Note

The dummy key approach is safe because:
- It's only used for type generation, not deployment
- Preview builds explicitly skip Convex deployment
- Your production data remains secure