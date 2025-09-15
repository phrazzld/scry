# TODO.md

## Fix Security Detection (Stop Security Theater)

### Phase 1: Remove Broken Detection (5 min)
- [x] Comment out lines 19-39 in `.husky/pre-commit` (the broken grep patterns)
- [x] Keep git-secrets check (lines 3-8) - it actually works
- [x] Keep .env file check (lines 10-17) - this is valid
- [x] Test commit works without false positives ✓ CONFIRMED WORKING

### Phase 2: Install Real Detection (10 min)
- [x] Install gitleaks: `brew install gitleaks`
- [x] Create `.gitleaks.toml` with this exact config:
  ```toml
  [extend]
  useDefault = true
  
  [allowlist]
  paths = [
    "TODO\\.md",
    "ARCHIVE\\.md", 
    "ISSUE\\.md",
    "docs/.*\\.md",
    ".*\\.test\\.(ts|js)",
    ".*\\.spec\\.(ts|js)"
  ]
  
  [[rules]]
  id = "high-entropy-base64"
  description = "High entropy base64 string (40+ chars)"
  regex = '''['\"]([A-Za-z0-9+/]{40,})['\"]'''
  entropy = 4.5
  
  [[rules]]
  id = "high-entropy-hex"  
  description = "High entropy hex string (40+ chars)"
  regex = '''['\"]([a-f0-9]{40,})['\"]'''
  entropy = 4.5
  ```
- [x] Add to `.husky/pre-commit` after git-secrets check:
  ```bash
  # Gitleaks check (better than grep patterns)
  if command -v gitleaks &> /dev/null; then
    if ! gitleaks protect --staged --quiet; then
      echo "⚠️  Potential secrets detected by gitleaks"
      gitleaks protect --staged --verbose --no-color
      exit 1
    fi
  fi
  ```
- [x] Test: Try committing actual test secret like `API_KEY="sk_test_4242424242424242424242"`
- [x] Test: Verify normal code with "token" variable names passes

### Phase 3: Fix Root Cause (15 min)
- [x] Create `docs/SECRET_HANDLING.md`:
  ```markdown
  # Secret Handling Protocol
  
  ## Never Commit Secrets
  - ALL secrets must be in environment variables
  - Use `.env.local` locally (gitignored)
  - Use Vercel env vars for production
  - Use Convex env vars for backend
  
  ## If You See a Secret
  1. Don't commit it
  2. Move to env var immediately
  3. If already committed: rotate immediately
  
  ## Our Stack's Secret Management
  - Clerk: Handles all auth secrets
  - Convex: `npx convex env set KEY value`
  - Vercel: Dashboard → Settings → Environment Variables
  - Local: `.env.local` (never commit)
  ```
- [x] Add env var validation to `lib/env.ts`:
  ```typescript
  const requiredEnvVars = [
    'NEXT_PUBLIC_CONVEX_URL',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY'
  ] as const;
  
  export function validateEnv() {
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
  }
  ```
- [x] Call `validateEnv()` in `app/layout.tsx` (fail fast in dev)

### Phase 4: Remove Security Theater (2 min)
- [x] Delete the custom grep patterns from `.husky/pre-commit` (lines 19-39)
- [x] Update commit message guidance: "If gitleaks warns, it's probably right"
- [x] Remove `--no-verify` from any scripts or docs
- [x] Git commit this fix: "fix: Replace broken secret detection with gitleaks"

## Immediate: Fix Magic Link Email Delivery (Ship Today)
- [x] Add `NEXT_PUBLIC_APP_URL=http://localhost:3002` to `.env.local` (port 3002 since 3000 is taken)
- [x] Log the full magic link URL to console in development mode by adding `console.log('Magic link:', magicLinkUrl)` after line 67 in `convex/emailActions.ts`
- [x] Test email delivery to your own address first - Resend free tier might be in test mode
  ```
  Work Log:
  - Email shows as sent in Convex logs but not arriving
  - Need to return magic link URL directly in API response
  ```
