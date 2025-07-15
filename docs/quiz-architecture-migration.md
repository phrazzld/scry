# Quiz Architecture Migration Guide

## Overview

This document describes the migration process from the old quiz results architecture (bundled 5-question sessions) to the new individual question tracking system.

## Migration Goals

1. **Preserve all existing quiz data** - No user data should be lost
2. **Enable individual question tracking** - Each question becomes a separate entity
3. **Maintain historical accuracy** - Quiz scores and completion times remain accurate
4. **Zero downtime** - Migration can run while the app is live
5. **Reversible** - Ability to rollback if issues arise

## Data Model Changes

### Old Model (quizResults)
```typescript
{
  userId: string,
  topic: string,
  difficulty: string,
  score: number,
  totalQuestions: number,
  answers: [{
    questionId: string,
    question: string,
    type?: 'multiple-choice' | 'true-false',
    userAnswer: string,
    correctAnswer: string,
    isCorrect: boolean,
    options: string[]
  }],
  completedAt: number
}
```

### New Model

**questions table:**
```typescript
{
  userId: string,
  topic: string,
  difficulty: string,
  question: string,
  type: 'multiple-choice' | 'true-false',
  options: string[],
  correctAnswer: string,
  explanation?: string,
  generatedAt: number,
  attemptCount: number,
  correctCount: number,
  lastAttemptedAt?: number
}
```

**interactions table:**
```typescript
{
  userId: string,
  questionId: string,
  userAnswer: string,
  isCorrect: boolean,
  attemptedAt: number,
  timeSpent?: number,
  context?: {
    sessionId?: string,
    isRetry?: boolean
  }
}
```

## Migration Strategy

### Phase 1: Preparation
1. Deploy new schema with questions and interactions tables
2. Update application to write to both old and new models
3. Verify new data is being created correctly

### Phase 2: Historical Data Migration
1. Run migration in dry-run mode to verify counts
2. Execute migration in batches during low-traffic periods
3. Verify migrated data integrity

### Phase 3: Cutover
1. Switch application to read from new model
2. Stop writing to old model
3. Monitor for issues

### Phase 4: Cleanup (after 30 days)
1. Archive old quizResults table
2. Remove dual-write code
3. Update documentation

## Migration Execution

### Prerequisites
1. Backup Convex database
2. Test migration on staging environment
3. Prepare rollback plan
4. Schedule maintenance window (optional)

### Running the Migration

1. **Dry Run** - Verify what will be migrated:
```bash
# From Convex dashboard or CLI
npx convex run migrations:migrateQuizResultsToQuestions --dryRun true --batchSize 10
```

2. **Small Batch Test** - Migrate a small batch:
```bash
npx convex run migrations:migrateQuizResultsToQuestions --dryRun false --batchSize 10
```

3. **Full Migration** - Run complete migration:
```bash
npx convex run migrations:migrateQuizResultsToQuestions --dryRun false --batchSize 100
```

### Monitoring Progress

Check migration status:
```typescript
// Stats returned by migration function:
{
  totalProcessed: number,
  questionsCreated: number,
  interactionsCreated: number,
  duplicateQuestions: number,
  errors: string[]
}
```

### Data Mapping Details

1. **Session ID Generation**
   - New: Generated for each quiz session
   - Migration: `migrated_{quizResultId.substring(0, 8)}`

2. **Question Deduplication**
   - Questions with same content for same user are not duplicated
   - Denormalized stats are updated instead

3. **Timestamps**
   - generatedAt: Uses completedAt from quiz result
   - attemptedAt: Uses completedAt from quiz result
   - timeSpent: Not available (set to undefined)

4. **Missing Data**
   - explanation: Not available in old data (set to undefined)
   - timeSpent: Not tracked in old system (set to undefined)

## Verification Steps

### Pre-Migration Checks
1. Count total quiz results: `SELECT COUNT(*) FROM quizResults`
2. Count total answers: Sum of all answers arrays
3. Identify any data anomalies

### Post-Migration Verification
1. Verify question count matches expected
2. Verify interaction count matches total answers
3. Spot-check specific user data
4. Run integrity queries:
   ```typescript
   // Check that all interactions have valid questions
   // Check that denormalized stats match interaction counts
   // Verify sessionId patterns
   ```

### User Experience Verification
1. User can see historical quiz results
2. Quiz history shows correct scores
3. New quizzes create individual questions
4. Dashboard statistics remain accurate

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback** (within 1 hour):
   ```bash
   npx convex run migrations:rollbackMigrationForUser --userId USER_ID --dryRun false
   ```

2. **Full Rollback Steps**:
   - Stop application writes to new model
   - Run rollback for affected users
   - Revert application code to read from old model
   - Investigate and fix issues
   - Retry migration

3. **Partial Rollback**:
   - Identify affected users
   - Rollback only those users
   - Fix issues and re-migrate

## Production Checklist

- [ ] Backup database
- [ ] Test on staging environment
- [ ] Verify dry run results
- [ ] Schedule maintenance window (if needed)
- [ ] Prepare monitoring dashboards
- [ ] Alert on-call team
- [ ] Run migration in batches
- [ ] Verify each batch
- [ ] Update application configuration
- [ ] Monitor error rates
- [ ] Verify user experience
- [ ] Document completion

## Troubleshooting

### Common Issues

1. **Duplicate Questions**
   - Expected behavior for questions attempted multiple times
   - Denormalized stats should reflect total attempts

2. **Missing Session IDs**
   - Old quiz results don't have sessionIds
   - Migration generates them with pattern `migrated_*`

3. **Performance Issues**
   - Reduce batch size
   - Run during off-peak hours
   - Add delays between batches

### Error Recovery

If migration fails partway:
1. Check which quiz results have sessionId starting with "migrated_"
2. Resume from last successful batch
3. Re-run with smaller batch size

## Success Metrics

- 100% of historical quiz results migrated
- 0% data loss
- <1% error rate during migration
- No user-reported issues
- Performance metrics remain stable

## Long-term Considerations

1. **Data Retention**
   - Keep quizResults table for 30 days post-migration
   - Archive before deletion

2. **Code Cleanup**
   - Remove dual-write logic after verification
   - Update all queries to use new model
   - Remove migration code after success

3. **Documentation Updates**
   - Update API documentation
   - Update database schema docs
   - Train support team on new model