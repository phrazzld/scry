# BACKLOG

- incorporate interleaving into reviews
  * maybe just by adding a smidge of randomness / schedule jitter

## Immediate Concerns 🔥

### Security Issues (Deploy Blockers)

- [ ] **[CRITICAL]** Implement rate limiting on question generation API | Effort: 1h | Impact: Prevents abuse & API cost explosion
  * **Location**: `app/api/generate-questions/route.ts:27`
  * **Issue**: IP extracted but never passed to rate limit check from `convex/rateLimit.ts`
  * **Approach**: Add rate limit mutation call before AI generation; return 429 with `retryAfter` on limit
  * **Files**: `app/api/generate-questions/route.ts`, `convex/rateLimit.ts`

- [ ] **[HIGH]** Enforce webhook secret in production | Effort: 10min | Impact: Prevents unauthorized user data manipulation
  * **Location**: `convex/http.ts:59`
  * **Issue**: Missing `CLERK_WEBHOOK_SECRET` returns 200 OK, accepting forged requests
  * **Approach**: Fail hard (503 or throw) in production; keep dev fallback
  * **Files**: `convex/http.ts`

### Data Integrity Issues

- [ ] **[HIGH]** Fix denormalized stats race condition | Effort: 2h | Impact: Prevents inconsistent question statistics
  * **Location**: `convex/questions.ts:98-102`
  * **Issue**: `attemptCount` and `correctCount` updated separately from interaction insert
  * **Approach**: Use Convex transaction or atomic update pattern
  * **Files**: `convex/questions.ts`

- [ ] **[MEDIUM]** Use server-side filtering for soft-deleted questions | Effort: 30min | Impact: Correctness & performance
  * **Location**: `convex/questions.ts:174`
  * **Issue**: Queries filter `deletedAt === undefined` in memory after `.take(50)`
  * **Approach**: Use `by_user_active` index or filter before take
  * **Files**: `convex/questions.ts`, `convex/schema.ts`

## High-Value Improvements 🎯

### Performance Wins

- [ ] **[HIGH]** Eliminate unnecessary polling overhead | Effort: 2-3h | Impact: Better battery life, reduced server load
  * **Location**: `hooks/use-polling-query.ts`, `components/review-flow.tsx`
  * **Issue**: Polling every 30-60s for time-based conditions using `_refreshTimestamp` hack
  * **Approach**: Calculate next due time and set single timeout; add visibility API pause
  * **Alternative**: Use Convex scheduled functions to eliminate polling entirely
  * **Files**: `hooks/use-polling-query.ts`, `components/review-flow.tsx`

- [ ] **[HIGH]** Implement cursor-based pagination | Effort: 2h | Impact: Scales for thousands of questions
  * **Location**: `convex/questions.ts:174`, `convex/quiz.ts` (getQuizHistory)
  * **Issue**: O(N) pagination using `.collect()` to compute totals
  * **Approach**: Use `continueCursor` pattern, compute `hasMore` via extra `.take(1)`
  * **Files**: `convex/questions.ts`, `convex/quiz.ts`

- [ ] **[MEDIUM]** Optimize FSRS calculations with denormalized retrievability | Effort: 2h | Impact: Faster review queue queries
  * **Location**: `convex/spacedRepetition.ts:248`
  * **Issue**: Calculating retrievability for each question in every query
  * **Approach**: Store retrievability score as field, update on schedule or on interaction
  * **Files**: `convex/spacedRepetition.ts`, `convex/schema.ts`

- [ ] **[MEDIUM]** Store streak incrementally | Effort: 2h | Impact: O(1) instead of O(N) calculation
  * **Location**: `convex/spacedRepetition.ts:415-479`
  * **Issue**: Loads all user interactions to calculate streak
  * **Approach**: Update streak counter on each interaction instead of recalculating
  * **Files**: `convex/spacedRepetition.ts`, `convex/schema.ts`