- [!] Check Resend dashboard (https://resend.com/emails) to see actual delivery status of sent emails
  ```
  Work Log:
  - Requires manual dashboard check
  - User needs to login to Resend and verify email status
  ```
- [x] If still failing, temporarily return magic link URL in API response for development (line 88-89 in `convex/auth.ts`)
  ```
  Work Log:
  - Modified auth.ts to return devUrl in development mode
  - Updated auth-context.tsx to display URL in console
  - Magic link automatically copied to clipboard
  ```

## URGENT: Complete Clerk Migration to Fix Build

### Critical Components Still Using Old Auth (Build Blockers)
- [!] Update `components/review-flow.tsx` - Replace useAuth with useUser (BLOCKED: needs backend update first)
  ```
  Work Log:
  - Component heavily uses sessionToken passed to Convex functions
  - Backend functions still expect sessionToken parameter
  - Need to update Convex functions first to use ctx.auth.getUserIdentity()
  - This is a chicken-and-egg problem - need both frontend and backend changes
  - Switching approach: Update all Convex auth first, then frontend
  ```
- [x] Update `app/settings/settings-client.tsx` - Replace useAuth with useUser
  ```
  Work Log:
  - Replaced useAuth with useUser from @clerk/nextjs
  - Updated authentication checks: isAuthenticated → isSignedIn, isLoading → !isLoaded
  - Updated user email access: user.email → user.primaryEmailAddress?.emailAddress
  - Note: DeleteAccountDialog component also needs updating (uses useAuth)
  ```
- [x] Update `components/navbar.tsx` - Replace useAuth with useUser
  ```
  Work Log:
  - Replaced useAuth with useUser from Clerk
  - Removed AuthModal component (Clerk handles auth UI)
  - Replaced custom sign out button with UserButton
  - Simplified component significantly
  ```
- [x] Update `components/generation-modal.tsx` - Replace useAuth with useUser
  ```
  Work Log:
  - Replaced useAuth with useUser from @clerk/nextjs
  - Removed sessionToken from component state
  - Removed sessionToken from API call body (Clerk handles auth via cookies/headers)
  - Added isSignedIn for auth state checking (though not actively used in component)
  ```
- [!] Update `components/quiz-flow.tsx` and `quiz-flow/index.tsx` - Replace useAuth (BLOCKED: child components need backend update)
  ```
  Work Log:
  - Updated quiz-flow.tsx to use useUser from Clerk
  - Removed sessionToken from API calls (Clerk handles via cookies)
  - BLOCKED: Child components (ReviewMode, QuizMode) still need sessionToken for Convex queries
  - Need to update Convex backend functions first before fully removing sessionToken
  - Partial update done: main component uses Clerk, but can't update child components yet
  ```
- [x] Update `components/empty-states.tsx` - Replace useAuth with useUser
  ```
  Work Log:
  - Removed useAuth import entirely
  - Removed sessionToken from API calls
  - API routes will get auth from Clerk automatically via cookies/headers
  - Simple fix since component only used sessionToken for API calls
  ```
- [!] Update `components/sign-in-landing.tsx` - Remove entirely (BLOCKED: used in review-flow.tsx)
- [!] Update all hooks using sessionToken (use-quiz-interactions, use-question-mutations) (BLOCKED: Convex mutations need backend update)
  ```
  Work Log:
  - Both hooks pass sessionToken to Convex mutations (api.questions.recordInteraction, api.questions.updateQuestion, etc.)
  - Cannot remove sessionToken until Convex backend functions are migrated to use ctx.auth.getUserIdentity()
  - These hooks are the bridge between frontend and Convex backend - need backend migration first
  - Partial migration not beneficial here as hooks are purely for Convex communication
  ```
- [!] Test build passes after auth updates (BLOCKED: ReviewFlow on home page still uses old auth)
  ```
  Work Log:
  - Build fails with "useAuth must be used within an AuthProvider"
  - Home page renders ReviewFlow which still uses old useAuth hook
  - AuthProvider was replaced with ClerkProvider, causing the error
  - Cannot fix until ReviewFlow is migrated (which is blocked by backend)
  - Build error: prerendering page "/" fails due to missing AuthProvider
  ```

## Clerk Migration: Minimum Viable Auth (4 Hours Total)

### Hour 1: Get Clerk Working At All
- [ ] Create Clerk account at clerk.com - use Google OAuth to sign up, pick "Scry" as app name
- [ ] Select only Email + Google OAuth as auth methods (skip everything else)
- [ ] Copy these two keys from Clerk dashboard to `.env.local`:
  ```
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
  CLERK_SECRET_KEY=<your-clerk-secret-key>
  ```
- [x] Install only what we need: `pnpm add @clerk/nextjs convex-helpers`
  ```
  Work Log:
  - Installed @clerk/nextjs v6.32.0
  - Installed convex-helpers v0.1.104
  - Next.js auto-updated from 15.3.4 to 15.4.7
  ```
- [x] Create `convex/auth.config.ts` with 4 lines:
  ```typescript
  export default {
    providers: [
      { domain: "https://your-instance.clerk.accounts.dev", applicationID: "convex" }
    ]
  };
  ```
  ```
  Work Log:
  - Created convex/auth.config.ts
  - Placeholder domain needs to be updated after Clerk account creation
  - Will sync with Convex when running npx convex dev
  ```
- [ ] Go to Clerk Dashboard → JWT Templates → Create "convex" template (exact name required)
- [ ] Copy the Issuer URL from JWT template, update `auth.config.ts` domain field
- [ ] Run `npx convex dev` to sync auth config - verify it says "Checking Clerk JWT issuer"

### Hour 2: Make Next.js Use Clerk
- [x] Rename current `middleware.ts` to `middleware.backup.ts` (keep as reference)
- [x] Create new `middleware.ts` with 6 lines that actually work:
  ```typescript
  import { clerkMiddleware } from '@clerk/nextjs/server'
  export default clerkMiddleware()
  export const config = {
    matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)']
  }
  ```
  ```
  Work Log:
  - Created new Clerk middleware (6 lines)
  - By default, doesn't protect any routes
  - Ready to work when Clerk keys are added
  ```
- [x] Create `app/clerk-provider.tsx` - the minimum that works:
  ```typescript
  'use client'
  import { ClerkProvider, useAuth } from '@clerk/nextjs'
  import { ConvexProviderWithClerk } from 'convex/react-clerk'
  import { ConvexReactClient } from 'convex/react'
  
  const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  
  export function ClerkConvexProvider({ children }: { children: React.ReactNode }) {
    return (
      <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    )
  }
  ```
  ```
  Work Log:
  - Created app/clerk-provider.tsx with ClerkConvexProvider component
  - Component combines ClerkProvider with ConvexProviderWithClerk
  - Ready to replace existing Providers once Clerk keys are configured
  - Will integrate with layout.tsx in next step
  ```
- [x] Update `app/layout.tsx` - replace Providers with ClerkConvexProvider (3 line change)
  ```
  Work Log:
  - Replaced import from './providers' to './clerk-provider'
  - Changed <Providers> to <ClerkConvexProvider> wrapper
  - Dev server still running without errors on port 3004
  - Ready for Clerk keys to be added to .env.local
  ```
- [ ] Test: `pnpm dev` should start without errors, check browser console for Clerk loaded message

### Hour 3: Add Sign In That Actually Works
- [x] Update `components/minimal-header.tsx` - add Clerk components at line 8:
  ```typescript
  import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
  ```
  ```
  Work Log:
  - Added Clerk component imports after lucide-react imports
  - Components ready for use when replacing auth skeleton
  ```
- [x] Replace lines 39-57 (the auth loading skeleton) with:
  ```typescript
  <SignedOut>
    <SignInButton mode="modal">
      <Button variant="ghost" size="sm">Sign In</Button>
    </SignInButton>
  </SignedOut>
  <SignedIn>
    <UserButton afterSignOutUrl="/" />
  </SignedIn>
  ```
  ```
  Work Log:
  - Replaced auth UI section (lines 88-132) with Clerk components
  - Removed old auth context import and related code
  - Cleaned up unused imports (ChevronDown, Settings, LogOut, User, useRef)
  - Updated generate button to use <SignedIn> wrapper instead of user check
  - Fixed event listener dependencies
  - TypeScript errors resolved, dev server running clean
  ```
- [ ] Delete the entire `contexts/auth-context.tsx` file - Clerk replaces it completely
- [ ] Delete `components/sign-in-landing.tsx` - Clerk handles this
- [ ] Test: Click "Sign In" → Modal should appear → Sign in with email → Verify you see UserButton avatar

### Hour 4: Make Convex Recognize Clerk Users
- [ ] Add `clerkId: v.string()` to users table in `convex/schema.ts` after line 6
- [ ] Add `.index("by_clerk_id", ["clerkId"])` after line 10 in schema
- [ ] Create `convex/clerk.ts` with user sync (required for Clerk users to save data):
  ```typescript
  import { internalMutation } from "./_generated/server";
  import { v } from "convex/values";
  
  export const syncUser = internalMutation({
    args: { 
      clerkId: v.string(),
      email: v.string() 
    },
    handler: async (ctx, { clerkId, email }) => {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", q => q.eq("clerkId", clerkId))
        .first();
      
      if (!existing) {
        await ctx.db.insert("users", { clerkId, email });
      }
      return existing?._id || (await ctx.db.query("users")
        .withIndex("by_clerk_id", q => q.eq("clerkId", clerkId))
        .first())?._id;
    },
  });
  ```
- [ ] Create Webhook in Clerk Dashboard → Webhooks → Add Endpoint:
  - URL: `https://your-convex-url.convex.site/clerk-webhook`
  - Events: Select only `user.created` and `user.updated`
  - Copy the Webhook Secret to `.env.local` as `CLERK_WEBHOOK_SECRET`
- [ ] Update one Convex function to test - in `convex/questions.ts` function `recordInteraction`:
  - Change line: `const userId = await getAuthenticatedUserId(ctx, sessionToken)`
  - To: `const identity = await ctx.auth.getUserIdentity(); const userId = identity?.subject`
  - Remove `sessionToken` from args
- [ ] Test: Sign in → Open browser console → Try generating a quiz → Check Convex dashboard for new user

## Migration Completion Checklist (Do After Above Works)
- [ ] Update all `getAuthenticatedUserId` calls in `convex/spacedRepetition.ts` (5 occurrences)
- [ ] Update all `getAuthenticatedUserId` calls in `convex/quiz.ts` (2 occurrences)  
- [ ] Update all `getAuthenticatedUserId` calls in `convex/questions.ts` (4 occurrences)
- [ ] Remove `sessionToken` from all client components in `components/` folder
- [ ] Remove `sessionToken` from all hooks in `hooks/` folder
- [ ] Delete these now-unused files:
  - [ ] `app/api/auth/send-magic-link/route.ts`
  - [ ] `app/auth/verify/page.tsx` (if it exists)
  - [ ] `convex/emailActions.ts`
  - [ ] `lib/cookies.ts`
- [ ] Drop these tables from Convex schema:
  - [ ] Remove `magicLinks` table definition
  - [ ] Remove `sessions` table definition
- [ ] Remove Resend API key from `.env.local` and Vercel

## Verification Tests (Must All Pass)
- [ ] Sign up with new email - creates Convex user automatically
- [ ] Sign in with Google - works without email verification
- [ ] Generate quiz while signed in - saves to correct user
- [ ] Review questions - loads user's specific questions only
- [ ] Sign out and sign back in - data persists
- [ ] Open app in two tabs - sign out in one updates the other
- [ ] Protected route `/settings` - redirects to sign in when logged out

## Production Deployment (After Local Works)
- [ ] Create production Clerk instance (separate from dev)
- [ ] Add production keys to Vercel environment variables
- [ ] Update JWT template in production Clerk dashboard
- [ ] Deploy and test with one real user first
- [ ] Monitor Clerk dashboard for auth errors for 24 hours
- [ ] Delete all magic link code after 1 week of stability

## Performance Optimizations (Only If Needed)
- [ ] Add `<ClerkLoading>` component if sign-in button flashes
- [ ] Implement Clerk webhook for faster user sync if lag noticed
- [ ] Add middleware route protection only if users access protected URLs directly
- [ ] Cache Clerk user data in Convex only if multiple identity lookups slow down queries

## Notes
- Each task should take <30 minutes or it needs to be split
- Test after EVERY task - don't batch changes
- Keep old auth working until Clerk is 100% functional
- Rollback = restore `middleware.backup.ts` and `auth-context.tsx`
- Success = you can delete 500+ lines of auth code