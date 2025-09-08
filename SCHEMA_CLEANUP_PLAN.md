# Database Schema Cleanup Plan

## Overview
Plan for removing quiz-related tables (`quizResults` and potentially `deployments`) from the Convex schema after the hypersimplicity overhaul. This cleanup aligns with the new single-screen review-focused architecture where individual question interactions are tracked instead of quiz sessions.

## Tables to Remove

### 1. `quizResults` Table
**Current Purpose**: Stores completed quiz sessions with aggregated results  
**Size**: Contains user quiz history data  
**Dependencies**: Referenced by 4 files in convex/

### 2. `deployments` Table (Consider Removal)
**Current Purpose**: Tracks deployment history  
**Size**: Likely minimal  
**Dependencies**: No active UI references after dashboard removal

## Impact Analysis

### Files Requiring Updates

#### `/convex/quiz.ts`
- **Functions affected**:
  - `completeQuiz` mutation - Can be removed entirely
  - `getQuizHistory` query - Can be removed entirely
  - `getQuizStats` query - Needs rewrite to use interactions table
  - `getTopicStats` query - Needs rewrite to use questions/interactions
  - `getUserQuizStats` query - Needs rewrite
  - `getAdminQuizStats` query - Can be removed

#### `/convex/auth.ts`
- **Function affected**: 
  - `deleteAccount` mutation - Remove quizResults deletion logic

#### `/convex/migrations.ts`
- May contain references that can be removed

#### `/convex/types.ts` and `/convex/TYPES.md`
- Remove QuizResult type definitions

### Data Migration Strategy

#### Option 1: Clean Break (Recommended)
- **Approach**: Simply remove tables and related code
- **Data Loss**: Quiz history aggregations will be lost
- **Justification**: Individual interactions are preserved, which is the source of truth
- **Benefits**: 
  - Simplest implementation
  - No migration complexity
  - Aligns with hypersimplicity philosophy

#### Option 2: Historical Preservation
- **Approach**: Export quiz history to JSON archive before removal
- **Implementation**:
  ```typescript
  // One-time export script
  const exportQuizHistory = internalMutation({
    handler: async (ctx) => {
      const allResults = await ctx.db.query("quizResults").collect();
      // Store in file storage or external system
      return { exported: allResults.length };
    }
  });
  ```
- **Benefits**: Preserves historical data if needed later
- **Drawbacks**: Additional complexity

## Implementation Steps

### Phase 1: Code Cleanup (This PR)
1. ✅ Remove UI references (already done in hypersimplicity overhaul)
2. ✅ Remove `/api/quiz/complete` route (already done)
3. Mark deprecated functions in `quiz.ts` with comments

### Phase 2: Schema Removal (Separate PR)
1. Remove all functions in `quiz.ts` that depend on `quizResults`
2. Update `deleteAccount` in `auth.ts` to skip quizResults deletion
3. Remove `quizResults` table from schema.ts
4. Remove `deployments` table from schema.ts (if confirmed unused)
5. Run Convex deployment to apply schema changes
6. Clean up type definitions

### Phase 3: Statistics Rewrite (Follow-up PR)
1. Create new statistics queries using interactions table:
   ```typescript
   export const getUserStats = query({
     args: { sessionToken: v.string() },
     handler: async (ctx, args) => {
       // Calculate from interactions table
       const interactions = await ctx.db
         .query("interactions")
         .withIndex("by_user", q => q.eq("userId", user._id))
         .collect();
       
       return {
         totalAttempts: interactions.length,
         correctRate: interactions.filter(i => i.isCorrect).length / interactions.length,
         // ... other stats
       };
     }
   });
   ```

## Queries to Preserve/Rewrite

These queries provide value and should be rewritten to use interactions:
- User performance statistics
- Topic-based analytics  
- Success rate tracking
- Learning progress metrics

## Queries to Remove

These are no longer relevant in the new architecture:
- Quiz session management
- Quiz completion tracking
- Session-based scoring
- Admin quiz overview (no admin features in hypersimplified version)

## Risk Assessment

### Low Risk ✅
- No production data migration needed (dev environment)
- UI already updated to not reference these tables
- Individual question data preserved in `questions` and `interactions`

### Medium Risk ⚠️
- Some users may expect to see historical quiz scores
- Mitigation: Explain in release notes that individual question history is preserved

### Migration Rollback Plan
- Keep a branch with old schema for 30 days
- Export data before removal if needed
- Schema changes are reversible via Convex dashboard

## Benefits of Removal

1. **Simplified Schema**: Fewer tables to maintain
2. **Reduced Complexity**: No dual tracking (quizzes + interactions)
3. **Storage Efficiency**: Eliminate redundant data storage
4. **Query Performance**: Fewer indexes to maintain
5. **Conceptual Clarity**: Single source of truth (interactions)

## Timeline

- **Week 1**: Complete Phase 1 code cleanup (current PR)
- **Week 2**: Implement Phase 2 schema removal (separate PR)
- **Week 3**: Complete Phase 3 statistics rewrite if needed

## Decision Points

1. **Should we preserve quiz history?** 
   - Recommendation: No, clean break aligns with hypersimplicity

2. **Should we remove deployments table?**
   - Recommendation: Yes, no longer used after dashboard removal

3. **Do we need aggregated statistics?**
   - Recommendation: Minimal stats only, calculated from interactions

## Success Criteria

- [ ] Zero references to `quizResults` in codebase
- [ ] All statistics queries use `interactions` table
- [ ] Schema contains only essential tables
- [ ] No runtime errors after removal
- [ ] Build and tests pass

## Notes

- This cleanup is a natural continuation of the hypersimplicity overhaul
- Removing these tables eliminates the "quiz session" concept entirely
- Focus shifts to individual question interactions (more granular, flexible)
- Aligns with spaced repetition focus over quiz completion focus