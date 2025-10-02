# Environment Validation System & Authentication Cleanup

*Generated: 2025-10-01*
*Approach: Zod + Next.js Instrumentation Hook*

---

## Executive Summary

**Problem**: Critical environment variables (GOOGLE_AI_API_KEY) are not validated at startup, causing cryptic runtime errors during question generation. Additionally, legacy Resend authentication code pollutes the codebase despite full migration to Clerk, and CLERK_WEBHOOK_SECRET has a security vulnerability.

**Solution**: Implement production-grade environment validation using Zod schemas with Next.js instrumentation hook, providing build-time and runtime validation with full TypeScript type safety. Simultaneously clean up all Resend references (documentation-only, zero code impact).

**User Value**: Developers get immediate, clear feedback when environment is misconfigured; production deployments fail fast instead of runtime surprises; reduced debugging time from cryptic API errors.

**Success Criteria**: Zero deployments with missing/invalid env vars; all secrets validated before app starts; complete removal of Resend confusion from documentation.

---

## User Context

### Target Users
- **Who**: Solo developer (you) + future contributors
- **Technical Level**: Experienced full-stack developer
- **Use Case**: Local development setup, CI/CD deployments, production monitoring

### User Problems Being Solved
1. **Cryptic Runtime Errors**: `GOOGLE_AI_API_KEY || ''` fails during question generation with unhelpful error messages
2. **Late Error Discovery**: Missing env vars not caught until user tries to generate questions
3. **Documentation Confusion**: Resend references mislead new contributors about authentication system
4. **Security Vulnerability**: Missing CLERK_WEBHOOK_SECRET silently accepts forged webhooks
5. **No Type Safety**: `process.env.X` is always `string | undefined`, requiring defensive checks everywhere

### Expected User Benefits
- **Fail Fast**: Build/deployment fails immediately if configuration is wrong (not at 2am in production)
- **Clear Errors**: "Missing GOOGLE_AI_API_KEY - get one at https://aistudio.google.com/app/apikey"
- **Type Safety**: `env.GOOGLE_AI_API_KEY` is guaranteed `string` (never undefined), full autocomplete
- **Clean Docs**: New contributors see accurate authentication architecture (Clerk only)
- **Security**: Webhook endpoint properly warns/rejects when verification secret is missing

---

## Requirements

### Functional Requirements (What it MUST do)

**Core Functionality**:
- [ ] Validate all required environment variables at build time (fails `next build` if missing)
- [ ] Validate all required environment variables at runtime (fails server startup if missing)
- [ ] Provide format validation (URLs must be URLs, API keys must match patterns, emails must be emails)
- [ ] Generate TypeScript types automatically from Zod schema (full autocomplete)
- [ ] Display clear, actionable error messages showing exactly what's wrong
- [ ] Separate server-only secrets from client-safe public variables

**Environment Variables to Validate**:

**Required Server-Only**:
- [ ] `GOOGLE_AI_API_KEY`: Non-empty string starting with "AIzaSy" (Google AI format)
- [ ] `CLERK_SECRET_KEY`: Non-empty string starting with "sk_" (Clerk format)
- [ ] `CLERK_WEBHOOK_SECRET`: Optional but WARN in production if missing (security issue)

**Required Client-Safe**:
- [ ] `NEXT_PUBLIC_CONVEX_URL`: Valid URL matching `https://*.convex.cloud`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Non-empty string starting with "pk_"

**Optional**:
- [ ] `NEXT_PUBLIC_APP_URL`: Valid URL if provided
- [ ] `NEXT_PUBLIC_USE_LEGACY_LAYOUT`: Boolean coercion from string
- [ ] `NODE_ENV`: Enum validation with "development" default

**Resend Cleanup (Remove ALL References)**:
- [ ] Remove `resend` from `package.json` dependencies
- [ ] Remove RESEND_API_KEY and EMAIL_FROM from `.env.example`
- [ ] Update 13 documentation files removing Resend references
- [ ] Update health check endpoint to remove "magic link" warnings
- [ ] Mark BACKLOG.md task as complete

