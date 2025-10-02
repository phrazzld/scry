# Scry TODO - Code Quality & Migration Fixes

## CRITICAL BLOCKERS - Must Fix Before Merge 🔥

### Migration Infrastructure

- [x] Fix migration pagination bug in `convex/migrations.ts:349`
  * **Problem**: Currently uses `.take(batchSize)` which only processes ONE batch (max 500 questions)
  * **Impact**: If database has 501+ questions, remaining questions never get migrated → silent failure
  * **File**: `convex/migrations.ts`, function `removeDifficultyFromQuestionsInternal`
  * **Current code** (line 349):
    ```typescript
    const allQuestions = await ctx.db.query('questions').take(batchSize);
    ```
  * **Fix**: Replace with cursor-based pagination loop:
    ```typescript
    let cursor = null;
    let hasMore = true;

    while (hasMore) {
      const result = await ctx.db.query('questions')
        .paginate({ cursor, numItems: batchSize });

      for (const question of result.page) {
        stats.totalProcessed++;
        // ... existing processing logic
      }

      cursor = result.continueCursor;
      hasMore = result.isDone === false;

      // Log progress every batch
      migrationLogger.info(`Batch completed`, {
        processed: stats.totalProcessed,
        updated: stats.updated,
        hasMore,
      });
    }
    ```
  * **Success criteria**: Migration processes all questions regardless of database size
  * **Test**: Create test with 1500+ mock questions, verify all are processed

- [ ] Add comprehensive migration tests in `convex/migrations.test.ts`
  * **Missing coverage**: Multi-batch processing, partial failures, idempotency
  * **Create test file**: `convex/migrations.test.ts`
  * **Required tests**:
    1. `should process all questions across multiple batches` (1500 questions, batchSize=500)
    2. `should handle partial failures gracefully` (mock 10% failure rate)
    3. `should be idempotent` (run twice, same result)
    4. `should respect dry-run mode` (verify no DB writes)
    5. `should track failed record IDs for retry`
  * **Example test structure**:
    ```typescript
    describe('Difficulty Removal Migration', () => {
      it('should process all questions across multiple batches', async () => {
        const simulator = new MigrationSimulator();
        // Insert 1500 test questions with difficulty field
        for (let i = 0; i < 1500; i++) {
          await simulator.insertQuestion({ difficulty: 'medium', /* ... */ });
        }

        const result = await simulator.runDifficultyRemoval({ batchSize: 500 });

        expect(result.stats.totalProcessed).toBe(1500);
        expect(result.stats.updated).toBe(1500);

        // Verify no questions still have difficulty
        const remaining = await simulator.countQuestionsWithDifficulty();
        expect(remaining.withDifficulty).toBe(0);
      });
    });
    ```
  * **Success criteria**: All 5 test scenarios pass, coverage > 90%

### Schema & Documentation Alignment

- [ ] Resolve schema/TODO discrepancy for difficulty field
  * **Problem**: TODO.md marks difficulty removal as complete, but `convex/schema.ts:20` still defines it
  * **Current state**:
    - TODO.md line 24-27: "[x] Remove difficulty from database schema" ✅
    - schema.ts line 20: `difficulty: v.optional(v.string()), // Temporarily optional - cleanup pending` ⚠️
  * **Decision required**: Choose path A or B
  * **Path A - Complete Removal** (recommended):
    1. Run migration in production: `npx convex run migrations:runDifficultyRemoval --adminKey scry-migration-2025`
    2. Verify migration: `npx convex run migrations:countQuestionsWithDifficulty`
    3. Remove from schema: Delete `convex/schema.ts:20`
    4. Deploy schema: `npx convex deploy`
    5. Update TODO to reflect completed state
  * **Path B - Mark Incomplete**:
    1. Change TODO checkbox to `[ ]` (unchecked)
    2. Add note: "Blocked on production migration execution"
    3. Document migration procedure
  * **Success criteria**: Schema code matches documented state in TODO.md

