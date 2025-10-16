# Scry Documentation

Clear, organized documentation for setup, operations, and security.

## Quick Start

**New to the project?** Start here:
1. [`setup/environment-setup.md`](setup/environment-setup.md) - Environment configuration
2. [`setup/development-authentication.md`](setup/development-authentication.md) - Auth setup
3. [`SECURITY.md`](SECURITY.md) - Secret management guidelines

**Deploying?** Check:
- [`operations/deployment-checklist.md`](operations/deployment-checklist.md)
- [`setup/vercel-project-setup.md`](setup/vercel-project-setup.md)

## Directory Structure

### [`setup/`](setup/)
One-time configuration for new developers or environments.

- **[environment-setup.md](setup/environment-setup.md)** - Environment variables and configuration
- **[development-authentication.md](setup/development-authentication.md)** - Local auth setup
- **[ci-cd-setup.md](setup/ci-cd-setup.md)** - GitHub Actions and automation
- **[vercel-project-setup.md](setup/vercel-project-setup.md)** - Vercel deployment configuration

### [`operations/`](operations/)
Day-to-day operations, testing, and maintenance.

- **[deployment-checklist.md](operations/deployment-checklist.md)** - Pre-deployment verification
- **[auth-testing-guide.md](operations/auth-testing-guide.md)** - Testing authentication flows
- **[monitoring-setup.md](operations/monitoring-setup.md)** - Observability and alerting
- **[logging.md](operations/logging.md)** - Logging conventions
- **[error-handling.md](operations/error-handling.md)** - Error patterns and recovery

### Root Level

- **[SECURITY.md](SECURITY.md)** - Secret management, incident response, security practices

### [`archive/`](archive/)
Historical documentation for completed features and decisions.

## Contributing

When adding documentation:
- **Setup docs**: One-time configuration → `setup/`
- **Operations docs**: Ongoing usage → `operations/`
- **Security topics**: → `SECURITY.md` (or link to it)
- **Completed work**: Historical reference → `archive/`

**Never commit secrets** - See [`SECURITY.md`](SECURITY.md)

## Related Documentation

- **[`/CLAUDE.md`](../CLAUDE.md)** - Project-specific Claude Code instructions
- **[`/README.md`](../README.md)** - Project overview and quick start
- **[`/BACKLOG.md`](../BACKLOG.md)** - Feature roadmap and priorities

---

**Last Updated:** 2025-10-13