**Security Fixes**:
- [ ] Fix CLERK_WEBHOOK_SECRET vulnerability in `convex/http.ts` (currently returns 200 OK when missing)
- [ ] Remove `|| ''` fallback from `GOOGLE_AI_API_KEY` in `lib/ai-client.ts`
- [ ] Ensure no server secrets can leak to client bundle

### Non-Functional Requirements (How well it must perform)

**Performance**:
- Build time impact: < 100ms added to `next build`
- Server startup impact: < 50ms added to initialization
- Client bundle impact: 0 bytes (server-only code)
- Runtime overhead: 0ms (validation runs once at startup)

**Developer Experience**:
- Error messages must show:
  - Variable name
  - Expected format/value
  - Where to get the value (link to API key page)
  - Which file to update (`.env.local`)
- TypeScript autocomplete for `env.VARIABLE_NAME` everywhere
- No undefined checks needed after validation

**Security**:
- Server secrets NEVER in client bundle (build-time detection)
- Webhook secrets validated and enforced in production
- Clear warning logs when security-critical vars missing
- Fail closed (reject request) not fail open (accept everything)

**Reliability**:
- Fail at build time, not runtime (catch in CI/CD)
- No silent failures (every error is explicit)
- Vercel deployments fail pre-production if env vars missing
- Impossible to deploy with invalid configuration

**Maintainability**:
- Single source of truth for all env vars (`lib/env.ts`)
- Adding new env var = add one line to Zod schema
- Type safety prevents forgetting to validate new vars
- Clear documentation in schema (`.describe()` for each field)

---

## Architectural Design

### Selected Approach
**Zod Schema + Next.js Instrumentation Hook + Build-Time Import**

**Rationale**:
- **Simplicity**: Zod already in dependencies (used for request validation), zero new libraries
- **User Value**: Best-in-class error messages, full type safety, catches errors in CI/CD
- **Explicitness**: Single `lib/env.ts` file contains all validation logic, obvious and centralized
- **Extensibility**: Adding env vars = one line in schema, automatic type inference
- **Not Overkill**: t3-env is designed for teams (prevent junior devs from exposing secrets); solo dev doesn't need extra enforcement layer

**Why Not t3-env**:
- Extra dependency (~50KB)
- More boilerplate (manual runtimeEnv mapping)
- Overkill for solo developer (designed for team safety)
- Adds complexity without proportional benefit

**Why Not Manual Validation**:
- No type safety
- No format validation
- Manual TypeScript types required
- Error-prone to maintain

### Alternative Approaches Considered

| Approach | User Value | Simplicity | Type Safety | Maintenance | Why Not Selected |
|----------|-----------|------------|-------------|-------------|------------------|
| **Zod + Instrumentation** ⭐ | High - Clear errors, fail fast | High - No new deps | Full - Auto types | Low - One file | **SELECTED** |
| t3-env Library | High - Best DX | Medium - New dep | Full - Auto types | Medium - More files | Overkill for solo dev |
| Manual Array Check | Low - Basic errors | High - Zero deps | None | High - Manual types | No format validation |
| Runtime Only | Medium - Runtime errors | High - Simple | None | Medium | Doesn't fail builds |
| Build Only | Medium - CI errors | High - Simple | Partial | Medium | Misses runtime issues |

### System Architecture

