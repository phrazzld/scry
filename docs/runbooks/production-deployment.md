# Production Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying to production, including pre-deployment validation, deployment execution, and post-deployment verification.

**Deployment Architecture:**
- **Backend**: Convex (deployment: `uncommon-axolotl-639`)
- **Frontend**: Vercel (Next.js application)
- **Order**: Convex backend → Validation → Vercel frontend

## Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] **All tests passing**: Run `pnpm test && pnpm test:contract`
- [ ] **TypeScript compilation**: Run `pnpm tsc --noEmit` (no errors)
- [ ] **Linting**: Run `pnpm lint` (no errors)
- [ ] **CONVEX_DEPLOY_KEY set**: Verify production deploy key is exported
- [ ] **Schema changes reviewed**: Check `git diff master...HEAD -- convex/schema.ts`
- [ ] **Migrations identified**: Any schema removals require migration first
- [ ] **Dry-run completed**: If migrations needed, run dry-run and verify output

### Verifying Deployment Target

**Critical**: Always verify you're deploying to the correct environment.

```bash
# Export production deploy key
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)

# Verify deployment target
echo "Deploying to: $(echo $CONVEX_DEPLOY_KEY | cut -d: -f2 | cut -d'|' -f1)"
# Expected output: "uncommon-axolotl-639"

# Verify key starts with "prod:"
echo $CONVEX_DEPLOY_KEY | grep "^prod:" && echo "✅ Production target confirmed" || echo "❌ NOT production!"
```

## Deployment Procedures

### Option 1: Automated Deployment (Recommended)

Use the atomic deployment script that handles environment variables correctly:

```bash
# From project root
./scripts/deploy-production.sh
```

**What the script does:**
1. Verifies `CONVEX_DEPLOY_KEY` is set
2. Deploys Convex backend functions
3. Runs health check to verify critical functions exist
4. Deploys Vercel frontend (only if backend healthy)
5. Exits with error at first failure

### Option 2: Manual Deployment (Production Hotfix)

For emergency hotfixes when script automation isn't suitable:

#### Step 1: Export Production Deploy Key

```bash
# DO NOT use "source .env.production" - it silently fails!
# Vercel format is not bash syntax

# CORRECT method:
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)

# Verify it's set:
echo $CONVEX_DEPLOY_KEY | head -c 20
# Should output: prod:uncommon-axolo
```

#### Step 2: Deploy Convex Backend

```bash
npx convex deploy --yes --cmd-url-env-var-name UNSET
```

**Watch for:**
- ✅ "Deployed Convex functions to https://uncommon-axolotl-639.convex.cloud"
- ❌ Any schema validation errors
- ❌ "Could not find deployment" errors

#### Step 3: Verify Backend Health

```bash
./scripts/check-deployment-health.sh
```

**Expected output:**
- ✅ "Deployment health check passed"
- ❌ If fails, DO NOT deploy frontend - investigate backend issues first

#### Step 4: Deploy Frontend

```bash
vercel --prod
```

**Watch for:**
- Build completion without errors
- Deployment URL in output

#### Step 5: Verify Deployment

```bash
# Run health check again
./scripts/check-deployment-health.sh

# Check schema consistency
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)
npx convex run diagnostics:validateSchemaConsistency

# Expected: { "healthy": true, "issues": [] }
```

## Migration Deployments

When deployments include schema migrations, use the migration-specific workflow.

### Pre-Migration Checklist

- [ ] Migration has dry-run support
- [ ] Migration has diagnostic query
- [ ] Migration tested in development environment
- [ ] Dry-run executed on production (read-only preview)
- [ ] Expected change count documented

### Migration Deployment Workflow

#### Phase 1: Temporary Schema Compatibility

If removing a field, make it optional first:

```bash
# Edit convex/schema.ts
# Before: fieldName: v.string()
# After: fieldName: v.optional(v.string())

git add convex/schema.ts
git commit -m "temp: make field optional for migration"

# Deploy backend with optional field
./scripts/deploy-production.sh
```

#### Phase 2: Run Migration

Use the migration workflow script (enforces dry-run approval):

```bash
./scripts/run-migration.sh <migrationName> production
```

**Script workflow:**
1. Verifies deployment target
2. Runs dry-run (read-only preview)
3. Displays expected changes: "Would update X records"
4. Requires manual approval (type the number to confirm)
5. Runs actual migration
6. Verifies results match dry-run predictions
7. Runs diagnostic query for final verification

**Manual alternative** (if script unavailable):