- [ ] **[MEDIUM]** Optimize bundle size with code splitting | Effort: 4-6h | Impact: Faster initial load
  * **Issue**: No lazy loading for heavy components (@radix-ui ~200KB, lucide-react full set, ai SDK)
  * **Approach**: Dynamic imports for routes, tree-shakeable icon imports, lazy load modals
  * **Files**: `app/`, `components/`, `next.config.ts`

### User Experience

- [ ] **[HIGH]** Restore disabled test coverage | Effort: 8-10h | Impact: Safety net for critical flows
  * **Issue**: 797 lines removed from PR #23 (generation-modal.test.tsx, review-flow.test.tsx)
  * **Approach**: Update tests for new state machine architecture
  * **Files**: `__tests__/generation-modal.test.tsx`, `__tests__/review-flow.test.tsx`

- [ ] **[MEDIUM]** Add comprehensive error boundaries | Effort: 2h | Impact: Better error recovery, improved UX
  * **Location**: Component tree (only one boundary exists)
  * **Approach**: Add boundaries at route level and around critical components
  * **Files**: `app/`, `components/`

- [ ] **[MEDIUM]** "Recently deleted" view with restore | Effort: 2h | Impact: Completes soft delete UX
  * **Approach**: Add filter toggle on My Questions page, surface `questions.restoreQuestion` mutation
  * **Files**: `app/my-questions/`, `convex/questions.ts`

## Technical Debt Worth Paying 🔧

### Code Quality

- [ ] **[HIGH]** Replace console.log with structured logging | Effort: 2h | Impact: Production readiness, better debugging
  * **Location**: 20+ files with console statements
  * **Approach**: Use `lib/logger.ts` context loggers with NODE_ENV checks
  * **Files**: `hooks/use-quiz-interactions.ts`, `convex/http.ts`, and 18 others

- [ ] **[MEDIUM]** Fix database index usage | Effort: 30min | Impact: Removes unused index or improves query performance
  * **Location**: `convex/schema.ts:51` - `by_user_active` index defined but not used
  * **Approach**: Either use index in queries or remove it from schema
  * **Files**: `convex/schema.ts`, `convex/questions.ts`

- [ ] **[MEDIUM]** Add compound index for review queries | Effort: 15min | Impact: Better query performance
  * **Location**: `spacedRepetition.getNextReview`
  * **Issue**: Query filters by userId, nextReview, AND deletedAt separately
  * **Approach**: Add `.index('by_user_due_active', ['userId', 'nextReview', 'deletedAt'])`
  * **Files**: `convex/schema.ts`

- [ ] **[MEDIUM]** Remove deprecated quizResults table | Effort: 2-3h | Impact: Reduces confusion, prevents migration issues
  * **Location**: `convex/schema.ts:86`
  * **Approach**: Create migration to archive data, remove table and all references
  * **Files**: `convex/schema.ts`, search codebase for references

- [ ] **[LOW]** Fix type safety in schema | Effort: 15min | Impact: Stronger type checking
  * **Location**: `convex/schema.ts:139` - `metadata: v.optional(v.any())`
  * **Approach**: Define proper metadata schema with known fields
  * **Files**: `convex/schema.ts`

### Testing & Quality Gates

- [ ] **[HIGH]** Add integration tests for mutations | Effort: 6-8h | Impact: Confidence in backend logic
  * **Missing**: `recordInteraction`, `scheduleReview`, `updateQuestion`, `softDeleteQuestion`
  * **Approach**: Set up Convex dev in CI, add mutation/permission tests
  * **Files**: New test files in `__tests__/integration/`

- [ ] **[MEDIUM]** Create test utilities library | Effort: 3-4h | Impact: DRY tests, faster test writing
  * **Approach**: Mock data factories, common assertions, test wrapper components
  * **Files**: `lib/test-utils/`

- [ ] **[MEDIUM]** Add performance regression detection | Effort: 2-3h | Impact: Catch performance degradations early
  * **Approach**: Lighthouse CI integration with performance budgets
  * **Files**: `.github/workflows/`, `lighthouserc.json`

