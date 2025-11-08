# TODO: Extract AI Provider Initialization

## Context

**Current State**: 203 lines of duplicated provider initialization code across two files:
- `convex/aiGeneration.ts:87-191` (105 lines)
- `convex/lab.ts:79-177` (98 lines)

**Problem**: Identical logic for environment variable reading, secret diagnostics, OpenAI vs Google conditional branching, and error handling. Bug fixes require 2+ updates (already happened per git history).

**Architecture Decision**: Extract to `convex/lib/aiProviders.ts` following established patterns from existing lib modules (validation.ts, userStatsHelpers.ts, responsesApi.ts).

**Key Files**:
- NEW: `convex/lib/aiProviders.ts` - Centralized initialization
- MODIFY: `convex/aiGeneration.ts` - Replace lines 96-191 with function call
- MODIFY: `convex/lab.ts` - Replace lines 128-177 with function call
- NEW: `convex/lib/aiProviders.test.ts` - Contract validation tests

**Patterns to Follow**:
- Pure async helper pattern (like `validation.ts`)
- Environment diagnostics integration (like `envDiagnostics.ts`)
- Provider abstraction pattern (like `responsesApi.ts`)

## Implementation Tasks

- [x] Create `convex/lib/aiProviders.ts` with centralized initialization logic
  ```
  Files: NEW convex/lib/aiProviders.ts
  Architecture: Exports ProviderClient interface and initializeProvider() function
  Pseudocode:
    1. Read environment variables (AI_PROVIDER, AI_MODEL, AI_REASONING_EFFORT, AI_VERBOSITY)
    2. Call getSecretDiagnostics() for respective API key
    3. Log provider selection with diagnostics
    4. Validate API key presence
    5. Initialize provider client (Google or OpenAI)
    6. Return { model?, openaiClient?, provider, diagnostics }
  Success Criteria:
    - Function signature matches interface from TASK.md
    - Supports both 'google' and 'openai' providers
    - Throws on invalid provider or missing API key
    - Returns structured ProviderClient object
    - Uses existing envDiagnostics module
    - Logs provider selection with context
  Test Strategy:
    - Unit tests mock process.env values
    - Test both provider paths (google, openai)
    - Test error conditions (missing key, invalid provider)
    - Test diagnostics integration
  Dependencies:
    - convex/lib/envDiagnostics.ts (getSecretDiagnostics)
    - @ai-sdk/google-generative-ai
    - openai SDK
  Estimated Time: 45 minutes
  ```

- [x] Refactor `convex/aiGeneration.ts` to use centralized provider initialization
  ```
  Files: MODIFY convex/aiGeneration.ts lines 96-191
  Approach: Replace initialization block with call to initializeProvider()
  Before (105 lines):
    - Lines 96-191: Provider selection, env reading, diagnostics, client creation
  After (3-5 lines):
    const { model, openaiClient, provider, diagnostics } = await initializeProvider(
      process.env.AI_PROVIDER || 'openai',
      process.env.AI_MODEL || 'gpt-5-mini'
    );
    const reasoningEffort = process.env.AI_REASONING_EFFORT || 'high';
    const verbosity = process.env.AI_VERBOSITY || 'medium';
  Success Criteria:
    - Reduces aiGeneration.ts by ~100 lines
    - Existing tests still pass (convex/aiGeneration.test.ts)
    - No change in runtime behavior
    - Logger calls remain with same context
    - Error handling flows to generationJobs.failJob as before
  Test Strategy:
    - Run existing aiGeneration.test.ts (error classification)
    - Manual test: pnpm dev, trigger generation job
    - Verify logs show same provider selection messages
  Dependencies: NEW convex/lib/aiProviders.ts
  Estimated Time: 30 minutes
  ```

