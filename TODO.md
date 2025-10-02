# TODO: Environment Validation System & Authentication Cleanup

## Context
- **Approach**: Zod + Next.js Instrumentation Hook (no t3-env - overkill for solo dev)
- **Key Files**:
  - `lib/env.ts` (complete rewrite)
  - `instrumentation.ts` (new file)
  - `env.d.ts` (new file)
  - `next.config.ts` (add import)
  - `lib/ai-client.ts:10` (remove fallback)
  - `convex/http.ts:56-62` (fix security)
- **Patterns**:
  - Vitest + happy-dom for testing
  - Zod already used in `lib/prompt-sanitization.ts` and `lib/ai-client.ts`
  - TypeScript strict mode via lint-staged
- **Dependencies**:
  - Zod ^3.25.67 (already present)
  - Next.js 15.4.7 with App Router
  - Node.js >=20.19.0

## Tenet Integration Plan

### 🎯 Modularity
**Component Boundaries:**
- **Environment Validation Module** (`lib/env.ts`): Single responsibility = validate and expose typed env vars
  - Interface: `export const env` object with typed properties
  - Hidden: Zod schemas, validation logic, error formatting
- **Runtime Instrumentation** (`instrumentation.ts`): Single responsibility = server startup initialization
  - Interface: Next.js `register()` hook
  - Hidden: Timing, conditional execution, error recovery
- **Type Augmentation** (`env.d.ts`): Single responsibility = global TypeScript types
  - Interface: `process.env` namespace extension
  - Hidden: Type definitions derived from Zod schema

**Independence:** Each component can be tested in isolation, no circular dependencies

### 🎯 Testability
**Overall Strategy:**
- **Unit Tests**: Zod schema validation logic (valid/invalid inputs)
- **Integration Tests**: Build-time import + runtime instrumentation
- **E2E Tests**: Vercel preview deployment with missing var

**Test Boundaries:**
- Mock `process.env` in unit tests
- Mock `process.exit` to prevent test runner termination
- Use Vitest's `vi.resetModules()` for clean env state per test

### 🎯 Design Evolution
**Iteration Checkpoints:**
1. After Phase 1: Review env schema completeness (did we miss any vars?)
2. After security fixes: Verify no new vulnerabilities introduced
3. After Resend cleanup: Check for broken references

**Assumptions to Validate:**
- Instrumentation hook works in Vercel (TEST in preview deploy)
- Build-time import fails CI/CD correctly (VERIFY with intentionally broken env)
- Type inference works across all import sites (CHECK with TypeScript server)

### 🎯 Automation
**Quality Gates:**
- Build-time validation (automatic via next.config.ts import)
- Runtime validation (automatic via instrumentation.ts)
- Type checking (automatic via pnpm tsc --noEmit)
- Test coverage (automatic via vitest --coverage)

**Process Automation:**
- Pre-commit hook validates env vars exist in .env.example
- CI/CD pipeline fails on missing env vars before deployment
- Vercel build logs show clear error if validation fails

### 🎯 Binding Compliance
**Applicable Core Bindings:**
- `hex-domain-purity`: Validation is pure infrastructure (no business logic mixing)
- `api-design`: `env` object is explicit interface with clear contract
- `automated-quality-gates`: Validation IS the quality gate
- `code-size`: Single focused file (~200 lines for lib/env.ts)

**Technology-Specific Bindings:**
- `typescript/no-any`: Full Zod type inference, no `any` types
- `typescript/modern-typescript-toolchain`: TypeScript 5.x strict mode

---

## Phase 1: Core Environment Validation [2-3 hours]

### 1.1 Create Complete Zod Validation Schema

- [ ] **Create `lib/env.ts` with Zod schemas and validation**
  ```
  Files to create:
  - lib/env.ts (new file, replaces existing simple validation)

  🎯 MODULARITY: Environment Validation Module
  - Single responsibility: Validate environment variables, provide type-safe access
  - Interface: `export const env` with typed properties (GOOGLE_AI_API_KEY, CLERK_SECRET_KEY, etc.)
  - Hidden complexity: Zod schemas, client/server separation, error formatting, process.exit
  - Dependencies: zod (already in package.json)

  🎯 TESTABILITY: Unit test strategy
  - Test file: `lib/env.test.ts` (create in separate task)
  - Mock boundaries: process.env, process.exit
  - Test scenarios:
    - All required vars present → success
    - Missing GOOGLE_AI_API_KEY → throws with clear message
    - Invalid URL format → throws
    - Client-side only validates NEXT_PUBLIC_* vars

  Implementation approach:
  1. Define serverEnvSchema with required server-only vars:
     - GOOGLE_AI_API_KEY: z.string().min(1).startsWith('AIzaSy')
     - CLERK_SECRET_KEY: z.string().min(1).startsWith('sk_')
     - CLERK_WEBHOOK_SECRET: z.string().optional() + production warning
  2. Define clientEnvSchema with public vars:
     - NEXT_PUBLIC_CONVEX_URL: z.string().url().regex(/^https:\/\/.*\.convex\.cloud$/)
     - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).startsWith('pk_')
     - NEXT_PUBLIC_APP_URL: z.string().url().optional()
     - NEXT_PUBLIC_USE_LEGACY_LAYOUT: z.enum(['true', 'false']).optional().transform(v => v === 'true')
  3. Merge schemas: `const envSchema = serverEnvSchema.merge(clientEnvSchema)`
  4. Create formatErrors() helper for developer-friendly error messages
  5. Create validateEnv() function with client/server separation logic
  6. Export validated `env` object: `export const env = validateEnv()`
  7. Add helper functions: isProduction, isDevelopment

  Success criteria:
  - [ ] Zod schemas defined for all required vars
  - [ ] Format validation (URL, startsWith, enum) implemented
  - [ ] Error messages show variable name + expected format + where to get value
  - [ ] Client-side validation only checks NEXT_PUBLIC_* vars
  - [ ] Type inference works: `env.GOOGLE_AI_API_KEY` is `string` not `string | undefined`
  - [ ] File compiles with `pnpm tsc --noEmit`

  🎯 BINDING COMPLIANCE:
  - hex-domain-purity: ✅ Pure validation logic, no business concerns
  - no-any: ✅ Full Zod type inference, no `any` types used
  - code-size: ✅ ~200 lines, single focused responsibility

  Time estimate: 45-60 minutes
  Risk: Medium (critical infrastructure, must get schema right)
  ```