### Dependencies & Security

- [ ] **[HIGH]** Update major dependencies | Effort: 4-6h | Impact: Security patches, bug fixes, new features
  * **Critical**: `@ai-sdk/google` 1.2.22 → 2.0.17, `ai` 4.3.16 → 5.0.59, `zod` 3.25.67 → 4.1.11
  * **Approach**: Test incrementally, check breaking changes, update one at a time
  * **Files**: `package.json`

- [ ] **[HIGH]** Fix security vulnerabilities | Effort: 1-2h | Impact: Prevents exploits
  * **Found**: jsondiffpatch XSS (moderate), @eslint/plugin-kit ReDoS (low), Vite middleware (low)
  * **Approach**: Update vulnerable packages or remove if unused
  * **Files**: `package.json`

- [ ] **[MEDIUM]** Audit unused dependencies | Effort: 1h | Impact: Smaller bundle, less maintenance
  * **Candidates**: `@formkit/auto-animate`, `ws`, `resend`
  * **Approach**: Run `depcheck`, verify usage, remove if unused
  * **Files**: `package.json`

## Nice to Have 💡

### Features from Original Backlog

- [ ] Create favicon | Effort: 30min
- [ ] Make question generation more sophisticated | Effort: L
  * Check existing questions for context (avoid duplicates)
  * Check user performance for adaptive difficulty
  * Generate dynamic number of questions (e.g., NATO alphabet = 26 questions)
- [ ] Subscription paywall | Effort: XL
- [ ] Support different question types | Effort: L
  * Free response with rubric and LLM grading
- [ ] Email notifications for reviews | Effort: M

### Quality of Life

- [ ] **[LOW]** Add React.memo optimization | Effort: 30min/component | Impact: Reduced unnecessary renders
  * **Location**: `ReviewQuestionDisplay` and other frequently re-rendered components
  * **Approach**: Add React.memo with custom comparison function
  * **Files**: `components/review-flow/`

- [ ] **[LOW]** Reduce max topic length | Effort: 5min | Impact: Lower abuse potential, faster AI responses
  * **Location**: `lib/prompt-sanitization.ts:19`
  * **Approach**: Reduce from 5000 to 500-1000 chars, add telemetry
  * **Files**: `lib/prompt-sanitization.ts`

- [ ] **[LOW]** Document API route vs Convex pattern | Effort: 30min | Impact: Clearer architecture for developers
  * **Issue**: Mixed patterns confuse new developers
  * **Approach**: Add architectural decision record to CLAUDE.md
  * **Files**: `CLAUDE.md`

## Completed & Archived ✅

### From PR #23 (Resolved)
- ✅ Debug Panel & Memory Leaks: Removed in commit 29f86af
- ✅ Console Logging in debug code: Cleaned up in commit 29f86af
- ✅ Polling Args Parameter: Fixed in commit b5f9b2a
- ✅ TypeScript @ts-expect-error: Removed with debug code

### Rejected (Not Aligned with Philosophy)
- 🚫 Feature flags for debug panel: Overengineering
- 🚫 Deprecation redirect for API: Clean break is simpler
- 🚫 Complex error recovery context: Violates hypersimplicity
- 🚫 Crypto.randomUUID for session IDs: Not necessary for client-side tracking

---

## Quick Reference

### By Effort
**Quick Wins (<1h)**: Environment validation, webhook security, soft-delete filtering, index cleanup, type safety fixes, topic length reduction

**Short (1-4h)**: Rate limiting, structured logging, error boundaries, security updates, dependency audit

**Medium (4-8h)**: Polling optimization, pagination, test restoration, integration tests, bundle optimization

**Large (8h+)**: Major dependency updates, E2E test suite, comprehensive test utilities

### By Impact
**Critical Security**: Rate limiting, API key validation, webhook security, security vulnerabilities

**Performance**: Polling optimization, pagination, bundle size, FSRS calculations

