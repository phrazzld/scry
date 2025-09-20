# Known Audit Exceptions

This document tracks known low-severity vulnerabilities in development dependencies that we've reviewed and accepted as low risk.

## Accepted Dev-Only Vulnerabilities

### 1. @eslint/plugin-kit - RegEx DoS
- **Advisory**: [GHSA-xffm-g5w8-qvg7](https://github.com/advisories/GHSA-xffm-g5w8-qvg7)
- **Severity**: Low
- **Risk**: Only affects linting during development
- **Justification**: No production exposure, requires malicious config files

### 2. Vite - Public directory file serving
- **Advisory**: [GHSA-g4jq-h2w9-997c](https://github.com/advisories/GHSA-g4jq-h2w9-997c)
- **Severity**: Low
- **Risk**: Only affects Vite dev server
- **Justification**: Dev server not exposed to production

### 3. Vite - server.fs settings on HTML
- **Advisory**: [GHSA-jqfw-vq24-v9c3](https://github.com/advisories/GHSA-jqfw-vq24-v9c3)
- **Severity**: Low
- **Risk**: Only affects Vite dev server
- **Justification**: Dev server not exposed to production

### 4. jsondiffpatch - XSS in HtmlFormatter
- **Advisory**: [GHSA-33vc-wfww-vjfv](https://github.com/advisories/GHSA-33vc-wfww-vjfv)
- **Severity**: Low
- **Risk**: Only used in AI dev tools
- **Justification**: Not user-facing, dev-only dependency

## Policy

- **Critical & High**: Must be fixed immediately
- **Medium**: Evaluate case-by-case, fix if in production code
- **Low (dev deps)**: Document and accept if no production impact

## CI Configuration

Our CI is configured to only fail on critical vulnerabilities:
- `.npmrc`: `audit-level=critical`
- `.github/workflows/ci.yml`: `pnpm audit --audit-level=critical`

*Last reviewed: 2025-01-19*