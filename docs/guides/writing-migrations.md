# Writing Safe Convex Migrations

## Overview

This guide covers best practices for writing data migrations in Convex, based on lessons learned from production deployments. Migrations are one-time operations that transform existing data to match schema changes.

**Key Principles:**
1. **Idempotent**: Safe to run multiple times
2. **Verifiable**: Can confirm completion
3. **Reversible**: Where possible, provide rollback
4. **Incremental**: Process large datasets in batches
5. **Visible**: Log progress and deployment target

## Required Migration Components

Every production migration MUST include all five components:

### 1. Dry-Run Support

Allow previewing changes without modifying data:

```typescript
export const myMigration = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),  // ← REQUIRED
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun || false;

    // ... migration logic

    if (!dryRun) {
      await ctx.db.replace(doc._id, updatedDoc);
    }
    // Count changes either way for verification
  },
});
```

**Why**: Allows testing on production data without modifying it.

### 2. Diagnostic Query

Provide a way to check if migration is needed:

```typescript
/**
 * Check how many records still need migration
 */
export const myMigrationDiagnostic = query({
  args: {},
  handler: async (ctx) => {
    const needsMigration = await ctx.db
      .query('tableName')
      .filter(q => {
        // Runtime check for deprecated field
        const doc = q as any;
        return 'deprecatedField' in doc;
      })
      .take(100);  // Limit for performance

    return {
      count: needsMigration.length,
      sample: needsMigration.length > 0 ? needsMigration[0]._id : null,
    };
  },
});
```

**Why**: Allows verifying migration completed successfully (should return `{ count: 0 }`).

### 3. Runtime Property Checks

Use runtime checks, not TypeScript type checks:

```typescript
// ❌ WRONG: TypeScript optimizes this away after schema change
if (doc.deprecatedField !== undefined) {
  // UNREACHABLE CODE after removing field from schema!
}

// ✅ CORRECT: Runtime property existence check
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docData = doc as any;
if ('deprecatedField' in docData) {
  // This code WILL execute at runtime
  const { deprecatedField, _id, _creationTime, ...rest } = docData;
  await ctx.db.replace(doc._id, rest);
}
```

**Why**: TypeScript's type erasure removes compile-time checks during transpilation. After removing a field from schema, TypeScript knows it "doesn't exist" and optimizes away dead code paths.

### 4. Environment Logging

Log deployment target at startup:

```typescript
handler: async (ctx, args) => {
  const logger = createLogger({
    module: 'migrations',
    function: 'myMigration',
  });

  // FIRST LOG: Deployment context
  logger.info('Migration started', {
    event: 'migration.start',
    dryRun: args.dryRun || false,
    // Deployment URL logged automatically via createLogger
  });

  // ... migration logic
}
```

**Why**: Makes debugging "deployed to wrong environment" issues immediately obvious in logs.

### 5. Batch Processing

For datasets >500 records, process in batches:

```typescript
const batchSize = args.batchSize || 100;
const allRecords = await ctx.db.query('table').collect();

// Process in batches
for (let i = 0; i < allRecords.length; i += batchSize) {
  const batch = allRecords.slice(i, i + batchSize);

  for (const record of batch) {
    // Process record
    stats.processed++;
  }

  // Log batch completion
  logger.info('Batch completed', {
    batchNumber: Math.floor(i / batchSize) + 1,
    processed: stats.processed,
    total: allRecords.length,
  });
}
```

**Why**: Prevents timeout errors, provides progress visibility, allows resuming if interrupted.

## Schema Removal Pattern (3-Phase)

When removing a field from schema, follow this exact sequence to avoid schema validation errors:

### Phase 1: Make Field Optional

Make the field optional (backwards-compatible):

```typescript
// convex/schema.ts
questions: defineTable({
  // ... other fields
  topic: v.optional(v.string()),  // ← Changed from v.string() to optional
  // ... other fields
})
```

**Commit and deploy:**
```bash
git add convex/schema.ts
git commit -m "temp: make topic field optional for migration"
./scripts/deploy-production.sh
```

**Why**: Allows schema to accept both old data (with field) and new data (without field).

### Phase 2: Run Migration

Create and run migration to remove field from existing data:

```bash
# Use migration workflow script (enforces dry-run)
./scripts/run-migration.sh removeTopicFromQuestions production
```

