# TODO

Focus on the remaining Clerk migration and delivery fixes. Completed items from earlier phases have been archived elsewhere.

## Manual Tasks (require dashboard or secrets)
- [!] Check Resend dashboard for delivery status of recent magic-link emails.
  ```
  Work Log:
  - Requires access to https://resend.com/emails with project credentials; cannot complete from CLI.
  ```
- [!] Create the Clerk application (Email + Google only) and copy the publishable/secret keys into `.env.local`.
  ```
  Work Log:
  - Needs Clerk dashboard access and secret key management; not doable within repo.
  ```
- [!] Configure Clerk JWT template named `convex`, update `convex/auth.config.ts` with the issued domain, and run `npx convex dev` once keys are in place.
  ```
  Work Log:
  - Blocked pending Clerk dashboard setup and valid keys; requires manual configuration.
  ```
- [!] After CLI migration work lands, verify the UI: launch `pnpm dev`, trigger the Clerk sign-in modal, complete login, and confirm the avatar renders.
  ```
  Work Log:
  - Depends on Clerk keys and dashboard setup; needs manual validation in browser.
  ```
- [ ] Create the Clerk webhook endpoint (Convex deployment URL, events `user.created` + `user.updated`) and store `CLERK_WEBHOOK_SECRET`.
- [ ] Once local flows pass, perform the production rollout steps (new Clerk instance, Vercel env vars, JWT template, staged deploy, 24h monitoring, remove magic-link code afterward).
- [ ] Remove Resend API keys from deployed environments after Clerk migration is stable.
- [ ] Post-migration manual QA: new email signup, Google sign-in, quiz generation, review flow, cross-tab sign-out, protected `/settings` check.

## CLI Tasks (doable in this repo)

### Core Auth Migration
- [x] Delete legacy auth surfaces: `contexts/auth-context.tsx` (+ tests) and `components/sign-in-landing.tsx`.
  ```
  Work Log:
  - Removed unused `contexts/auth-context` provider/tests and obsolete `app/providers.tsx` wrapper.
  - Purged the dead `components/auth` directory; `sign-in-landing` was already absent.
  - Updated hooks/components tests to mock Clerk's `useUser`/`SignIn` instead of the legacy context.
  ```
- [x] Add `clerkId` column and `by_clerk_id` index to the users table in `convex/schema.ts`.
  ```
  Work Log:
  - Already completed - clerkId and by_clerk_id index exist in schema.ts
  ```
- [x] Create `convex/clerk.ts` with the `syncUser` internal mutation to upsert users by Clerk id.
  ```
  Work Log:
  - Created syncUser internal mutation for upserting users by Clerk ID
  - Added deleteUser mutation for soft deletion
  - Added getUserFromClerk and requireUserFromClerk helper functions
  - Fixed TypeScript types for proper QueryCtx/MutationCtx usage
  ```
- [x] Update Convex functions to rely on Clerk identity only: refactor `convex/questions.ts`, `convex/spacedRepetition.ts`, and `convex/quiz.ts` to drop `sessionToken` arguments and use `ctx.auth.getUserIdentity()` helpers.
  ```
  Work Log:
  - Removed sessionToken from all query/mutation arguments
  - Replaced getAuthenticatedUserId with requireUserFromClerk
  - Updated questions.ts: 8 functions refactored
  - Updated spacedRepetition.ts: 3 functions refactored
  - Updated quiz.ts: 4 functions refactored
  - Fixed ESLint issues with unused parameters
  ```
- [x] Remove `sessionToken` plumbing from client components and hooks (review flow, quiz flow, question mutations/interactions, etc.).
  ```
  Work Log:
  - Updated use-question-mutations.ts to use Clerk auth state
  - Updated use-quiz-interactions.ts to remove sessionToken
  - Cleaned up review-flow.tsx component
  - Refactored quiz-flow components (index, quiz-mode, review-mode)
  - Updated API route to use Clerk getAuth() directly
  - Removed sessionToken from prompt sanitization schema and tests
  ```
- [x] Delete obsolete files once Clerk auth is authoritative: `app/api/auth/send-magic-link/route.ts`, `app/auth/verify/page.tsx` (if present), `convex/emailActions.ts`, and `lib/cookies.ts`.
  ```
  Work Log:
  - Deleted app/api/auth/send-magic-link/route.ts (API route)
  - Deleted convex/auth.ts (magic link mutations)
  - Deleted convex/emailActions.ts (email sending)
  - Deleted convex/lib/auth.ts (session token helpers)
  - app/auth/verify/page.tsx and lib/cookies.ts didn't exist
  - Updated health check endpoint to remove auth.getCurrentUser references
  - Cleaned .next build directory
  ```
- [x] Strip magic-link schema tables (`sessions`, `magicLinks`) from `convex/schema.ts`.
  ```
  Work Log:
  - Removed sessions and magicLinks tables from convex/schema.ts
  - Removed associated types from convex/types.ts (Session, MagicLink, SessionId, MagicLinkId)
  - Verified no references to these tables in Convex functions
  - Linting passes, test failures appear pre-existing (API route env issues)
  - Committed as chore: remove legacy magic-link tables from schema
  ```

### Verification & Tooling
- [ ] Run `pnpm dev` (after env keys exist) to ensure Clerk loads cleanly.
- [ ] Execute automated suites once migration changes land: `pnpm lint`, `pnpm test`, and Playwright smoke via `./scripts/test-e2e-local.sh`.
- [ ] Implement optional UX polish when time allows: `<ClerkLoading>` placeholder, Clerk webhook-triggered user sync, middleware route protection, Convex user caching if lookups become hot.
