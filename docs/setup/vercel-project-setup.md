# Vercel Project Setup Guide

This guide explains how to set up and link your local project with Vercel for deployments.

## Prerequisites

- Vercel account (free at [vercel.com](https://vercel.com))
- Vercel CLI installed: `npm i -g vercel`
- Project cloned locally

## Initial Setup for New Projects

### Method 1: Using Vercel CLI (Recommended)

1. Run the Vercel CLI in your project directory:
   ```bash
   vercel
   ```

2. Follow the prompts:
   - Log in to your Vercel account (if not already logged in)
   - Select your scope (personal account or team)
   - Link to existing project or create new one
   - Configure project settings

3. This will create `.vercel/project.json` with your configuration:
   ```json
   {
     "projectId": "prj_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
     "orgId": "team_xxxxxxxxxxxxxxxxxxxxxxxxx"
   }
   ```

### Method 2: Manual Configuration

1. Create a project on [Vercel Dashboard](https://vercel.com/dashboard)
2. Get your project ID and organization ID:
   - Go to Project Settings → General
   - Find "Project ID" (starts with `prj_`)
   - Find your Organization/Team ID in account settings

3. Create `.vercel/project.json` manually:
   ```json
   {
     "projectId": "YOUR_PROJECT_ID",
     "orgId": "YOUR_ORG_ID"
   }
   ```

## Finding Existing Values

If you need to find the values for an existing Vercel project:

### From Vercel Dashboard:
1. Log in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **General**
4. Scroll down to find:
   - **Project ID**: Listed under "Project ID" section
   - **Team/Org ID**: Click on your avatar → Settings → General → Team ID

### From Vercel CLI:
```bash
# List all projects
vercel ls

# Get project info (when in project directory)
vercel inspect
```

## Environment Variables for CI/CD

For GitHub Actions or other CI/CD systems, you'll need these values as secrets:

- `VERCEL_ORG_ID`: Same as orgId from project.json
- `VERCEL_PROJECT_ID`: Same as projectId from project.json
- `VERCEL_TOKEN`: Create at [vercel.com/account/tokens](https://vercel.com/account/tokens)

### Setting GitHub Secrets:
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add the three secrets with their respective values

## Important Notes

⚠️ **Security**: Never commit `.vercel/project.json` if it contains sensitive information
- The file is automatically added to `.gitignore`
- For open source projects, the IDs are generally safe to commit

📁 **Version Control**: 
- `.vercel/` folder should be in `.gitignore`
- Only commit if you want to share project linking across team

🔄 **Multiple Environments**:
- Use different Vercel projects for staging/production
- Set environment-specific variables in Vercel Dashboard

## Troubleshooting

### "No Vercel project found"
- Run `vercel` to link your project
- Ensure `.vercel/project.json` exists

### "Invalid project configuration"
- Verify projectId and orgId are correct
- Check you have access to the project
- Try running `vercel link` to re-link

### CI/CD Deployment Failures
- Verify all three environment variables are set
- Check token hasn't expired
- Ensure token has deployment permissions

## Related Documentation

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [CI/CD Setup Guide](./ci-cd-setup.md)
- [Convex Deployment Fix](./convex-deployment-fix.md)