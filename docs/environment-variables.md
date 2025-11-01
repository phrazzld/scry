# Environment Variables Reference

**Last Updated**: November 2025
**Purpose**: Single source of truth for environment variable configuration across all deployment contexts

## Critical Concept: Convex ≠ Vercel

**Convex and Vercel maintain SEPARATE environment variable systems.** Setting a variable in one does NOT set it in the other.

- **Convex backend vars**: Backend functions (Convex Cloud)
- **Vercel vars**: Frontend + build process (Vercel infrastructure)
- **Some vars required in BOTH**: See table below

## Environment Variables Table

| Variable | Convex | Vercel | CI | Purpose | How to Set |
|----------|--------|--------|-----|---------|------------|
| **GOOGLE_AI_API_KEY** | ✅ | ❌ | ❌ | Backend AI generation and embeddings | Convex dashboard → Settings → Environment Variables<br>`npx convex env set GOOGLE_AI_API_KEY "AIzaSy..." --prod` |
| **NEXT_PUBLIC_CONVEX_URL** | ❌ | ✅ | ✅ | Frontend connection to Convex backend | **Auto-set by `npx convex deploy`**<br>Do not manually configure (auto-injected during build) |
| **CONVEX_DEPLOY_KEY** | ❌ | ✅ | ✅ | Deploy Convex functions during builds | Vercel dashboard → Settings → Environment Variables<br>`gh secret set CONVEX_DEPLOY_KEY` (GitHub secrets for CI)<br>Get from: Convex dashboard → Settings → Deploy Keys |
| **CLERK_SECRET_KEY** | ❌ | ✅ | ✅ | Backend auth verification | Vercel dashboard → Settings → Environment Variables<br>Get from: https://dashboard.clerk.com |
| **CLERK_WEBHOOK_SECRET** | ❌ | ✅ | ✅ | Validate Clerk webhooks | Vercel dashboard → Settings → Environment Variables<br>Get from: Clerk dashboard → Webhooks |
| **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY** | ❌ | ✅ | ✅ | Frontend auth initialization | Vercel dashboard → Settings → Environment Variables<br>Get from: Clerk dashboard → API Keys |
| **NEXT_PUBLIC_APP_URL** | ✅ | ❌ | ❌ | Application URL for redirects/links | Convex dashboard → Settings → Environment Variables<br>`npx convex env set NEXT_PUBLIC_APP_URL "https://scry.study" --prod` |
| **CONVEX_CLOUD_URL** | ✅ | ❌ | ❌ | Deployment URL (auto-set by Convex) | **Automatically set by Convex** (no action needed) |
| **ADMIN_EMAILS** | ✅ | ❌ | ❌ | Admin access for migrations | Convex dashboard → Settings → Environment Variables<br>`npx convex env set ADMIN_EMAILS "admin@example.com" --prod` |

## Variable Categories

### Backend-Only (Convex)

These variables are used by Convex serverless functions and should ONLY be set in the Convex dashboard.

- `GOOGLE_AI_API_KEY` - **Critical**: Quiz generation, embeddings, semantic search
- `NEXT_PUBLIC_APP_URL` - Application base URL for email links
- `CONVEX_CLOUD_URL` - Auto-set (deployment URL)
- `ADMIN_EMAILS` - Optional (migration access control)

### Frontend + Build (Vercel)

These variables are used by the Next.js frontend and build process, set in Vercel dashboard.

- `NEXT_PUBLIC_CONVEX_URL` - **Auto-injected** by `npx convex deploy` (DO NOT set manually)
- `CONVEX_DEPLOY_KEY` - Build-time deployment authentication
- `CLERK_SECRET_KEY` - Server-side auth verification
- `CLERK_WEBHOOK_SECRET` - Webhook signature validation
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Client-side auth initialization

### CI/CD (GitHub Secrets)

Required for automated deployments and CI pipelines.

- `CONVEX_DEPLOY_KEY` - Authorize Convex function deployment in CI
- All Vercel vars - Needed for build and test jobs

## Setting Variables by Environment

### Local Development

**File**: `.env.local` (gitignored, create from `.env.example`)