### 1.2 Create TypeScript Type Augmentation

- [ ] **Create `env.d.ts` for global TypeScript types**
  ```
  Files to create:
  - env.d.ts (new file, root directory)

  🎯 MODULARITY: Type Definition Module
  - Single responsibility: Extend process.env with concrete types
  - Interface: Global NodeJS.ProcessEnv namespace
  - Hidden complexity: Type definitions matching Zod schema
  - Dependencies: None (pure TypeScript types)

  🎯 TESTABILITY: Type-level testing
  - Test: TypeScript compiler catches undefined access
  - Test: Autocomplete works in IDE for env.VARIABLE_NAME
  - Test: Type errors when accessing non-existent vars

  Implementation approach:
  1. Declare namespace NodeJS
  2. Extend ProcessEnv interface with all env vars from lib/env.ts schema
  3. Add types for auto-provided vars (VERCEL_ENV, NEXT_RUNTIME, NODE_ENV)
  4. Export empty object to make it a module

  Success criteria:
  - [ ] TypeScript recognizes process.env.GOOGLE_AI_API_KEY as string
  - [ ] Autocomplete shows all env vars when typing env.
  - [ ] No type errors in existing code accessing process.env
  - [ ] File compiles with `pnpm tsc --noEmit`

  🎯 BINDING COMPLIANCE:
  - no-any: ✅ Concrete types for all env vars
  - modern-typescript-toolchain: ✅ Namespace augmentation pattern

  Time estimate: 15 minutes
  Risk: Low (pure types, no runtime behavior)
  Dependencies: lib/env.ts must exist (schema defines types)
  ```

### 1.3 Create Runtime Instrumentation Hook

- [ ] **Create `instrumentation.ts` for Next.js startup validation**
  ```
  Files to create:
  - instrumentation.ts (new file, root directory)

  🎯 MODULARITY: Runtime Initialization Module
  - Single responsibility: Validate env vars at server startup
  - Interface: `export async function register()` (Next.js convention)
  - Hidden complexity: Conditional execution (nodejs runtime only), error recovery, timing
  - Dependencies: lib/env (imports for validation)

  🎯 TESTABILITY: Integration test strategy
  - Test: Server startup logs "✅ Environment variables validated"
  - Test: Server exits with code 1 if validation fails
  - Mock boundaries: console.log, process.exit

  Implementation approach:
  1. Export async register() function
  2. Check process.env.NEXT_RUNTIME === 'nodejs' (skip Edge runtime)
  3. Log "🚀 Server instrumentation starting..."
  4. Start timer with console.time()
  5. Import lib/env (triggers validation)
  6. Log success + environment info (NODE_ENV, CONVEX_URL)
  7. End timer
  8. Catch errors, log, and process.exit(1)

  Success criteria:
  - [ ] Function runs on server startup (not on client)
  - [ ] Logs show validation success in development
  - [ ] Server exits if env vars invalid
  - [ ] Timing logged for performance monitoring
  - [ ] File compiles with `pnpm tsc --noEmit`

  🎯 BINDING COMPLIANCE:
  - hex-domain-purity: ✅ Infrastructure initialization, no business logic
  - automated-quality-gates: ✅ Automatic validation at startup

  Time estimate: 20 minutes
  Risk: Low (straightforward Next.js hook)
  Dependencies: lib/env.ts must exist
  ```

### 1.4 Enable Build-Time Validation

- [ ] **Update `next.config.ts` to import env for build-time validation**
  ```
  Files to modify:
  - next.config.ts:1 (add import at very top, before other imports)

  🎯 MODULARITY: Build Configuration
  - Single responsibility: Configure Next.js build + trigger env validation
  - Interface: NextConfig export
  - Change: Add single import statement at top

  🎯 TESTABILITY: Integration test
  - Test: `pnpm build` fails if GOOGLE_AI_API_KEY missing
  - Test: Build logs show clear error message
  - Mock: Remove env var from .env.local temporarily

  Implementation approach:
  1. Add `import './lib/env';` as FIRST line of file (before type import)
  2. Add comment explaining build-time validation
  3. Enable instrumentation hook in experimental config:
     ```typescript
     experimental: {
       instrumentationHook: true,
       // ... existing optimizePackageImports, webVitalsAttribution
     }
     ```

  Success criteria:
  - [ ] Import added at line 1 (before all other code)
  - [ ] instrumentationHook: true added to experimental config
  - [ ] Build succeeds with valid env vars
  - [ ] Build fails with missing env vars (test by temporarily removing)
  - [ ] File compiles with `pnpm tsc --noEmit`

  🎯 BINDING COMPLIANCE:
  - automated-quality-gates: ✅ Build-time validation prevents bad deploys

  Time estimate: 10 minutes
  Risk: Low (single import + config flag)
  Dependencies: lib/env.ts, instrumentation.ts must exist
  ```

