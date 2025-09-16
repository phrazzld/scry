# TODO

Focus on the remaining Clerk migration and delivery fixes. Completed items from earlier phases have been archived elsewhere.

## Manual Tasks (require dashboard or secrets)
- [ ] Check Resend dashboard for delivery status of recent magic-link emails.
- [ ] Create the Clerk application (Email + Google only) and copy the publishable/secret keys into `.env.local`.
- [ ] Configure Clerk JWT template named `convex`, update `convex/auth.config.ts` with the issued domain, and run `npx convex dev` once keys are in place.
- [ ] After CLI migration work lands, verify the UI: launch `pnpm dev`, trigger the Clerk sign-in modal, complete login, and confirm the avatar renders.
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
- [ ] Add `clerkId` column and `by_clerk_id` index to the users table in `convex/schema.ts`.
- [ ] Create `convex/clerk.ts` with the `syncUser` internal mutation to upsert users by Clerk id.
- [ ] Update Convex functions to rely on Clerk identity only: refactor `convex/questions.ts`, `convex/spacedRepetition.ts`, and `convex/quiz.ts` to drop `sessionToken` arguments and use `ctx.auth.getUserIdentity()` helpers.
- [ ] Remove `sessionToken` plumbing from client components and hooks (review flow, quiz flow, question mutations/interactions, etc.).
- [ ] Delete obsolete files once Clerk auth is authoritative: `app/api/auth/send-magic-link/route.ts`, `app/auth/verify/page.tsx` (if present), `convex/emailActions.ts`, and `lib/cookies.ts`.
- [ ] Strip magic-link schema tables (`sessions`, `magicLinks`) from `convex/schema.ts`.

### Verification & Tooling
- [ ] Run `pnpm dev` (after env keys exist) to ensure Clerk loads cleanly.
- [ ] Execute automated suites once migration changes land: `pnpm lint`, `pnpm test`, and Playwright smoke via `./scripts/test-e2e-local.sh`.
- [ ] Implement optional UX polish when time allows: `<ClerkLoading>` placeholder, Clerk webhook-triggered user sync, middleware route protection, Convex user caching if lookups become hot.