**Reliability**: Test coverage, integration tests, error boundaries, race conditions

**Developer Experience**: Structured logging, test utilities, documentation

## High Priority (HIGH) — Code Health & Developer Experience

### PR #23 Follow-up Work (From Code Review)
- [ ] [HIGH] [TEST] Restore disabled test coverage (797 lines) | Effort: M | Source: PR#23 Review | Impact: Test confidence
  * Re-enable generation-modal.test.tsx (373 lines removed)
  * Re-enable review-flow.test.tsx (424 lines removed)
  * Update tests to work with new state machine architecture
- [ ] [HIGH] [PERF] Add performance CI/CD integration | Effort: M | Source: PR#23 Review | Impact: Prevent regressions
  * Integrate performance scripts into CI pipeline
  * Set up performance budgets and alerts
  * Use Web Vitals library for metrics
- [ ] [HIGH] [RELIABILITY] Improve error recovery mechanism | Effort: M | Source: PR#23 Review | Impact: Better UX
  * Replace window.location.href = '/' with context-based recovery
  * Add telemetry for error tracking
  * Document error recovery strategy
- [ ] [HIGH] [CONCURRENCY] Multi-tab race condition handling | Effort: M | Source: PR#23 Review | Impact: Data integrity
  * Implement sessionStorage or robust locking mechanism
  * Document race condition prevention strategy
  * Test with multiple tabs/windows
- [ ] [MEDIUM] [A11Y] Accessibility improvements | Effort: M | Source: PR#23 Review | Impact: User accessibility
  * Add ARIA labels to interactive elements
  * Implement keyboard navigation for all features (especially quick prompts in generation modal)
  * Add aria-live regions for dynamic updates
  * Ensure proper focus management during transitions
  * Test with screen readers

### Testing Infrastructure Rollout (Incremental PRs)
- [ ] [HIGH] [MAINTAIN] PR#2: Add test coverage reporting (Codecov/Coveralls) | Effort: S | Impact: Visibility into coverage
- [ ] [HIGH] [MAINTAIN] PR#4: React Testing Library setup with 2-3 component tests | Effort: S | Impact: Frontend testing foundation
- [ ] [HIGH] [MAINTAIN] PR#5: Integration tests for 3 critical Convex functions | Effort: M | Impact: Backend confidence
- [ ] [HIGH] [DX] PR#6: Pre-commit hooks for related tests only | Effort: S | Impact: Fast feedback loops
- [ ] [MEDIUM] [MAINTAIN] Gradual coverage increase: 40% → 50% → 60% → 70% | Effort: L | Timeline: Over 4 sprints

- [ ] [HIGH] [MAINTAIN] PR#5a: Fix test runtime environment (pin Node LTS and Rollup/Vitest) | Effort: S | Impact: Unblocks CI tests
  * Use Node 20.x or 22.x in CI and local dev (engines already require >=20.19)
  * Pin Rollup/Vitest/Vite to versions compatible with LTS Node; avoid optional native binary resolution issues
  * Verify vitest runs cleanly: pnpm test should pass on LTS

### Testing Enhancements (From PR#4 Review)
- [ ] [LOW] [DX] Create test utilities library | Effort: S | Source: PR#4 Claude review | Impact: Reusable test patterns
  * Create lib/test-utils.ts with common testing helpers
  * Mock date creators, format validators, assertion helpers
  * Reduces duplication across test files
- [ ] [LOW] [MAINTAIN] Organize test directory structure | Effort: S | Source: PR#4 Claude review | Impact: Better test organization
  * Create __tests__/unit/, __tests__/integration/, __tests__/utils/ directories
  * Move tests to appropriate directories based on type
  * Improves test discoverability and maintenance
- [ ] [LOW] [PERF] Add CI test result caching | Effort: S | Source: PR#4 Claude review | Impact: Faster CI runs
  * Cache coverage/ directory in GitHub Actions
  * Key by commit SHA for accurate results