- [ ] Document migration execution procedure in `MIGRATIONS.md`
  * **Problem**: No runbook for when/how to run migrations, verification, or rollback
  * **Create file**: `MIGRATIONS.md` at project root
  * **Required sections**:
    1. **Migration Inventory**: List all available migrations with descriptions
    2. **Execution Order**: Which migrations depend on others
    3. **Pre-flight Checks**: What to verify before running
    4. **Execution Steps**: Exact commands with parameters
    5. **Verification Queries**: How to confirm success
    6. **Rollback Procedures**: How to undo if needed
    7. **Admin Key Management**: How to rotate (if keeping hardcoded approach)
  * **Example structure**:
    ```markdown
    # Migration Runbook

    ## Available Migrations

    ### 1. Difficulty Field Removal (2025-01)
    **Purpose**: Remove deprecated `difficulty` field from existing questions
    **Status**: Ready to run
    **Affects**: `questions` table

    #### Pre-flight Checks
    - [ ] Verify question count: `npx convex run migrations:countQuestionsWithDifficulty`
    - [ ] Backup database (Convex auto-backups, verify in dashboard)
    - [ ] Test in development first with dry-run

    #### Execution Steps
    1. Dry run: `npx convex run migrations:runDifficultyRemoval --adminKey scry-migration-2025 --dryRun true`
    2. Review dry-run stats
    3. Production run: `npx convex run migrations:runDifficultyRemoval --adminKey scry-migration-2025`
    4. Monitor logs in Convex dashboard

    #### Verification
    - Query: `npx convex run migrations:countQuestionsWithDifficulty`
    - Expected: `{ withDifficulty: 0 }`

    #### Post-Migration
    - Remove `difficulty` field from schema (convex/schema.ts:20)
    - Deploy schema changes: `npx convex deploy`
    ```
  * **Success criteria**: Any developer can run migrations safely following this doc

### Security & Authentication

- [ ] Replace hardcoded admin key with secure authentication in `convex/migrations.ts:309`
  * **Problem**: `'scry-migration-2025'` is committed to git, cannot be rotated, provides no real security
  * **Current code** (migrations.ts:309):
    ```typescript
    if (args.adminKey !== 'scry-migration-2025') {
      throw new Error('Unauthorized: Invalid admin key');
    }
    ```
  * **Security risks**:
    - Anyone with repo access can run migrations
    - Key visible in git history forever
    - No rotation possible without code deploy
    - No audit trail of who ran migrations
  * **Solution Option A - Environment Variable** (quick fix):
    ```typescript
    export const runDifficultyRemoval = mutation({
      args: {
        adminKey: v.string(),
        batchSize: v.optional(v.number()),
        dryRun: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        const validKey = process.env.MIGRATION_ADMIN_KEY;
        if (!validKey) {
          throw new Error('MIGRATION_ADMIN_KEY not configured');
        }
        if (args.adminKey !== validKey) {
          throw new Error('Unauthorized: Invalid admin key');
        }
        // ... rest of logic
      },
    });
    ```
    - Add to `.env.local`: `MIGRATION_ADMIN_KEY=<generate-secure-random-key>`
    - Add to Vercel env vars (production)
    - Update MIGRATIONS.md with key retrieval instructions
  * **Solution Option B - Clerk Admin Role** (proper fix):
    ```typescript
    export const runDifficultyRemoval = mutation({
      args: {
        batchSize: v.optional(v.number()),
        dryRun: v.optional(v.boolean()),
      },
      handler: async (ctx, args) => {
        const user = await requireUserFromClerk(ctx);

        // Check if user has admin role
        const adminEmails = ['admin@example.com']; // Or use Clerk roles
        if (!adminEmails.includes(user.email)) {
          throw new Error('Unauthorized: Admin access required');
        }

        // Log who ran the migration
        migrationLogger.info('Migration started by admin', {
          userId: user._id,
          email: user.email,
        });

        return await removeDifficultyFromQuestionsInternal(ctx, args);
      },
    });
    ```
  * **Recommended**: Option B (Clerk admin role) for production, Option A for quick fix
  * **Success criteria**:
    - Admin key not in source code
    - Can be rotated without code deploy
    - Audit trail of who ran migrations
    - Unauthorized users cannot run migrations