### 1.5 Remove Unsafe Fallbacks

- [ ] **Fix `lib/ai-client.ts:10` - Remove empty string fallback**
  ```
  Files to modify:
  - lib/ai-client.ts:10 (line 10 specifically)

  🎯 MODULARITY: AI Client Configuration
  - Single responsibility: Create Google AI client
  - Interface: Exported google client object
  - Change: Remove `|| ''` fallback, import validated env

  🎯 TESTABILITY: Unit test update
  - Test file: lib/ai-client.test.ts (already exists)
  - Update: No changes needed (test already mocks env)
  - Verify: Tests still pass after change

  Implementation approach:
  1. Add import at top: `import { env } from '@/lib/env';`
  2. Change line 10 from:
     ```typescript
     apiKey: process.env.GOOGLE_AI_API_KEY || '',
     ```
     to:
     ```typescript
     apiKey: env.GOOGLE_AI_API_KEY,
     ```
  3. Remove `|| ''` fallback completely

  Success criteria:
  - [ ] Import added: `import { env } from '@/lib/env';`
  - [ ] Line 10 uses `env.GOOGLE_AI_API_KEY` (no fallback)
  - [ ] Existing tests pass: `pnpm test lib/ai-client.test.ts`
  - [ ] File compiles with `pnpm tsc --noEmit`
  - [ ] TypeScript knows apiKey is never undefined

  🎯 BINDING COMPLIANCE:
  - hex-domain-purity: ✅ Configuration separated from implementation
  - no-any: ✅ Type-safe env access

  Time estimate: 10 minutes
  Risk: Low (simple refactor, tests already exist)
  Dependencies: lib/env.ts must exist and export env object
  ```

### 1.6 Fix Webhook Security Vulnerability

- [ ] **Fix `convex/http.ts:56-62` - Properly handle missing CLERK_WEBHOOK_SECRET**
  ```
  Files to modify:
  - convex/http.ts:56-62 (webhook handler function)

  🎯 MODULARITY: Webhook Security
  - Single responsibility: Verify Clerk webhook signatures
  - Interface: HTTP route handler
  - Change: Warn in production, reject unsigned requests

  🎯 TESTABILITY: Integration test strategy
  - Test: Development without secret → returns 200 with warning
  - Test: Production without secret → logs warning, returns 401
  - Test: Request without svix headers → returns 400
  - Mock boundaries: process.env.NODE_ENV

  Implementation approach:
  1. Import validated env: `import { env } from '@/lib/env';`
  2. Change lines 56-62 to:
     ```typescript
     const webhookSecret = env.CLERK_WEBHOOK_SECRET;

     if (!webhookSecret) {
       if (env.NODE_ENV === 'production') {
         console.error('🚨 SECURITY: CLERK_WEBHOOK_SECRET not set in production!');
         // Fail closed in production - reject unsigned requests
         return new Response('Webhook verification required', { status: 401 });
       }
       // Development fallback - log warning and continue
       console.warn('⚠️  CLERK_WEBHOOK_SECRET not set - accepting unverified webhook (dev only)');
       return new Response('Webhook accepted (dev mode - no verification)', { status: 200 });
     }
     ```
  3. Rest of verification logic remains unchanged

  Success criteria:
  - [ ] Import added: `import { env } from '@/lib/env';`
  - [ ] Production mode rejects webhooks without secret (401)
  - [ ] Development mode accepts with warning (200)
  - [ ] Logs clearly show security issue when secret missing
  - [ ] Existing webhook tests pass (if any)
  - [ ] File compiles with `pnpm tsc --noEmit`

  🎯 BINDING COMPLIANCE:
  - hex-domain-purity: ✅ Security validation separated from business logic
  - input-validation-standards: ✅ Fail closed (reject unsafe requests)

  Time estimate: 20 minutes
  Risk: Medium (security-critical, must test thoroughly)
  Dependencies: lib/env.ts must exist and export env + NODE_ENV
  ```

### 1.7 Update Environment Variable Example

- [ ] **Update `.env.example` to match new validation schema**
  ```
  Files to modify:
  - .env.example (remove Resend vars, add comments)

  🎯 MODULARITY: Documentation
  - Single responsibility: Document required env vars for setup
  - Interface: Example file for new developers
  - Change: Remove Resend, add format requirements

  Implementation approach:
  1. Remove lines:
     - RESEND_API_KEY=re_...
     - EMAIL_FROM=Scry <noreply@yourdomain.com>
  2. Add format comments to existing vars:
     ```bash
     # Google AI API key for quiz generation
     # Get from: https://makersuite.google.com/app/apikey
     # Format: Must start with "AIzaSy"
     GOOGLE_AI_API_KEY=AIzaSy...

     # Clerk secret key for server-side authentication
     # Get from: https://dashboard.clerk.com
     # Format: Must start with "sk_"
     CLERK_SECRET_KEY=sk_...

     # Clerk webhook secret for webhook verification (REQUIRED in production)
     # Get from: https://dashboard.clerk.com/webhooks
     # SECURITY: Without this, webhooks are not verified!
     CLERK_WEBHOOK_SECRET=whsec_...

     # Convex backend URL
     # Format: Must be https://*.convex.cloud
     NEXT_PUBLIC_CONVEX_URL=https://your-app.convex.cloud

     # Clerk publishable key
     # Format: Must start with "pk_"
     NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
     ```
  3. Add optional vars section:
     ```bash
     # Optional: Application URL for absolute URLs
     NEXT_PUBLIC_APP_URL=https://yourdomain.com

     # Optional: Use legacy layout (default: false)
     NEXT_PUBLIC_USE_LEGACY_LAYOUT=false
     ```

  Success criteria:
  - [ ] All RESEND_* vars removed
  - [ ] All required vars documented with format requirements
  - [ ] Links to get API keys included
  - [ ] Comments explain validation rules
  - [ ] Optional vars clearly marked

  🎯 BINDING COMPLIANCE:
  - explicitness: ✅ Clear documentation of requirements

  Time estimate: 15 minutes
  Risk: Low (documentation only)
  Dependencies: lib/env.ts schema defines what to document
  ```