- [x] Refactor `convex/lab.ts` to use centralized provider initialization
  ```
  Files: MODIFY convex/lab.ts lines 128-177
  Approach: Replace initialization block with call to initializeProvider()
  Before (50 lines):
    - Lines 128-177: Provider selection, env reading, diagnostics, client creation
  After (3 lines):
    const { model, openaiClient, provider } = await initializeProvider(
      args.provider,
      args.model
    );
  Success Criteria:
    - Reduces lab.ts by ~47 lines
    - Lab UI still executes configs correctly
    - No change in runtime behavior
    - Logger calls remain with same context
  Test Strategy:
    - Manual test: Navigate to /lab in dev, execute PRODUCTION config
    - Verify execution completes without errors
    - Compare output with pre-refactor baseline
    - Verify logs show same provider selection messages
  Dependencies: NEW convex/lib/aiProviders.ts
  Estimated Time: 30 minutes
  ```

- [x] Create contract validation tests for behavior equivalence
  ```
  Files: NEW convex/lib/aiProviders.test.ts
  Architecture: Vitest unit tests validating all code paths
  Test Cases:
    1. Initializes Google provider with valid API key
    2. Initializes OpenAI provider with valid API key
    3. Throws on missing GOOGLE_AI_API_KEY
    4. Throws on missing OPENAI_API_KEY
    5. Throws on unsupported provider name
    6. Returns diagnostics from getSecretDiagnostics
    7. Logs provider selection with correct context
  Approach:
    - Mock process.env for each test
    - Mock @ai-sdk/google-generative-ai and openai
    - Spy on logger.info and logger.error calls
    - Verify returned ProviderClient structure
  Success Criteria:
    - All test cases pass
    - 100% branch coverage of initializeProvider()
    - Tests run in <1 second
  Dependencies: vitest, existing test patterns from aiGeneration.test.ts
  Estimated Time: 45 minutes
  ```

- [ ] Update documentation and references
  ```
  Files:
    - MODIFY CLAUDE.md (update AI Provider Configuration section)
    - MODIFY docs/operations/*.md (if provider setup mentioned)
  Approach:
    - Update CLAUDE.md section "AI Provider Configuration" to reference new module
    - Add note: "Provider initialization centralized in convex/lib/aiProviders.ts"
    - Document ProviderClient interface
  Success Criteria:
    - CLAUDE.md accurately describes new architecture
    - No stale references to inline initialization
    - Future developers find centralized module via docs
  Test Strategy: Manual review, grep for "provider initialization" in docs
  Dependencies: None
  Estimated Time: 15 minutes
  ```

## Design Iteration

**After Implementation**:
- Review module boundary: Does `initializeProvider()` hide the right complexity?
- Check interface simplicity: Is ProviderClient easy to use?
- Measure coupling: Can we add Anthropic provider by only modifying aiProviders.ts?

**Refactoring Checkpoint**:
- If adding a third provider (Anthropic) requires changes to consumers, interface needs refinement
- If ProviderClient interface grows beyond 4-5 fields, consider splitting Google/OpenAI types
- Monitor for emerging pattern: Should reasoning parameters also be centralized?

## Acceptance Criteria

- [ ] `convex/lib/aiProviders.ts` exists and exports `initializeProvider()` function
- [ ] Both `aiGeneration.ts` and `lab.ts` use shared module (no inline provider logic)
- [ ] Net reduction: ~200 lines of duplicated code eliminated
- [ ] All existing tests pass (aiGeneration.test.ts)
- [ ] New contract tests prove identical behavior
- [ ] Adding Anthropic provider requires changes in 1 location only (aiProviders.ts)
- [ ] pnpm dev works, generation jobs complete successfully
- [ ] Genesis Lab executes configs without errors

## Notes

**Why Not Use a Factory Class?**
Following established pattern from this codebase: "Minimal abstraction—only abstract when 3+ concrete examples exist (Carmack's rule)". We have 2 providers (Google, OpenAI), so a simple async function is sufficient. If Anthropic is added, revisit this decision.

**Error Handling Strategy**:
Preserve existing behavior where initialization errors call `generationJobs.failJob()` in aiGeneration.ts. The lib function throws; callers handle context-specific error recording.

**Parallel Work Opportunities**:
- Task 1 (create module) is independent
- Tasks 2-3 (refactor consumers) can be done in parallel after Task 1
- Task 4 (tests) can start before Task 2-3 (TDD approach)

**Time Estimate**: 2.5 hours total (below 3-hour target from TASK.md)
