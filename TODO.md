# 🚨 CRITICAL SECURITY INCIDENT - API Keys Exposed in Git History

**Incident Date**: 2025-09-11
**Severity**: CRITICAL
**Status**: ACTIVE BREACH

## IMMEDIATE REMEDIATION (Do within 30 minutes)

### Rotate Compromised API Keys
- [x] Open https://makersuite.google.com/app/apikey and revoke compromised Google AI key
- [x] Generate new Google AI API key and save temporarily in password manager
- [x] Open https://resend.com/api-keys and revoke compromised Resend API key
- [x] Generate new Resend API key with same permissions and save temporarily in password manager
- [x] Run `npx convex env set RESEND_API_KEY "new-resend-key-here" --prod` to update Convex production
- [x] Open Vercel dashboard → Settings → Environment Variables and update `GOOGLE_AI_API_KEY` for all environments
- [x] Open Vercel dashboard → Settings → Environment Variables and update `RESEND_API_KEY` for all environments  
- [x] Update `.env.local` with new keys: `GOOGLE_AI_API_KEY` and `RESEND_API_KEY`
- [x] Test magic link flow locally with `pnpm dev` to verify new Resend key works
- [x] Test quiz generation locally to verify new Google AI key works

### Remove Secrets from Git History
- [x] Run `git rm --cached .env.production` to unstage the file
- [x] Run `git commit -m "security: remove exposed .env.production from tracking"`
- [x] Install BFG Repo-Cleaner: `brew install bfg`
- [x] Run `bfg --delete-files .env.production` to purge from all history
- [x] Run `git reflog expire --expire=now --all && git gc --prune=now --aggressive`
- [x] Run `git push --force-with-lease --all` to update remote
- [x] Run `git push --force-with-lease --tags` to update tags

## PREVENTION INFRASTRUCTURE (Complete within 24 hours)

### Fix .gitignore Coverage
- [x] Add `.env*` to .gitignore to catch all env files
- [x] Add `!.env.example` to .gitignore to allow example files
- [x] Add `!.env.*.example` to .gitignore to allow environment-specific examples
- [x] Run `git add .gitignore && git commit -m "security: comprehensive env file exclusion"`
- [x] Verify with `git check-ignore .env.production` - should return the filename

### Install Pre-Commit Hook for Secret Detection
- [x] Create file `.git/hooks/pre-commit` with executable permissions: `touch .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
- [x] Add shebang line: `#!/bin/bash`
- [x] Add check for .env files: `if git diff --cached --name-only | grep -E "^\.env"; then echo "ERROR: Attempting to commit .env file!" && exit 1; fi`
- [x] Add check for inline secrets: `if git diff --cached | grep -iE "(api_key|apikey|api-key|secret|token|password)[\"\'\s]*[:=][\"\'\s]*[A-Za-z0-9]"; then echo "WARNING: Possible secret detected!" && exit 1; fi`
- [x] Test hook by attempting to stage .env.local: `git add .env.local` - should fail with error
  ```
  Work Log:
  - Discovered husky is managing git hooks via .husky/ directory
  - Added secret detection to .husky/pre-commit instead of .git/hooks/pre-commit
  - Successfully tested hook - it blocks commits with api_key patterns
  - Hook also checks for Google API keys (AIzaSy...), Stripe keys (sk_live_...), and Resend keys (re_...)
  ```

### Install Secret Scanning Tools
- [x] Install gitleaks: `brew install gitleaks`
- [x] Run initial scan: `gitleaks detect --source . --verbose` and address any findings
  ```
  Work Log:
  - Found 1 false positive: revoked Google API key documented in TODO.md 
  - Created .gitleaksignore to exclude this documented incident
  - Scan now reports: "no leaks found"
  ```
- [x] Add gitleaks to pre-push: `echo 'gitleaks protect --verbose --staged' >> .git/hooks/pre-push`
  ```
  Work Log:
  - Added to husky pre-push hook instead of .git/hooks/pre-push
  - Runs before build check to fail fast on secret detection
  - Provides clear error messages and bypass instructions
  ```
- [x] Install git-secrets: `brew install git-secrets`
- [x] Initialize git-secrets: `git secrets --install -f`
  ```
  Work Log:
  - git-secrets installed its hooks in .git/hooks/
  - Integrated git-secrets into husky pre-commit hook instead
  - Now runs before our custom secret checks for layered protection
  ```
