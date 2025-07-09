# Environment Setup Guide

This guide helps you configure environment variables for the Scry application across different environments.

## Quick Start

1. **Copy the template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your values** in `.env.local`

3. **Validate configuration**:
   ```bash
   pnpm env:validate
   ```

## Required Environment Variables

### Core Application

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `GOOGLE_AI_API_KEY` | Google AI API key for quiz generation | `AIzaSy...` | ✅ |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` | ✅ |
| `NEXTAUTH_SECRET` | NextAuth.js JWT signing secret | Generate with `openssl rand -base64 32` | ✅ |
| `RESEND_API_KEY` | Resend API key for emails | `re_...` | ✅ |
| `EMAIL_FROM` | From address for auth emails | `Scry <noreply@yourdomain.com>` | ✅ |

### Optional Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `NEXTAUTH_URL` | Application base URL | Auto-detected | Required in production |
| `EMAIL_SERVER_HOST` | SMTP server hostname | `smtp.resend.com` | Uses Resend by default |
| `EMAIL_SERVER_PORT` | SMTP server port | `587` | Standard SMTP port |
| `EMAIL_SERVER_USER` | SMTP username | `resend` | Resend default |
| `DATABASE_URL_UNPOOLED` | Direct DB connection | | For migrations |

### Vercel KV (Rate Limiting)

| Variable | Description | Notes |
|----------|-------------|-------|
| `KV_URL` | Redis connection URL | All KV vars required together |
| `KV_REST_API_URL` | REST API endpoint | or none at all |
| `KV_REST_API_TOKEN` | API authentication token | |

## Environment-Specific Setup

### Development

```bash
# Local development with .env.local
cp .env.example .env.local
# Edit .env.local with your development values
pnpm env:validate
```

### Preview/Staging

```bash
# Validate preview environment
pnpm env:validate:preview
```

### Production

```bash
# Validate production readiness
pnpm env:validate:prod
pnpm deploy:check
```

## Validation Commands

| Command | Purpose |
|---------|---------|
| `pnpm env:validate` | Validate current environment |
| `pnpm env:validate:prod` | Validate for production |
| `pnpm env:validate:preview` | Validate for preview |
| `pnpm env:example` | Regenerate .env.example |
| `pnpm deploy:check` | Full deployment readiness check |

## Security Best Practices

### ✅ DO

- Use `.env.local` for local development
- Generate strong secrets: `openssl rand -base64 32`
- Use HTTPS URLs in production
- Keep API keys private and rotate regularly
- Validate environment before deployment

### ❌ DON'T

- Commit `.env` files with real secrets
- Use placeholder values in production
- Share API keys in chat/email
- Use the same secrets across environments
- Skip environment validation

## Getting API Keys

### Google AI API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy the key starting with `AIzaSy...`

### Resend API Key

1. Visit [Resend API Keys](https://resend.com/api-keys)
2. Create a new API key
3. Copy the key starting with `re_...`

### Database (Neon)

1. Visit [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy the connection string
4. Use both pooled and direct URLs if available

### Vercel KV (Optional)

1. Visit Vercel Dashboard → Storage → KV
2. Create a new KV database
3. Copy all three connection variables
4. Use for rate limiting features

## Troubleshooting

### Common Issues

**Environment variables not loading**:
- Ensure `.env.local` exists and has correct format
- Check for syntax errors (no spaces around `=`)
- Restart development server after changes

**API key validation fails**:
- Verify key format matches requirements
- Check for trailing whitespace or quotes
- Regenerate key if format seems incorrect

**Database connection fails**:
- Verify connection string format
- Check network connectivity
- Ensure database is running and accessible

**Email sending fails**:
- Verify Resend API key is valid
- Check email format in `EMAIL_FROM`
- Ensure SMTP settings are correct

### Getting Help

1. Run validation: `pnpm env:validate`
2. Check deployment readiness: `pnpm deploy:check`
3. Review error messages and fix issues
4. Consult documentation for specific services

## Environment File Hierarchy

```
.env.example          # Template (committed to git)
.env.local           # Local development (gitignored)
.env                 # Shared defaults (should be gitignored)
.env.production      # Production overrides (on Vercel)
.env.preview         # Preview overrides (on Vercel)
```

Only `.env.example` should be committed to version control.