## HIGH PRIORITY - Quality & Reliability 🔴

### Error Handling & Observability

- [ ] Fix migration error handling to surface failures in `convex/migrations.ts:151`
  * **Problem**: Catches errors, pushes to array, returns `success: true` anyway
  * **Current behavior**:
    ```typescript
    } catch (error) {
      stats.errors.push(`Error processing quiz ${quizResult._id}: ${(error as Error).message}`);
      // ... continues and returns { success: true }
    }
    ```
  * **Impact**: If 500 out of 1000 migrations fail, caller sees "success" with no indication of problems
  * **Fix**: Return partial success status with detailed failure information
    ```typescript
    // Define result type at top of file
    type MigrationResult = {
      status: 'completed' | 'partial' | 'failed';
      stats: {
        totalProcessed: number;
        updated: number;
        alreadyMigrated: number;
        failed: number;
      };
      failures?: Array<{
        recordId: string;
        error: string;
      }>;
      message: string;
    };

    // In migration handler
    const failures: Array<{ recordId: string; error: string }> = [];

    for (const question of allQuestions) {
      try {
        // ... migration logic
      } catch (error) {
        failures.push({
          recordId: question._id,
          error: error instanceof Error ? error.message : String(error),
        });
        stats.failed++;
      }
    }

    // Determine status
    const status =
      failures.length === 0 ? 'completed' :
      failures.length === stats.totalProcessed ? 'failed' :
      'partial';

    return {
      status,
      stats,
      failures: failures.length > 0 ? failures : undefined,
      message:
        status === 'completed'
          ? `Successfully migrated ${stats.updated} questions`
          : status === 'partial'
          ? `Partially completed: ${stats.updated} succeeded, ${failures.length} failed`
          : `Migration failed: ${failures.length} errors`,
    };
    ```
  * **Success criteria**:
    - Partial failures return `status: 'partial'`
    - Failed record IDs are returned for retry
    - Caller can distinguish between complete success and partial success

- [ ] Add structured error handling for all migration catch blocks
  * **Files affected**: `convex/migrations.ts` (multiple functions)
  * **Current pattern**: `} catch (error) { return { error: (error as Error).message } }`
  * **Problem**: Assumes error is Error object (might be string, undefined, etc.)
  * **Fix pattern**:
    ```typescript
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      migrationLogger.error('Migration failed', {
        event: 'migration.error',
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      });

      return {
        status: 'failed' as const,
        stats,
        failures: [{
          recordId: 'N/A',
          error: error.message,
        }],
        message: `Migration failed: ${error.message}`,
      };
    }
    ```
  * **Apply to**:
    - `migrateQuizResultsToQuestions` (line 164)
    - `removeDifficultyFromQuestionsInternal` (line 388)
    - `rollbackMigrationForUser` (line 263)
  * **Success criteria**: No `(error as Error)` casts, all errors properly handled

- [x] Improve logging for dry-run mode in `convex/migrations.ts:366`
  * **Problem**: Progress logs only appear in production mode (`if (!dryRun)`), no feedback during testing
  * **Solution**: Implemented in pagination fix - batch logging now works in both modes with distinct events
  * **Current code**:
    ```typescript
    if (stats.updated % 100 === 0) {
      migrationLogger.info(`Migration progress: ${stats.updated} questions updated`);
    }
    ```
  * **Fix**: Log progress in both modes
    ```typescript
    if (stats.totalProcessed % 100 === 0) {
      migrationLogger.info('Migration progress', {
        event: dryRun ? 'migration.dry-run.progress' : 'migration.progress',
        mode: dryRun ? 'DRY RUN' : 'PRODUCTION',
        totalProcessed: stats.totalProcessed,
        updated: stats.updated,
        alreadyMigrated: stats.alreadyMigrated,
      });
    }
    ```
  * **Success criteria**: Dry-run shows progress logs, clearly labeled as DRY RUN

