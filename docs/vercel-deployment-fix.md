# Vercel Deployment Fix Guide

## Quick Fix: Add CONVEX_DEPLOY_KEY to Vercel

### Step 1: Get Your Convex Deploy Key

1. Open your terminal and run:
   ```bash
   npx convex dashboard
   ```

2. Navigate to: **Settings** → **Deploy Keys**

3. Click **"Generate Production Deploy Key"**

4. Copy the generated key (it starts with `prod:`)

### Step 2: Add to Vercel Environment Variables

1. Go to your Vercel project: https://vercel.com/[your-username]/scry

2. Click on **"Settings"** tab

3. Navigate to **"Environment Variables"** in the left sidebar

4. Click **"Add New"** and create:
   - **Key**: `CONVEX_DEPLOY_KEY`
   - **Value**: [Paste your deploy key from Step 1]
   - **Environment**: Select only **"Production"**
   - Click **"Save"**

### Step 3: Verify Other Required Variables

While you're there, make sure these are also set:

1. **NEXT_PUBLIC_CONVEX_URL**
   - Should be your Convex URL like `https://[your-project].convex.cloud`
   - Set for all environments

2. **GOOGLE_AI_API_KEY**
   - Your Google AI API key for quiz generation
   - Set for all environments

### Step 4: Trigger a New Deployment

1. Go to your Vercel project dashboard
2. Click **"Redeploy"** on the latest deployment
3. Select **"Redeploy with existing Build Cache"**

## Optional: Preview Deployments

If you want preview deployments to work with their own Convex instances:

1. In Convex Dashboard, generate a **Preview Deploy Key**
2. Add another environment variable in Vercel:
   - **Key**: `CONVEX_DEPLOY_KEY`
   - **Value**: [Your preview deploy key]
   - **Environment**: Select only **"Preview"**

## Alternative: Remove Convex from Vercel Build

If you prefer to deploy Convex separately (via GitHub Actions only), update `vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "functions": {
    "app/api/generate-questions/route.ts": {
      "maxDuration": 30
    },
    "app/api/quiz/complete/route.ts": {
      "maxDuration": 10
    }
  }
}
```

This removes the `npx convex deploy` from the build command, relying on GitHub Actions to deploy Convex before Vercel deployment.

## Verification

After adding the environment variable and redeploying:

1. Check the build logs in Vercel
2. Look for "Convex functions deployed successfully"
3. Verify your app works at the production URL

## Troubleshooting

If it still fails:
- Double-check the deploy key is copied correctly (no extra spaces)
- Ensure it's set for the correct environment (Production)
- Check that your Convex project is active in the dashboard
- Verify the key hasn't expired (they don't expire by default)