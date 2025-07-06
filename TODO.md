# PROJECT TODO

## Current Sprint

### Phase 1: Basic Email Magic Link Authentication (Day 1)

#### Vercel Project Setup
- [x] Install Vercel CLI: run `pnpm add -g vercel` if not already installed
- [x] Link to Vercel project: run `vercel link` and follow prompts to connect to existing project or create new
- [x] Pull existing env vars: run `vercel env pull .env.local` to sync any existing environment variables (Note: No env vars in Vercel yet)

#### Setup & Dependencies
- [x] Install NextAuth dependencies: run `pnpm add next-auth @auth/prisma-adapter nodemailer`
- [x] Install Resend for email (Vercel-friendly): run `pnpm add resend`
- [x] Generate NextAuth secret: run `openssl rand -base64 32` and save output for next step
- [x] Set NextAuth URL in Vercel: run `vercel env add NEXTAUTH_URL` and enter production URL (e.g., https://your-app.vercel.app)
- [x] Set NextAuth secret in Vercel: run `vercel env add NEXTAUTH_SECRET` and paste the generated secret
- [x] Set Resend API key: run `vercel env add RESEND_API_KEY` (get key from https://resend.com/api-keys)
- [x] Set email from address: run `vercel env add EMAIL_FROM` and enter "Scry <noreply@yourdomain.com>"
- [x] Pull env vars locally: run `vercel env pull .env.local` to update local environment

#### Vercel Postgres Setup (Neon Serverless)
- [x] Create Vercel Postgres: run `vercel postgres create scry-db` to create a new Postgres database (Note: Using Neon serverless Postgres)
- [x] Link database to project: run `vercel link` if not already linked, database should auto-connect
- [x] Pull database env vars: run `vercel env pull .env.local` to get `POSTGRES_*` variables
- [x] Install Prisma (recommended for auth): run `pnpm add prisma @prisma/client`
- [x] Install Neon adapters: run `pnpm add @neondatabase/serverless @prisma/adapter-neon` for Edge Runtime compatibility
- [x] Initialize Prisma: run `pnpm prisma init` to create prisma folder and schema
- [x] Update Prisma schema: replace default schema with auth tables (users, sessions, verification_tokens) and add `previewFeatures = ["driverAdapters"]`
- [x] Set database URL in schema: update `datasource db` in schema.prisma to use `env("DATABASE_URL_UNPOOLED")` for migrations
- [x] Create edge-compatible Prisma client: implement `/lib/prisma.ts` with Neon adapter for production use
- [x] Generate Prisma client: run `pnpm prisma generate`
- [x] Push schema to database: run `pnpm prisma db push` to create tables in Vercel Postgres
- [x] Verify tables created: run `pnpm prisma studio` to open Prisma Studio and check tables

#### NextAuth Configuration
- [x] Create auth configuration: implement `/lib/auth.ts` with NextAuth configuration including email provider
- [x] Configure Resend email provider: set up magic link email using Resend provider in NextAuth config
- [x] Add Prisma adapter: integrate `@auth/prisma-adapter` with Prisma client in configuration
- [x] Set session strategy: configure database sessions with 30-minute idle timeout in auth config
- [x] Configure production URL: ensure `NEXTAUTH_URL` is used for callbacks in production
- [x] Create auth utilities: export `auth`, `signIn`, `signOut` helper functions from `/lib/auth.ts`

#### API Route Setup
- [x] Create NextAuth route handler: implement `/app/api/auth/[...nextauth]/route.ts` with GET and POST exports
- [x] Test auth endpoints locally: verify endpoints work with `pnpm dev`
- [x] Deploy to Vercel: run `vercel --prod` to deploy and test auth endpoints in production
- [x] Verify production endpoints: test `/api/auth/signin` etc. on deployed URL
  - Note: Auth endpoints are deployed but behind Vercel Authentication. Need to disable Deployment Protection in Vercel Dashboard under Settings > Deployment Protection

#### Authentication UI Components
- [x] Install shadcn/ui components: run `pnpm dlx shadcn-ui@latest add dialog tabs form input button alert toast`
- [x] Create auth modal component: implement `/components/auth/auth-modal.tsx` using shadcn Dialog component
- [x] Add tabbed interface: use shadcn Tabs component for sign in/sign up switching in modal
- [x] Create email form: use shadcn Form with Input component following `topic-input.tsx` patterns
- [x] Add loading states: use shadcn Button with loading variant and Loader2 icon
- [x] Create success alert: use shadcn Alert component for "Check your email" message
- [x] Add error handling: use shadcn FormMessage for field errors and Sonner for general errors
- [x] Style auth buttons: use shadcn Button variants (default, outline, ghost) for consistency

#### Navbar Integration
- [x] Install dropdown menu: run `pnpm dlx shadcn-ui@latest add dropdown-menu avatar` (Note: Used `shadcn@latest` as shadcn-ui is deprecated)
- [ ] Update navbar component: add auth state check to `/components/navbar.tsx` or create if doesn't exist
- [ ] Add sign in button: use shadcn Button component with variant="outline" size="sm"
- [ ] Create user menu: implement shadcn DropdownMenu with Avatar for authenticated users
- [ ] Add menu items: use DropdownMenuItem for "My Quizzes", "Settings", "Sign out" options
- [ ] Test responsive design: ensure auth UI works on mobile following existing responsive patterns

#### Middleware & Route Protection
- [ ] Create middleware file: implement `/middleware.ts` with NextAuth session checks
- [ ] Configure middleware matcher: ensure middleware works with Vercel Edge Runtime
- [ ] Define public routes: configure matcher to exclude `/`, `/api/auth/*`, static files from protection
- [ ] Protect quiz creation: add `/create` route to protected paths requiring authentication
- [ ] Add redirect logic: redirect unauthenticated users to sign in page with return URL
- [ ] Test middleware locally: verify protected routes work with `pnpm dev`
- [ ] Deploy middleware: run `vercel --prod` and verify middleware runs on Edge Runtime
- [ ] Monitor Edge function logs: run `vercel logs --prod` to check middleware execution

#### Session Provider Setup
- [ ] Wrap app with provider: add `SessionProvider` to `/app/layout.tsx` root layout
- [ ] Create auth context: implement `/contexts/auth-context.tsx` for client-side auth state
- [ ] Add session hook: create `useAuth` hook for accessing session in client components
- [ ] Test session persistence: verify sessions persist across page refreshes

### Phase 2: User Association with Quizzes (Day 2)

#### Database Schema Updates
- [ ] Update Prisma schema: add `QuizResult` model to schema.prisma with userId, topic, score, completedAt fields
- [ ] Add relation to User: define relation between User and QuizResult models in Prisma schema
- [ ] Generate updated client: run `pnpm prisma generate` to update Prisma client
- [ ] Push schema changes: run `pnpm prisma db push` to update Vercel Postgres
- [ ] Add indexes: include `@@index([userId])` in QuizResult model for query performance
- [ ] Verify in production: run `vercel env pull` then `pnpm prisma studio` to check production tables

#### Quiz Generation Updates
- [ ] Update quiz API route: modify `/app/api/generate-quiz/route.ts` to check for authenticated session
- [ ] Extract user ID: get userId from session in quiz generation endpoint
- [ ] Store quiz results: save generated quiz with userId if user is authenticated
- [ ] Handle anonymous users: allow quiz generation without auth but don't save results
- [ ] Add error handling: properly handle database errors when saving quiz results

#### My Quizzes Page
- [ ] Install data table components: run `pnpm dlx shadcn-ui@latest add table card skeleton`
- [ ] Create quizzes route: add `/app/(protected)/quizzes/page.tsx` for user's quiz history
- [ ] Implement data fetching: create server component that fetches user's quizzes from database
- [ ] Design quiz cards: use shadcn Card components with CardHeader, CardContent for each quiz
- [ ] Add data table view: implement shadcn Table for list view option showing topic, score, date
- [ ] Add pagination: install `pnpm dlx shadcn-ui@latest add pagination` and implement
- [ ] Create empty state: use shadcn Card with icon and "Start your first quiz" button
- [ ] Add loading skeleton: use shadcn Skeleton components for loading states

#### User Menu Enhancement
- [ ] Add navigation link: include "My Quizzes" link in user dropdown menu
- [ ] Create profile placeholder: add non-functional "Profile" link for future enhancement
- [ ] Improve menu styling: ensure dropdown matches existing UI patterns
- [ ] Add keyboard navigation: implement proper arrow key navigation in dropdown

### Phase 3: OAuth & Polish (Week 2)

#### OAuth Provider Setup
- [ ] Create Google OAuth app: visit https://console.cloud.google.com/apis/credentials and create OAuth 2.0 credentials
- [ ] Set Google redirect URI: add `https://your-app.vercel.app/api/auth/callback/google` to authorized redirect URIs
- [ ] Add Google credentials to Vercel: run `vercel env add GOOGLE_CLIENT_ID` and `vercel env add GOOGLE_CLIENT_SECRET`
- [ ] Create GitHub OAuth app: visit https://github.com/settings/developers and create new OAuth App
- [ ] Set GitHub redirect URI: use `https://your-app.vercel.app/api/auth/callback/github` as callback URL
- [ ] Add GitHub credentials to Vercel: run `vercel env add GITHUB_CLIENT_ID` and `vercel env add GITHUB_CLIENT_SECRET`
- [ ] Pull updated env vars: run `vercel env pull .env.local` to get OAuth credentials locally
- [ ] Update NextAuth config: add Google and GitHub providers to `/lib/auth.ts`
- [ ] Update Prisma schema: ensure Account model exists for OAuth provider data
- [ ] Push schema updates: run `pnpm prisma db push` if schema was updated
- [ ] Test OAuth locally: verify OAuth flow works with `pnpm dev`
- [ ] Deploy OAuth changes: run `vercel --prod` to deploy OAuth configuration
- [ ] Test production OAuth: verify Google and GitHub sign in works on deployed app

#### UI Enhancements
- [ ] Install separator component: run `pnpm dlx shadcn-ui@latest add separator`
- [ ] Add OAuth buttons: use shadcn Button with variant="outline" and provider icons
- [ ] Style provider buttons: add Google/GitHub icons from lucide-react to buttons
- [ ] Implement button loading states: use Button loading prop with spinner during OAuth redirect
- [ ] Add divider element: use shadcn Separator with "Or continue with" text
- [ ] Update success handling: use Sonner for success messages after OAuth
- [ ] Test OAuth error states: use shadcn Alert with variant="destructive" for errors

#### Account Settings Page
- [ ] Install settings components: run `pnpm dlx shadcn-ui@latest add tabs label switch accordion`
- [ ] Create settings route: implement `/app/(protected)/settings/page.tsx`
- [ ] Design settings UI: use shadcn Tabs for profile, security, preferences sections
- [ ] Add email display: use shadcn Label and Input (disabled) to show verified email
- [ ] Create delete account: use shadcn AlertDialog for deletion confirmation
- [ ] Implement session list: use shadcn Accordion to show active sessions with revoke buttons

#### Email Preferences
- [ ] Install switch component: run `pnpm dlx shadcn-ui@latest add switch` if not already installed
- [ ] Add preferences schema: extend user model with emailPreferences JSON field
- [ ] Create preferences form: use shadcn Switch components for email toggles
- [ ] Style preference items: use shadcn Label with description text for each preference
- [ ] Add save button: use shadcn Button with loading state for saving preferences
- [ ] Test email preferences: verify preferences are respected when sending emails

#### Security Enhancements
- [ ] Set up Vercel KV: run `vercel kv create scry-kv` to create KV store for rate limiting
- [ ] Link KV to project: KV store should auto-link, run `vercel env pull` to get KV env vars
- [ ] Implement rate limiter: create `/lib/rate-limit.ts` using @vercel/kv for auth endpoint protection
- [ ] Add rate limiting middleware: apply rate limiter to `/api/auth/*` endpoints
- [ ] Configure security headers: add security headers to `next.config.js` for production
- [ ] Enable HTTPS redirect: ensure `headers()` in next.config.js includes strict transport security
- [ ] Test rate limiting: verify rate limits work locally and in production
- [ ] Monitor security logs: use `vercel logs --prod` to monitor authentication attempts

#### Performance Optimization
- [ ] Configure KV session cache: implement session caching in `/lib/auth.ts` using Vercel KV
- [ ] Set cache TTL: configure 5-minute cache TTL for session lookups in KV
- [ ] Enable Prisma query logging: add query logging in development to identify slow queries
- [ ] Add connection pooling: configure `connection_limit` in Prisma datasource for Vercel
- [ ] Set up monitoring: enable Vercel Analytics with `pnpm add @vercel/analytics`
- [ ] Add performance tracking: implement Web Vitals tracking for auth flows
- [ ] Review Edge logs: run `vercel logs --prod --filter=edge` to check middleware performance
- [ ] Optimize bundle size: run `pnpm analyze` to check impact of auth dependencies

## Next Up

### Deployment Checklist
- [ ] Run build locally: execute `pnpm build` to ensure no build errors
- [ ] Test production build: run `pnpm start` to test production build locally
- [ ] Check TypeScript: run `pnpm tsc --noEmit` to verify no type errors
- [ ] Verify env vars: run `vercel env ls` to ensure all required variables are set
- [ ] Deploy to preview: run `vercel` to deploy to preview environment
- [ ] Test preview deployment: thoroughly test auth flow on preview URL
- [ ] Deploy to production: run `vercel --prod` for production deployment
- [ ] Monitor deployment: run `vercel logs --prod --follow` to monitor real-time logs
- [ ] Set up alerts: configure Vercel monitoring alerts for errors
- [ ] Document deployment: update README with deployment instructions

### Future Enhancements
- [ ] Add two-factor authentication: use shadcn InputOTP component for TOTP verification
- [ ] Create 2FA setup flow: use shadcn Dialog with QR code display and InputOTP for verification
- [ ] Implement password auth: add shadcn PasswordInput component (custom with show/hide toggle)
- [ ] Add password strength: use shadcn Progress component to show password strength meter
- [ ] Create admin dashboard: use shadcn DataTable for user management interface
- [ ] Add admin user actions: use shadcn DropdownMenu for user actions (suspend, delete, etc.)
- [ ] Implement email reminders: use shadcn Badge to show verification status
- [ ] Create recovery flow: use shadcn Stepper component (or custom steps) for account recovery
- [ ] Add login history: use shadcn Table with sorting for device/location history
- [ ] Create API key management: use shadcn Card components with copy button for API keys
- [ ] Set up Vercel Cron Jobs for session cleanup
- [ ] Implement Vercel Edge Config for feature flags with shadcn Switch for toggle UI

## Completed