- [x] Register AWS patterns: `git secrets --register-aws`
- [x] Register custom patterns: `git secrets --add 'sk_live_[0-9a-zA-Z]{24}'` for Stripe keys
- [x] Register custom patterns: `git secrets --add 're_[0-9a-zA-Z_]{20,}'` for Resend keys

## WORKFLOW PROCESS CHANGES (Implement immediately)

### Safe Git Add Practices
- [ ] Create shell alias: `alias ga='git add'` (never use with -A flag)
- [ ] Create shell function `safe-commit() { git status && read -p "Continue? (y/n): " && [[ $REPLY =~ ^[Yy]$ ]] && git commit "$@"; }`
- [ ] Document in team README: "NEVER use `git add -A` or `git add .`"
- [ ] Document required workflow: `git status` → `git diff` → `git add <specific-file>` → `git diff --staged` → `git commit`

### Verification Commands to Run Before Every Commit
- [ ] Add to muscle memory: `git status` - check what files are staged
- [ ] Add to muscle memory: `git diff --staged` - review actual changes
- [ ] Add to muscle memory: `git diff --staged | grep -iE "api|key|secret|token|password"` - scan for secrets
- [ ] Add to muscle memory: `gitleaks protect --staged` - automated secret scan

## VERIFICATION & AUDIT (Complete within 48 hours)

### Verify Remediation Success
- [ ] Confirm old Google AI key returns 403 when tested
- [ ] Confirm old Resend key returns unauthorized when tested  
- [ ] Run `git log --all --grep="\.env"` and verify .env.production doesn't appear after cleanup
- [ ] Clone repo to new directory and run `git log --all -- .env.production` - should return nothing
- [ ] Search GitHub web UI for exposed keys - should show "This commit does not belong to any branch"

### Security Audit
- [ ] Review all environment variables in Vercel dashboard for other potential exposures
- [ ] Review all environment variables in Convex dashboard for other potential exposures
- [ ] Check if any other sensitive files are tracked: `git ls-files | grep -E "\.(env|key|pem|p12|pfx)"`
- [ ] Review recent commits for other accidents: `git log --oneline -20 | xargs -I {} git show --name-only {}`
- [ ] Enable GitHub secret scanning: Settings → Security → Code security → Enable secret scanning

## LESSONS LEARNED DOCUMENTATION

### Create Incident Report
- [ ] Document what happened: ".env.production with API keys was committed to git"
- [ ] Document root cause: "Used `git add -A` without reviewing staged files"
- [ ] Document impact: "API keys exposed in public GitHub repository"
- [ ] Document remediation: "Keys rotated, history cleaned, prevention measures added"
- [ ] Document prevention: "Pre-commit hooks, secret scanning, workflow changes"
- [ ] Save report to `docs/incidents/2025-09-11-api-key-exposure.md`

---

# Pure FSRS with Fresh Question Priority - Implementation TODO

Generated from TASK.md on 2025-01-09
Updated with Code Review Feedback on 2025-01-10
SECURITY INCIDENT TASKS ADDED: 2025-09-11

## Critical Path Items (Must complete in order)

### Core Queue Priority System
- [x] Implement FSRS-based retrievability scoring in spacedRepetition.ts
  - Success criteria: New questions return -2 (ultra-fresh) or -1 (new), reviewed questions return 0-1
  - Dependencies: None
  - Estimated complexity: MEDIUM
  - Files: convex/spacedRepetition.ts

- [x] Update getNextReview to prioritize by retrievability score
  - Success criteria: Fresh questions appear before reviews, no daily limits enforced
  - Dependencies: Retrievability scoring
  - Estimated complexity: MEDIUM
  - Files: convex/spacedRepetition.ts

- [x] Remove any daily limit logic from getDueCount
  - Success criteria: Returns actual count without limits, shows real learning debt
  - Dependencies: None
  - Estimated complexity: SIMPLE
  - Files: convex/spacedRepetition.ts

## Parallel Work Streams

### Stream A: Toast & Feedback Enhancements
- [x] Enhance success toast to show count and topic
  - Success criteria: Toast displays "✓ X questions generated" with topic description
  - Can start: Immediately
  - Estimated complexity: SIMPLE
  - Files: components/generation-modal.tsx:112

- [x] Add event dispatch on successful generation
  - Success criteria: 'questions-generated' event fired with count and topic
  - Can start: Immediately
  - Estimated complexity: SIMPLE
  - Files: components/generation-modal.tsx

### Stream B: Real-Time Updates
- [x] Implement dynamic polling intervals in review-flow.tsx
  - Success criteria: 1-second polling for 5 seconds after generation, then back to 30 seconds
  - Can start: Immediately
  - Estimated complexity: MEDIUM
  - Files: components/review-flow.tsx

