# Migration Runbook

This document provides procedures for safely executing database migrations in the Scry application.

## Table of Contents

1. [Migration Inventory](#migration-inventory)
2. [Execution Order](#execution-order)
3. [Pre-flight Checks](#pre-flight-checks)
4. [Execution Steps](#execution-steps)
5. [Verification Queries](#verification-queries)
6. [Rollback Procedures](#rollback-procedures)
7. [Admin Access Management](#admin-access-management)
8. [Troubleshooting](#troubleshooting)

---

## Migration Inventory

### 1. Quiz Results to Questions Migration

**File:** `convex/migrations.ts` - `migrateQuizResultsToQuestions`

**Purpose:** Migrates deprecated `quizResults` table data to the new `questions` + `interactions` architecture.

**Status:** Available (internal mutation)

**Affects:**
- `quizResults` table (reads, marks as migrated)
- `questions` table (creates new records)
- `interactions` table (creates new records)

**When to run:**
- When migrating from legacy quiz storage to individual question tracking
- Only needed if you have data in the old `quizResults` table

**Idempotent:** Yes (checks `sessionId` to skip already-migrated records)

**Estimated duration:** ~1 second per 100 quiz results

---

### 2. Difficulty Field Removal Migration

**File:** `convex/migrations.ts` - `runDifficultyRemoval`

**Purpose:** Removes the deprecated `difficulty` field from existing question records. This field was removed from the schema in v2.0 as it was never used by the FSRS algorithm.

**Status:** Ready to run (public mutation with authentication)

**Affects:**
- `questions` table (removes `difficulty` field from existing records)

**When to run:**
- After deploying schema changes that remove the `difficulty` field
- Before the field removal causes type inconsistencies

**Idempotent:** Yes (skips questions that already lack the `difficulty` field)

**Estimated duration:** ~500 questions per second

**Test coverage:** 19 unit tests covering multi-batch processing, partial failures, idempotency, and dry-run mode

---

### 3. User-specific Rollback

**File:** `convex/migrations.ts` - `rollbackMigrationForUser`

**Purpose:** Rolls back quiz results migration for a specific user (for testing or data recovery).

**Status:** Available (internal mutation)

**Affects:**
- `interactions` table (deletes migration-created records)
- `quizResults` table (resets `sessionId` to unmigrated state)

**When to run:**
- Testing migration behavior
- Recovering from partial migration failures for specific users
- NEVER run in production without explicit need

**Idempotent:** Yes (safe to run multiple times)

**Default mode:** Dry-run (must explicitly set `dryRun: false`)

---

## Execution Order

Migrations should be executed in this order:

1. **Quiz Results Migration** (if applicable)
   - Migrates old data structure to new architecture
   - Must run BEFORE difficulty removal if both are needed

2. **Difficulty Field Removal**
   - Cleans up vestigial schema fields
   - Can run independently if no quiz results migration needed

3. **Rollback** (emergency only)
   - Only use for testing or data recovery
   - NOT part of normal migration workflow

**Dependencies:**
- No migration depends on another completing first
- They operate on different fields/tables
- Can be run independently based on your data state

---

## Pre-flight Checks

Before running ANY migration:

### 1. Verify Database Backup

Convex provides automatic backups, but verify they're enabled:

```bash
# Check Convex dashboard: Settings → Backups
# Ensure point-in-time recovery is available
```

### 2. Check Migration Status

**For Difficulty Removal:**

```bash
# In Convex dashboard or via query
npx convex run migrations:countQuestionsWithDifficulty
```

Expected output:
```json
{
  "total": 1234,
  "withDifficulty": 567,
  "percentage": "45.95"
}
```

If `withDifficulty: 0`, migration is not needed.

### 3. Verify Admin Access

Ensure you have admin credentials configured:

```bash
# Check Convex environment variables
# Required: ADMIN_EMAILS must include your email address
```

See [Admin Access Management](#admin-access-management) for setup.

### 4. Test in Development First

**ALWAYS** run dry-run in development before production:

```bash
# Development instance
NEXT_PUBLIC_CONVEX_URL=https://dev-instance.convex.cloud \
  npx convex run migrations:runDifficultyRemoval --dryRun true
```

### 5. Review Dry-Run Results

Examine the dry-run output:

```json
{
  "status": "completed",
  "dryRun": true,
  "stats": {
    "totalProcessed": 1234,
    "updated": 567,
    "alreadyMigrated": 667,
    "errors": 0
  },
  "message": "Dry run: Would update 567 questions, 667 already migrated"
}
```

Verify:
- ✅ `status: "completed"` (no failures)
- ✅ `errors: 0` (no error count)
- ✅ No `failures` array present
- ✅ `updated + alreadyMigrated = totalProcessed`

---

## Execution Steps

### Difficulty Field Removal Migration

#### Step 1: Authenticate with Clerk

Ensure you're logged into the application with an admin account:

1. Open application in browser
2. Sign in with email listed in `ADMIN_EMAILS` environment variable
3. Verify authentication by checking user profile

#### Step 2: Dry-Run Execution

```bash
# Via Convex CLI (requires authentication context)
npx convex run migrations:runDifficultyRemoval \
  --dryRun true \
  --batchSize 500
```

**Parameters:**
- `dryRun`: Set to `true` to preview changes without applying them
- `batchSize`: Number of questions per batch (default: 500, max: 1000)

#### Step 3: Review Dry-Run Output

Check the output for:
- Total questions to be processed
- Expected update count
- Any potential errors
- Estimated duration

#### Step 4: Production Execution

After verifying dry-run results:

```bash
# Production run
npx convex run migrations:runDifficultyRemoval \
  --batchSize 500
```

**Note:** Omitting `--dryRun` defaults to `false` (production mode).

#### Step 5: Monitor Execution

Watch Convex dashboard logs:

1. Navigate to Convex dashboard → Logs
2. Filter for `migration.difficulty-removal.*` events
3. Monitor for:
   - `migration.difficulty-removal.start` - Migration started
   - `migration.batch` - Batch completion events
   - `migration.difficulty-removal.complete` - Migration finished
   - `migration.difficulty-removal.error` - Any errors (should not appear)

#### Step 6: Handle Partial Failures

If migration returns `status: "partial"`:

```json
{
  "status": "partial",
  "dryRun": false,
  "stats": {
    "totalProcessed": 1000,
    "updated": 950,
    "alreadyMigrated": 0,
    "errors": 50
  },
  "failures": [
    { "recordId": "jd7x8y9z", "error": "..." },
    // ... more failures
  ],
  "message": "Partially completed: 950 succeeded, 50 failed"
}
```

**Action:**
1. Review `failures` array for error patterns
2. Check Convex logs for detailed error messages
3. Fix underlying issues (e.g., data corruption, schema conflicts)
4. Re-run migration (idempotent - will skip already-migrated records)

---

## Verification Queries

### Post-Migration Verification

#### 1. Verify Difficulty Field Removal

```bash
npx convex run migrations:countQuestionsWithDifficulty
```

**Expected result:**
```json
{
  "total": 1234,
  "withDifficulty": 0,
  "percentage": "0"
}
```

✅ **Success criteria:** `withDifficulty: 0`

#### 2. Spot-Check Questions

Query random questions to verify field is removed:

```javascript
// In Convex dashboard → Data → questions table
// Select random records and verify no 'difficulty' field present
```

#### 3. Verify Application Functionality

After migration:

1. Generate new questions → Should not have `difficulty` field
2. Review existing questions → Should display correctly
3. FSRS scheduling → Should work normally (uses `fsrsDifficulty` parameter)

#### 4. Check Logs for Errors

```bash
# In Convex dashboard
# Filter logs for: level:error AND module:migrations
# Should return no results
```

---

## Rollback Procedures

### Difficulty Field Removal Rollback

**⚠️ WARNING:** This migration is **NOT reversible**. Once the `difficulty` field is removed, the original values cannot be recovered.

**Prevention:**
- Always run dry-run first
- Verify dry-run results before production
- Ensure Convex backups are enabled
- Test in development environment first

**Recovery options if migration fails:**

1. **Partial failure (some questions still have difficulty):**
   - Re-run migration (idempotent)
   - Only failed records will be retried

2. **Complete rollback needed:**
   - Contact Convex support for point-in-time backup restoration
   - Restore to timestamp before migration execution
   - Review and fix underlying issues
   - Re-run migration with fixes

3. **Application broken after migration:**
   - Revert schema changes: `git revert <commit-hash>`
   - Deploy previous schema version: `npx convex deploy`
   - Migration data remains (harmless - just extra fields)

### Quiz Results Migration Rollback

For testing or emergency recovery:

```bash
# Dry-run first (default mode)
npx convex run migrations:rollbackMigrationForUser \
  --userId "user_id_here" \
  --dryRun true

# Actual rollback (DANGEROUS)
npx convex run migrations:rollbackMigrationForUser \
  --userId "user_id_here" \
  --dryRun false
```

**This will:**
- Delete all interactions created by migration for that user
- Reset `sessionId` on quiz results to unmigrated state
- NOT delete questions (they may be used by other interactions)

---

## Admin Access Management

### Setup Admin Access

Admin access is controlled via the `ADMIN_EMAILS` environment variable in Convex.

#### 1. Add Admin Emails to Convex

```bash
# Via Convex dashboard
1. Navigate to Settings → Environment Variables
2. Add new variable: ADMIN_EMAILS
3. Set value to comma-separated list of admin emails:
   admin@example.com,ops@example.com,yourname@company.com
4. Save changes
```

#### 2. Verify Configuration

```bash
# Check environment variable is set
npx convex env ls | grep ADMIN_EMAILS
```

#### 3. Test Admin Access

Attempt to run migration as admin user:

```bash
# Should succeed (returns migration result)
npx convex run migrations:runDifficultyRemoval --dryRun true

# If unauthorized, check:
# 1. Email is in ADMIN_EMAILS list
# 2. Authenticated via Clerk with correct email
# 3. No typos in email address
```

### Audit Trail

All migration attempts are logged with user details:

```javascript
// In Convex logs, search for:
event: "migration.difficulty-removal.start"
event: "migration.unauthorized"

// Each log includes:
{
  userId: "user_id",
  userEmail: "user@example.com",
  timestamp: "...",
  dryRun: true/false
}
```

### Security Best Practices

1. **Limit admin access:** Only add emails for users who need migration access
2. **Use real email addresses:** Convex authenticates via Clerk - must be valid accounts
3. **Rotate admin list:** Remove users who no longer need access
4. **Monitor logs:** Review `migration.unauthorized` events for access attempts
5. **Production access:** Limit to 2-3 trusted administrators

### Adding/Removing Admins

**To add admin:**
1. Go to Convex dashboard → Settings → Environment Variables
2. Edit `ADMIN_EMAILS` variable
3. Add email to comma-separated list: `existing@email.com,new@email.com`
4. Save (takes effect immediately - no deploy needed)

**To remove admin:**
1. Edit `ADMIN_EMAILS` variable
2. Remove email from list
3. Save (access revoked immediately)

**To audit current admins:**
```bash
# View current admin list
npx convex env get ADMIN_EMAILS
```

---

## Troubleshooting

### Common Issues

#### Issue: "Unauthorized: Admin access required"

**Cause:** User email not in `ADMIN_EMAILS` environment variable

**Solution:**
1. Verify you're authenticated with Clerk
2. Check your email matches `ADMIN_EMAILS` exactly
3. Confirm environment variable is set in correct Convex deployment (dev vs prod)
4. Try logging out and back in

---

#### Issue: Migration returns `status: "partial"`

**Cause:** Some records failed to migrate

**Solution:**
1. Review `failures` array in migration result
2. Check Convex logs for detailed error messages
3. Identify common error patterns
4. Fix underlying data issues
5. Re-run migration (will skip successful records)

---

#### Issue: Migration timeout

**Cause:** Too many records in single batch

**Solution:**
1. Reduce `batchSize` parameter: `--batchSize 250`
2. Re-run migration (will continue from where it failed)
3. Consider running during low-traffic period

---

#### Issue: "Question still has difficulty field after migration"

**Cause:** Possible causes:
- New questions generated between migration runs
- Migration failed for specific records
- Cached data in application

**Solution:**
1. Re-run verification query: `countQuestionsWithDifficulty`
2. If count > 0, re-run migration (idempotent)
3. Clear application cache/refresh browser
4. Check application code isn't adding field back

---

#### Issue: Application errors after migration

**Cause:** Schema mismatch or data inconsistency

**Solution:**
1. Check Convex logs for TypeScript errors
2. Verify schema is deployed: `npx convex deploy`
3. Ensure application code doesn't reference `difficulty` field
4. Run verification queries to check data integrity
5. If needed, revert schema changes and investigate

---

### Getting Help

If you encounter issues not covered here:

1. **Check Convex logs:** Detailed error messages with stack traces
2. **Review migration tests:** `convex/migrations.test.ts` for expected behavior
3. **Contact team lead:** Escalate if data integrity is at risk
4. **Convex support:** For platform-specific issues or backup restoration

---

## Migration History

Track completed migrations here:

| Date | Migration | Deployed By | Status | Notes |
|------|-----------|-------------|--------|-------|
| YYYY-MM-DD | Difficulty Removal | name@example.com | Pending | Awaiting deployment |

---

**Last Updated:** 2025-01-16

**Document Owner:** Engineering Team

**Review Schedule:** After each migration execution