### Type Safety & Code Quality

- [ ] Standardize migration return types across all functions
  * **Problem**: Inconsistent shapes across different migration functions
  * **Current inconsistencies**:
    - `migrateQuizResultsToQuestions`: Returns `{ success: boolean, dryRun, stats, error?: string }`
    - `removeDifficultyFromQuestionsInternal`: Returns `{ success: boolean, dryRun, stats, error?: string }`
    - `rollbackMigrationForUser`: Returns `{ success: boolean, dryRun, stats }`
  * **Issues**:
    - Sometimes `error?` field, sometimes not
    - `stats` shape varies (sometimes has `errors: string[]`, sometimes `errors: number`)
    - `success: true` doesn't guarantee zero errors
  * **Solution**: Define standard type at top of file
    ```typescript
    /**
     * Standard result type for all migrations
     */
    type MigrationResult<T = Record<string, number>> = {
      status: 'completed' | 'partial' | 'failed';
      dryRun: boolean;
      stats: T;
      failures?: Array<{
        recordId: string;
        error: string;
      }>;
      message: string;
    };

    // Specific stats types for different migrations
    type DifficultyRemovalStats = {
      totalProcessed: number;
      updated: number;
      alreadyMigrated: number;
      failed: number;
    };

    type QuizMigrationStats = {
      totalProcessed: number;
      questionsCreated: number;
      interactionsCreated: number;
      duplicateQuestions: number;
      failed: number;
    };
    ```
  * **Update all migration functions** to return `MigrationResult<T>`
  * **Success criteria**:
    - All migrations return same shape
    - TypeScript enforces consistent error handling
    - Callers can use same logic for all migrations

- [x] Remove ESLint suppression and fix properly in `convex/migrations.ts:360`
  * **Problem**: Using lint suppression instead of fixing the issue properly
  * **Solution implemented**: Configure ESLint to allow underscore-prefixed unused vars globally
  * **Changes**:
    - Added `varsIgnorePattern: '^_'` to default ESLint rules in `eslint.config.mjs`
    - Now `const { difficulty: _difficulty, ...rest }` works without suppression comments
    - Applied same pattern already used in test files to all production code
  * **Success criteria**: ✅ No lint suppressions needed, code passes all checks

## MEDIUM PRIORITY - Architecture & Maintainability ⚠️

### Code Architecture Improvements

- [ ] Refactor pass-through migration wrapper to reduce coupling
  * **Location**: `convex/migrations.ts:301-318` (`runDifficultyRemoval`)
  * **Current pattern**: Public wrapper → auth check → internal implementation
    ```typescript
    export const runDifficultyRemoval = mutation({
      handler: async (ctx, args) => {
        // Auth only
        if (args.adminKey !== 'scry-migration-2025') {
          throw new Error('Unauthorized');
        }
        // Then call internal function
        return await removeDifficultyFromQuestionsInternal(ctx, { ... });
      },
    });
    ```
  * **Problems**:
    - Temporal decomposition: Organized by execution order (auth then migrate)
    - Tight coupling: Wrapper knows internal function signature
    - Low abstraction value: Just passes through parameters
    - Hard to test: Must mock through wrapper
  * **Violation**: Ousterhout Red Flag #1 (Temporal Decomposition), #4 (Pass-through Methods)
  * **Fix Option A - Inline Auth** (simpler):
    ```typescript
    export const runDifficultyRemoval = mutation({
      args: { /* ... */ },
      handler: async (ctx, args) => {
        // Auth inline
        const user = await requireUserFromClerk(ctx);
        if (!isAdmin(user)) {
          throw new Error('Unauthorized');
        }

        // Migration logic inline or extracted for reuse, not for auth
        const stats = { /* ... */ };
        // ... actual migration work here
        return { status: 'completed', stats };
      },
    });
    ```
  * **Fix Option B - Middleware Pattern** (more reusable):
    ```typescript
    // Create reusable auth helper
    async function requireAdmin(ctx: MutationCtx): Promise<Doc<'users'>> {
      const user = await requireUserFromClerk(ctx);
      if (!isAdmin(user)) {
        throw new Error('Unauthorized: Admin access required');
      }
      return user;
    }

    export const runDifficultyRemoval = mutation({
      handler: async (ctx, args) => {
        await requireAdmin(ctx);  // Single line auth
        return await performDifficultyRemoval(ctx, args);  // Business logic
      },
    });
    ```
  * **Recommended**: Option B (middleware pattern)
  * **Success criteria**:
    - No pass-through wrappers
    - Auth logic reusable across migrations
    - Business logic testable independently