---

## Phase 2: Resend Cleanup & Documentation [1-2 hours]

### 2.1 Remove Resend Package

- [ ] **Remove `resend` from package.json dependencies**
  ```
  Command to run:
  - pnpm remove resend

  🎯 MODULARITY: Dependency Management
  - Single responsibility: Remove unused authentication library
  - Impact: Reduces bundle size, removes maintenance burden
  - Zero risk: No code uses Resend (verified in /spec research)

  Implementation approach:
  1. Run: `pnpm remove resend`
  2. Verify removal: `pnpm list resend` (should show empty)
  3. Verify build: `pnpm build` (should succeed)

  Success criteria:
  - [ ] package.json no longer contains "resend"
  - [ ] pnpm-lock.yaml updated (automatic)
  - [ ] `pnpm list resend` returns empty
  - [ ] `pnpm build` succeeds
  - [ ] No import errors (no code imports from 'resend')

  🎯 BINDING COMPLIANCE:
  - code-size: ✅ Reduces bundle size and dependency tree

  Time estimate: 5 minutes
  Risk: Very Low (no code depends on this package)
  Dependencies: None (can run anytime)
  ```

### 2.2 Clean Core Documentation

- [ ] **Update primary documentation files (4 files)**
  ```
  Files to modify:
  - CLAUDE.md (lines 61, 82-83, 202)
  - README.md (lines 36, 119-120, 261-262, 356, 591-593)
  - .github/SECURITY.md (lines 124-126)
  - BACKLOG.md (line 144 - mark task complete)

  🎯 MODULARITY: Documentation Consistency
  - Single responsibility: Accurate system documentation
  - Change: Remove Resend, clarify Clerk-only auth

  Implementation approach:
  1. CLAUDE.md:
     - Line 61: Remove RESEND_API_KEY, EMAIL_FROM from env vars list
     - Lines 82-83: Remove "Resend API key for magic links" requirement
     - Line 202: Update auth flow to mention Clerk only
  2. README.md:
     - Line 36: Remove "Resend API key for email" from tech stack
     - Lines 119-120: Remove RESEND_API_KEY, EMAIL_FROM from env table
     - Lines 261-262: Remove resend from Vercel env setup commands
     - Line 356: Update architecture to show Clerk-only auth
     - Lines 591-593: Remove resend from troubleshooting
  3. .github/SECURITY.md:
     - Lines 124-126: Remove Resend from third-party services list
  4. BACKLOG.md:
     - Line 144: Change from `- [ ]` to `- [x]` (mark complete)
     - Add note: "✅ Completed: Removed in env validation PR"

  Success criteria:
  - [ ] `grep -r "RESEND_API_KEY" CLAUDE.md README.md` returns no results
  - [ ] `grep -r "resend" CLAUDE.md README.md .github/SECURITY.md -i` only shows git history
  - [ ] BACKLOG.md shows task as complete
  - [ ] No broken markdown links

  🎯 BINDING COMPLIANCE:
  - explicitness: ✅ Documentation matches reality

  Time estimate: 25 minutes
  Risk: Low (documentation only, no code changes)
  Dependencies: None (independent documentation updates)
  ```

### 2.3 Clean Developer Setup Guides

- [ ] **Update developer documentation (4 files)**
  ```
  Files to modify:
  - docs/environment-setup.md (lines 38-39, 61-62, 131-136, 146-148, 223-225, 257)
  - docs/ci-cd-setup.md (lines 132-133, 178-179)
  - docs/deployment-checklist.md (lines 47-48, 63-64)
  - docs/convex-deployment-fix.md (lines 63-64)

  🎯 MODULARITY: Setup Documentation
  - Single responsibility: Guide developers through setup
  - Change: Remove Resend setup steps, simplify

  Implementation approach:
  1. docs/environment-setup.md:
     - Remove all references to RESEND_API_KEY and EMAIL_FROM
     - Update "Required variables" table to exclude Resend
     - Update setup instructions to remove Resend signup
     - Update troubleshooting to remove Resend errors
  2. docs/ci-cd-setup.md:
     - Remove Resend from CI/CD environment variable setup
     - Update secrets management to exclude Resend
  3. docs/deployment-checklist.md:
     - Remove Resend API key from deployment verification
     - Update pre-deployment checklist
  4. docs/convex-deployment-fix.md:
     - Remove Resend from Convex environment setup
     - Update deployment commands

  Success criteria:
  - [ ] No references to RESEND_API_KEY in setup docs
  - [ ] Setup guide reflects Clerk-only auth
  - [ ] Checklist accurate for current system
  - [ ] No broken internal links

  🎯 BINDING COMPLIANCE:
  - explicitness: ✅ Clear, accurate setup instructions

  Time estimate: 20 minutes
  Risk: Low (documentation only)
  Dependencies: None (independent documentation updates)
  ```

### 2.4 Clean Error Handling Documentation