**Or manually:**
```bash
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)

# Dry-run first
npx convex run migrations:removeTopicFromQuestions --args '{"dryRun":true}'
# Note: "Would update 332 records"

# Actual migration
npx convex run migrations:removeTopicFromQuestions
# Verify: "Successfully updated 332 records"

# Diagnostic check
npx convex run migrations:removeTopicFromQuestionsDiagnostic
# Should return: { count: 0 }
```

**Commit migration code:**
```bash
git add convex/migrations.ts
git commit -m "feat: add migration to remove topic field"
git push
```

### Phase 3: Remove Field from Schema

Remove field entirely (pristine schema):

```typescript
// convex/schema.ts
questions: defineTable({
  // ... other fields
  // topic field removed entirely
  // ... other fields
})
```

**Commit and deploy:**
```bash
git add convex/schema.ts
git commit -m "feat: remove topic field permanently - pristine schema"
./scripts/deploy-production.sh
```

**Why**: Schema now matches data (no topic field), validation passes.

## Complete Migration Example

Here's a complete example removing a deprecated `difficulty` field:

```typescript
// convex/migrations.ts

import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';
import { createLogger } from './lib/logger';

/**
 * Migration stats type
 */
type DifficultyRemovalStats = {
  totalProcessed: number;
  updated: number;
  alreadyMigrated: number;
  errors: number;
};

/**
 * Diagnostic query: Check how many questions still have difficulty field
 */
export const removeDifficultyDiagnostic = query({
  args: {},
  handler: async (ctx) => {
    const questionsWithDifficulty = await ctx.db
      .query('questions')
      .filter(q => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = q as any;
        return 'difficulty' in doc;
      })
      .take(10);

    return {
      count: questionsWithDifficulty.length,
      sample: questionsWithDifficulty.length > 0
        ? questionsWithDifficulty[0]._id
        : null,
    };
  },
});

/**
 * Migration: Remove difficulty field from all questions
 */
export const removeDifficultyFromQuestions = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;
    const dryRun = args.dryRun || false;

    const logger = createLogger({
      module: 'migrations',
      function: 'removeDifficultyFromQuestions',
    });

    // Log deployment context
    logger.info('Migration started', {
      event: 'migration.difficulty-removal.start',
      dryRun,
    });

    const stats: DifficultyRemovalStats = {
      totalProcessed: 0,
      updated: 0,
      alreadyMigrated: 0,
      errors: 0,
    };

    try {
      // Fetch all questions
      const allQuestions = await ctx.db.query('questions').collect();

      logger.info('Processing questions', {
        totalQuestions: allQuestions.length,
      });

      // Process in batches
      for (let i = 0; i < allQuestions.length; i += batchSize) {
        const batch = allQuestions.slice(i, i + batchSize);

        for (const question of batch) {
          stats.totalProcessed++;

          // Runtime property check
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const questionData = question as any;

          if ('difficulty' in questionData) {
            if (!dryRun) {
              // Remove difficulty field
              const {
                difficulty: _difficulty,
                _id,
                _creationTime,
                ...questionWithoutDifficulty
              } = questionData;

              await ctx.db.replace(question._id, questionWithoutDifficulty);
            }
            stats.updated++;
          } else {
            stats.alreadyMigrated++;
          }
        }

        // Log batch completion
        if ((i + batchSize) % 500 === 0 || i + batchSize >= allQuestions.length) {
          logger.info('Batch processed', {
            processed: stats.totalProcessed,
            total: allQuestions.length,
          });
        }
      }

      logger.info('Migration completed', {
        event: 'migration.difficulty-removal.complete',
        dryRun,
        stats,
      });

      return {
        status: 'completed' as const,
        dryRun,
        stats,
        message: dryRun
          ? `Dry run: Would update ${stats.updated} questions`
          : `Successfully updated ${stats.updated} questions`,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      logger.error('Migration failed', {
        event: 'migration.difficulty-removal.error',
        error: error.message,
        stats,
      });

      return {
        status: 'failed' as const,
        dryRun,
        stats,
        message: `Migration failed: ${error.message}`,
      };
    }
  },
});
```

## Testing Workflow

### 1. Test in Development

```bash
# Export dev deploy key
export CONVEX_DEPLOY_KEY=dev:amicable-lobster-935|...

# Dry-run first
npx convex run migrations:removeDifficultyFromQuestions --args '{"dryRun":true}'
# Review output: "Dry run: Would update X questions"

# Run actual migration
npx convex run migrations:removeDifficultyFromQuestions
# Verify: "Successfully updated X questions"

# Check diagnostic
npx convex run migrations:removeDifficultyDiagnostic
# Should return: { count: 0, sample: null }

# Run again (idempotency test)
npx convex run migrations:removeDifficultyFromQuestions
# Should return: "Successfully updated 0 questions, X already migrated"
```

