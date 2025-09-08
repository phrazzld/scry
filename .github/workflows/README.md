# GitHub Actions Workflows Documentation

## Overview
This directory contains GitHub Actions workflows for CI/CD, security scanning, and code quality checks.

## Critical Configuration Requirements

### pnpm Version
- **Required Version**: 10.12.1 (as specified in package.json)
- **Location**: All workflows using pnpm must specify `version: 10.12.1` in the pnpm/action-setup step
- **Validation**: Check package.json `packageManager` field for the correct version

### Step Ordering Requirements

When using pnpm with Node.js in workflows, the correct order is:

1. **Checkout code** - Always first
2. **Install pnpm** - Must come BEFORE Node.js setup if using pnpm cache
3. **Setup Node.js** - Can use `cache: 'pnpm'` after pnpm is installed
4. **Install dependencies** - Use `pnpm install --frozen-lockfile`

Example:
```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v3
  with:
    version: 10.12.1
- uses: actions/setup-node@v4
  with:
    node-version: '20.x'
    cache: 'pnpm'
- run: pnpm install --frozen-lockfile
```

### Dependency Review Action

The `actions/dependency-review-action@v4` has the following constraints:

- **Cannot use both** `allow-licenses` and `deny-licenses` parameters
- Choose one approach:
  - Use `deny-licenses` to block specific problematic licenses (recommended)
  - OR use `allow-licenses` to only permit specific licenses

### Workflow Files

| File | Purpose | Triggers |
|------|---------|----------|
| `ci.yml` | Main CI pipeline | Push, PR |
| `security.yml` | Security scanning (CodeQL, dependencies, licenses) | Push, PR, Schedule |
| `dependency-review.yml` | Review dependency changes | PR with package changes |
| `convex-schema-check.yml` | Validate Convex schema | Push, PR |
| `claude-code-review.yml` | AI code review | PR |

## Common Issues and Solutions

### Issue: "Unable to locate executable file: pnpm"
**Cause**: Node.js setup with pnpm cache before pnpm installation
**Solution**: Install pnpm before Node.js setup

### Issue: "ERR_PNPM_UNSUPPORTED_ENGINE"
**Cause**: Wrong pnpm version specified
**Solution**: Update to `version: 10.12.1` in pnpm/action-setup

### Issue: "Cannot specify both allow-licenses and deny-licenses"
**Cause**: Conflicting license parameters in dependency-review-action
**Solution**: Use only one parameter (prefer deny-licenses)

## Maintenance

### Updating pnpm Version
1. Update `packageManager` field in package.json
2. Update ALL workflow files to use the new version
3. Test locally with `act` if possible

### Adding New Workflows
1. Follow the step ordering requirements above
2. Use exact versions for all tools
3. Add appropriate permissions block
4. Document in this README

## Testing Workflows Locally

Use [act](https://github.com/nektos/act) to test workflows locally:

```bash
# Test all workflows
act

# Test specific workflow
act -W .github/workflows/security.yml

# Test with specific event
act pull_request
```

## Security Considerations

- Never commit secrets directly in workflows
- Use GitHub Secrets for sensitive values
- Limit permissions to minimum required
- Review third-party actions before use
- Pin action versions to specific commits for security