# Vercel Preview Deployment Workaround

**Last Updated**: July 2025  
**Status**: ✅ WORKING SOLUTION IMPLEMENTED

## The Issue

When deploying to Vercel preview environments without Convex Pro, the build fails because:
1. Convex CLI detects the Vercel environment
2. It requires `CONVEX_DEPLOY_KEY` even for just generating TypeScript types
3. Without Convex Pro, you can't create preview deployment keys

## Working Solution (Implemented)

**We now commit Convex generated types to the repository**, eliminating the need for any deployment keys in preview environments.

### What We Changed:

1. **Removed `convex/_generated/` from `.gitignore`**
   - Generated types are now tracked in git
   - Preview builds use these pre-generated types

2. **Updated `scripts/vercel-build.cjs`**
   - Preview builds skip type generation entirely
   - Production builds still generate fresh types
   - No CONVEX_DEPLOY_KEY needed for preview!

### How It Works:

```javascript
// In vercel-build.cjs
if (!isProduction && vercelEnv && typesExist) {
  // Use committed types for preview
  console.log('ℹ️  Preview environment detected - using pre-generated Convex types');
} else {
  // Generate types for production or local dev
  execSync('npx convex codegen');
}
```

### Benefits:

- ✅ No dummy keys or workarounds needed
- ✅ Preview deployments work out of the box
- ✅ No Convex Pro subscription required
- ✅ Faster preview builds (skip type generation)
- ✅ Preview uses production Convex backend (read-only)

## Old Solution (Deprecated)

~~The dummy key approach no longer works due to Convex CLI validation.~~

## Alternative Solutions

1. **Commit Generated Types** (✅ IMPLEMENTED)
   - Types are committed to repository
   - Preview builds use pre-generated types
   - No deployment keys needed

2. **Upgrade to Convex Pro** (If you need preview isolation)
   - Get proper preview deployment keys
   - Each preview gets its own Convex instance
   - Better for testing database changes

3. **Use Production Key** (Not recommended)
   - Share production key with preview
   - Risk of accidental production deployments
   - Requires careful build script logic

## Maintenance Notes

### When to Regenerate Types

Run `npx convex codegen` and commit changes when:
- You modify Convex schema (`convex/schema.ts`)
- You add/modify Convex functions
- You update Convex dependencies

### Security Considerations

The committed types approach is safe because:
- It's only used for type generation, not deployment
- Preview builds explicitly skip Convex deployment
- Your production data remains secure