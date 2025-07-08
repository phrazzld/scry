# PROJECT TODO

> **Note**: Completed tasks and detailed work logs have been moved to `WORKLOG.md`. This file focuses on remaining tasks and active work.

## IMMEDIATE PRIORITIES

## SECURITY ENHANCEMENTS

### Rate Limiting Setup (BLOCKED - Manual KV Setup)
- [!] Set up Vercel KV: Create KV store via Vercel Dashboard (Storage tab)
**BLOCKED**: Manual task - KV stores must be created via Vercel Dashboard, not CLI

### Manual Steps Required:
1. Visit Vercel Dashboard → Storage tab
2. Create new KV store named "scry-kv"
3. Run `vercel env pull .env.local` to get KV environment variables
4. Proceed with rate limiter implementation once KV store exists

### Rate Limiting Implementation (After KV Setup)
- [ ] Link KV to project: KV store should auto-link, run `vercel env pull` to get KV env vars
- [ ] Implement rate limiter: create `/lib/rate-limit.ts` using @vercel/kv for auth endpoint protection
- [ ] Add rate limiting middleware: apply rate limiter to `/api/auth/*` endpoints
- [ ] Test rate limiting: verify rate limits work locally and in production
- [ ] Monitor security logs: use `vercel logs --prod` to monitor authentication attempts

### Additional Security Tasks
- [ ] Enable HTTPS redirect: ensure `headers()` in next.config.js includes strict transport security

## PERFORMANCE OPTIMIZATION

### Caching & Performance
- [ ] Configure KV session cache: implement session caching in `/lib/auth.ts` using Vercel KV
- [ ] Set cache TTL: configure 5-minute cache TTL for session lookups in KV
- [ ] Optimize bundle size: run `pnpm analyze` to check impact of auth dependencies

## QUALITY ASSURANCE

### Testing
- [ ] **Add Unit Tests for Auth Configuration**: Test NextAuth configuration independently
  - **Coverage**: Email provider setup, callback functions, session configuration
  - **Mock Dependencies**: Mock Prisma, email service, external dependencies
  - **Validation**: Ensure configuration changes don't break authentication flow
  - **Framework**: Use Vitest with proper mocking for NextAuth internals

### Monitoring & Observability
- [ ] **Implement Structured Error Logging**: Add comprehensive logging for production debugging
  - **Log Levels**: DEBUG (development), INFO (auth events), WARN (recoverable errors), ERROR (failures)
  - **Context**: Include user ID (when available), session info, timestamp, request metadata
  - **Format**: JSON structured logs for parsing and analysis
  - **Storage**: Integrate with Vercel logging or external service (DataDog, LogRocket)

- [ ] **Add Performance Monitoring**: Track auth flow performance and bottlenecks
  - **Metrics**: Email send time, database query performance, session creation time
  - **Alerts**: Set up alerts for authentication failure rates, slow responses
  - **Dashboard**: Create monitoring dashboard for auth system health
  - **Tools**: Integrate with Vercel Analytics, custom metrics collection

## CONFIGURATION & ENVIRONMENT

### Environment Management
- [ ] **Audit Environment Variable Consistency**: Ensure all environments have required variables
  - **Environments**: Development, Preview, Production
  - **Validation Script**: Create script to check env var completeness across environments
  - **Documentation**: Update `.env.example` with all required variables and descriptions
  - **Security**: Ensure no sensitive values in repository or logs

- [ ] **Create Environment Validation Script**: Automated check for production readiness
  - **Checks**: Database connectivity, email service, required environment variables
  - **Integration**: Run during deployment pipeline before going live
  - **Output**: Clear pass/fail status with specific remediation instructions
  - **Format**: CLI tool with colored output and actionable error messages

- [ ] Consolidate .env files: reimagine and consolidate .env, .env.local, .env.example, and .env.local.example into proper hierarchy

## DEPLOYMENT

### Final Deployment Tasks
- [ ] Deploy to production: run `vercel --prod` for production deployment
- [ ] Monitor deployment: run `vercel logs --prod --follow` to monitor real-time logs
- [ ] Set up alerts: configure Vercel monitoring alerts for errors
- [ ] Document deployment: update README with deployment instructions

## LONG-TERM IMPROVEMENTS

### Security Hardening
- [ ] **Implement Rate Limiting**: Add rate limiting to authentication endpoints
  - **Implementation**: Use Vercel KV for rate limiting storage (requires manual KV setup)
  - **Limits**: 5 email requests per hour per IP, 3 requests per minute per email
  - **Error Handling**: Clear error messages for rate-limited users
  - **Monitoring**: Track rate limiting effectiveness and false positives

- [ ] **Add Session Security Enhancements**: Improve session management security
  - **Features**: Session invalidation on suspicious activity, device tracking
  - **Implementation**: Extend current session management with security metadata
  - **Monitoring**: Log and alert on unusual session patterns
  - **User Control**: Allow users to view and revoke active sessions

### Development Experience
- [ ] **Create Development Authentication Shortcuts**: Improve developer experience
  - **Implementation**: Development-only authentication bypass for testing
  - **Security**: Ensure shortcuts are completely disabled in production
  - **Documentation**: Clear instructions for local development setup
  - **Validation**: Automated tests to ensure shortcuts don't reach production

- [ ] **Enhanced Error Documentation**: Create comprehensive error handling documentation
  - **Coverage**: All possible authentication error states and resolutions
  - **Format**: Searchable knowledge base with troubleshooting guides
  - **Integration**: Link error documentation from error messages in UI
  - **Maintenance**: Keep documentation updated with new error patterns

### User Experience
- [ ] **Implement Password Reset Flow**: Add password reset for users who want to change from magic links
  - **Implementation**: Optional password auth alongside magic link auth
  - **UI**: Password reset form with email verification
  - **Security**: Secure password reset tokens with expiration
  - **Migration**: Allow existing users to set passwords

- [ ] **Add User Profile Management**: Expand settings page with profile editing
  - **Features**: Update name, email, profile picture
  - **Validation**: Email verification for email changes
  - **Security**: Password confirmation for sensitive changes
  - **Integration**: Profile data used throughout application

### Analytics & Insights
- [ ] **Enhanced Analytics Dashboard**: Create comprehensive analytics for auth flows
  - **Metrics**: Sign-up rates, auth method preferences, drop-off points
  - **Visualization**: Charts and graphs for auth performance over time
  - **Alerts**: Notifications for unusual auth patterns or failures
  - **Integration**: Connect with business intelligence tools

---

*Last updated: 2025-07-08*
*Work history available in: `WORKLOG.md`*