- [x] Add event listener for generation events in review flow
  - Success criteria: Review flow responds to 'questions-generated' events
  - Dependencies: Event dispatch implementation
  - Estimated complexity: SIMPLE
  - Files: components/review-flow.tsx

- [x] Update usePollingQuery hook to support dynamic intervals
  - Success criteria: Polling interval can be changed dynamically
  - Can start: Immediately
  - Estimated complexity: MEDIUM
  - Files: hooks/use-polling-query.ts

### Stream C: Visual Indicators
- [x] Add "New" badge component for fresh questions
  - Success criteria: Badge shows for questions < 1 hour old
  - Can start: Immediately
  - Estimated complexity: SIMPLE
  - Files: components/review-flow.tsx, components/ui/badge.tsx

- [x] Update progress display to show honest totals
  - Success criteria: Shows real total due without limits, warning message for 100+ items
  - Can start: Immediately
  - Estimated complexity: SIMPLE
  - Files: components/review-flow.tsx:342-347

- [x] Add review button pulse animation after generation
  - Success criteria: Review button briefly pulses when new questions added
  - Dependencies: Event dispatch implementation
  - Estimated complexity: SIMPLE
  - Files: components/minimal-header.tsx

## Phase 2: Smart Scheduling (COMPLETE)

### Advanced Queue Management
- [x] Implement freshness decay algorithm
  - Success criteria: Exponential decay over 24 hours affects priority
  - Dependencies: Core queue priority system
  - Estimated complexity: MEDIUM
  - Files: convex/spacedRepetition.ts

- [x] ~~Add intelligent interleaving~~ REMOVED - Violates Pure FSRS
  - **Removed**: This was a comfort feature that corrupts the algorithm
  - FSRS already determines optimal order; artificial interleaving breaks memory science

- [x] Create progress bar segments for new vs due
  - Success criteria: Visual distinction between new and review items
  - Dependencies: Visual indicators
  - Estimated complexity: MEDIUM
  - Files: components/review-flow.tsx

## Testing & Validation

### Unit Tests
- [x] Test retrievability scoring function
  - Success criteria: Correct scores for new/fresh/reviewed questions
  - Dependencies: Core queue priority system
  - Estimated complexity: SIMPLE

- [x] Test freshness decay calculation
  - Success criteria: Exponential decay verified over 24-hour window
  - Dependencies: Freshness decay implementation
  - Estimated complexity: SIMPLE

- [x] ~~Test interleaving algorithm~~ REMOVED
  - **Removed**: No interleaving to test since we removed the feature

### Integration Tests
- [x] Test generation → queue update → UI flow
  - Success criteria: Generated questions appear in review within 2 seconds
  - Dependencies: All Stream A, B, C items
  - Estimated complexity: MEDIUM

- [x] Test polling interval changes
  - Success criteria: Aggressive polling activates and deactivates correctly
  - Dependencies: Dynamic polling implementation
  - Estimated complexity: SIMPLE

### End-to-End Tests
- [x] Complete generation and immediate review flow
  - Success criteria: User can generate and immediately review new questions
  - Dependencies: All Phase 1 items
  - Estimated complexity: MEDIUM

- [x] Verify no daily limits enforcement
  - Success criteria: 100+ due items all appear in queue
  - Dependencies: Core queue priority system
  - Estimated complexity: SIMPLE

## Documentation & Cleanup

- [x] Document FSRS priority algorithm in code comments
  - Success criteria: Clear explanation of retrievability scoring
  - Dependencies: Core implementation complete
  - Estimated complexity: SIMPLE

- [x] Update CLAUDE.md with new queue behavior
  - Success criteria: Spaced repetition section reflects pure FSRS approach
  - Dependencies: Implementation complete
  - Estimated complexity: SIMPLE

- [x] Add JSDoc comments to new/modified functions
  - Success criteria: All public functions documented
  - Dependencies: Implementation complete
  - Estimated complexity: SIMPLE

## Performance Optimization

- [ ] Profile polling overhead
  - Success criteria: < 1% CPU usage confirmed
  - Dependencies: Dynamic polling implementation
  - Estimated complexity: SIMPLE

- [ ] Optimize queue generation for 1000+ questions
  - Success criteria: Queue generates in < 100ms for 1000 questions
  - Dependencies: Core queue priority system
  - Estimated complexity: MEDIUM

## Future Enhancements (BACKLOG.md candidates)

