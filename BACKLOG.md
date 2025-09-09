# BACKLOG

## High Priority (HIGH) — Code Health & Developer Experience

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

- [ ] [MEDIUM] [UX] “Recently deleted” view with restore action on My Questions | Effort: M | Value: Completes soft delete UX
  * Add filter toggle to include deleted items and provide Restore button
  * Surface `questions.restoreQuestion` mutation in UI
- [ ] [MEDIUM] [VALIDATION] Mirror client-side validation on server for questions | Effort: S | Quality: Data integrity
  * Enforce min/max lengths for question/topic/explanation in Convex mutations
## Medium Priority (MEDIUM) — Features & Optimization

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
- [ ] [MEDIUM] [PERF] Replace polling with WebSocket real-time updates | Effort: L | Target: 90% query reduction | Measurement: Database metrics
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

## Completed (Archive)

### Recently Completed
- ✅ [2024-01-15] Basic spaced repetition implementation
- ✅ [2024-01-10] Magic link authentication setup
- ✅ [2024-01-05] Initial AI quiz generation with Google Gemini