```bash
# Copy template
cp .env.example .env.local

# Edit .env.local with your values:
GOOGLE_AI_API_KEY=AIzaSy...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note**: Local `.env.local` is read by BOTH Next.js AND Convex dev server (`npx convex dev`).

### Convex Production

**Method 1 - CLI** (recommended for automation):
```bash
npx convex env set GOOGLE_AI_API_KEY "AIzaSy..." --prod
npx convex env set NEXT_PUBLIC_APP_URL "https://scry.study" --prod
npx convex env set ADMIN_EMAILS "admin@example.com" --prod

# Verify
npx convex env list --prod
```

**Method 2 - Dashboard** (recommended for secrets):
1. Visit https://dashboard.convex.dev
2. Navigate to your project → Settings → Environment Variables
3. Add production environment variables
4. Changes take effect immediately (no redeploy needed)

### Vercel Production

**Method 1 - Dashboard** (recommended):
1. Visit https://vercel.com/dashboard
2. Select project → Settings → Environment Variables
3. Add variable with environments: Production, Preview, Development
4. Redeploy for changes to take effect

**Method 2 - CLI**:
```bash
vercel env add CONVEX_DEPLOY_KEY production
# Paste value when prompted

vercel env add CLERK_SECRET_KEY production
```

### CI/CD (GitHub Actions)

**Add secrets via CLI**:
```bash
gh secret set CONVEX_DEPLOY_KEY
# Paste production deploy key when prompted

gh secret set NEXT_PUBLIC_CONVEX_URL
gh secret set CLERK_SECRET_KEY
# ... repeat for all CI-required vars
```

**Verify secrets**:
```bash
gh secret list
```

## Deploy Key Types (Convex Pro)

Convex Pro supports different deploy key types for production vs preview environments:

- **Production Key**: `prod:uncommon-axolotl-639|...`
  - Targets production backend (uncommon-axolotl-639)
  - Used by `vercel --prod` deployments

- **Preview Key**: `preview:uncommon-axolotl-639|...`
  - Creates isolated branch-named backends (e.g., `phaedrus:scry:feature-branch`)
  - Each preview gets fresh database (no production data)
  - Auto-cleanup when branch/deployment deleted
  - Used by `vercel` (non-prod) deployments

The deploy key TYPE automatically determines backend routing. No manual configuration needed.

## Health Checks & Validation

### Post-Deployment Health Checks

Health checks validate that deployed environment actually works (superior to pre-flight checks):

**Convex Backend Health** (`convex/health.ts`):
```bash
# Basic check (env vars exist?)
npx convex run health:check

# Detailed check (categorized status)
npx convex run health:detailed