- [ ] Machine learning for optimal new/review ratios
- [ ] Topic fatigue detection algorithm
- [ ] Predictive queue generation based on user patterns
- [ ] Performance-based interleaving adjustments
- [ ] WebSocket implementation for real-time updates
- [ ] Redis queue for 10k+ question scaling
- [ ] User-specific learning velocity tracking
- [ ] Adaptive freshness windows per user

## PR #16 Review Feedback Actions (UPDATED)

### Convex Real-Time Discovery
After investigation, we discovered that Convex ALREADY provides WebSocket-based real-time updates automatically!
- Removed unnecessary custom event system and aggressive polling
- Kept minimal polling (60s) only for time-based conditions (questions becoming due)
- New questions now appear instantly via Convex reactivity (truly < 1 second)

### Test Coverage Gaps (COMPLETED)
- [x] ~~Add comprehensive tests for calculateFreshnessDecay() function~~ DONE
  - Completed in convex/spacedRepetition.test.ts lines 583-650
  - Tests cover: 0 hours → 1.0, 24 hours → ~0.37, 48 hours → ~0.14, edge cases

- [x] ~~Add tests for fresh question priority range validation~~ DONE
  - Completed in convex/spacedRepetition.test.ts lines 742-797
  - Tests verify -2 to -1 priority range based on freshness

### Code Hardening (COMPLETED)
- [x] ~~Add input validation to calculateFreshnessDecay()~~ DONE
  - Now returns 1.0 for negative hours (graceful clock skew handling)
  - Implemented in convex/spacedRepetition.ts:53-56

- [x] ~~Namespace custom events for better isolation~~ N/A
  - Custom events were completely removed in favor of Convex's built-in reactivity
  - No events to namespace anymore

## Risk Mitigation

- [x] ~~Add fallback for event system failures~~ N/A
  - Event system removed; Convex handles real-time updates automatically

- [x] ~~Handle edge case of 0 questions in queue~~ DONE
  - Division by zero fixed in progress bar (components/review-flow.tsx:377-378)
  - Empty state handling implemented

- [x] ~~Prevent infinite polling loops~~ DONE
  - Removed aggressive polling; only minimal 60s polling for time-based updates

## Success Verification Checklist

- [ ] Generated questions appear within 2 seconds
- [ ] Toast shows count and topic
- [ ] "New" badges display correctly
- [ ] No artificial limits on review count
- [ ] Progress bar shows real totals
- [ ] Fresh questions prioritize correctly
- [ ] No mid-question interruptions
- [ ] Polling overhead < 1% CPU
- [ ] All tests passing
- [ ] Documentation updated

## Notes

- Prioritize Phase 1 items for immediate user value
- Stream A, B, C can be developed in parallel by different developers
- Phase 2 builds on Phase 1 but isn't blocking initial release
- Performance optimization can happen after functional implementation
- Risk mitigation should be addressed during implementation, not after

## Code Review Feedback - Remaining Items

### HIGH PRIORITY (COMPLETED)

- [x] **Optimize getDueCount query for scalability** DONE
  - Changed from `.collect()` to `.take(1000)` to prevent memory issues
  - Now caps at counting 1000 items (reasonable limit for UI display)
  - Prevents O(N) memory usage for users with massive collections

### MEDIUM PRIORITY (Can be follow-up PRs)

- [ ] **Fix "New" badge to use server time**
  - Location: `components/review-flow.tsx:455`
  - Issue: Badge logic compares server timestamp to client's `Date.now()`
  - Impact: Users with incorrect system clocks see wrong behavior
  - Fix: Have `getNextReview` return server's current time, use that for comparison
  - Estimated complexity: SIMPLE

- [ ] **Update E2E test for real-time validation**
  - Location: `tests/e2e/spaced-repetition.local.test.ts:204-260`
  - Issue: Test uses `await reviewPage.reload()` which bypasses WebSocket validation
  - Impact: Critical failures in Convex reactivity layer would go undetected
  - Fix: Remove `reload()`, use Playwright's auto-waiting assertions
  - Estimated complexity: SIMPLE

### COMPLETED (Fixed in recent commits)

- [x] ~~Handle clock skew gracefully~~ - Fixed: Returns 1.0 for negative hours
- [x] ~~Remove broken E2E test~~ - Fixed: Deleted obsolete dynamic polling test
- [x] ~~Fix division by zero in progress bar~~ - Fixed: Added guard clause for total === 0
- [x] ~~Update tests for graceful error handling~~ - Fixed: Tests now expect 1.0 for negative input