- [ ] **Update error handling documentation (2 files)**
  ```
  Files to modify:
  - docs/error-handling.md (lines 24-38, 72, 176-194, 212, 709)
  - docs/authentication-task-analysis.md (lines 100, 127)

  🎯 MODULARITY: Error Documentation
  - Single responsibility: Document error scenarios
  - Change: Remove Resend error scenarios, add migration note

  Implementation approach:
  1. docs/error-handling.md:
     - Lines 24-38: Remove "Invalid RESEND_API_KEY" error section
     - Line 72: Remove Resend from service outage list
     - Lines 176-194: Remove Resend service outage recovery
     - Line 212: Update external dependencies list (remove Resend)
     - Line 709: Remove Resend documentation link
  2. docs/authentication-task-analysis.md:
     - Lines 100, 127: Add note about migration from Resend to Clerk
     - Add section: "## Migration History: Resend → Clerk"
     - Document: "Authentication fully migrated to Clerk. Resend removed in [date]."

  Success criteria:
  - [ ] No Resend error scenarios remain
  - [ ] Migration history documented for future reference
  - [ ] Error handling docs reflect current system
  - [ ] No broken documentation links

  🎯 BINDING COMPLIANCE:
  - design-never-done: ✅ Document migration for historical context

  Time estimate: 15 minutes
  Risk: Low (documentation only)
  Dependencies: None (independent documentation updates)
  ```

### 2.5 Clean Convex Documentation

- [ ] **Update Convex-specific documentation (2 files)**
  ```
  Files to modify:
  - convex/README.md (lines 9, 74, 82)
  - convex/TYPES.md (verify if references exist)

  🎯 MODULARITY: Backend Documentation
  - Single responsibility: Document Convex backend
  - Change: Remove non-existent emailActions reference

  Implementation approach:
  1. convex/README.md:
     - Line 9: Remove emailActions.ts from file list (file doesn't exist)
     - Lines 74, 82: Remove code examples using Resend
     - Update auth documentation to show Clerk-only flow
  2. convex/TYPES.md:
     - Search for any Resend/email types
     - Remove if found, otherwise skip

  Success criteria:
  - [ ] No references to emailActions.ts (file doesn't exist)
  - [ ] No Resend code examples
  - [ ] Convex docs reflect current backend architecture
  - [ ] File list accurate

  🎯 BINDING COMPLIANCE:
  - explicitness: ✅ Documentation matches actual codebase

  Time estimate: 10 minutes
  Risk: Low (documentation only)
  Dependencies: None (independent documentation updates)
  ```

### 2.6 Update Health Check Endpoint

- [ ] **Update `app/api/health/preview/route.ts` - Remove magic link warning**
  ```
  Files to modify:
  - app/api/health/preview/route.ts:191

  🎯 MODULARITY: Health Check
  - Single responsibility: Report system health
  - Change: Remove outdated warning about magic links

  Implementation approach:
  1. Find line 191 (in recommendations.push section)
  2. Remove or update warning:
     ```typescript
     // OLD:
     recommendations.push(
       'VERCEL_URL is not set. This may cause issues with magic link generation in preview deployments.'
     );

     // NEW:
     recommendations.push(
       'VERCEL_URL is not set. This may cause issues with authentication redirects in preview deployments.'
     );
     ```
  3. Search file for any other "magic link" or "resend" references
  4. Remove/update as needed

  Success criteria:
  - [ ] No "magic link" references in health check
  - [ ] Warning message accurate for Clerk auth
  - [ ] Health check still functional
  - [ ] File compiles with `pnpm tsc --noEmit`

  🎯 BINDING COMPLIANCE:
  - explicitness: ✅ Accurate system status reporting

  Time estimate: 10 minutes
  Risk: Low (simple text change)
  Dependencies: None (independent update)
  ```

---

## Phase 3: Testing & Verification [1-2 hours]

### 3.1 Create Env Validation Unit Tests

- [ ] **Create `lib/env.test.ts` for validation testing**
  ```
  Files to create:
  - lib/env.test.ts (new file)

  🎯 MODULARITY: Test Suite
  - Single responsibility: Verify env validation logic
  - Interface: Vitest test suite
  - Coverage: Valid inputs, invalid inputs, error messages

  🎯 TESTABILITY: Comprehensive unit tests
  - Test file structure: describe/it blocks with Vitest
  - Mock boundaries: process.env, process.exit, console
  - Test data: Valid/invalid env var combinations

  Implementation approach:
  1. Setup:
     ```typescript
     import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

     const originalEnv = process.env;

     beforeEach(() => {
       vi.resetModules(); // Clear module cache
       process.env = { ...originalEnv };
     });

     afterEach(() => {
       process.env = originalEnv;
     });
     ```
  2. Test cases:
     - Valid env (all required vars) → passes
     - Missing GOOGLE_AI_API_KEY → throws
     - Invalid GOOGLE_AI_API_KEY format (doesn't start with AIzaSy) → throws
     - Invalid URL format for CONVEX_URL → throws
     - Missing CLERK_SECRET_KEY → throws
     - Invalid CLERK_SECRET_KEY format (doesn't start with sk_) → throws
     - Client-side validation only checks NEXT_PUBLIC_* vars
     - Optional vars work when missing
  3. Mock process.exit to prevent test runner termination:
     ```typescript
     const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
       throw new Error('process.exit called');
     });
     ```

  Success criteria:
  - [ ] All test cases pass: `pnpm test lib/env.test.ts`
  - [ ] 100% coverage of validation logic
  - [ ] Tests are isolated (can run in any order)
  - [ ] Error messages validated (not just "throws")
  - [ ] Tests complete in < 1 second

  🎯 BINDING COMPLIANCE:
  - automated-quality-gates: ✅ Automated validation testing
  - testability: ✅ Isolated unit tests with clear boundaries

  Time estimate: 30 minutes
  Risk: Low (standard unit testing)
  Dependencies: lib/env.ts must exist
  ```