- [ ] Deepen migration query module or remove wrapper in `convex/migrations.ts:278-295`
  * **Location**: `countQuestionsWithDifficulty` query
  * **Current implementation**: Shallow wrapper around filter+count operation
    ```typescript
    export const countQuestionsWithDifficulty = query({
      args: {},
      handler: async (ctx) => {
        const allQuestions = await ctx.db.query('questions').collect();
        const questionsWithDifficulty = allQuestions.filter(
          (q) => 'difficulty' in q && q.difficulty !== undefined
        );
        return {
          total: allQuestions.length,
          withDifficulty: questionsWithDifficulty.length,
          percentage: ((questionsWithDifficulty.length / allQuestions.length) * 100).toFixed(2),
        };
      },
    });
    ```
  * **Problem**: Ousterhout Red Flag #6 (Shallow Module)
    - Interface complexity: Named query with 3-field return type
    - Implementation complexity: Filter + count + percentage calc
    - Abstraction value: (Functionality - Interface Cost) ≈ 0
  * **Fix Option A - Remove Wrapper** (if only used once):
    - Inline this logic into MIGRATIONS.md verification steps
    - Document the query: `ctx.db.query('questions').collect().filter(...).length`
  * **Fix Option B - Deepen Module** (if widely used):
    ```typescript
    export const analyzeMigrationStatus = query({
      args: { migrationName: v.string() },
      handler: async (ctx, args) => {
        switch (args.migrationName) {
          case 'difficulty-removal':
            const all = await ctx.db.query('questions').collect();
            const withDifficulty = all.filter(q => 'difficulty' in q);
            const samples = withDifficulty.slice(0, 5).map(q => ({
              id: q._id,
              topic: q.topic,
              createdAt: new Date(q.generatedAt).toISOString(),
            }));

            return {
              migrationName: 'Difficulty Field Removal',
              isComplete: withDifficulty.length === 0,
              status: withDifficulty.length === 0 ? 'Ready to deploy' : 'Migration needed',
              stats: {
                total: all.length,
                needsMigration: withDifficulty.length,
                percentage: ((withDifficulty.length / all.length) * 100).toFixed(2),
              },
              samples,  // Example records for debugging
              recommendation: withDifficulty.length > 0
                ? `Run migration to update ${withDifficulty.length} questions`
                : 'Safe to remove difficulty field from schema',
            };
          default:
            throw new Error(`Unknown migration: ${args.migrationName}`);
        }
      },
    });
    ```
  * **Recommended**: Option A (remove) unless this becomes a pattern for multiple migrations
  * **Success criteria**: Either removed, or significantly deeper with actionable recommendations

### AI Integration Improvements

