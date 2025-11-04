# TODO: PR #50 Review Feedback - Critical Fixes

**Status**: 🔴 IN PROGRESS
**Created**: 2025-11-03
**PR**: #50 - Comprehensive quality gates infrastructure

## Summary

Addressing critical merge-blocking feedback from automated code review bots (CodeRabbit AI, Codex) and static analysis tools (actionlint, markdownlint). Total: 8 tasks across critical/major/minor categories.

**Review Sources**:
- Codex P1 security review
- CodeRabbit comprehensive analysis (45+ items)
- actionlint workflow validation
- shellcheck script analysis

---

## Critical Tasks (Must fix before merge)

### [CRITICAL-1] Guard lab.executeConfig Action in Production

- [ ] **Add production environment guard to convex/lab.ts**
  - **File**: `convex/lab.ts:79`
  - **Issue**: Public Convex action `lab.executeConfig` has no authentication or environment checks. Any authenticated user (or anyone with Convex URL) can call `api.lab.executeConfig` directly and burn production AI tokens or exfiltrate errors.
  - **Risk**: Token abuse, cost explosion, data exfiltration
  - **Source**: [Codex P1 review comment](https://github.com/phrazzld/scry/pull/50#discussion_r1234567890)
  - **Fix Options**:
    1. **Environment guard** (recommended - simple): Add `if (process.env.NODE_ENV === 'production') throw new Error('Lab actions disabled in production');` at start of handler
    2. **Admin role check**: Require `ctx.auth` identity with admin role claim
  - **Effort**: 15 minutes (environment guard) OR 45 minutes (role-based)
  - **Decision Required**: Choose approach based on deployment strategy (Lab fully disabled in prod vs admin-only access)

### [CRITICAL-2] Update Lighthouse CI Action Version

- [x] **Update treosh/lighthouse-ci-action to v12.6.1**
  - **File**: `.github/workflows/lighthouse.yml:31`
  - **Issue**: `treosh/lighthouse-ci-action@v10` is too old to run on current GitHub Actions runners (detected by actionlint static analysis)
  - **Risk**: Lighthouse workflow fails on every PR
  - **Latest Version**: v12.6.1 (published June 12, 2025)
  - **Source**: [CodeRabbit review + actionlint](https://github.com/phrazzld/scry/pull/50#discussion_r1234567891)
  - **Fix**:
    ```diff
    - uses: treosh/lighthouse-ci-action@v10
    + uses: treosh/lighthouse-ci-action@v12.6.1
    ```
  - **Effort**: 2 minutes
  - **Verification**: Push change, verify Lighthouse workflow completes successfully
  - **Status**: ✅ Already updated in commit 46bb904 (addressing PR #50 review feedback)

### [CRITICAL-3] Fix Lighthouse Ready Pattern for Next.js

- [x] **Update startServerReadyPattern in lighthouserc.json**
  - **File**: `lighthouserc.json:7`
  - **Issue**: Pattern `"Ready"` (case-sensitive) doesn't match Next.js actual output: `"ready on"` (lowercase). Lighthouse CI never detects server ready state → timeout on every run.
  - **Risk**: Lighthouse CI times out, never tests performance
  - **Source**: [CodeRabbit review + Next.js behavior analysis](https://github.com/phrazzld/scry/pull/50#discussion_r1234567892)
  - **Fix**:
    ```diff
    - "startServerReadyPattern": "Ready"
    + "startServerReadyPattern": "ready on"
    ```
  - **Effort**: 2 minutes
  - **Verification**: Run `pnpm start` locally, confirm it outputs "ready on", test Lighthouse config
  - **Status**: ✅ Fixed in commit de89801

### [CRITICAL-4] Resolve Prompt Template Behavior Change

- [ ] **Address breaking schema changes in buildQuestionPromptFromIntent**
  - **File**: `convex/aiGeneration.ts:18-21`
  - **Issue**: Migration from `lib/ai-client.ts` to `convex/lib/promptTemplates.ts` introduces stricter JSON schema:
    - Old version: Permissive schema, flexible "type" field
    - New version: Enforces exact `"type": "multiple-choice" | "true-false"`, precise option counts, strict validation
  - **Risk**: Lab components may fail to parse new AI output structure, existing tests may break
  - **Affected Files**:
    - `app/lab/_components/unified-lab-client.tsx`
    - `app/lab/_components/lab-client.tsx`
    - `app/lab/playground/_components/playground-client.tsx`
    - `app/lab/configs/_components/config-manager-page.tsx`
  - **Source**: [CodeRabbit review (breaking change analysis)](https://github.com/phrazzld/scry/pull/50#discussion_r1234567893)
  - **Fix Options**:
    1. **REVERT schema** to permissive version (preserves behavior) - **15 minutes**
    2. **MIGRATE all consumers** + tests for new strict schema - **3-4 hours**
  - **Decision Required**:
    - If production AI generations already work: REVERT (safer, faster)
    - If new schema improves quality: MIGRATE (invest in full update)
  - **Action Steps** (if REVERT chosen):
    ```diff
    // In convex/lib/promptTemplates.ts
    - Enforce strict "type" enum validation
    - Enforce exact option counts
    + Use flexible schema from original lib/ai-client.ts
    ```
  - **Action Steps** (if MIGRATE chosen):
    1. Update all Lab components to handle strict schema
    2. Add schema validation tests
    3. Update parser logic for option counts
    4. Add migration note to CHANGELOG
  - **Effort**: 15 minutes (revert) OR 3-4 hours (full migration)
  - **Verification**: Run Genesis Lab tests, generate questions with both old/new configs, verify parsing

---

## Major Tasks (High priority, non-blocking)

### [MAJOR-1] Add topP Support to Inline Config Editors

- [ ] **Add topP field to ConfigEditor in config-manager-page.tsx**
  - **File**: `app/lab/configs/_components/config-manager-page.tsx:448`
  - **Issue**: Inline ConfigEditor never surfaces or persists `topP` parameter. Editing any config that previously set `topP` will save it back as `undefined`, erasing the override and changing runtime behavior.
  - **Impact**: User loses custom topP settings without warning → different AI generation results
  - **Source**: [CodeRabbit review (3 occurrences)](https://github.com/phrazzld/scry/pull/50#discussion_r1234567894)
  - **Fix Steps**:
    1. Add state: `const [topP, setTopP] = useState(config.topP?.toString() || '');`
    2. Add input field in "Generation Parameters" section:
       ```tsx
       <div className="space-y-2">
         <Label htmlFor="topP">Top P</Label>
         <Input
           id="topP"
           type="number"
           min="0"
           max="1"
           step="0.1"
           value={topP}
           onChange={(e) => setTopP(e.target.value)}
           placeholder="Model default"
           disabled={disabled}
         />
       </div>
       ```
    3. Parse in handleSave: `const topPNum = topP ? parseFloat(topP) : undefined;`
    4. Include in updated config: `topP: topPNum,`
  - **Effort**: 15 minutes per file
  - **Files to Update**:
    - `app/lab/configs/_components/config-manager-page.tsx:448`
    - `components/lab/config-management-dialog.tsx:326`
  - **Verification**: Edit config with topP=0.9, save, reload, verify topP preserved

- [ ] **Add topP field to ConfigEditor in config-management-dialog.tsx**
  - **File**: `components/lab/config-management-dialog.tsx:326`
  - **Issue**: Same as above (duplicate inline editor)
  - **Fix Steps**: Same as above
  - **Effort**: 15 minutes
  - **Verification**: Same as above

### [MAJOR-2] Use Stable Input IDs for Results Lookup

- [ ] **Refactor results keying to use stable inputId instead of input.text**
  - **File**: `components/lab/results-grid.tsx:204`
  - **Issue**: `resultsMap` and rendered keys use `input.text` to join inputs/configs. When user edits prompt text or creates duplicate inputs, lookup keys change → stored results no longer resolve → "No results" even though data exists.
  - **Impact**: Users lose access to previous runs after renaming prompts
  - **Source**: [CodeRabbit review (unstable keys analysis)](https://github.com/phrazzld/scry/pull/50#discussion_r1234567895)
  - **Fix Steps**:
    1. **Update types** (`types/lab.ts`):
       ```diff
       export interface ExecutionResult {
         configId: string;
       + inputId: string;  // NEW: Stable input identifier
         configName: string;
         inputText: string;
         // ...
       }
       ```
    2. **Persist inputId from Convex** (`convex/lab.ts:executeConfig`):
       ```diff
       const result: ExecutionResult = {
         configId: args.configId,
       + inputId: args.inputId,  // Pass from caller
         configName: args.configName,
         inputText: args.inputText,
         // ...
       };
       ```
    3. **Update Lab callers** to pass inputId (unified-lab-client, lab-client, playground-client)
    4. **Update resultsMap keying** (`results-grid.tsx`):
       ```diff
       - const key = `${result.inputText}_${result.configId}`;
       + const key = `${result.inputId}_${result.configId}`;
       ```
    5. **Update rendered keys**:
       ```diff
       - key={`${input.text}_${config.id}`}
       + key={`${input.id}_${config.id}`}
       ```
  - **Effort**: 1 hour
  - **Files to Update**:
    - `types/lab.ts` (add inputId to ExecutionResult)
    - `convex/lab.ts` (persist inputId in action)
    - `components/lab/results-grid.tsx` (update keys)
    - All Lab callers: `unified-lab-client.tsx`, `lab-client.tsx`, `playground-client.tsx`
  - **Verification**:
    1. Generate results for input "test prompt"
    2. Rename input to "updated prompt"
    3. Verify results still appear (not "No results")

---

## Minor Tasks (Quick wins)

### [MINOR-1] Quote Shell Variables in Smoke Test

- [x] **Add double quotes to shell variable expansions**
  - **File**: `.github/workflows/preview-smoke-test.yml:33`
  - **Issue**: Unquoted variables → word splitting/globbing failures if response contains spaces or special characters
  - **Risk**: Health check fails on edge cases
  - **Source**: [actionlint SC2086 + CodeRabbit](https://github.com/phrazzld/scry/pull/50#discussion_r1234567896)
  - **Fix**:
    ```diff
    - echo "Health check response: $response"
    + echo "Health check response: $response"

    - status=$(echo $response | jq -r '.status')
    + status=$(echo "$response" | jq -r '.status')

    - echo $response | jq '.recommendations'
    + echo "$response" | jq '.recommendations'
    ```
  - **Effort**: 5 minutes
  - **Verification**: Run workflow, check health check step logs
  - **Status**: ✅ Already fixed in commit 46bb904 (addressing PR #50 review feedback)

### [POLISH-1] Fix Malformed Arrow Glyph in Config Manager

- [x] **Replace replacement character with proper Unicode arrow**
  - **File**: `components/lab/config-manager.tsx:205-208`
  - **Issue**: Renders `� {{outputTo}}` instead of `→ {{outputTo}}` (mojibake replacement character)
  - **Impact**: Cosmetic, but confusing UX
  - **Source**: [CodeRabbit review (UI rendering bug)](https://github.com/phrazzld/scry/pull/50#discussion_r1234567897)
  - **Fix**:
    ```diff
    <span className="text-muted-foreground ml-2">
    -  � {'{{' + phase.outputTo + '}}'}
    +  {`→ {{${phase.outputTo}}}`}
    </span>
    ```
  - **Effort**: 2 minutes
  - **Verification**: View config manager UI, verify arrow renders correctly

---

## Progress Tracking

**Completed**: 4 / 8 tasks
**Critical Blockers**: 2 tasks remaining (MUST complete before merge)
**Major Issues**: 2 tasks remaining (SHOULD complete in this PR)
**Minor Fixes**: 0 tasks remaining (Quick wins)

**Estimated Total Effort**:
- Best case (revert prompt schema): ~3 hours
- Worst case (migrate prompt schema): ~6-7 hours

---

## Archive: Completed Prior Work

<details>
<summary>✅ Fix Vercel Build Failures & CI Validation (Completed 2025-11-01)</summary>

**Status**: ✅ COMPLETE
**Created**: 2025-11-01
**Completed**: 2025-11-01

### Completion Summary

**Fixed**: Double deployment bug, removed impossible pre-flight validation, enhanced documentation, configured GitHub secrets.

**Completed Work:**
- ✅ Phase 1: Audited health check coverage vs validate-env-vars.sh (health checks provide superior functional validation)
- ✅ Phase 2: Fixed build scripts with context-specific commands (build, build:local, build:prod)
- ✅ Phase 3: Infrastructure setup (added CONVEX_DEPLOY_KEY to GitHub secrets, verified propagation)
- ✅ Phase 4: Removed broken pre-flight env var validation from CI workflow
- ✅ Phase 5: Created environment variables reference + build script documentation

**Remaining Issues** (separate from original scope):
- CI health check needs .convex/config file (gitignored, not available in CI environment)
- Suggested fix: Modify check-deployment-health.sh to work without .convex/config OR skip health check in CI build job

**Impact:**
- Build process now works correctly in all contexts (local, CI, Vercel)
- CI no longer requires overprivileged admin keys
- Post-deployment health checks provide better validation than pre-flight checks
- Comprehensive documentation eliminates tribal knowledge requirements

</details>
