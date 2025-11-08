# TODO

## Bandwidth Hardening

- [x] Seed users.by_creation_time sampling index
  ```
  Files: convex/schema.ts, convex/clerk.ts, convex/migrations.ts, convex/migrations.test.ts
  Goal: add a persisted `createdAt` field plus `by_creation_time` index so user sampling can page deterministically without `.collect()`.
  Success: every user document (new + legacy) carries `createdAt`, Convex schema/typegen compile clean, new index visible via `npx convex dev`.
  Tests: convex/migrations.test.ts covers dry-run/apply for the backfill; new convex/clerk.test.ts case ensures `ensureUser` writes `createdAt`.
  Dependencies: —
  Estimate: 1.25h
  ```

- [x] Refactor reconcileUserStats sampling/pagination
  depends: Seed users.by_creation_time sampling index
  ```
  Files: convex/userStats.ts, convex/lib/logger.ts (metrics hook), convex/userStats.reconcile.test.ts
  Goal: replace `.collect()` usage with random cursor sampling via `by_creation_time` and stream question scans in fixed batches when recalculating stats.
  Success: cron reads ≤ sampleSize users (default 100), per-user question pass processes at most `ceil(total/batchSize)` iterations, run finishes <5s against 10k synthetic users.
  Tests: new convex/userStats.reconcile.test.ts builds 10k-user fixtures + 1,200-question accounts to assert only `sampleSize` docs are fetched and stats still correct.
  Dependencies: Seed users.by_creation_time sampling index
  Estimate: 1.5h
  ```

- [x] Bound rateLimit queries to maxAttempts window
  ```
  Files: convex/rateLimit.ts, convex/rateLimit.test.ts
  Goal: funnel every rate-limit query/cleanup through `.take()`/`.paginate()` helpers capped at `maxAttempts + buffer`, eliminating table-wide `.collect()` calls.
  Success: checkEmailRateLimit, checkIpRateLimit, recordRateLimitAttempt, getRateLimitStatus, checkApiRateLimit, and cleanupExpiredRateLimits each touch ≤100 docs per call and keep retryAfter math identical.
  Tests: extend convex/rateLimit.test.ts with >1,100-entry fixtures to prove helpers cap fetch counts and cleanup deletes in batches.
  Dependencies: —
  Estimate: 1h
  ```

- [x] Denormalize sessionId for interactions + index
  ```
  Files: convex/schema.ts, convex/questionsInteractions.ts, convex/migrations.ts, convex/migrations.test.ts, convex/questionsInteractions.test.ts
  Goal: promote `context.sessionId` to a top-level optional `sessionId` plus `interactions.by_user_session` index so quiz analytics can query a session without scanning an entire history.
  Success: new field written on every interaction, migration copies legacy session IDs, index deploy passes Convex validation with no runtime callers broken.
  Tests: add migration coverage (dry-run + apply) in convex/migrations.test.ts and a unit in convex/questionsInteractions.test.ts ensuring inserts set `sessionId`.
  Dependencies: —
  Estimate: 1.25h
  ```

- [x] Stream getQuizInteractionStats via session index
  depends: Denormalize sessionId for interactions + index
  ```
  Files: convex/questionsLibrary.ts, convex/questionsLibrary.test.ts
  Goal: reimplement `getQuizInteractionStats` using the new `by_user_session` pagination loop with a documented `MAX_SESSION_INTERACTIONS` cap and early exit.
  Success: query no longer calls `.collect()`, pages through session interactions in fixed-size chunks, returns correct accuracy/unique-question stats for 1,500-interaction sessions, and surfaces truncation warnings when hitting the cap.
  Tests: new convex/questionsLibrary.test.ts seeds 1,200 interactions for a session and asserts stats accuracy plus chunk limit enforcement.
  Dependencies: Denormalize sessionId for interactions + index
  Estimate: 1h
  ```

- [x] Batch clerk.deleteUser question cleanup
  ```
  Files: convex/clerk.ts, convex/clerk.test.ts
  Goal: replace `.collect()` with paginated batches (100–200 docs) when soft-deleting a user’s questions so cleanup cost stays O(limit) even for 10k-card accounts.
  Success: mutation loops over paginator cursors until exhaustion, sets `deletedAt` for every question, logs processed count, and never loads more than one batch at a time.
  Tests: new convex/clerk.test.ts uses a mocked paginator with 1,200 questions to assert sequential batches and total patch count.
  Dependencies: —
  Estimate: 0.75h
  ```

- [x] Add >1,100-doc regression suite for bandwidth-sensitive paths
  depends: Refactor reconcileUserStats sampling/pagination; Bound rateLimit queries to maxAttempts window; Stream getQuizInteractionStats via session index; Batch clerk.deleteUser question cleanup
  ```
  Files: convex/bandwidth-regressions.test.ts, lib/test-utils/largeFixtures.ts
  Goal: codify Vitest regressions that spin up 1,100–10,000 document fixtures and exercise the refactored cron, rate limits, quiz stats, and deleteUser paths to guard against future `.collect()` regressions.
  Success: suite fails if any function exceeds its batch cap or reintroduces `.collect()`, and documents runtime thresholds (<5s runtime, ≤100 docs per rate-limit call, etc.).
  Tests: convex/bandwidth-regressions.test.ts covering the four scenarios with shared large-fixture helpers.
  Dependencies: Refactor reconcileUserStats sampling/pagination; Bound rateLimit queries to maxAttempts window; Stream getQuizInteractionStats via session index; Batch clerk.deleteUser question cleanup
  Estimate: 1.5h
  ```

- [~] Document Convex bandwidth guardrails
  depends: Refactor reconcileUserStats sampling/pagination; Bound rateLimit queries to maxAttempts window; Stream getQuizInteractionStats via session index; Batch clerk.deleteUser question cleanup
  ```
  Files: docs/guides/convex-bandwidth.md, README.md (link), BACKLOG.md (cross-link)
  Goal: capture the `.collect()` anti-pattern, sampling recipes, and testing checklist so future backend work defaults to bounded queries.
  Success: guide explains why `.collect()` is banned, shows code snippets for pagination/sampling, references TASK.md acceptance criteria, and is linked from README/Backlog.
  Tests: n/a (documentation)
  Dependencies: Refactor reconcileUserStats sampling/pagination; Bound rateLimit queries to maxAttempts window; Stream getQuizInteractionStats via session index; Batch clerk.deleteUser question cleanup
  Estimate: 0.5h
  ```