- [ ] [HIGH] [DATA] Use server-side filtering for soft-deleted questions in queries | Effort: S | Impact: Correctness & perf
  * Update questions.getUserQuestions to filter deletedAt === undefined before `.take()`
  * Either leverage new `by_user_active` index or remove it if unused
  * Reduces redundant test execution in CI

- [ ] [HIGH] [DX] CI job: run Convex for integration tests | Effort: M | Impact: Realistic backend tests
  * Spin up `convex dev` in CI to enable mutation/permission E2E tests
  * Add smoke tests for `updateQuestion`, `softDeleteQuestion`, `restoreQuestion`
### Code Quality & Simplification
- [ ] [HIGH] [ALIGN] Implement ESLint complexity rules (max-lines: 200, complexity: 10) | Effort: S | Quality: 9/10 | Enforcement: CI pipeline blocking
- [ ] [HIGH] [MAINTAIN] Fix flaky E2E test infrastructure | Effort: M | Target: 100% reliability, <5% false positives | Automation: Auto-retry with alerts

### Developer Experience
- [ ] [HIGH] [DX] Complete pre-commit hooks with Prettier + type checking | Effort: S | Time saved: 3 hrs/week | Quality: Consistent code style
- [ ] [HIGH] [DX] Fast test runner with watch mode (Vitest) | Effort: M | Time saved: 5 hrs/week | Quality: Enables TDD workflow
- [ ] [HIGH] [DX] Zero-config development environment (Docker Compose) | Effort: L | Time saved: 4 hrs/week | Quality: Eliminates "5 services" problem

### Performance Critical
- [ ] [HIGH] [PERF] Implement semantic AI response caching | Effort: M | Target: 85% cache hits, 70% cost reduction | Measurement: API call metrics
- [ ] [HIGH] [PERF] Optimize spaced repetition queries with composite indexing | Effort: L | Target: 75% query time reduction (<50ms) | Measurement: P95 response times
- [ ] [LOW] [PERF] Optimize time-based query updates | Effort: M | Target: Eliminate unnecessary polling | Source: Convex investigation
  * Current: Using _refreshTimestamp hack to force query re-evaluation for time-based conditions
  * Solution 1: Create Convex scheduled function that updates a "currentTime" field periodically
  * Solution 2: Calculate next due time and set single timeout instead of constant polling
  * Note: Convex already provides WebSocket-based real-time updates for data changes
- [ ] [LOW] [PERF] Add monitoring for time-based polling overhead | Effort: S | Target: < 0.1% CPU usage | Source: Convex investigation
  * Reduced polling to 60-second intervals for time-based updates only
  * Data changes (new questions) handled automatically by Convex reactivity
  * Monitor battery impact on mobile devices with long review sessions

- [ ] [MEDIUM] [UX] “Recently deleted” view with restore action on My Questions | Effort: M | Value: Completes soft delete UX
  * Add filter toggle to include deleted items and provide Restore button
  * Surface `questions.restoreQuestion` mutation in UI
- [ ] [MEDIUM] [VALIDATION] Mirror client-side validation on server for questions | Effort: S | Quality: Data integrity
  * Enforce min/max lengths for question/topic/explanation in Convex mutations
## Medium Priority (MEDIUM) — Features & Optimization

### PR #23 Medium Priority Follow-ups
- [ ] [MEDIUM] [MONITORING] Production performance monitoring | Effort: M | Source: PR#23 Review | Impact: Observability
  * Add production performance telemetry
  * Monitor real user metrics (Core Web Vitals)
  * Set up alerts for performance regressions
- [ ] [MEDIUM] [PERF] Adaptive polling based on user activity | Effort: S | Source: PR#23 Review | Impact: Efficiency
  * Reduce polling interval when user is inactive
  * Increase frequency during active review sessions
  * Consider 30s → 60s → 120s backoff strategy
  * Implement visibility API to pause polling when tab is in background
  * Monitor battery impact on mobile devices
