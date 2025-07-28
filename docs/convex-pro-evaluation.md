# Convex Pro Evaluation for Preview Isolation

## Executive Summary

This document evaluates the feasibility and benefits of upgrading to Convex Pro to enable isolated preview environments for the Scry project. Currently, all preview deployments share the production Convex database, which poses risks for data integrity and testing.

## Current Architecture Limitations

### Shared Production Database
- **Issue**: All Vercel preview deployments connect to the production Convex instance
- **Risk**: Preview deployments can modify production data
- **Testing Impact**: Cannot test destructive operations or schema changes safely
- **Data Isolation**: No separation between preview and production data

### Schema Synchronization Challenges
- **Manual Process**: Requires deploying to production before merging PRs
- **Error Prone**: Easy to forget production deployment steps
- **Blocked Previews**: Schema mismatches cause preview deployment failures

## Convex Pro Features for Preview Isolation

### 1. Preview Instances
- **Isolated Environments**: Each preview deployment gets its own Convex instance
- **Automatic Provisioning**: Convex creates instances on-demand for previews
- **Data Isolation**: Complete separation from production data
- **Schema Freedom**: Test schema changes without affecting production

### 2. Branch Deployments
- **Git Integration**: Convex instances tied to git branches
- **Automatic Sync**: Schema updates when branch is updated
- **Clean Teardown**: Instances removed when branch is deleted

### 3. Development Workflow Benefits
- **Parallel Development**: Multiple developers can work independently
- **Safe Testing**: Destructive operations don't affect production
- **Schema Experiments**: Try database changes without commitment
- **Data Seeding**: Preview instances can have test data

## Cost Analysis

### Convex Pricing Tiers (as of 2025)
1. **Free Tier**
   - 1 production deployment
   - Limited to 1 developer
   - No preview deployments
   - Current setup

2. **Pro Tier** (~$25/month per project)
   - Unlimited preview deployments
   - Team collaboration
   - Advanced monitoring
   - Priority support

3. **Enterprise** (Custom pricing)
   - Additional security features
   - SLA guarantees
   - Dedicated support

### Cost-Benefit Analysis
- **Monthly Cost**: ~$25/month
- **Developer Time Saved**: ~5-10 hours/month on deployment issues
- **Risk Mitigation**: Prevents production data corruption
- **ROI**: Positive if preventing even one production incident

## Migration Path

### Phase 1: Enable Convex Pro (Week 1)
1. Subscribe to Convex Pro
2. Configure preview deployments in Convex dashboard
3. Update environment variables for preview isolation
4. Test with a single preview deployment

### Phase 2: Update Build Process (Week 2)
1. Modify `vercel.json` to support preview instances
2. Update build scripts to detect preview environment
3. Configure automatic Convex URL injection
4. Add preview-specific seed data scripts

### Phase 3: Developer Workflow (Week 3)
1. Document new preview workflow
2. Update deployment guides
3. Train team on new process
4. Remove manual deployment requirements

### Phase 4: Cleanup (Week 4)
1. Remove dual-instance workarounds
2. Simplify deployment scripts
3. Update CI/CD pipelines
4. Archive old deployment documentation

## Technical Implementation

### Environment Detection
```typescript
// lib/convex-url.ts
export function getConvexUrl() {
  // With Convex Pro, each preview gets unique URL
  if (process.env.VERCEL_ENV === 'preview') {
    return process.env.CONVEX_URL // Automatically injected
  }
  return process.env.NEXT_PUBLIC_CONVEX_URL
}
```

### Build Configuration
```json
// vercel.json with Convex Pro
{
  "buildCommand": "convex deploy --cmd 'next build'",
  "env": {
    "CONVEX_DEPLOY_KEY": "@convex-deploy-key"
  }
}
```

### Preview Seed Data
```typescript
// convex/seed.ts
export const seedPreviewData = mutation({
  handler: async (ctx) => {
    // Only run in preview environments
    if (process.env.VERCEL_ENV !== 'preview') return
    
    // Insert test data
    await ctx.db.insert('users', testUsers)
    await ctx.db.insert('questions', testQuestions)
  }
})
```

## Recommendation

### Recommended Action: Upgrade to Convex Pro

**Rationale**:
1. **Cost Effective**: $25/month is minimal compared to developer time saved
2. **Risk Reduction**: Eliminates production data corruption risk
3. **Developer Experience**: Significantly improves workflow and testing
4. **Future Proof**: Enables better CI/CD practices

### Alternative If Budget Constrained

If Convex Pro is not feasible, implement these mitigations:
1. **Stricter Deployment Process**: Automate production deployments in CI
2. **Read-Only Previews**: Modify preview builds to disable mutations
3. **Separate Staging Instance**: Manual third Convex instance for testing
4. **Enhanced Monitoring**: Better alerts for production data changes

## Implementation Timeline

- **Week 1**: Decision and subscription
- **Week 2**: Technical implementation
- **Week 3**: Testing and documentation
- **Week 4**: Team rollout
- **Total Duration**: 1 month

## Success Metrics

1. **Zero preview-related production incidents**
2. **50% reduction in deployment-related issues**
3. **Improved developer satisfaction scores**
4. **Faster PR review cycles**
5. **Ability to test destructive operations safely**

## Conclusion

Convex Pro offers significant benefits for preview isolation that justify the modest monthly cost. The improved developer experience, reduced risk, and cleaner architecture make it a worthwhile investment for any production application using Convex.

### Next Steps
1. Review this evaluation with team
2. Get budget approval for Convex Pro
3. Schedule implementation sprint
4. Begin migration following outlined phases