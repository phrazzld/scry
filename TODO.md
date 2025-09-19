# Quality Gates Cleanup TODOs

## [CRITICAL] Fix the 2,239 ESLint Suppressions
- [x] Run `grep -r "eslint-disable" --include="*.ts" --include="*.tsx" . | head -20` to see patterns
  ```
  Work Log:
  - FALSE ALARM: Only 16 suppressions in source code, not 2,239!
  - Original count included node_modules
  - 3 suppressions in generated files (justified)
  - 9 in test files (mostly justified for test utilities)
  - Only 4 questionable suppressions in components
  - Created ESLINT_AUDIT.md with full analysis
  - Verdict: ESLint setup is actually fine, no major issues
  ```
- [x] Either fix the issues or remove the rules causing them - NOT NEEDED
- [x] No point having a linter that's 90% disabled - Linter is working fine!

## [HIGH] Optimize CI Pipeline (save 45+ seconds per build)
- [x] Parallelize test and build steps in ci.yml
  ```
  Work Log:
  - Split single job into 3 parallel jobs: quality, test, build
  - Quality runs first as a gate (lint, typecheck, audit)
  - Test and build run in parallel after quality passes
  - Expected time savings: ~30 seconds per CI run
  - Build (40s) and test (30s) now run simultaneously
  ```
- [x] Add condition to Claude review: only for external contributors
  ```
  Work Log:
  - Added condition to check author_association
  - Skips review for MEMBER, OWNER, COLLABORATOR
  - Added workflow_dispatch for manual triggers
  - Team members can still request reviews manually
  - Renamed workflow to clarify it's for external contributors
  ```
- [ ] Reduce convex-schema-check.yml from 143 to ~20 lines

## [MEDIUM] Fix Test Infrastructure
- [ ] Remove coverage threshold or make it real (no fake metrics)
- [ ] Delete 40-line "improvement plan" comment in vitest.config.ts
- [ ] Fix flaky E2E tests instead of using retries

## [LOW] Clean Up False Positives
- [ ] Add pnpm audit ignores for the 4 dev-only vulnerabilities
- [ ] Remove or enforce console.log checking
- [ ] Consider removing convex schema check entirely (what has it caught?)

## [BONUS] Add Real Monitoring
- [ ] Track bundle size changes in CI
- [ ] Add performance budget checks
- [ ] Monitor actual user metrics, not vanity metrics

---

*Generated from quality infrastructure audit on 2025-01-19*

**Key Finding:** Quality gates are 70% theater, 30% value. Focus on what catches real bugs.