- [ ] [MEDIUM] [DX] Component code splitting maintenance | Effort: S | Source: PR#23 Review | Impact: Bundle size
  * Ensure flattened hierarchy maintains lazy loading
  * Monitor bundle sizes after refactor
  * Add dynamic imports where appropriate
- [ ] [MEDIUM] [SECURITY] Rate limiting for continuous review flow | Effort: S | Source: PR#23 Review | Impact: Abuse prevention
  * Add client-side request throttling
  * Implement server-side rate limits for review submissions
  * Monitor for unusual usage patterns

### Core Features (from Original Backlog)
- [ ] [MEDIUM] [FEATURE] Build quiz submission pipeline with Convex | Effort: M | Value: Essential for saving results | Quality: 7/10
- [ ] [MEDIUM] [FEATURE] True/False question support | Effort: S | Value: Diversifies quiz types | Quality: 6/10
- [ ] [MEDIUM] [FEATURE] Free response with AI grading | Effort: L | Value: Deeper learning assessment | Quality: 8/10
- [ ] [MEDIUM] [FEATURE] Context-aware quiz generation with embeddings | Effort: L | Value: No duplicate questions | Quality: 8/10
- [ ] [MEDIUM] [FEATURE] Study notifications via push/email | Effort: M | Value: Increases engagement | Quality: 6/10

### Quality Improvements
- [ ] [MEDIUM] [MAINTAIN] Schedule periodic cleanup of rate limit entries | Effort: S | Source: PR#5 Review | Impact: Prevent unbounded table growth
  * cleanupExpiredRateLimits exists but is not scheduled
  * Add cron/scheduler job to run cleanup daily/hourly
  * Files: convex/rateLimit.ts
- [ ] [MEDIUM] [MAINTAIN] Remove console.log pollution and implement structured logging | Effort: S | Target: Zero debug logs in production | Enforcement: ESLint rules | Source: PR#5 Review
  * Replace console.log/console.error in Convex functions with structured logger
  * Files: convex/auth.ts, convex/emailActions.ts, convex/migrations.ts
  * Use lib/logger.ts context loggers with NODE_ENV checks
- [ ] [MEDIUM] [ACCURACY] Correct AI fallback logging to match returned question count | Effort: S | Source: PR#5 Review
  * Log mentions fallbackQuestionCount: 1, but two fallback questions are returned
  * Files: lib/ai-client.ts
- [ ] [MEDIUM] [TEST] Add focused tests for edge cases | Effort: S | Source: PR#5 Review | Impact: Better test coverage
  * Add tests for bracket/parenthesis replacement in sanitization
  * Add boundary cases for retryAfter calculations in rate limiting
  * Files: lib/prompt-sanitization.test.ts, new rate limit tests
- [ ] [MEDIUM] [SIMPLIFY] Consolidate duplicate UI patterns in quiz-history-views | Effort: S | Metrics: 305→220 lines | Enforcement: Component linter
- [ ] [MEDIUM] [DX] Enhanced error messages with stack traces | Effort: M | Time saved: 3 hrs/week | Quality: Faster debugging
- [ ] [MEDIUM] [PERF] Improve pagination in getQuizHistory | Effort: M | Source: PR#5 Review | Impact: Better scalability
  * Collecting all documents to compute total is O(n)
  * Prefer cursor-based pagination by completedAt/_id
  * Compute hasMore via one extra take
  * Files: convex/quiz.ts
- [ ] [LOW] [DOCS] Align README claims with implementation or add minimal audit logging | Effort: S | Clarity: Avoid mismatched expectations
  * If we keep "Audit Trail" in README, add lightweight logging in mutations
  * Otherwise, update README to remove the claim
- [ ] [MEDIUM] [PERF] Implement lazy loading and bundle splitting | Effort: M | Target: 40% bundle reduction (<200KB) | Measurement: Lighthouse scores

## Low Priority (LOW) — Future Enhancements