**High-Level Components**:
```
┌─────────────────────────────────────────────────────────────┐
│                    next.config.ts                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  import './lib/env' ← Build-time validation          │  │
│  │  (Runs during `next build` and `next dev`)           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Validates env vars
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      lib/env.ts                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Zod Schema Definition                                │  │
│  │  • serverSchema (GOOGLE_AI_API_KEY, CLERK_SECRET)    │  │
│  │  • clientSchema (NEXT_PUBLIC_CONVEX_URL, etc)        │  │
│  │  • Format validation (URL, email, startsWith)        │  │
│  │  • Error formatting (developer-friendly messages)    │  │
│  │  • TypeScript type inference                         │  │
│  │  • export const env = validateEnv()                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Imports for type safety
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              instrumentation.ts (Runtime)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  await import('./lib/env') ← Runtime validation      │  │
│  │  (Runs when server starts: `next start`)             │  │
│  │  • Logs validation success                           │  │
│  │  • Exits process on failure (fail fast)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Validated env available
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          Application Code (Components, API Routes)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  import { env } from '@/lib/env'                     │  │
│  │  const apiKey = env.GOOGLE_AI_API_KEY  ← Type-safe  │  │
│  │  const url = env.NEXT_PUBLIC_CONVEX_URL             │  │
│  │  // No undefined checks needed!                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Module Boundaries** (Deep Module Design):

**Module 1: Environment Validation (`lib/env.ts`)**
- **Interface**: `export const env` object with typed properties
- **Responsibility**: Validate all env vars, provide type-safe access, format errors
- **Hidden Complexity**: Zod schemas, client/server separation logic, error formatting, process.exit behavior
- **Why Deep**: Simple interface (`env.X`) hides complex validation, parsing, type inference

**Module 2: Runtime Instrumentation (`instrumentation.ts`)**
- **Interface**: `export async function register()` (Next.js convention)
- **Responsibility**: Initialize server, validate environment, log startup
- **Hidden Complexity**: Timing, error recovery, conditional execution (nodejs runtime only)
- **Why Deep**: Simple hook hides startup orchestration

**Module 3: Application Code (everywhere else)**
- **Interface**: Import validated env, use guaranteed-present values
- **Responsibility**: Business logic using configuration
- **Hidden Complexity**: None - just uses env values
- **Why Shallow**: Just consumes the validated env

**Abstraction Layers**:
- **Layer 1 (Application)**: "Give me configuration values" (`env.GOOGLE_AI_API_KEY`)
- **Layer 2 (Validation)**: "Validate environment meets requirements" (Zod schema + parsing)
- **Layer 3 (Runtime)**: "Get value from process.env" (`process.env.GOOGLE_AI_API_KEY`)

*Each layer changes vocabulary: App talks "configuration", Validation talks "schemas", Runtime talks "environment variables"*

### Technology Stack

**Languages/Frameworks**:
- TypeScript 5.x: Full type inference from Zod schemas
- Next.js 15: App Router with instrumentation hook
- Node.js 22.x: Runtime environment

**Libraries/Dependencies**:
- **Zod 3.x**: Already in dependencies, schema validation and type inference
  - Why: Production-grade validation, excellent TypeScript integration, 50KB gzipped
  - Alternatives rejected: Yup (heavier, less TS support), Joi (no TS inference), custom (maintenance burden)

**Infrastructure**:
- Next.js instrumentation hook: Built-in, runs on server startup
- TypeScript namespace augmentation: Extends `process.env` types globally
- Build-time import: Force validation during `next build`

**Rationale**: This stack serves users best by using existing dependencies (Zod), fitting existing architecture (Next.js 15 instrumentation), and minimizing complexity (no new libraries to learn/maintain).

---

## Dependencies & Assumptions

### Explicit Dependencies

**External Systems**: None (self-contained validation)

**Libraries/Services**:
- **Zod 3.x**: CRITICAL - already in `package.json` line 71
  - Version constraint: `^3.23.8` (current)
  - Criticality: REQUIRED for validation
  - Breaking change risk: LOW (stable, mature library)

**Infrastructure Requirements**:
- Compute: None (validation < 50ms)
- Storage: None
- Network: None

### Documented Assumptions

**Environment**:
- Deployment platform: Vercel (uses VERCEL_ENV, VERCEL_URL variables)
- Next.js 15: Instrumentation hook is stable (experimental flag still required)
- Server runtime: Node.js (not Edge runtime for instrumentation)

**Scale**:
- Number of env vars: ~10 required, ~5 optional (current + growth)
- Validation complexity: Simple string/URL/email checks (< 1ms per var)
- Error frequency: Rare in production (caught in CI/CD)

**Users**:
- Solo developer: No team coordination needed
- Technical capability: Comfortable with TypeScript, Zod, Next.js patterns
- Development workflow: Uses `.env.local` for secrets, Vercel dashboard for production

**Team**:
- Size: 1 developer
- Skill level: Senior full-stack
- Timeline: "Invest in infrastructure" (not rushed)

### Identified Constraints

**Technical**:
- Must work with Next.js 15 App Router (not Pages Router)
- Must support both development and production environments
- Must not break existing Convex/Clerk integrations
- Must not increase client bundle size

**Resource**:
- Budget: $0 (no new services/libraries)
- Timeline: Single PR implementation
- Team capacity: Solo developer

**Operational**:
- Deployment process: Vercel Git integration (auto-deploy on push)
- Monitoring/alerting: Build logs, Vercel deployment logs
- Compliance: None (internal tooling)

---

## Implementation Strategy

### Phase 1: Core Environment Validation (MVP)
**Goal**: Production-grade validation preventing invalid deployments

**Scope**:
- [ ] Create `lib/env.ts` with complete Zod schemas
- [ ] Create `instrumentation.ts` for runtime validation
- [ ] Update `next.config.ts` to import env for build-time validation
- [ ] Create `env.d.ts` for TypeScript namespace augmentation
- [ ] Update `.env.example` to match schema (remove Resend vars)
- [ ] Remove `|| ''` fallback from `lib/ai-client.ts:10`
- [ ] Replace existing `lib/env.ts` validation with new system
- [ ] Fix CLERK_WEBHOOK_SECRET vulnerability in `convex/http.ts`

**Success Criteria**:
- [ ] `next build` fails if GOOGLE_AI_API_KEY missing
- [ ] Server startup fails if any required var invalid
- [ ] TypeScript autocomplete works for `env.GOOGLE_AI_API_KEY`
- [ ] Error messages show exactly what's wrong and where to fix
- [ ] No client bundle size increase

**Estimated Time**: 2-3 hours

### Phase 2: Resend Cleanup & Documentation
**Goal**: Remove all traces of deprecated Resend authentication

**Scope**:
- [ ] Remove `resend` from `package.json` (run `pnpm remove resend`)
- [ ] Update 13 documentation files:
  - `.env.example` - Remove RESEND_API_KEY, EMAIL_FROM
  - `CLAUDE.md` - Remove Resend references, update auth flow
  - `README.md` - Remove from tech stack, env vars, troubleshooting
  - `docs/environment-setup.md` - Remove setup instructions
  - `docs/ci-cd-setup.md` - Remove CI/CD config
  - `docs/deployment-checklist.md` - Remove from checklist
  - `docs/convex-deployment-fix.md` - Remove env var commands
  - `docs/error-handling.md` - Remove Resend error scenarios
  - `docs/authentication-task-analysis.md` - Add migration note
  - `.github/SECURITY.md` - Remove from third-party services
  - `convex/README.md` - Remove emailActions reference
  - `convex/TYPES.md` - Check and update if needed
  - `app/api/health/preview/route.ts` - Update warning messages
- [ ] Mark BACKLOG.md task as complete

**Success Criteria**:
- [ ] `pnpm list resend` returns empty
- [ ] `grep -r "RESEND_API_KEY" .` returns only git history
- [ ] All documentation refers to Clerk authentication only
- [ ] No broken links or references

**Estimated Time**: 1-2 hours

### Phase 3: Testing & Verification
**Goal**: Comprehensive test coverage and deployment validation

**Scope**:
- [ ] Create `lib/env.test.ts` with validation tests
  - Test: All required vars present → success
  - Test: Missing GOOGLE_AI_API_KEY → build fails
  - Test: Invalid URL format → error
  - Test: Invalid email format → error
- [ ] Update existing tests that mock env vars
  - `lib/ai-client.test.ts` - Already mocks GOOGLE_AI_API_KEY
  - Other tests - Ensure they set required env vars
- [ ] Test build-time validation: `pnpm build` without env vars
- [ ] Test runtime validation: Start server without env vars
- [ ] Test Vercel deployment: Preview deployment with missing var

**Success Criteria**:
- [ ] All tests pass locally
- [ ] Build fails with clear error when var missing
- [ ] CI/CD catches missing vars before merge
- [ ] Vercel deployment fails gracefully with helpful error

**Estimated Time**: 1-2 hours

---

## Testing Strategy

### Test Pyramid

**Unit Tests** (Fast, focused):
- [ ] `lib/env.test.ts`: Zod schema validation logic
  - Valid env vars → passes
  - Missing required var → throws with clear message
  - Invalid URL format → throws
  - Invalid email format → throws
  - Client-side validation only validates NEXT_PUBLIC_* vars
- Target: 100% coverage of validation logic

**Integration Tests** (Build/Runtime):
- [ ] Build-time: `next build` fails with missing GOOGLE_AI_API_KEY
- [ ] Runtime: `next start` exits with code 1 if validation fails
- [ ] Instrumentation: Startup logs show "✅ Environment variables validated"

**End-to-End Tests** (Deployment):
- [ ] Vercel preview deployment: Missing env var → deployment fails
- [ ] Vercel production deployment: All vars present → deployment succeeds
- [ ] Local development: `pnpm dev` catches missing vars immediately

### Test Data & Environments
- **Test Data**: Mock env vars in `beforeEach` with valid/invalid values
- **Staging**: Vercel preview deployments test with production-like env
- **CI/CD**: GitHub Actions should fail fast on missing vars (build-time validation)

---

## Success Metrics & KPIs

### User Value Metrics (Primary)
- **Time to Error Discovery**: < 10 seconds (build-time failure vs. minutes/hours of debugging)
- **Error Clarity**: 100% of env errors show variable name + where to get value
- **False Positives**: 0 (valid configurations always pass)
- **Developer Satisfaction**: Clear, actionable errors (no "works on my machine")

### Technical Metrics (Secondary)
- **Build Time Impact**: < 100ms added to `next build`
- **Runtime Impact**: < 50ms added to server startup
- **Bundle Size**: 0 bytes client-side increase
- **Type Safety**: 100% of env access via typed `env` object

### Business Metrics (Deployment Safety)
- **Failed Prod Deployments**: 0 due to missing env vars (caught in CI/CD)
- **Time to Deploy Fix**: < 5 minutes (clear error → set var → redeploy)
- **Documentation Clarity**: 0 confusion about Resend vs. Clerk

### How We'll Measure
- Build logs: Check validation timing and error messages
- Vercel deployment logs: Monitor pre-deploy validation failures
- TypeScript compiler: Verify autocomplete and type errors
- Developer feedback: "Did error message tell you what to do?"

---

## Risks & Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Instrumentation hook fails in production | Low | High | Import in `next.config.ts` catches 99% at build time; instrumentation is backup |
| Invalid env vars in production | Very Low | High | Build-time validation prevents this; Vercel dashboard shows vars before deploy |
| Type inference breaks with Zod update | Low | Medium | Pin Zod version; test after updates; Zod is stable (v3 for 2+ years) |
| Client bundle includes server secrets | Very Low | Critical | Zod schema separates client/server; Next.js strips non-NEXT_PUBLIC_; manual review |

### Timeline Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scope creep (health check upgrade) | Medium | Low | Explicitly out of scope; focus on validation only |
| Resend cleanup takes longer | Low | Low | Already audited; 16 files, mostly docs, ~2 hours max |
| Test writing takes longer | Medium | Low | Core validation is priority; can merge basic tests, iterate |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vercel deployment blocked | Low | High | Test in preview deployment first; rollback plan via Git revert |
| Breaking change for local dev | Low | Medium | Update `.env.example` in same PR; migration guide in PR description |
| CLERK_WEBHOOK_SECRET fix breaks webhooks | Low | Medium | Current behavior is already broken (security issue); fix improves it |

---

## Key Decisions & Rationale

### Decision 1: Zod + Instrumentation (Not t3-env)
**Decision**: Use Zod schemas with Next.js instrumentation hook
**Options Considered**: t3-env library, manual validation, Zod only
**Rationale**:
- **User Value**: t3-env is overkill for solo developer (designed for team safety)
- **Simplicity**: Zod already in dependencies, instrumentation is Next.js built-in
- **Explicitness**: Single file (`lib/env.ts`) contains all logic, no magic
- **Type Safety**: Full Zod type inference, same as t3-env
**Trade-offs**: No automatic client/server bundle separation enforcement (but solo dev doesn't need it)

### Decision 2: Build-Time + Runtime Validation (Both)
**Decision**: Validate at build time (import in next.config.ts) AND runtime (instrumentation)
**Options Considered**: Build-only, runtime-only, both
**Rationale**:
- **User Value**: Build-time catches in CI/CD (fast feedback), runtime catches edge cases
- **Fail Fast**: Can't deploy with missing vars (build fails), can't start with bad vars (server exits)
- **Defense in Depth**: Two validation points better than one
**Trade-offs**: Slightly more complex setup (two import points), negligible performance cost

### Decision 3: Include Resend Cleanup in Same PR
**Decision**: Remove Resend in same PR as env validation
**Rationale**:
- **Thematic Coherence**: Both are "clean up environment configuration"
- **Atomic Change**: Removing RESEND_API_KEY from docs while validating remaining vars is logical
- **Reduced Context Switching**: One review, one test, one deploy
- **Zero Risk**: Resend is documentation-only (no active code)
**Trade-offs**: Slightly larger PR, but still focused scope

### Decision 4: GOOGLE_AI_API_KEY is Required (Not Optional)
**Decision**: Make GOOGLE_AI_API_KEY required, fail startup if missing
**Options Considered**: Optional with warning, required
**Rationale**:
- **User Value**: Question generation is core functionality
- **Product Value First**: App without generation is not useful
- **Explicit Over Implicit**: Better to fail explicitly than silently degrade
**Trade-offs**: Can't run app without API key (acceptable - generation is required)

### Decision 5: CLERK_WEBHOOK_SECRET Warns (Not Fails)
**Decision**: Optional but WARN loudly in production if missing
**Options Considered**: Required, optional silent, optional with warning
**Rationale**:
- **Security**: Current behavior (silently accepts forged webhooks) is unacceptable
- **Flexibility**: Development environments may not need webhooks
- **Explicitness**: Warning makes security issue visible
**Trade-offs**: Not enforced (could still deploy without secret), but visible in logs

---

## Leyline Binding Compliance

### Applicable Bindings for Implementation

**Core Bindings**:

- **hex-domain-purity**: Environment validation is pure infrastructure - no business logic mixing
  - Validation logic is pure (input → validated output or error)
  - No side effects in validation (only in startup: log + exit)

- **api-design**: `env` object is the interface contract
  - Simple: `env.VARIABLE_NAME` (no methods, no complexity)
  - Explicit: Types guarantee variable exists and has correct format
  - Hard to misuse: TypeScript prevents accessing undefined vars

- **automated-quality-gates**: Validation IS the quality gate
  - CI/CD fails if vars missing (automated)
  - Build fails if vars invalid (automated)
  - No manual checklist needed

- **code-size**: Single focused file
  - `lib/env.ts`: ~200 lines (Zod schemas + validation)
  - `instrumentation.ts`: ~30 lines (startup hook)
  - Total: < 250 lines of infrastructure code

**Technology-Specific Bindings**:

- **TypeScript: no-any**:
  - Full Zod type inference (`z.infer<typeof schema>`)
  - No `any` types in env validation
  - `process.env` augmented with concrete types

- **TypeScript: modern-typescript-toolchain**:
  - TypeScript 5.x with strict mode
  - Zod for runtime validation + type inference
  - Namespace augmentation for global types

**Validation Plan**:
- Code review checklist: Verify no `any` types, single responsibility per file
- Type checking: `pnpm tsc --noEmit` must pass with zero errors
- Manual review: Env schema is explicit and well-documented

---

## Open Questions

*All questions resolved through user feedback:*
- ✅ GOOGLE_AI_API_KEY required → Yes (generation is core feature)
- ✅ Resend cleanup scope → Include in same PR (zero risk, thematically related)
- ✅ Validation level → Robust infrastructure investment (Zod + instrumentation)
- ✅ Team considerations → Solo developer (no team safety layers needed)
- ✅ Health check upgrade → Out of scope (keep simple)

---

## Validation Checklist

**Ousterhout Validation**:
- [x] **Deep Modules**: `env` object is simple interface (access vars), hides complex validation logic
- [x] **Information Hiding**: Zod schemas, error formatting, client/server separation are internal
- [x] **No Information Leakage**: Can change validation library without affecting callers (still import `env`)
- [x] **Different Abstractions**: App layer sees "configuration", validation layer sees "schemas", runtime sees "process.env"
- [x] **Strategic Design**: Investing ~5 hours now, saves hours of debugging forever

**Tenet Validation**:
- [x] **Simplicity**: Zod (already have it) + instrumentation (built-in) = minimal new concepts
- [x] **User Value**: Clear errors, fail fast, type safety = measurably better developer experience
- [x] **Explicitness**: All env vars documented in single schema, all validation logic in one file
- [x] **Maintainability**: Adding env var = one line in schema, automatic type inference
- [x] **Observability**: Startup logs show validation success, error messages show exact problem

**Dijkstra Validation**:
- [x] All invariants explicitly stated: "GOOGLE_AI_API_KEY must start with AIzaSy"
- [x] Edge cases defined: Missing var, invalid format, client accessing server var
- [x] Failure modes documented: Build fails, runtime exits, clear error messages
- [x] Mathematical precision: Zod schema is formal specification of valid environment

---

## Next Steps

1. **Review this PRD** with stakeholder (you)
2. **Get approval** on approach and scope
3. **Run `/plan`** to decompose into actionable implementation tasks
4. **Begin Phase 1** (core validation system)

**Ready for**: `/plan` command

---

## File Change Summary

### Files to Create (3 new files)
1. `/Users/phaedrus/Development/scry/lib/env.ts` - Complete rewrite with Zod schemas
2. `/Users/phaedrus/Development/scry/instrumentation.ts` - Runtime validation hook
3. `/Users/phaedrus/Development/scry/env.d.ts` - TypeScript namespace augmentation

### Files to Modify (18 files)

**High Priority (Core Functionality)**:
1. `/Users/phaedrus/Development/scry/next.config.ts` - Add `import './lib/env'` at top
2. `/Users/phaedrus/Development/scry/lib/ai-client.ts:10` - Remove `|| ''` fallback
3. `/Users/phaedrus/Development/scry/convex/http.ts:56-62` - Fix webhook security
4. `/Users/phaedrus/Development/scry/package.json` - Remove `resend` dependency

**Documentation Updates (13 files)**:
5. `.env.example` - Remove RESEND_API_KEY, EMAIL_FROM
6. `CLAUDE.md` - Remove Resend references
7. `README.md` - Update tech stack and env vars
8. `docs/environment-setup.md` - Remove Resend setup
9. `docs/ci-cd-setup.md` - Remove Resend from CI/CD
10. `docs/deployment-checklist.md` - Remove from checklist
11. `docs/convex-deployment-fix.md` - Remove env commands
12. `docs/error-handling.md` - Remove Resend scenarios
13. `docs/authentication-task-analysis.md` - Add migration note
14. `.github/SECURITY.md` - Remove from services
15. `convex/README.md` - Remove emailActions
16. `convex/TYPES.md` - Update if needed
17. `app/api/health/preview/route.ts` - Update warnings

**Tracking**:
18. `BACKLOG.md` - Mark Resend cleanup task complete

### Files to Delete (0 files)
- None (Resend code already removed, only docs remain)

---

*"Simplicity is prerequisite for reliability. This validation system is simple by design, reliable by construction."*
