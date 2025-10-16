# CLAUDE.md

Operational guidance for Claude Code working in this repository.

## Core Operations

**Package Manager:** pnpm only (10.0+)
**Dev Setup:** `pnpm dev` (Next.js + Convex concurrently)
**Convex instances:** dev=amicable-lobster-935, prod=uncommon-axolotl-639

## Critical Architecture Rules

**Backend-First Workflow (MANDATORY):**
1. Implement mutation/query in `convex/` with args schema
2. Wait for `npx convex dev` → "Convex functions ready!"
3. Then import `api` in frontend
4. Never frontend-first (causes runtime "function not found")

**Mutation Pairs (Reversible Ops):**
- Archive ↔ Unarchive | Soft Delete ↔ Restore | Hard Delete (irreversible)
- Both mutations MUST exist before implementing UI
- Use atomic validation via `validateBulkOwnership()` helper

**Confirmation UX:**
- Reversible → `useUndoableAction()` (soft delete, archive)
- Irreversible → `useConfirmation()` with `requireTyping`

## Pure FSRS Philosophy (NON-NEGOTIABLE)

**Zero Tolerance Rules:**
- ❌ No daily limits (300 due = show 300)
- ❌ No artificial interleaving/comfort features
- ❌ No "improvements" to algorithm
- ✅ Pure FSRS calculations only
- ✅ Natural consequences teach sustainable habits

## Environment Variables (CRITICAL)

**Vercel ≠ Convex:** Separate systems, must configure BOTH

**Preview Limitation (Free Tier):**
- Preview deployments share PROD Convex backend
- Missing `GOOGLE_AI_API_KEY` in Convex prod breaks ALL environments
- No env isolation until Convex Pro ($25/mo)

**Variable Distribution:**
- Convex backend: `GOOGLE_AI_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`
- Vercel frontend: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `CLERK_*`

## Deployment Architecture

**Order:** Convex backend → Validation → Vercel frontend

**Automated (Recommended):**
```bash
vercel --prod  # Runs: npx convex deploy --cmd 'pnpm build'
```

**Manual/Hotfix:**
```bash
./scripts/deploy-production.sh  # Atomic with health checks
./scripts/check-deployment-health.sh  # Verify critical functions exist
```

**Schema Versioning:**
- Keep `convex/schemaVersion.ts` ↔ `lib/deployment-check.ts` synced
- Deploy backend first, then frontend
- Emergency bypass: `NEXT_PUBLIC_DISABLE_VERSION_CHECK=true`

## Background Job System

**Components:**
- `convex/generationJobs.ts` - Job CRUD/lifecycle
- `convex/aiGeneration.ts` - AI streaming with incremental saves
- `lib/constants/jobs.ts` - Config (max 3 concurrent/user)
- UI: BackgroundTasksBadge, BackgroundTasksPanel, GenerationTaskCard

**Lifecycle:** pending → processing → completed/failed/cancelled
**Cleanup:** Daily cron (3 AM UTC) removes completed (7d), failed (30d)

## Convex Real-Time (Zero Polling)

**Built-in reactivity:** WebSockets auto-update queries when data changes
**What we removed:** Custom events, aggressive polling
**What we kept:** 60s polling ONLY for time-based conditions (`nextReview` due checks)

## Modular Convex Architecture

**Backend modules:**
- `questionsCrud.ts` - CRUD ops (create, update, soft delete, restore)
- `questionsBulk.ts` - Atomic bulk ops (archive, delete, restore, permanent delete)
- `questionsInteractions.ts` - Answer recording + auto FSRS scheduling
- `questionsLibrary.ts` - Browse/filter/stats queries
- `spacedRepetition.ts` - Review queue (Pure FSRS, no modifications)
- `generationJobs.ts` + `aiGeneration.ts` - Background AI generation
- `lib/validation.ts` - Shared atomic validation helpers

**Validation pattern:** All bulk ops use `validateBulkOwnership()` to prevent partial failures

## Testing & Scripts

**Test stack:** Vitest (unit), Playwright (E2E)
```bash
pnpm test           # Unit tests
pnpm test:coverage  # With coverage report
pnpm test:contract  # API contract validation
```

**Utility scripts:**
- `./scripts/validate-env-vars.sh` - Check env config
- `./scripts/check-deployment-health.sh` - Verify functions deployed