# Functional check (API actually works?)
npx convex run health:functional
```

**What gets validated**:
- ✅ `GOOGLE_AI_API_KEY` - **Functional test** (makes actual API call)
- ✅ `NEXT_PUBLIC_APP_URL` - Existence check
- ✅ `CONVEX_CLOUD_URL` - Existence check

**Frontend Health** (`app/api/health/route.ts`):
```bash
curl https://scry.study/api/health
```

**What gets validated**:
- Basic uptime check
- Memory usage
- Deployment version

### Deployment Health Script

**Script**: `./scripts/check-deployment-health.sh`

Validates Convex functions deployed correctly:
- Verifies critical functions exist (questions CRUD, AI generation, etc.)
- Checks schema version matches deployed frontend
- Runs automatically in CI after build

```bash
./scripts/check-deployment-health.sh
```

## Common Pitfalls

### 1. Setting Variable in Wrong System

❌ **WRONG**: Setting `GOOGLE_AI_API_KEY` in Vercel
- Backend functions can't access Vercel vars
- AI generation will fail with "API key not configured"

✅ **CORRECT**: Set `GOOGLE_AI_API_KEY` in Convex dashboard

### 2. Manually Setting Auto-Generated Variables

❌ **WRONG**: Manually setting `NEXT_PUBLIC_CONVEX_URL` in Vercel
- Can become stale if backend URL changes
- Creates deployment mismatch

✅ **CORRECT**: Let `npx convex deploy --cmd 'pnpm build'` auto-inject URL

### 3. Using Wrong Deploy Key Type

❌ **WRONG**: Using preview key for production deployments
- Creates new isolated backend instead of deploying to production
- Production data not accessible

✅ **CORRECT**: Use `prod:` key for production, `preview:` key for previews

### 4. Forgetting CI Secrets

❌ **WRONG**: Adding `CONVEX_DEPLOY_KEY` only to Vercel
- CI builds fail with authentication errors
- Quality gates can't run

✅ **CORRECT**: Add `CONVEX_DEPLOY_KEY` to BOTH Vercel AND GitHub secrets

## Security Best Practices

### DO

- ✅ Use different API keys for development and production
- ✅ Rotate keys regularly (especially after potential exposure)
- ✅ Set environment-specific scopes (production vs preview vs development)
- ✅ Use production deploy keys (not admin keys) for CI/CD
- ✅ Keep `.env.local` gitignored (never commit secrets)
- ✅ Validate deployments with health checks (functional testing)

### DON'T

- ❌ Use admin keys in CI (overprivileged, security risk)
- ❌ Commit `.env`, `.env.local`, or `.env.production` files
- ❌ Share API keys via chat, email, or unencrypted channels
- ❌ Use placeholder values in production
- ❌ Skip post-deployment health validation
- ❌ Use `source .env.production` in bash (uses wrong format, silently fails)

## Troubleshooting

### "GOOGLE_AI_API_KEY is not set"

**Symptom**: AI generation fails with "API key not configured"

**Diagnosis**:
```bash
npx convex run health:functional
```

**Fix**:
```bash
npx convex env set GOOGLE_AI_API_KEY "AIzaSy..." --prod
```

### "Function not found" errors in frontend

**Symptom**: Frontend shows "Function xyz not found" at runtime

**Root Cause**: Convex functions not deployed (backend-first workflow violated)

**Fix**:
```bash
# Ensure Convex functions deployed BEFORE frontend
npx convex deploy
# Wait for "Convex functions ready!" message
# Then deploy frontend
```

### Deployment succeeds but app broken

**Symptom**: Build passes, but features fail at runtime

**Root Cause**: Pre-flight validation replaced with post-deployment health checks

**Fix**:
```bash
# Check health after deployment
./scripts/check-deployment-health.sh
npx convex run health:functional

# Review recommendations
# Fix missing/invalid env vars
# Redeploy
```

### Migration says "690 migrated" but data still broken

**Symptom**: Migration completes but data not actually updated

**Root Cause**: Deployed to DEV instead of PROD (wrong `CONVEX_DEPLOY_KEY`)

**Diagnosis**:
```bash
echo $CONVEX_DEPLOY_KEY | grep "^prod:"
# Should output: prod:uncommon-axolotl-639|...
```

**Fix**:
```bash
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)
# Re-run migration
```

## Getting API Keys

### Google AI API Key

1. Visit https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy key (starts with `AIzaSy`)
4. Optional: Add API restrictions for security

### Convex Deploy Keys

1. Visit https://dashboard.convex.dev
2. Navigate to Settings → Project Settings → Deploy Keys
3. Generate "Production Deploy Key" (for `vercel --prod`)
4. Generate "Preview Deploy Key" (for `vercel` preview deployments)
5. Keys start with `prod:` or `preview:` indicating type

### Clerk Authentication

1. Visit https://dashboard.clerk.com
2. Select application → API Keys
3. Copy:
   - Publishable Key (starts with `pk_`)
   - Secret Key (starts with `sk_`)
4. Navigate to Webhooks → Create Endpoint
5. Copy Webhook Secret (starts with `whsec_`)

## Relationship to Other Docs

- **Setup Guide**: `docs/setup/environment-setup.md` - Step-by-step setup instructions
- **CI/CD Setup**: `docs/setup/ci-cd-setup.md` - CI pipeline configuration
- **Deployment Checklist**: `docs/operations/deployment-checklist.md` - Pre-deployment validation
- **CLAUDE.md**: Project operational guide for AI assistant
- **.env.example**: Template with inline comments
