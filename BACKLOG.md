# BACKLOG

- [ ] create favicon
- [ ] make question generation more sophisticated
    * really grok user intent before determining what questions to generate
    * check existing questions of the user for context
    * check performance of the user for context
    * generate dynamic number of questions (eg "nato alphabet" should not gen 5 questions it should at least gen 26)
- [ ] subscription paywall
- [ ] support different question types
    * free response with rubric and llm grading
- [ ] email notifications when it's time to review

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
  * Implement keyboard navigation for all features
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

## Completed (Archive)

### Recently Completed
- ✅ [2025-09-27] Review Flow "Next" button fix with full state reset
- ✅ [2024-01-15] Basic spaced repetition implementation
- ✅ [2024-01-10] Magic link authentication setup
- ✅ [2024-01-05] Initial AI quiz generation with Google Gemini