### 3.2 Update Existing Tests

- [ ] **Update `lib/ai-client.test.ts` to use validated env**
  ```
  Files to modify:
  - lib/ai-client.test.ts (update mocks and setup)

  🎯 MODULARITY: Test Updates
  - Single responsibility: Ensure AI client tests still pass
  - Change: Update to use validated env import

  🎯 TESTABILITY: Regression prevention
  - Verify: Existing tests still pass after env validation changes
  - Update: Mock setup to include all required env vars

  Implementation approach:
  1. Review current test setup (already uses vi.mock and process.env)
  2. Add all required env vars to beforeEach:
     ```typescript
     beforeEach(() => {
       process.env.GOOGLE_AI_API_KEY = 'AIzaSyTestKey123';
       process.env.CLERK_SECRET_KEY = 'sk_test_123';
       process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
       process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
       // ... other required vars
     });
     ```
  3. Run tests: `pnpm test lib/ai-client.test.ts`
  4. Fix any failures related to env validation

  Success criteria:
  - [ ] All existing tests pass
  - [ ] No new test failures introduced
  - [ ] Tests run in same time (no performance regression)
  - [ ] Coverage maintained or improved

  🎯 BINDING COMPLIANCE:
  - automated-quality-gates: ✅ Regression testing

  Time estimate: 15 minutes
  Risk: Low (tests already mock env)
  Dependencies: lib/env.ts must exist, Phase 1 complete
  ```

### 3.3 Build-Time Validation Test

- [ ] **Test build-time validation by breaking environment**
  ```
  Manual test procedure:
  1. Backup current .env.local: `cp .env.local .env.local.backup`
  2. Remove GOOGLE_AI_API_KEY from .env.local
  3. Run: `pnpm build`
  4. Expected: Build fails with clear error message
  5. Verify error message shows:
     - Variable name (GOOGLE_AI_API_KEY)
     - Expected format (starts with AIzaSy)
     - Where to get it (link to Google AI Studio)
  6. Restore: `mv .env.local.backup .env.local`
  7. Run: `pnpm build`
  8. Expected: Build succeeds

  🎯 TESTABILITY: Integration test
  - Test: Build-time validation catches missing vars
  - Verify: Error messages are actionable

  Success criteria:
  - [ ] Build fails with missing GOOGLE_AI_API_KEY
  - [ ] Error message is clear and actionable
  - [ ] Build succeeds after restoring env var
  - [ ] Build time impact < 100ms (measure with time command)

  🎯 BINDING COMPLIANCE:
  - automated-quality-gates: ✅ Build-time validation prevents bad deploys

  Time estimate: 10 minutes
  Risk: Low (manual test, easy to restore)
  Dependencies: Phase 1 complete
  ```

### 3.4 Runtime Validation Test

- [ ] **Test runtime validation by starting server without env vars**
  ```
  Manual test procedure:
  1. Backup current .env.local: `cp .env.local .env.local.backup`
  2. Remove GOOGLE_AI_API_KEY from .env.local
  3. Run: `pnpm dev`
  4. Expected: Server fails to start, shows error
  5. Verify error message shows:
     - Variable name
     - Expected format
     - Where to get it
  6. Verify instrumentation logs:
     - "🚀 Server instrumentation starting..."
     - Error with validation failure
  7. Restore: `mv .env.local.backup .env.local`
  8. Run: `pnpm dev`
  9. Expected: Server starts successfully
  10. Verify instrumentation logs:
      - "✅ Environment variables validated"
      - "📍 Environment: development"
      - Timing log

  🎯 TESTABILITY: Integration test
  - Test: Runtime validation catches missing vars
  - Verify: Instrumentation hook runs correctly

  Success criteria:
  - [ ] Server fails to start with missing env var
  - [ ] Error message is clear and actionable
  - [ ] Server starts successfully after restoring
  - [ ] Instrumentation logs show success
  - [ ] Startup time impact < 50ms

  🎯 BINDING COMPLIANCE:
  - automated-quality-gates: ✅ Runtime validation prevents running with bad config

  Time estimate: 10 minutes
  Risk: Low (manual test, easy to restore)
  Dependencies: Phase 1 complete
  ```

### 3.5 Verify Vercel Deployment

- [ ] **Test Vercel preview deployment with missing env var**
  ```
  Manual test procedure:
  1. Create test branch: `git checkout -b test/env-validation`
  2. Commit changes so far: `git add . && git commit -m "test: env validation"`
  3. Push to trigger preview: `git push -u origin test/env-validation`
  4. In Vercel dashboard:
     - Go to Settings → Environment Variables
     - Temporarily remove GOOGLE_AI_API_KEY from preview env
  5. Trigger new deployment (push empty commit)
  6. Expected: Deployment fails during build
  7. Check Vercel build logs:
     - Should show validation error
     - Should show variable name and expected format
  8. Restore GOOGLE_AI_API_KEY in Vercel
  9. Trigger deployment again
  10. Expected: Deployment succeeds

  🎯 TESTABILITY: E2E deployment test
  - Test: CI/CD catches missing vars before production
  - Verify: Vercel deployment fails gracefully

  Success criteria:
  - [ ] Vercel build fails with missing env var
  - [ ] Build logs show clear error message
  - [ ] Deployment succeeds after restoring var
  - [ ] No runtime errors in working deployment

  🎯 BINDING COMPLIANCE:
  - automated-quality-gates: ✅ CI/CD prevents invalid deployments

  Time estimate: 20 minutes
  Risk: Medium (requires Vercel access, can affect preview deploys)
  Dependencies: Phase 1 complete, code committed to branch
  ```