### Nice to Have Features
- [ ] [LOW] [FEATURE] AI Study Buddy with voice conversations | Effort: XL | Value: Advanced learning experience
- [ ] [LOW] [FEATURE] Knowledge graph visualization (D3.js) | Effort: L | Value: Visual learning paths
- [ ] [LOW] [FEATURE] Multiplayer quiz battles | Effort: XL | Value: Social engagement
- [ ] [LOW] [FEATURE] Universal content import (PDFs, URLs) | Effort: L | Value: Content flexibility
- [ ] [LOW] [FEATURE] Mobile app with offline mode | Effort: XL | Value: Platform expansion

### Optimization & Polish
- [ ] [LOW] [PERF] Optimize FSRS with memoization | Effort: S | Target: 50% calculation speedup | Measurement: CPU profiling
- [ ] [LOW] [DX] Advanced code quality metrics dashboard | Effort: L | Time saved: 1 hr/week | Quality: Proactive debt management
- [ ] [LOW] [SIMPLIFY] Decompose large test files (fsrs.test.ts: 586 lines) | Effort: L | Metrics: <200 lines per file | Enforcement: Test file limits

## Quality Gates & Automation

**Immediate Implementation:**
- [ ] Pre-commit hooks: Prettier, ESLint, type checking, test coverage
- [ ] CI/CD gates: Block on security vulnerabilities, coverage <80%, complexity violations
- [ ] Automated dependency updates with security scanning
- [ ] Performance budget enforcement (<200KB main bundle)

**Monitoring & Metrics:**
- [ ] Code coverage tracking with trend analysis
- [ ] Bundle size monitoring with regression alerts
- [ ] Query performance dashboards (P50/P95/P99)
- [ ] Error rate tracking with categorization

## PR #23 Review Feedback - Not Applicable or Already Resolved

### ✅ Resolved in PR #23 Commits
- **Debug Panel & Memory Leaks**: Removed entirely in commit 29f86af (radical cleanup)
- **Console Logging**: All cleaned up in commit 29f86af
- **Polling Args Parameter**: Fixed in commit b5f9b2a
- **TypeScript Suppression (@ts-expect-error)**: Removed with debug code

### 🚫 Rejected Suggestions (Not Aligned with Project Philosophy)
- **Feature Flags for Debug Panel**: Overengineering - debug panel completely removed
- **Deprecation Redirect for API**: Overengineering - clean break is simpler
- **Complex Error Recovery Context**: Violates hypersimplicity principle
- **Crypto.randomUUID for Session IDs**: Not necessary - client-side only tracking

### 💡 Good Ideas for Future Consideration
- **React.memo for ReviewQuestionDisplay**: Worth testing if performance issues arise
- **Migration Guide Documentation**: Add if users report upgrade issues
- **Performance Budgets in CI**: Valuable once stable baseline established
- **Telemetry for Review Completion Rates**: Useful for validating FSRS effectiveness

## Moved from TODO.md (Low Priority/Overengineering)

### Review Flow Edge Cases (Manual Testing Only)
- [ ] Test when only one question exists in the system (continuous loop)
- [ ] Test when network is slow (loading state should remain visible)
- [ ] Test when Convex backend returns null (no more questions)
- [ ] Verify error boundary catches any state transition errors

### Performance Monitoring (Only if Issues Arise)
- [ ] Monitor render count in development console
- [ ] Verify no memory leaks from incomplete state cleanup
- [ ] Check that polling continues working after multiple transitions
- [ ] Confirm loading state duration is acceptable (<500ms typical)

### Same-Question Transition UX (Polish)
- [ ] Consider adding subtle animation for same-question reload
- [ ] Implement crossfade transition instead of loading state for same question
- [ ] Add audio/haptic feedback for incorrect answers that trigger immediate review

### Testing Infrastructure (Overengineering)
- [ ] Create performance benchmark for question transitions
- [ ] Add regression test to prevent future locking issues (E2E test already covers this)

