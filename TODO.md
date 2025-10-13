# TODO

Active development tasks organized by priority.

## High Priority

### Add Unit Tests for Health Check Queries
**Context:** PR #34 review feedback - health checks are now critical infrastructure
**File:** `convex/health.test.ts` (NEW)
**Effort:** 45 minutes

**Requirements:**
- Test `health:check` query returns healthy when all env vars present
- Test `health:check` query returns unhealthy with correct missing array
- Test `health:check` handles edge cases (empty strings, whitespace)
- Test `health:detailed` query classifies critical vs recommended vars correctly
- Test deployment URL validation (CONVEX_CLOUD_URL)

**Implementation:**
```typescript
// convex/health.test.ts
import { convexTest } from "convex-test";
import { api } from "./_generated/api";

describe("Health checks", () => {
  it("reports healthy when all vars present", async () => {
    const t = convexTest({
      env: {
        GOOGLE_AI_API_KEY: "AIzaTest",
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "test@example.com",
        NEXT_PUBLIC_APP_URL: "https://test.com",
        CONVEX_CLOUD_URL: "https://test.convex.cloud",
      },
    });
    const result = await t.query(api.health.check, {});
    expect(result.healthy).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("reports missing vars correctly", async () => {
    const t = convexTest({ env: {} });
    const result = await t.query(api.health.check, {});
    expect(result.healthy).toBe(false);
    expect(result.missing).toContain("GOOGLE_AI_API_KEY");
    expect(result.missing).toContain("CONVEX_CLOUD_URL");
  });

  it("handles empty string as missing", async () => {
    const t = convexTest({
      env: {
        GOOGLE_AI_API_KEY: "  ", // Whitespace only
        RESEND_API_KEY: "",       // Empty string
        EMAIL_FROM: "test@example.com",
        NEXT_PUBLIC_APP_URL: "https://test.com",
        CONVEX_CLOUD_URL: "https://test.convex.cloud",
      },
    });
    const result = await t.query(api.health.check, {});
    expect(result.healthy).toBe(false);
    expect(result.missing).toContain("GOOGLE_AI_API_KEY");
    expect(result.missing).toContain("RESEND_API_KEY");
  });

  describe("detailed health check", () => {
    it("classifies critical failures correctly", async () => {
      const t = convexTest({
        env: {
          EMAIL_FROM: "test@example.com", // Non-critical
          NEXT_PUBLIC_APP_URL: "https://test.com", // Non-critical
        },
      });
      const result = await t.query(api.health.detailed, {});
      expect(result.status).toBe("unhealthy"); // Missing critical vars
      expect(result.checks.GOOGLE_AI_API_KEY.critical).toBe(true);
      expect(result.checks.GOOGLE_AI_API_KEY.status).toBe("missing");
    });

    it("reports degraded when only non-critical missing", async () => {
      const t = convexTest({
        env: {
          GOOGLE_AI_API_KEY: "AIzaTest",
          RESEND_API_KEY: "re_test",
          // EMAIL_FROM and NEXT_PUBLIC_APP_URL missing (non-critical)
        },
      });
      const result = await t.query(api.health.detailed, {});
      expect(result.status).toBe("degraded");
    });
  });
});
```

**Success Criteria:**
- All tests pass
- Coverage for happy path, error cases, and edge cases
- Tests run in CI pipeline
- Documentation updated with testing approach

---

### Integrate Validation into GitHub Actions CI
**Context:** PR #34 review feedback - prevent environment issues in CI
**File:** `.github/workflows/ci.yml` (UPDATE)
**Effort:** 1 hour

**Requirements:**
- Add `validate-env` job that runs before deployments
- Check both Vercel and Convex environment variables
- Fail CI if validation fails
- Add to pull request checks

**Implementation:**
```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

jobs:
  validate-env:
    name: Validate Environment Variables
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Install Convex CLI
        run: pnpm add -g convex

      - name: Install Vercel CLI
        run: pnpm add -g vercel

      - name: Validate Production Environment
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          # Link to Vercel project
          vercel link --yes --token=$VERCEL_TOKEN

          # Run validation
          ./scripts/validate-env-vars.sh production

      - name: Run Health Check (if on main)
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
        run: |
          npx convex run health:check --prod

  # ... rest of CI jobs depend on validate-env
  build:
    needs: validate-env
    # ... existing build job
```

**Success Criteria:**
- Validation runs on all PRs
- CI fails if env vars missing
- Clear error messages in GitHub checks
- Documentation updated in CI/CD setup docs

---

### Add BATS Tests for Shell Scripts
**Context:** PR #34 review feedback - ensure scripts work across environments
**Files:**
- `tests/scripts/validate-env-vars.test.bats` (NEW)
- `tests/scripts/check-deployment-health.test.bats` (NEW)
**Effort:** 2 hours