### 3.6 Type Safety Verification

- [ ] **Verify TypeScript type inference works correctly**
  ```
  Manual verification procedure:
  1. Open lib/ai-client.ts in VS Code
  2. Hover over `env.GOOGLE_AI_API_KEY`
  3. Expected: Shows type `string` (not `string | undefined`)
  4. Try accessing non-existent var: `env.FAKE_VAR`
  5. Expected: TypeScript error "Property 'FAKE_VAR' does not exist"
  6. Type `env.` and trigger autocomplete
  7. Expected: Shows all env vars (GOOGLE_AI_API_KEY, etc.)
  8. Run: `pnpm tsc --noEmit`
  9. Expected: No type errors

  🎯 TESTABILITY: Type-level testing
  - Test: TypeScript inference works correctly
  - Verify: No undefined checks needed

  Success criteria:
  - [ ] `env.GOOGLE_AI_API_KEY` typed as `string`
  - [ ] Autocomplete shows all env vars
  - [ ] TypeScript errors for non-existent vars
  - [ ] `pnpm tsc --noEmit` passes with 0 errors

  🎯 BINDING COMPLIANCE:
  - no-any: ✅ Concrete types, no undefined
  - modern-typescript-toolchain: ✅ Full type inference

  Time estimate: 10 minutes
  Risk: Low (type checking only)
  Dependencies: Phase 1 complete
  ```

---

## Phase 4: Design Iteration & Automation [Continuous]

### 🎯 DESIGN NEVER DONE - Iteration Checkpoints

- [ ] **Iteration Checkpoint 1: After Phase 1 - Review module boundaries**
  ```
  Questions to evaluate:
  - Are lib/env.ts, instrumentation.ts, env.d.ts properly separated?
  - Did we discover any env vars we missed during implementation?
  - Should CLERK_WEBHOOK_SECRET be required instead of optional?
  - Are error messages clear enough for new contributors?
  - Is the schema structure easy to extend for new vars?

  Actions if needed:
  - Add missing env vars to schema
  - Improve error message formatting
  - Extract formatErrors() to separate util if it grows
  - Consider adding env var categories (auth, AI, database, etc.)

  🎯 BINDING COMPLIANCE:
  - design-never-done: ✅ Structured reflection on design

  Time estimate: 15 minutes
  Risk: Low (reflection and planning, no code)
  Dependencies: Phase 1 complete
  ```

- [ ] **Iteration Checkpoint 2: After security fixes - Review security posture**
  ```
  Questions to evaluate:
  - Is webhook endpoint properly secured now?
  - Are there other endpoints that need similar protection?
  - Should we log security events (missing secrets) to monitoring?
  - Are error messages revealing too much information?

  Actions if needed:
  - Add security event logging
  - Review other endpoints for similar issues
  - Add security checklist to CLAUDE.md
  - Document security assumptions

  🎯 BINDING COMPLIANCE:
  - design-never-done: ✅ Security review checkpoint

  Time estimate: 15 minutes
  Risk: Low (reflection and planning)
  Dependencies: Phase 1 (task 1.6) complete
  ```

- [ ] **Iteration Checkpoint 3: After Resend cleanup - Check for broken references**
  ```
  Questions to evaluate:
  - Did we miss any Resend references? (search entire codebase)
  - Are all internal links in docs still working?
  - Is authentication flow clearly documented now?
  - Should we add migration guide for future reference?

  Actions if needed:
  - Create migration guide document
  - Add internal link checker to CI
  - Update architecture diagrams if any exist
  - Document decision to remove Resend (why, when, how)

  Command to run:
  - `grep -r "resend\|RESEND_API_KEY\|EMAIL_FROM" . --include="*.{ts,tsx,md,json}" | grep -v ".git" | grep -v "node_modules"`

  🎯 BINDING COMPLIANCE:
  - design-never-done: ✅ Completeness verification

  Time estimate: 15 minutes
  Risk: Low (verification and documentation)
  Dependencies: Phase 2 complete
  ```

### 🎯 AUTOMATION OPPORTUNITIES

- [ ] **Quality Gate Automation: Add env validation to CI pipeline**
  ```
  Optional enhancement (can be done later):

  Create .github/workflows/env-validation.yml:
  - Check .env.example matches lib/env.ts schema
  - Verify all env vars in schema are documented
  - Run env validation tests on every PR
  - Block merge if validation tests fail

  Implementation approach:
  1. Create script: scripts/validate-env-example.js
  2. Script reads lib/env.ts schema
  3. Script reads .env.example
  4. Script verifies all required vars present in example
  5. Add to package.json: "validate:env": "node scripts/validate-env-example.js"
  6. Add to CI: run pnpm validate:env

  🎯 BINDING COMPLIANCE:
  - automation: ✅ Automate manual verification
  - automated-quality-gates: ✅ CI prevents mismatches

  Time estimate: 30 minutes
  Risk: Low (optional enhancement)
  Dependencies: None (can be done anytime after Phase 1)
  ```

- [ ] **Process Automation: Add binding compliance checks**
  ```
  Optional enhancement (can be done later):

  Create scripts/check-bindings.js:
  - Verify no `any` types in new files
  - Check file sizes (warn if > 300 lines)
  - Verify test coverage for new modules
  - Check for circular dependencies

  Implementation approach:
  1. Use ast-grep or TypeScript AST to parse files
  2. Check for prohibited patterns
  3. Generate report
  4. Add to package.json: "validate:bindings": "node scripts/check-bindings.js"
  5. Add to lint-staged for pre-commit

  🎯 BINDING COMPLIANCE:
  - automation: ✅ Automate binding verification
  - code-size: ✅ Automated file size checks

  Time estimate: 45 minutes
  Risk: Low (optional enhancement)
  Dependencies: None (can be done anytime)
  ```