- [ ] Make low-count warning threshold dynamic or remove in `lib/ai-client.ts:244`
  * **Current code**:
    ```typescript
    if (questions.length < 15) {
      aiLogger.warn({
        event: 'ai.question-generation.low-count',
        questionCount: questions.length,
        topic,
      }, `Low question count (${questions.length})`);
    }
    ```
  * **Problem**: Fixed threshold of 15 ignores topic complexity variance
  * **Valid question ranges** (from prompts):
    - Single fact: 2-4 questions (would trigger warning incorrectly)
    - Primary colors: 6-9 questions (would trigger warning incorrectly)
    - NATO alphabet: 50-80 questions (wouldn't warn if AI only generates 20)
    - React hooks: 30-50 questions (wouldn't warn if AI only generates 20)
  * **Impact**: High false positive rate, some false negatives
  * **Solution Option A - Remove Warning** (simplest):
    - Delete the warning entirely
    - Rationale: The improved prompts with concrete examples should fix the root cause
    - Users will naturally regenerate if they feel count is too low
  * **Solution Option B - Dynamic Threshold** (more complex):
    ```typescript
    // After intent clarification, extract expected range
    const expectedRange = extractExpectedRange(clarifiedIntent);

    if (questions.length < expectedRange.min * 0.8) {  // 80% of minimum
      aiLogger.warn({
        event: 'ai.question-generation.low-count',
        questionCount: questions.length,
        expectedMin: expectedRange.min,
        expectedMax: expectedRange.max,
        topic,
        clarifiedIntent: clarifiedIntent.slice(0, 200),
      }, `Low question count: got ${questions.length}, expected ${expectedRange.min}-${expectedRange.max}`);
    }

    // Helper function
    function extractExpectedRange(intent: string): { min: number; max: number } {
      // Parse clarified intent for indicators
      if (intent.includes('single') || intent.includes('one')) return { min: 2, max: 4 };
      if (intent.includes('small list') || /\b[3-9]\s+items?\b/.test(intent)) return { min: 6, max: 15 };
      if (intent.includes('medium list') || /\b[1-2][0-9]\s+items?\b/.test(intent)) return { min: 30, max: 80 };
      // Default for broad topics
      return { min: 15, max: 50 };
    }
    ```
  * **Recommended**: Option A (remove) unless low counts become a recurring issue
  * **Success criteria**:
    - No false positives for legitimate small topics
    - Warnings appear for genuinely under-generated content
    - OR warning removed entirely

- [ ] Add post-generation analytics to track AI performance
  * **Purpose**: Monitor if prompt improvements actually increase question counts
  * **Location**: `lib/ai-client.ts`, after successful generation
  * **Add metrics tracking**:
    ```typescript
    // After question generation succeeds
    const analytics = {
      event: 'ai.generation.analytics',
      topic,
      questionCount: questions.length,
      mode: 'two-step',  // vs 'fallback'
      hasIntentClarification: true,
      questionTypes: {
        multipleChoice: questions.filter(q => q.type === 'multiple-choice').length,
        trueFalse: questions.filter(q => q.type === 'true-false').length,
      },
      avgOptionsPerQuestion: questions.reduce((sum, q) => sum + q.options.length, 0) / questions.length,
      explanationRate: questions.filter(q => q.explanation).length / questions.length,
    };

    aiLogger.info('Generation analytics', analytics);
    ```
  * **Monitoring queries** (add to dashboard):
    - Average questions per generation (trending up after prompt changes?)
    - Fallback rate (should be < 1%)
    - Topic categories that consistently generate low counts
  * **Success criteria**: Analytics logged for every generation, queryable for trends

## LOW PRIORITY - Polish & Documentation ✨

### Code Style & Consistency

- [ ] Extract magic numbers to named constants
  * **Locations**:
    - `convex/migrations.ts:332`: `const batchSize = args.batchSize || 500;`
    - `convex/migrations.ts:44`: `const batchSize = args.batchSize || 100;`
    - `lib/ai-client.ts:244`: `if (questions.length < 15)`
  * **Fix**: Define at top of file with rationale
    ```typescript
    // convex/migrations.ts
    /**
     * Default batch size for migrations
     * - Large enough to be efficient (fewer DB roundtrips)
     * - Small enough to avoid timeout (Convex has 60s limit per function)
     * - Chosen based on: ~100 items/second processing rate, 30s buffer = 3000 items max, use 500 for safety
     */
    const DEFAULT_MIGRATION_BATCH_SIZE = 500;

    /**
     * Default for quiz result migration (smaller batch due to nested processing)
     */
    const DEFAULT_QUIZ_MIGRATION_BATCH_SIZE = 100;
    ```
  * **Success criteria**: No unexplained magic numbers in migration code

- [ ] Add JSDoc comments to migration functions
  * **Files**: `convex/migrations.ts`
  * **Functions needing docs**:
    - `migrateQuizResultsToQuestions`
    - `removeDifficultyFromQuestionsInternal`
    - `rollbackMigrationForUser`
  * **Template**:
    ```typescript
    /**
     * Removes the deprecated difficulty field from all questions in the database.
     *
     * This migration is idempotent - safe to run multiple times.
     * Questions already migrated will be skipped.
     *
     * @param ctx - Convex mutation context
     * @param args - Migration configuration
     * @param args.batchSize - Number of questions to process per batch (default: 500)
     * @param args.dryRun - If true, logs changes without applying them (default: false)
     *
     * @returns Migration result with status, statistics, and any failures
     *
     * @example
     * // Dry run to preview changes
     * const preview = await removeDifficulty(ctx, { dryRun: true });
     * console.log(`Would update ${preview.stats.updated} questions`);
     *
     * // Production run
     * const result = await removeDifficulty(ctx, {});
     * if (result.status === 'completed') {
     *   console.log('Migration successful');
     * }
     *
     * @see MIGRATIONS.md for full runbook
     */
    ```
  * **Success criteria**: All public migration functions have comprehensive JSDoc

### Testing & Verification

- [ ] Add schema version tracking for migrations
  * **Problem**: No tracking of which migrations depend on which schema versions
  * **Location**: Top of `convex/migrations.ts`
  * **Add version constants**:
    ```typescript
    /**
     * Migration Version Registry
     *
     * Tracks which schema versions each migration is compatible with.
     * Update this when schema changes affect migrations.
     */
    const MIGRATION_VERSIONS = {
      DIFFICULTY_REMOVAL: {
        name: 'Difficulty Field Removal',
        version: '2025-01',
        schemaCompatibility: {
          min: '1.0',  // First schema version
          max: '2.0',  // Before difficulty field removed from schema
        },
        description: 'Removes vestigial difficulty field from question records',
      },
      QUIZ_TO_QUESTIONS: {
        name: 'Quiz Results Migration',
        version: '2024-12',
        schemaCompatibility: {
          min: '1.0',
          max: '999.0',  // Always compatible
        },
        description: 'Migrates deprecated quizResults table to questions + interactions',
      },
    } as const;
    ```
  * **Use in migration functions**:
    ```typescript
    migrationLogger.info('Migration started', {
      migration: MIGRATION_VERSIONS.DIFFICULTY_REMOVAL.name,
      version: MIGRATION_VERSIONS.DIFFICULTY_REMOVAL.version,
      schemaCompatibility: MIGRATION_VERSIONS.DIFFICULTY_REMOVAL.schemaCompatibility,
    });
    ```
  * **Success criteria**: Each migration has documented schema compatibility

- [ ] Create migration verification script
  * **Purpose**: Quick command to check migration status before/after running
  * **Location**: Create `scripts/verify-migrations.ts`
  * **Functionality**:
    ```typescript
    #!/usr/bin/env npx tsx

    /**
     * Verify migration status across all migrations
     *
     * Usage:
     *   pnpm verify-migrations
     *   pnpm verify-migrations --migration difficulty-removal
     */

    import { ConvexClient } from 'convex/browser';

    async function verifyMigrations() {
      const client = new ConvexClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

      console.log('🔍 Verifying migration status...\n');

      // Check difficulty removal
      const diffStats = await client.query('migrations:countQuestionsWithDifficulty');
      console.log('✅ Difficulty Removal Migration');
      console.log(`   Total questions: ${diffStats.total}`);
      console.log(`   Need migration: ${diffStats.withDifficulty}`);
      console.log(`   Status: ${diffStats.withDifficulty === 0 ? '✅ Complete' : '⚠️  Pending'}\n`);

      // Add more migration checks as needed

      client.close();
    }

    verifyMigrations().catch(console.error);
    ```
  * **Add to package.json**:
    ```json
    "scripts": {
      "verify-migrations": "npx tsx scripts/verify-migrations.ts"
    }
    ```
  * **Success criteria**: Single command shows status of all migrations

### Documentation Updates

- [ ] Update README.md with migration section
  * **Location**: `README.md`
  * **Add section** (after "Environment Setup"):
    ```markdown
    ## Database Migrations

    This project uses Convex for database and migrations. See [MIGRATIONS.md](./MIGRATIONS.md) for detailed runbook.

    ### Quick Reference

    ```bash
    # Verify migration status
    pnpm verify-migrations

    # Run a specific migration (dry-run first!)
    npx convex run migrations:runDifficultyRemoval --dryRun true
    npx convex run migrations:runDifficultyRemoval --adminKey <key>
    ```

    ### Common Scenarios

    - **After pulling schema changes**: Run `pnpm verify-migrations` to check if migrations are needed
    - **Before deploying**: Ensure all migrations are complete
    - **Production deploys**: Always run migrations before deploying schema changes
    ```
  * **Success criteria**: Developers know migrations exist and where to find docs

- [ ] Add inline comments explaining FSRS field removal rationale
  * **Location**: `convex/schema.ts:20` (once difficulty is actually removed)
  * **Add comment**:
    ```typescript
    // Note: difficulty field was removed in v2.0 (January 2025)
    // - Field was never used by FSRS algorithm (uses fsrsDifficulty instead)
    // - No impact on question quality or learning
    // - See migrations/2025-01-difficulty-removal.md for history
    ```
  * **Success criteria**: Future developers understand why field was removed

## Testing Coverage Improvements

- [ ] Add E2E test for question generation with new prompts
  * **Purpose**: Verify prompt improvements actually work end-to-end
  * **Location**: Create `e2e/question-generation.spec.ts`
  * **Test scenarios**:
    ```typescript
    test('should generate appropriate count for small enumerable list', async ({ page }) => {
      await page.goto('/');
      await page.fill('[data-testid="topic-input"]', 'primary colors');
      await page.click('[data-testid="generate-button"]');

      // Wait for generation
      await page.waitForSelector('[data-testid="question-card"]');

      // Count questions
      const questions = await page.$$('[data-testid="question-card"]');

      // Should generate 6-9 questions for 3 items
      expect(questions.length).toBeGreaterThanOrEqual(6);
      expect(questions.length).toBeLessThanOrEqual(9);
    });

    test('should generate comprehensive coverage for medium list', async ({ page }) => {
      await page.goto('/');
      await page.fill('[data-testid="topic-input"]', 'NATO phonetic alphabet');
      await page.click('[data-testid="generate-button"]');

      await page.waitForSelector('[data-testid="question-card"]');

      const questions = await page.$$('[data-testid="question-card"]');

      // Should generate 50-80 questions for 26 letters
      expect(questions.length).toBeGreaterThanOrEqual(50);
    });
    ```
  * **Success criteria**: Tests pass, verify prompt improvements work in practice

---

## Summary Statistics

**Total Tasks**: 35
- **CRITICAL**: 6 tasks (must fix before merge)
- **HIGH**: 5 tasks (quality & reliability)
- **MEDIUM**: 5 tasks (architecture & maintainability)
- **LOW**: 19 tasks (polish & documentation)

**Estimated Effort**:
- CRITICAL blockers: 6-8 hours
- HIGH priority: 4-6 hours
- MEDIUM priority: 3-4 hours
- LOW priority: 4-5 hours
- **Total**: 17-23 hours

**Recommended Merge Strategy**:
1. Fix CRITICAL blockers first (6 tasks)
2. Fix HIGH priority items (5 tasks)
3. Merge with remaining work as technical debt
4. Complete MEDIUM/LOW in follow-up PRs

**Alternative Strategy** (faster merge):
1. Split into two PRs:
   - PR A: AI prompt improvements only (mergeable immediately)
   - PR B: Migration infrastructure (complete all CRITICAL fixes first)