```bash
# Export production deploy key
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)

# Dry-run first (MANDATORY)
npx convex run migrations:<migrationName> --args '{"dryRun":true}'
# Note the expected change count

# Run actual migration
npx convex run migrations:<migrationName>
# Verify change count matches dry-run

# Verify completion
npx convex run migrations:<migrationName>Diagnostic
# Should return: { "count": 0 }
```

#### Phase 3: Remove Field from Schema

After migration completes successfully:

```bash
# Edit convex/schema.ts
# Remove the fieldName line entirely

git add convex/schema.ts
git commit -m "feat: remove field permanently - pristine schema"

# Deploy backend with clean schema
./scripts/deploy-production.sh
```

## Common Pitfalls

### Pitfall 1: "Migration says '690 already migrated' but production still has issues"

**Root cause**: Deployed to DEV instead of PROD due to environment variable loading failure.

**Diagnosis:**
- Check migration logs for deployment URL
- Should show: `https://uncommon-axolotl-639.convex.cloud`
- If shows: `https://amicable-lobster-935.convex.cloud` → deployed to DEV!

**Fix:**
```bash
# Re-export production deploy key correctly
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)

# Verify target
echo $CONVEX_DEPLOY_KEY | cut -d: -f2 | cut -d'|' -f1
# Must output: uncommon-axolotl-639

# Re-run migration
npx convex run migrations:<migrationName>
```

**Prevention**: Always use deployment scripts, never `source .env.production`.

### Pitfall 2: "TypeScript compiles but migration doesn't detect data"

**Root cause**: TypeScript optimizes away property checks for fields removed from schema.

**Example:**
```typescript
// ❌ BAD: Gets optimized away at compile time
if (question.topic !== undefined) {
  // This code is UNREACHABLE after schema change
}

// ✅ GOOD: Runtime property check
if ('topic' in (question as any)) {
  // This code executes at runtime
}
```

**Fix**: Update migration code to use runtime property checks.

**Prevention**: Follow migration development guide (`docs/guides/writing-migrations.md`).

### Pitfall 3: "Schema validation failed: Object contains extra field"

**Root cause**: Removed field from schema before running migration.

**Example error:**
```
Document with ID "xyz" in table "questions" does not match the schema:
Object contains extra field `topic` that is not in the validator.
```

**Fix:**
1. Revert schema change (add field back as optional)
2. Deploy backend with optional field
3. Run migration to remove data
4. Remove field from schema
5. Deploy backend with clean schema

**Prevention**: Always follow 3-phase migration pattern (optional → migrate → remove).

## Post-Deployment Validation

After every deployment, verify:

### 1. Health Check

```bash
./scripts/check-deployment-health.sh
```

Expected: All critical functions exist, health check passes.

### 2. Schema Consistency

```bash
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)
npx convex run diagnostics:validateSchemaConsistency
```

Expected: `{ "healthy": true, "issues": [] }`

### 3. Production Smoke Test

**Manual verification:**
1. Visit production URL: https://scry-o08qcl16e-moomooskycow.vercel.app
2. Check browser console (should be clean except preload warnings)
3. Test question generation flow
4. Test spaced repetition reviews
5. Verify schema version check passes (no error modal)

### 4. Monitor Logs

```bash
# View Vercel deployment logs
vercel logs --prod --follow

# View Convex backend logs
npx convex logs
```

Watch for:
- No runtime errors
- No schema validation errors
- No "function not found" errors

## Rollback Procedures

If deployment causes issues:

### Quick Rollback (Vercel Frontend)

```bash
# List recent deployments
vercel ls

# Promote previous working deployment
vercel promote <deployment-url> --prod
```

### Backend Rollback (Convex)

Convex doesn't support instant rollback. Options:

1. **Revert commits and redeploy**:
   ```bash
   git revert <bad-commit-sha>
   ./scripts/deploy-production.sh
   ```

2. **Emergency schema fix**:
   - If schema validation failing, add back removed field as optional
   - Deploy hotfix immediately
   - Plan proper migration

3. **Contact Convex support** for critical issues requiring database-level intervention.

## Emergency Contacts

- **Convex Dashboard**: https://dashboard.convex.dev
- **Vercel Dashboard**: https://vercel.com/moomooskycow/scry
- **Production Health Check**: https://scry-o08qcl16e-moomooskycow.vercel.app/api/health

## Related Documentation

- **Migration Development Guide**: `docs/guides/writing-migrations.md`
- **Environment Setup**: `docs/environment-setup.md`
- **Deployment Architecture**: `CLAUDE.md` (Deployment Architecture section)
- **Troubleshooting**: `README.md` (Troubleshooting Deployments section)