---

## Final Validation Checklist

### Code Quality Gates
- [ ] Run `pnpm test` - all tests pass (including new env.test.ts)
- [ ] Run `pnpm tsc --noEmit` - no type errors
- [ ] Run `pnpm lint` - no lint errors
- [ ] Run `pnpm build` - build succeeds
- [ ] Manual test: Start dev server with valid env vars
- [ ] Manual test: Try starting with missing env var (should fail)

### 🎯 Tenet Compliance Validation

**Modularity:**
- [ ] lib/env.ts has single responsibility (validation)
- [ ] instrumentation.ts has single responsibility (startup)
- [ ] env.d.ts has single responsibility (types)
- [ ] No circular dependencies between modules
- [ ] Each module can be tested independently

**Testability:**
- [ ] lib/env.test.ts covers all validation scenarios
- [ ] Tests use proper mocking (process.env, process.exit)
- [ ] Tests are isolated (can run in any order)
- [ ] Test coverage meets standards (aim for 100% of validation logic)
- [ ] Integration tests verify build-time and runtime validation

**Design Evolution:**
- [ ] All iteration checkpoints completed
- [ ] Assumptions documented (Next.js 15 instrumentation, Vercel env vars)
- [ ] Refactoring opportunities identified
- [ ] Future extensibility considered (easy to add new env vars)

**Automation:**
- [ ] Build-time validation automated (next.config.ts import)
- [ ] Runtime validation automated (instrumentation.ts)
- [ ] Test execution automated (CI/CD)
- [ ] Quality gates cannot be bypassed

**Binding Compliance:**
- [ ] hex-domain-purity: Validation is pure infrastructure
- [ ] api-design: env object has clear interface
- [ ] automated-quality-gates: Validation runs automatically
- [ ] code-size: Files are focused and under limits
- [ ] no-any: No `any` types used
- [ ] modern-typescript-toolchain: Full type inference works

### Quality Metrics
- [ ] Test coverage: 100% of lib/env.ts validation logic
- [ ] Build time impact: < 100ms (measured)
- [ ] Runtime impact: < 50ms (measured from instrumentation logs)
- [ ] Bundle size impact: 0 bytes client-side (verified with bundle analyzer)
- [ ] Type safety: env.* always typed as concrete types, never undefined

### Resend Cleanup Verification
- [ ] `pnpm list resend` returns empty
- [ ] `grep -r "RESEND_API_KEY" . --include="*.ts" --include="*.tsx"` returns no code matches
- [ ] `grep -r "resend" docs/ -i` returns no references
- [ ] All documentation updated
- [ ] BACKLOG.md task marked complete
- [ ] No broken links in documentation

### Documentation Complete
- [ ] .env.example updated with format requirements
- [ ] CLAUDE.md reflects Clerk-only auth
- [ ] README.md reflects Clerk-only auth
- [ ] All setup guides accurate
- [ ] Error handling docs current
- [ ] No Resend references remain

---

## Implementation Notes

### Parallelization Opportunities
These tasks can be done in parallel:
- **Phase 1 tasks 1.1-1.3** can be done simultaneously (env.ts, env.d.ts, instrumentation.ts)
- **Phase 2 tasks 2.2-2.6** can be done in any order (all documentation updates)
- **Phase 3 tasks 3.1-3.2** can be done simultaneously (create new tests + update existing)

### Critical Path (Must be sequential)
1. Create lib/env.ts (task 1.1)
2. Update next.config.ts (task 1.4) - depends on lib/env.ts
3. Fix lib/ai-client.ts (task 1.5) - depends on lib/env.ts
4. Fix convex/http.ts (task 1.6) - depends on lib/env.ts
5. Test build-time validation (task 3.3) - depends on Phase 1 complete
6. Deploy to Vercel preview (task 3.5) - depends on all code complete

### Risk Mitigation
- **High Risk**: Task 1.1 (lib/env.ts) - Core infrastructure, must be correct
  - Mitigation: Follow research examples exactly, test thoroughly
- **Medium Risk**: Task 1.6 (webhook security) - Security-critical
  - Mitigation: Test both dev and prod scenarios, verify logs
- **Medium Risk**: Task 3.5 (Vercel deployment) - Could affect preview deploys
  - Mitigation: Use test branch, easy to rollback

### Time Tracking
- **Phase 1**: 2-3 hours (core validation system)
- **Phase 2**: 1-2 hours (Resend cleanup)
- **Phase 3**: 1-2 hours (testing)
- **Total**: 4-7 hours (6 hours realistic estimate)

### Success Definition
✅ **Done when:**
1. `pnpm build` fails if GOOGLE_AI_API_KEY missing
2. Dev server fails to start if env vars invalid
3. TypeScript knows env.GOOGLE_AI_API_KEY is string (not undefined)
4. All tests pass
5. No Resend references in codebase
6. Vercel deployment tested successfully

---

## Next Steps After Completion

1. **Monitor first production deployment**: Watch for any env var issues
2. **Gather feedback**: Did error messages help? Were they clear?
3. **Consider enhancements**:
   - Add env var validation to health check endpoint
   - Create migration script to audit all process.env usage
   - Add Zod schema generation from .env.example
   - Create Vercel env var sync script

4. **Document lessons learned**: Add to CLAUDE.md what worked well

---

*"The best plan is one that ships working code. This plan is specific, actionable, and test-driven. Now execute."*
