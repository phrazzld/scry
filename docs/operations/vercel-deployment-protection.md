# Vercel Deployment Protection Configuration

**Date Created**: 2025-11-03
**Purpose**: Configure Vercel deployment protection to allow GitHub Actions smoke tests

---

## Issue Summary

Preview deployments on Vercel are protected by SSO/password authentication, returning HTTP 401 Unauthorized. This prevents the Preview Deployment Smoke Test workflow from accessing the deployment to verify health.

### Error Signature
```
GET status: 401. Attempt 0-149 of 150
HTTP/2 401
set-cookie: _vercel_sso_nonce=...
Timeout reached: Unable to connect to preview URL
```

### Root Cause
Vercel's **Deployment Protection** feature is enabled for preview deployments. This requires authentication to access previews, which GitHub Actions cannot provide without additional configuration.

---

## Solutions

### Option 1: Disable Protection for Preview Deployments (Recommended)

**When to use**: If you trust your PR review process and want automated smoke tests

**Steps**:
1. Visit [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your `scry` project
3. Go to **Settings** → **Deployment Protection**
4. Under "Protection Method":
   - Select **Standard Protection** (free) or **Vercel Authentication** (Pro)
5. Configure protection scope:
   - **Production**: Keep protection enabled (recommended)
   - **Preview**: Disable protection OR add bypass for `vercel[bot]`
6. Save changes

**Result**: GitHub Actions can access preview deployments for health checks

---

### Option 2: Use Protection Bypass for Automation

**When to use**: If you want to keep preview protection but allow CI access

**Steps**:

1. **Generate Protection Bypass Token**:
   ```bash
   # In Vercel Dashboard → Settings → Deployment Protection
   # Click "Generate Protection Bypass for Automation"
   # Copy the generated secret
   ```

2. **Add to GitHub Secrets**:
   ```bash
   gh secret set VERCEL_PROTECTION_BYPASS_TOKEN
   # Paste the token when prompted
   ```

3. **Update workflow** (`.github/workflows/preview-smoke-test.yml`):
   ```yaml
   - name: Test preview health endpoint
     run: |
       curl -f -s \
         -H "x-vercel-protection-bypass: ${{ secrets.VERCEL_PROTECTION_BYPASS_TOKEN }}" \
         "${{ steps.waitForDeployment.outputs.url }}/api/health"
   ```

**Result**: CI can bypass protection using the token

---

### Option 3: Keep Current Configuration (Non-Blocking)

**When to use**: Temporary workaround while deciding on long-term approach

**Current Status**: Preview smoke test is already configured with `continue-on-error: true`, so CI doesn't block on this failure.

**Workflow behavior**:
- ✅ Lighthouse CI: Tests performance on local build
- ✅ CI: Validates code quality (lint, test, typecheck)
- ⚠️ Preview Smoke Test: Skipped with helpful message
- ✅ Security Audit: Checks dependencies

**Trade-off**: Lose automated validation of preview deployment health

---

## Recommended Configuration

For most teams, **Option 1** (disable preview protection) is recommended because:

1. **Security**: PR review process already gates code changes
2. **Automation**: Enables valuable smoke tests on preview deployments
3. **Developer Experience**: Team members can access previews without SSO friction
4. **Production Safety**: Keep production protection enabled

### Balanced Approach
```
Production:      Protected by Vercel Authentication ✅
Preview (PRs):   Open for automation and team access ✅
Development:     No protection needed ✅
```

---

## Verification Steps

After configuring deployment protection:

1. **Push a commit** to trigger CI
2. **Check workflow**: `.github/workflows/preview-smoke-test.yml`
3. **Expected result**:
   - "Wait for Vercel preview deployment" succeeds
   - "Test preview health endpoint" runs and passes
   - No 401 Unauthorized errors

### Test Command (Local)
```bash
# Get preview URL from PR comment or Vercel dashboard
curl -I https://scry-{branch-name}-{user}.vercel.app/api/health

# Expected: HTTP/2 200 (not 401)
```

---

## Related Files

- `.github/workflows/preview-smoke-test.yml` - Smoke test workflow
- `.github/workflows/lighthouse.yml` - Performance testing
- `docs/operations/vercel-environment-setup.md` - Environment variable configuration

---

## Troubleshooting

### Preview still returns 401 after disabling protection

**Check**:
1. Verify settings saved in Vercel Dashboard
2. Clear browser cache (Vercel sometimes caches protection state)
3. Wait 1-2 minutes for settings to propagate
4. Check correct project selected in dashboard

### Can't find Deployment Protection settings

**Path**: Vercel Dashboard → [Your Project] → Settings → Deployment Protection

**Note**: Feature availability varies by plan:
- **Hobby**: Standard protection only
- **Pro**: Vercel Authentication + custom bypasses
- **Enterprise**: Advanced protection options

### Protection Bypass token not working

**Verify**:
1. Token copied correctly (no extra whitespace)
2. Token added as GitHub secret (not hardcoded)
3. Header name exactly: `x-vercel-protection-bypass`
4. Token generated for correct Vercel project

---

## Security Considerations

### Is it safe to disable preview protection?

**Yes**, if:
- ✅ PRs require review before merge
- ✅ Sensitive data not in preview environments
- ✅ Preview URLs use unpredictable naming (Vercel default)
- ✅ Preview deploys auto-delete after PR close

**No**, if:
- ❌ Previews contain production data
- ❌ No PR review process
- ❌ Compliance requires authentication on all environments

### Preview URL Security

Vercel preview URLs are **unguessable** by default:
```
https://scry-{random-hash}-{username}.vercel.app
```

The random hash provides "security by obscurity" sufficient for most development workflows.

---

## Current Status

- **Issue**: Preview deployments protected by SSO
- **Impact**: Smoke tests cannot validate preview health
- **Workaround**: Smoke test marked non-blocking
- **Action Required**: Choose and implement Option 1, 2, or 3 above
- **Timeline**: No urgency (CI passes without smoke test)

---

**Last Updated**: 2025-11-03
**Needs Action**: User decision on deployment protection approach
