# BACKLOG: Deployment System Enhancements

This file tracks future deployment improvements that are out of scope for the immediate production fix but would add value over time.

---

## Future Enhancements

### Automated Rollback Capability
- **Description**: Implement one-command rollback to previous deployment state
- **Implementation**:
  - Pre-deployment: Export Convex data to snapshot (`npx convex export snapshots/pre-deploy-${timestamp}.zip`)
  - On failure: Import snapshot to restore (`npx convex import snapshots/...`)
  - Integrate with deployment script
- **Value**: Reduce recovery time from deployment failures from hours to minutes
- **Estimated Effort**: M (2-4 hours)
  - Need snapshot management system
  - Test restore procedures
  - Handle schema migration rollbacks
- **When to Implement**: After 3+ deployment failures occur to justify automation

### Deployment Dashboard
- **Description**: Visual dashboard showing deployment status, history, and health metrics
- **Features**:
  - Real-time deployment status (Convex + Vercel)
  - Deployment history with git commit links
  - Schema version across environments
  - Quick rollback button
- **Value**: Single pane of glass for deployment visibility
- **Estimated Effort**: L (4-8 hours)
- **Tech Stack**: Simple Next.js page using Convex queries + Vercel API
- **When to Implement**: When team size grows beyond 2 developers

### Canary Deployments
- **Description**: Deploy to small percentage of users first, gradually roll out
- **Implementation**:
  - Deploy to Vercel preview environment
  - Route 5% of production traffic to preview
  - Monitor error rates, gradually increase to 100%
- **Value**: Catch production issues before they affect all users
- **Estimated Effort**: XL (8-16 hours)
  - Requires Vercel Enterprise or custom routing logic
  - Need monitoring/metrics integration
- **When to Implement**: When user base exceeds 1000 active users

### Staging Environment
- **Description**: Permanent staging environment mirroring production
- **Setup**:
  - Separate Convex project for staging
  - Separate Vercel project for staging
  - Data seeding scripts for realistic testing
- **Value**: Test production-like scenarios without affecting real users
- **Estimated Effort**: M (3-5 hours)
  - Manual setup of environments
  - CI/CD configuration for staging deploys
  - Documentation
- **When to Implement**: When deploying more than 2x per week

---

## PR Review Follow-Up Items

These items came from PR #28 review feedback but are out of scope for the immediate deployment fix.

### Graceful Version Mismatch UX
- **Description**: Improve user experience when frontend/backend version mismatch occurs during rolling deployments
- **Current State**: Version mismatch throws error unconditionally, crashing the entire app
- **Problem**: During rolling deployments with edge cache serving stale frontend, users hit hard errors instead of graceful degradation
- **Suggested Improvements**:
  - Implement error boundary with user-friendly messaging
  - Add automatic retry/reload mechanisms
  - Consider progressive degradation vs hard error (e.g., show warning banner but allow read-only access)
  - Display countdown timer for automatic retry
  - Provide "Force Refresh" button for immediate resolution
- **Value**: Better UX during deployments, reduced user frustration, fewer support tickets
- **Estimated Effort**: M (2-3 hours)
  - Design error boundary component
  - Implement retry logic with exponential backoff
  - Test during simulated rolling deployment
  - Update deployment-check.ts to support degraded mode
- **When to Implement**: After first user complaints about version mismatch errors
- **Source**: Claude PR #28 review feedback (High Priority Recommendation #3)
- **Related Files**: `lib/deployment-check.ts:68`, `components/deployment-version-guard.tsx`

### Deployment Script Test Coverage
- **Description**: Add automated tests for deployment shell scripts
- **Current State**: No automated tests for `vercel-build.sh`, `check-deployment-health.sh`, `deploy-production.sh`
- **Testing Gaps Identified**:
  1. Environment-aware build script logic (VERCEL_ENV detection)
  2. Health check failure scenarios (e.g., 1 out of 7 functions missing)
  3. Version mismatch detection and error handling
  4. Deployment script error handling and rollback
- **Suggested Implementation**:
  - Set up shell testing framework (bats-core or shunit2)
  - Mock Convex CLI commands for isolated testing
  - Test environment variable handling
  - Test error conditions and exit codes
  - Add to CI pipeline as pre-deployment validation
- **Value**: Higher confidence in deployment automation, catch regressions before production
- **Estimated Effort**: L (4-6 hours)
  - Research and set up shell testing framework
  - Write test cases for all three scripts
  - Mock external dependencies (npx convex, vercel CLI)
  - Integrate into CI/CD pipeline
  - Document testing approach