### 2. Deploy to Production

```bash
# Use migration workflow script (recommended)
./scripts/run-migration.sh removeDifficultyFromQuestions production

# Script enforces:
# 1. Deployment target verification
# 2. Dry-run with manual approval
# 3. Actual migration execution
# 4. Result verification
# 5. Diagnostic check
```

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Deploying Schema Change Before Migration

**Wrong order:**
```bash
# BAD: Remove field from schema first
git commit -m "feat: remove difficulty field"
./scripts/deploy-production.sh
# ❌ Schema validation fails: "Object contains extra field difficulty"
```

**Correct order:**
```bash
# GOOD: Make optional → migrate → remove
# Phase 1: Make optional
git commit -m "temp: make difficulty optional"
./scripts/deploy-production.sh

# Phase 2: Run migration
./scripts/run-migration.sh removeDifficulty production

# Phase 3: Remove field
git commit -m "feat: remove difficulty - pristine schema"
./scripts/deploy-production.sh
```

### ❌ Anti-Pattern 2: TypeScript Property Checks

**Wrong:**
```typescript
// BAD: Gets optimized away after schema change
if (doc.deprecatedField !== undefined) {
  // This code becomes UNREACHABLE
}
```

**Correct:**
```typescript
// GOOD: Runtime property check
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docData = doc as any;
if ('deprecatedField' in docData) {
  // This code WILL execute
}
```

### ❌ Anti-Pattern 3: Using `.filter()` After `.collect()`

**Wrong:**
```typescript
// BAD: Fetches ALL 10,000 records into memory, then filters
const allQuestions = await ctx.db.query('questions').collect();
const withField = allQuestions.filter(q => 'field' in q);
```

**Correct:**
```typescript
// GOOD: Use compound index for DB-level filtering
const withField = await ctx.db
  .query('questions')
  .withIndex('by_user_active', q =>
    q.eq('userId', userId)
     .eq('deletedAt', undefined)
  )
  .take(limit);
```

### ❌ Anti-Pattern 4: No Dry-Run or Diagnostic

**Wrong:**
```typescript
// BAD: No way to preview or verify
export const myMigration = internalMutation({
  args: {},  // ← No dry-run parameter
  handler: async (ctx) => {
    // ... migration logic
    // ← No diagnostic query to verify completion
  },
});
```

**Correct:**
```typescript
// GOOD: Dry-run support + diagnostic query
export const myMigration = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),  // ← Preview support
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun || false;
    // ... migration logic with conditional writes
  },
});

export const myMigrationDiagnostic = query({  // ← Verification
  args: {},
  handler: async (ctx) => {
    // Return count of records still needing migration
  },
});
```

## Troubleshooting

### Issue: "Migration reports 690 migrated but data still has field"

**Cause**: Deployed to DEV instead of PROD due to environment variable loading failure.

**Diagnosis:**
```bash
# Check migration logs for deployment URL
# Should show: https://uncommon-axolotl-639.convex.cloud
# If shows: https://amicable-lobster-935.convex.cloud → DEV!
```

**Fix:**
```bash
# Export production deploy key correctly
export CONVEX_DEPLOY_KEY=$(grep CONVEX_DEPLOY_KEY .env.production | cut -d= -f2)

# Verify target
echo $CONVEX_DEPLOY_KEY | cut -d: -f2 | cut -d'|' -f1
# Must output: uncommon-axolotl-639

# Re-run migration
npx convex run migrations:myMigration
```

### Issue: "TypeScript compiles but migration doesn't detect data"

**Cause**: TypeScript type erasure removes property checks.

**Fix**: Change from type check to runtime check:
```typescript
// Before (wrong)
if (doc.field !== undefined)

// After (correct)
if ('field' in (doc as any))
```

### Issue: "Schema validation failed: Object contains extra field"

**Cause**: Removed field from schema before running migration.

**Fix**: Follow 3-phase pattern (make optional → migrate → remove).

## Related Documentation

- **Production Deployment Runbook**: `docs/runbooks/production-deployment.md`
- **CLAUDE.md**: Migration Development Patterns section
- **AGENTS.md**: Migration Development section
- **README.md**: Troubleshooting Deployments section