**Requirements:**
- Test all error paths and edge cases
- Mock Convex/Vercel CLI responses
- Test with all vars present
- Test with missing Convex vars
- Test with missing Vercel vars
- Test with invalid environment argument

**Implementation:**
```bash
# tests/scripts/validate-env-vars.test.bats

setup() {
  load 'test_helper/bats-support/load'
  load 'test_helper/bats-assert/load'

  # Source the script functions (if refactored for testability)
  # Or mock commands
}

@test "validates production environment successfully" {
  # Mock npx convex env get to return success
  function npx() {
    if [[ "$2" == "env" && "$3" == "get" ]]; then
      return 0
    fi
  }
  export -f npx

  # Mock vercel env ls
  function vercel() {
    if [[ "$2" == "ls" ]]; then
      echo "NEXT_PUBLIC_CONVEX_URL  Production"
      echo "CONVEX_DEPLOY_KEY       Production"
    fi
  }
  export -f vercel

  run ./scripts/validate-env-vars.sh production
  assert_success
  assert_output --partial "✅ Environment validation passed"
}

@test "fails when Convex vars missing" {
  function npx() {
    if [[ "$4" == "GOOGLE_AI_API_KEY" ]]; then
      return 1 # Missing
    fi
    return 0
  }
  export -f npx

  run ./scripts/validate-env-vars.sh production
  assert_failure
  assert_output --partial "GOOGLE_AI_API_KEY"
}

@test "rejects invalid environment" {
  run ./scripts/validate-env-vars.sh invalid
  assert_failure
  assert_output --partial "Invalid environment"
}
```

**Setup:**
```bash
# Install BATS
pnpm add -D bats bats-support bats-assert

# Add to package.json
{
  "scripts": {
    "test:scripts": "bats tests/scripts"
  }
}
```

**Success Criteria:**
- All error paths covered
- Tests run in CI
- Scripts proven to work across environments
- Documentation includes testing approach

---

## Medium Priority

### Add Monitoring/Alerting Integration
**Context:** PR #34 review feedback - proactive configuration drift detection
**File:** `convex/cron.ts` (UPDATE)
**Effort:** 2-3 hours

**Requirements:**
- Daily cron job checks health endpoint
- Alerts if environment unhealthy
- Logs health status for monitoring
- Integrates with monitoring service (Sentry, Datadog, or similar)

**Implementation:**
```typescript
// convex/cron.ts
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Daily health check at 6 AM UTC
crons.daily(
  'daily-health-check',
  { hourUTC: 6, minuteUTC: 0 },
  internal.monitoring.checkAndAlertHealth
);

export default crons;

// convex/monitoring.ts
import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';

export const checkAndAlertHealth = internalMutation({
  handler: async (ctx) => {
    const health = await ctx.runQuery(internal.health.check, {});

    if (!health.healthy) {
      console.error('[HEALTH] Deployment unhealthy:', {
        missing: health.missing,
        timestamp: health.timestamp,
        deployment: health.deployment,
      });

      // Send alert to monitoring service
      // await sendAlert({ ... });
    }

    // Log health status for monitoring
    await ctx.db.insert('healthChecks', {
      timestamp: Date.now(),
      healthy: health.healthy,
      missing: health.missing,
      deployment: health.deployment,
    });
  },
});
```

**Success Criteria:**
- Health checks run automatically
- Alerts sent on unhealthy status
- Historical health data logged
- Integration tested in production

---

## Low Priority

### Add Deployment Rollback Mechanism
**Context:** PR #34 review feedback - atomic deployment safety
**File:** `scripts/deploy-production.sh` (UPDATE)
**Effort:** 3-4 hours

**Blockers:** Requires Convex CLI rollback support (check if available)

**Requirements:**
- If Vercel deploy fails, rollback Convex to previous version
- Capture Convex deployment ID before upgrade
- Implement rollback via Convex CLI
- Test rollback scenarios

---

### Add API Key Format Validation
**Context:** PR #34 review feedback - catch typos before deployment
**File:** `scripts/validate-env-vars.sh` (UPDATE)
**Effort:** 30 minutes

**Requirements:**
- Validate GOOGLE_AI_API_KEY starts with "AIza"
- Validate RESEND_API_KEY starts with "re_"
- Validate email addresses in EMAIL_FROM
- Validate URLs in NEXT_PUBLIC_APP_URL

---

### Add Dry-Run Mode to Validation Script
**Context:** PR #34 review feedback - better developer experience
**File:** `scripts/validate-env-vars.sh` (UPDATE)
**Effort:** 15 minutes

**Requirements:**
- Add `DRY_RUN` environment variable support
- Show what would be validated without blocking
- Don't exit on failures in dry-run mode
- Document dry-run usage

---

**Last Updated:** 2025-10-13 (PR #34 review feedback)