- **When to Implement**: When deployment frequency exceeds 2x per week or after first deployment script regression
- **Source**: Claude PR #28 review feedback (Testing Gaps)
- **Related Files**: `scripts/vercel-build.sh`, `scripts/check-deployment-health.sh`, `scripts/deploy-production.sh`

---

## Nice-to-Have Improvements

### Deployment Notifications
- **Description**: Slack/Discord/Email notifications on deployment events
- **Triggers**:
  - Deployment started
  - Deployment succeeded
  - Deployment failed (with error details)
  - Schema version mismatch detected
- **Value**: Team awareness without manually checking
- **Effort**: S (1-2 hours with webhook integration)

### Deployment Performance Metrics
- **Description**: Track and visualize deployment performance over time
- **Metrics**:
  - Time to deploy Convex functions
  - Time to deploy Vercel
  - Total deployment duration
  - Success rate percentage
- **Value**: Identify performance regressions in deployment pipeline
- **Effort**: M (2-3 hours with logging + dashboard)

### Pre-deployment Schema Validation
- **Description**: Validate schema changes are backwards-compatible before deploying
- **Checks**:
  - No removed required fields
  - No removed tables with data
  - No changed field types
  - Migrations provided for breaking changes
- **Value**: Prevent deployment of breaking schema changes
- **Effort**: L (4-6 hours)
  - Need schema diff tool
  - Define compatibility rules
  - Integration into CI/CD

### Multi-region Deployment
- **Description**: Deploy to multiple Vercel regions for lower latency
- **Regions**: US, EU, Asia
- **Value**: Faster response times for global users
- **Effort**: M (2-4 hours Vercel configuration)
- **Note**: Convex currently single-region, may need architecture changes

---

## Technical Debt Opportunities

### Deployment Script Error Handling
- **Current State**: Basic error detection with `set -e`
- **Improvement**: Detailed error messages, partial rollback, retry logic
- **Benefit**: More robust deployments with better failure recovery
- **Effort**: S (1-2 hours)
- **When**: After first deployment script failure

### Health Check Extensibility
- **Current State**: Hard-coded checks for specific functions
- **Improvement**: Config-driven health checks (JSON/YAML file listing critical functions)
- **Benefit**: Easy to add new checks without modifying script
- **Effort**: S (1-2 hours)
- **Example Config**:
  ```yaml
  critical_functions:
    - generationJobs:getRecentJobs
    - aiGeneration:processJob
    - questions:saveBatch
  critical_queries:
    - system:getSchemaVersion
  ```

### Deployment Lock Mechanism
- **Current State**: No protection against concurrent deployments
- **Improvement**: Lock file or Convex-based mutex to prevent overlapping deploys
- **Benefit**: Prevent race conditions and corrupted deployments
- **Effort**: M (2-3 hours)
- **When**: If concurrent deployment issues occur

### Deployment Audit Log
- **Current State**: No persistent log of who deployed what when
- **Improvement**: Store deployment events in Convex table with metadata
- **Schema**:
  ```typescript
  deploymentLog: defineTable({
    timestamp: v.number(),
    environment: v.string(),  // "production" | "staging" | "preview"
    deployedBy: v.string(),   // email or CI system
    schemaVersion: v.string(),
    convexDeploymentId: v.string(),
    vercelDeploymentId: v.string(),
    commitSha: v.string(),
    status: v.string(),  // "success" | "failed" | "rolled_back"
  })
  ```
- **Benefit**: Full audit trail for compliance and debugging
- **Effort**: S-M (2-4 hours)

---

## Out of Scope (Don't Build)

These are explicitly NOT worth building based on current scale and complexity:

- ❌ **Blue-Green Deployments**: Overkill for current architecture, Vercel handles this
- ❌ **Feature Flags for Gradual Rollout**: Use Convex feature flags if needed, not deployment-level
- ❌ **Custom Deployment Orchestration Platform**: GitHub Actions + scripts sufficient
- ❌ **Deployment Approval Workflows**: Manual review in PRs is sufficient
- ❌ **Automated Performance Testing in CI**: Too slow, test in staging instead
- ❌ **Schema Migration Generator**: Manual migrations are fine at current scale

---

## When to Revisit This Backlog

Review and prioritize these enhancements when:
- [ ] Team size grows beyond 5 developers
- [ ] Deployment frequency exceeds 10 per week
- [ ] Active user base exceeds 1000 users
- [ ] Deployment failure rate exceeds 5%
- [ ] Recovery time from deployment issues exceeds 1 hour
- [ ] Quarterly planning session for infrastructure improvements

---

**Last Updated**: 2025-01-04
**Next Review**: 2025-04-04 (quarterly)
