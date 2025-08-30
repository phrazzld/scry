# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Scry, please report it by:

1. **Do NOT** create a public GitHub issue
2. Send an email to security@[yourdomain] with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide updates on the fix.

## Security Measures

### Automated Security Scanning

This project implements multiple layers of automated security scanning:

#### 1. Dependabot
- **Configuration**: `.github/dependabot.yml`
- **Frequency**: Daily scans for npm dependencies, weekly for GitHub Actions
- **Auto-PRs**: Creates pull requests for dependency updates
- **Grouping**: Minor and patch updates are grouped together

#### 2. GitHub Security Scanning
- **Workflows**: `.github/workflows/security.yml`
- **Components**:
  - npm audit checks
  - CodeQL analysis for JavaScript/TypeScript
  - License compatibility verification
  - Snyk vulnerability scanning (when configured)

#### 3. Dependency Review
- **Workflow**: `.github/workflows/dependency-review.yml`
- **Triggers**: On PRs that modify dependencies
- **Checks**: 
  - Fails on high/critical vulnerabilities
  - License compatibility
  - OpenSSF Scorecard ratings

### Manual Security Setup

#### Enabling Snyk Integration (Optional)
1. Sign up for a free Snyk account at https://snyk.io
2. Get your authentication token from account settings
3. Add the token as a GitHub secret named `SNYK_TOKEN`:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SNYK_TOKEN`
   - Value: Your Snyk authentication token

#### Viewing Security Reports
- **GitHub Security Tab**: View Dependabot alerts and code scanning results
- **Pull Request Checks**: Automated comments on dependency changes
- **Actions Tab**: View security workflow runs and summaries

### Security Best Practices Implemented

1. **Authentication Security**
   - Cryptographically secure token generation using `crypto.getRandomValues()`
   - Magic link authentication with expiration
   - Session tokens with 30-day expiry

2. **Rate Limiting**
   - API endpoint protection (100 requests/hour per IP)
   - Magic link rate limiting (5 requests/hour per email)
   - Database-backed tracking for distributed systems

3. **Input Sanitization**
   - AI prompt injection prevention
   - Zod schema validation on all inputs
   - Pattern detection for malicious content

4. **Dependency Management**
   - Automated vulnerability scanning
   - License compatibility checks
   - Regular dependency updates via Dependabot

### Security Checklist for Contributors

- [ ] No hardcoded secrets or API keys in code
- [ ] All user inputs validated with Zod schemas
- [ ] Rate limiting on all public endpoints
- [ ] Secure random generation for tokens/IDs
- [ ] Proper error handling without information leakage
- [ ] Dependencies updated and vulnerability-free
- [ ] Security headers configured properly

## Security Headers

The application implements the following security headers:

```typescript
// Configured in Next.js middleware
{
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}
```

## Third-Party Services Security

- **Convex**: Database and authentication backend
  - End-to-end encrypted data transmission
  - SOC 2 Type II compliant
  
- **Google Gemini API**: AI quiz generation
  - API key stored in environment variables
  - No PII sent to AI service
  
- **Resend**: Email service for magic links
  - API key stored in environment variables
  - Email content sanitized

## Incident Response

In case of a security incident:

1. Immediate containment and assessment
2. Fix deployment within 24 hours for critical issues
3. Security advisory published after fix
4. Post-mortem analysis and prevention measures

## Contact

For security concerns, contact: security@[yourdomain]

Last Updated: 2025-08-29