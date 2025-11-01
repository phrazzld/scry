# Security Guidelines

## Secret Management

### Never Commit These
- API keys (Google AI, Resend, etc.)
- Authentication tokens (Clerk keys, session tokens)
- Database credentials
- Private keys or certificates
- Passwords or passphrases
- OAuth client secrets
- Webhook secrets
- Encryption keys

### Use Environment Variables
All secrets MUST be stored in environment variables, never in code or documentation.

**Local Development:**
```bash
# .env.local (never committed)
GOOGLE_AI_API_KEY="AIzaSy..."
RESEND_API_KEY="re_..."
CLERK_SECRET_KEY="sk_test_..."
```

**Production:**
- **Vercel**: Set via `vercel env add VAR_NAME production`
- **Convex**: Set via `npx convex env set VAR_NAME "value" --prod`

See `CLAUDE.md` for full environment variable architecture.

### Documentation Examples
When documenting environment variables, use truncated or dummy values:

**Good:**
```bash
GOOGLE_AI_API_KEY="AIzaSy...abc123"  # Truncated
GOOGLE_AI_API_KEY="your-key-here"    # Placeholder
```

**Bad:**
```bash
GOOGLE_AI_API_KEY="AIzaSyC_RealKeyExample_NEVER_COMMIT_THIS"  # Full real key (DO NOT DO THIS)
```

## Secret Scanning

### Pre-commit Hooks
The repository uses `gitleaks` to scan for secrets before commits:

```bash
# Configuration: .gitleaks.toml
# Hook: .husky/pre-commit
```

**If gitleaks blocks your commit:**
1. Remove the secret from the file
2. Move it to `.env.local` or appropriate environment
3. Use environment variable reference instead
4. Commit again

### Allowlist Policy
The `.gitleaks.toml` allowlist should:
- Only exempt specific reviewed files
- Never use blanket directory exemptions like `docs/**/*.md`
- Include justification comments for each exemption
- Be reviewed during security audits

## Incident Response

If a secret is accidentally committed and pushed:

### Immediate Actions (Within 1 Hour)
1. **Rotate the secret immediately** - Invalidate the exposed credential
2. **Notify team** - Alert collaborators of the exposure
3. **Check logs** - Review access logs for unauthorized usage

### Cleanup Process
1. **Remove from git history** using BFG Repo-Cleaner:
   ```bash
   # Create backup
   cd /Users/phaedrus/Development
   rsync -a --exclude='node_modules' --exclude='.next' scry scry-backup-$(date +%Y%m%d-%H%M%S)

   # Clean history
   cd scry
   bfg --replace-text <(echo 'EXPOSED_SECRET==>==>***REMOVED***') --no-blob-protection
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive

   # Delete offending file if needed
   git rm path/to/file.md
   git commit -m "docs: remove file containing exposed secret"

   # Force push (one-time security exception)
   git push --force origin master
   git push --force origin branch-name
   ```

2. **Verify removal** - Check GitHub commit history to confirm secret is gone

3. **Document incident** - Add comment to relevant PRs explaining the remediation

4. **Review process** - Update this document with lessons learned

### Prevention
- Run `gitleaks detect` before pushing sensitive documentation
- Use `git diff --cached` to review staged changes before committing
- Keep `.gitleaks.toml` configuration strict
- Regular security audits of documentation

## Deployment Security

### Vercel Environment Variables
- Use separate values for preview/production environments
- Never log environment variables in build output
- Validate critical variables in `scripts/vercel-build.cjs`

### Convex Environment Variables
- Set production variables via Convex dashboard only
- Never commit Convex deployment keys
- Use `CONVEX_DEPLOYMENT=dev:...` for local development

### API Key Rotation Schedule
- Rotate production keys quarterly
- Rotate immediately after:
  - Security incidents
  - Team member departures
  - Suspected exposure

## Code Review Checklist

Before approving PRs, verify:
- [ ] No hardcoded secrets or credentials
- [ ] Environment variables used for all sensitive data
- [ ] `.env.local` not committed
- [ ] Documentation uses placeholders/truncated values
- [ ] Gitleaks passing on all commits

## Reporting Security Issues

If you discover a security vulnerability:
1. **Do not** create a public GitHub issue
2. Email security concerns directly to project maintainer
3. Include reproduction steps and impact assessment
4. Allow 48 hours for initial response

---

## Security Incident Log

### 2025-10-13: Missing GOOGLE_AI_API_KEY in Convex Production

**Incident**: Preview deployment failed with `API_KEY` error. Quiz generation failed with "API configuration error. Please contact support."

**Root Cause**: `GOOGLE_AI_API_KEY` was missing or invalid in Convex production environment. On Convex free tier, preview deployments share the production backend, so missing Convex environment variables affect BOTH preview AND production.

**Impact**:
- Preview deployments unable to generate quizzes
- User experience degraded (error messages not actionable)
- Configuration issue not caught until runtime

**Resolution**:
1. Set `GOOGLE_AI_API_KEY` in Convex production: `npx convex env set GOOGLE_AI_API_KEY "new-key" --prod`
2. Verified fix with health check endpoint: `/api/health/preview`
3. Confirmed quiz generation working in preview deployment

**Prevention Measures Implemented**:
1. **Build Script Validation** (`scripts/vercel-build.sh`): Added automatic validation of Convex environment variables during deployment
2. **Functional Health Checks** (`convex/health.ts`): Created functional API key testing (not just existence check)
3. **Enhanced Error Messages** (`app/api/health/preview/route.ts`): Health check now actually tests API key and provides actionable recommendations
4. **Documentation** (`CLAUDE.md`): Added prominent warnings about Convex free tier preview limitations
5. **Incident Response Procedures**: Documented in this section for future reference

**Key Learnings**:
- Vercel environment variables ≠ Convex environment variables (separate systems)
- Preview deployments on free tier share production Convex backend
- Health checks should test functionality, not just configuration existence
- Validation should happen at build time, not runtime

**Related Documentation**:
- Preview deployment architecture: `CLAUDE.md` lines 81-125
- Post-deployment health checks: `convex/health.ts` (functional validation)
- Deployment verification: `scripts/check-deployment-health.sh`

---

**Last Updated:** 2025-10-13 (After AIzaSy... exposure incident + API_KEY incident)
**Next Review:** 2025-11-13
