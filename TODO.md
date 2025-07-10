# TODO

## Critical: Fix Build Issues

### [ ] Configure Convex Backend
- **Issue**: Build fails without NEXT_PUBLIC_CONVEX_URL environment variable
- **Why**: The ConvexProvider in app/providers.tsx requires a valid Convex URL
- **Solution**: 
  1. Run `npx convex dev` to set up Convex project
  2. Add NEXT_PUBLIC_CONVEX_URL to .env.local
  3. Ensure all environment variables are properly configured
- **Blocked by**: Need to run interactive Convex setup

### [ ] Fix Static Generation Issues
- **Issue**: Several pages fail during static generation due to Convex client initialization
- **Why**: Pages using Convex hooks try to connect during build time
- **Solution**:
  1. Make dashboard page use dynamic rendering with `export const dynamic = 'force-dynamic'`
  2. Or provide a build-time Convex URL in the environment
  3. Consider using client-side only components for Convex-dependent features

### [ ] Update CI/CD Pipeline
- **Issue**: GitHub Actions will fail without Convex configuration
- **Why**: Build and deployment steps require valid Convex connection
- **Solution**:
  1. Add Convex environment variables to GitHub secrets
  2. Update deployment scripts to handle Convex deployment
  3. Add documentation for Convex setup in CI/CD

## Post-Migration Tasks

### [ ] Complete Authentication Implementation
- Add updateProfile mutation to convex/auth.ts
- Add deleteAccount mutation to convex/auth.ts
- Remove temporary error messages in AuthContext
- Test full authentication flow with real Convex backend

### [ ] Enable Real-time Features
- Update quiz-history-realtime.tsx to use actual Convex queries
- Update quiz-stats-realtime.tsx to use actual Convex queries
- Implement getRecentActivity query for activity feed
- Test real-time updates

### [ ] Remove Development Workarounds
- Remove eslint-disable comments from Convex files once types are generated
- Remove placeholder types and use generated types from convex dev
- Clean up any temporary type assertions

## Documentation

### [ ] Update README with Convex Setup
- Add Convex installation instructions
- Document required environment variables
- Add deployment guide for Convex + Vercel
- Include troubleshooting section