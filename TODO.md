# TODO: Genesis Laboratory

## Context

**Approach**: Local-only dev tool with 3-panel UI (Inputs | Configs | Results), localStorage persistence, parallel execution via Convex lab actions

**Key Patterns Identified**:
- localStorage: Use existing `lib/storage.ts` `safeStorage` wrapper
- Convex actions: Follow `convex/aiGeneration.ts` pattern (internalAction, error handling, logging)
- Component structure: Follow `components/generation-task-card.tsx` (Card-based, type guards, state management)
- Page routing: Follow `app/library/page.tsx` pattern (client component wrapper)
- Type definitions: Follow `types/generation-jobs.ts` pattern (Doc types, type guards)

**Files to Create**:
- `app/lab/page.tsx` - Main route (dev-only wrapper)
- `app/lab/_components/lab-client.tsx` - Client component with state
- `convex/lab.ts` - Execution actions
- `types/lab.ts` - Type definitions
- `components/lab/` - UI modules (InputSetManager, ConfigEditor, ResultsGrid)
- `lib/lab-storage.ts` - localStorage helpers

## Implementation Tasks

### Phase 1: Foundation & Storage (Day 1) ✅ COMPLETE

- [x] **Create lab type definitions with validation**
  ```
  Files: types/lab.ts ✅
  Status: Implemented with InputSet, InfraConfig, PromptPhase, ExecutionResult types
  Type guards: isProdConfig, isValidInputSet, isValidPhase, isValidConfig
  ```

- [x] **Implement localStorage persistence layer**
  ```
  Files: lib/lab-storage.ts ✅
  Status: SSR-safe with quota handling, JSON serialize/deserialize
  Interface: save/load for inputSets, configs, results + clearResults
  ```

- [x] **Create dev-only lab route**
  ```
  Files: app/lab/page.tsx ✅
  Status: Dev-only guard implemented, renders LabClient
  ```

- [x] **Build main lab client with 3-panel layout**
  ```
  Files: app/lab/_components/lab-client.tsx ✅
  Status: 3-panel grid (25% | 35% | 40%), localStorage persistence
  State: inputSets, configs, results, selectedInputSetId, enabledConfigIds
  ```

### Phase 2: Input & Config Management (Day 2)

- [x] **Implement InputSetManager component**
  ```
  Files: components/lab/input-set-manager.tsx ✅
  Status: Card-based CRUD with expand/collapse, validation (max 10 inputs)
  Features: Create/edit/delete sets, inline editing, toast notifications
  Integrated: Used in lab-client.tsx with full state management
  ```

- [x] **Build ConfigEditor component**
  ```
  Files: components/lab/config-editor.tsx ✅
  Status: Form with Select, Input, Textarea for all config fields
  Validation: name required, temp 0-2, tokens 1-65536, topP 0-1, phases validated
  Features: Create/edit configs, read-only PROD config display
  ```

- [x] **Implement PromptPhaseEditor sub-component**
  ```
  Files: components/lab/config-editor.tsx ✅ (included in same file)
  Status: Dynamic phase array with add/remove, template editor with variable hints
  Features: Phase name, template textarea, outputTo variable for chaining
  Integrated: Used within ConfigEditor component
  ```

- [x] **Build ConfigManager wrapper component**
  ```
  Files: components/lab/config-manager.tsx ✅ (bonus component)
  Status: Lists configs with expand/collapse, enable/disable checkboxes
  Features: CRUD operations, PROD config protection, phase preview
  Integrated: Used in lab-client.tsx with full state management
  ```

### Phase 3: Backend Execution (Day 3)

- [x] **Create lab.ts with executeConfig action**
  ```
  Files: convex/lab.ts ✅
  Status: internalAction with full N-phase execution pipeline
  Features:
    - Template interpolation with {{variable}} syntax
    - Sequential phase execution with context passing
    - Schema validation with questionsSchema
    - Metrics tracking (latency, token count)
    - Comprehensive error handling and logging
  Provider: Google AI only (OpenAI/Anthropic deferred for future)
  Pattern: Follows convex/aiGeneration.ts - pino logging, error classification
  ```

- [x] **Implement template variable interpolation**
  ```
  Status: ✅ Included in lab.ts
  Implementation: interpolateTemplate(template, context)
  Features: Regex-based {{varName}} replacement, missing var detection
  Error handling: Throws with list of missing variables
  ```

- [ ] **Add provider factory for multi-model support**
  ```
  Status: DEFERRED - Google-only implementation sufficient for MVP
  Reason: OpenAI/Anthropic packages not installed, adds complexity
  Future: Can extend when multi-provider testing is needed
  Current: args.provider !== 'google' throws descriptive error
  ```

### Phase 4: Results Display (Day 4) ✅ COMPLETE

- [x] **Build ResultsGrid component with matrix layout**
  ```
  Files: components/lab/results-grid.tsx ✅
  Status: Matrix layout with input rows × config columns
  Features: Cell click to expand, loading states, empty states
  Layout: Responsive grid with result badges (valid/invalid/pending)
  Integration: Wired to lab-client with handleRunAll
  ```

- [x] **Implement ResultCell with tabbed views**
  ```
  Status: ✅ Included in results-grid.tsx
  Tabs: Cards (QuestionPreviewCard) | JSON (pre-formatted) | Metrics
  Features: Question preview cards with options/answers, metrics table
  Components: QuestionPreviewCard, MetricRow helpers
  ```

- [x] **Add schema validation display with error highlighting**
  ```
  Status: ✅ Included in ResultCell
  Display: Alert component with error list when result.errors.length > 0
  Badges: Visual indicators for valid/invalid status
  Integration: Errors from ExecutionResult shown inline
  ```

### Phase 5: Parallel Execution (Day 5) ✅ COMPLETE

- [x] **Implement parallel execution orchestrator**
  ```
  Files: app/lab/_components/lab-client.tsx ✅
  Status: Full parallel execution with Promise.all()
  Implementation:
    - useAction hook for api.lab.executeConfig
    - Creates promise for each input × config combination
    - Promise.all() executes in parallel
    - Individual error handling (partial failures supported)
    - Results state updated with all ExecutionResults
  Features:
    - Real-time progress tracking (completed/failed counters)
    - Toast notifications for start/complete/errors
    - Handles partial failures gracefully
  ```

- [x] **Add progress tracking and cancellation**
  ```
  Status: ✅ Progress tracking implemented
  Features:
    - Progress state: {total, completed, failed}
    - Progress bar with percentage display
    - Failed count indicator (red text)
    - Progress bar color: primary (success) / red (failures)
    - Real-time updates as promises resolve
  Note: Cancellation deferred (would require AbortController + action support)
  ```

### Phase 6: Production Integration (Day 6)

- [ ] **Create PromotionDialog component**
  ```
  Files: components/lab/promotion-dialog.tsx (new)
  Approach: AlertDialog from shadcn with code preview
  Interface: <PromotionDialog config={InfraConfig} onConfirm={} onCancel={} />
  Features: Show config summary, warning message, Copy to Clipboard button
  Success: Dialog renders, clipboard copy works, can cancel
  Test: Unit test for clipboard API, integration test for dialog flow
  Module: Promotion UX, hides clipboard complexity
  Time: 45min
  ```

- [ ] **Implement code generation for aiGeneration.ts**
  ```
  Files: components/lab/promotion-dialog.tsx (extend existing)
  Approach: Template string generation
  Interface: generateAIGenerationCode(config: InfraConfig) → string
  Output: Updated buildIntentClarificationPrompt and buildQuestionPromptFromIntent
  Features: Replace prompt templates, update model selection, preserve formatting
  Success: Generated code is valid TypeScript, matches existing structure
  Test: Unit tests comparing generated vs. expected output
  Module: Code generation, isolated from UI
  Time: 1.5hr
  ```

- [x] **Add export/import functionality**
  ```
  Files: app/lab/_components/lab-client.tsx ✅
  Status: Full export/import with JSON file handling
  Features:
    - Export: Downloads JSON file with inputSets, configs, results
    - Excludes PROD configs from export (safety)
    - Import: File upload with JSON validation
    - Validates structure (version, required fields)
    - Merges imported data with existing (non-destructive)
    - Toast notifications for success/errors
  UI: Export/Import buttons in header toolbar
  File format: Versioned JSON (v1.0) with timestamp
  ```

- [x] **Extract shared prompt templates (PROD baseline)**
  ```
  Files: convex/lib/promptTemplates.ts ✅ (NEW), convex/aiGeneration.ts ✅, app/lab/_components/lab-client.tsx ✅
  Status: Single source of truth for production prompts
  Approach:
    - Created convex/lib/promptTemplates.ts with buildIntentClarificationPrompt, buildQuestionPromptFromIntent
    - Exported PROD_CONFIG_METADATA (provider, model, temperature, maxTokens)
    - Updated aiGeneration.ts to import from shared module (removed duplicate functions)
    - Lab auto-loads PROD config on mount using shared prompts
    - Updates PROD config each load to match current production (prevents drift)
  Features:
    - PROD config always visible in lab (id: 'prod-baseline', isProd: true)
    - Read-only protection via ConfigManager (can't edit/delete PROD)
    - Changes to prompts in one place update both production and lab
  Integration: Solves "missing PROD baseline" feedback - lab now shows actual production infrastructure
  ```

- [x] **Fix layout width to match app-wide pattern**
  ```
  Files: app/lab/_components/lab-client.tsx ✅
  Status: Full-width layout matching library and other pages
  Changes:
    - Replaced `<div className="container mx-auto px-4">` with PageContainer
    - Header and main content use PageContainer (w-full px-4 md:px-8)
    - Vertical alignment now matches navbar/footer
  Integration: Solves "too narrow / too much margin" feedback
  ```

## Design Iteration

**After Phase 3**: Review execution layer
- Is template interpolation flexible enough for complex chains?
- Should provider factory support custom API keys per config?
- Are error messages clear enough for debugging prompt issues?

**After Phase 5**: Review state management
- Is localStorage limit (10MB) sufficient? Add warning at 8MB
- Should results be compressed (gzip) for larger datasets?
- Is parallel execution fast enough? Profile for bottlenecks

## Module Boundaries Validation

**Strong Modules** (high value, low interface complexity):
- ✅ `lab-storage.ts`: 4 functions hide localStorage + JSON complexity
- ✅ `executeConfig`: Single function hides multi-phase + multi-provider logic
- ✅ `ResultsGrid`: Simple props, complex layout computation hidden

**Potential Shallow Modules** (watch for):
- ⚠️ `PromptPhaseEditor`: If just wrapping Textarea, consider inline
- ⚠️ Type guards in `types/lab.ts`: Keep minimal, avoid duplication

## Testing Strategy

**Unit Tests** (isolated, fast):
- Type guards, template interpolation, validation functions
- localStorage helpers (mock localStorage)
- Code generation output

**Integration Tests** (component + hooks):
- InputSetManager CRUD flow
- ConfigEditor form submission
- ResultsGrid rendering with real data
- Parallel execution with mock Convex

**E2E Tests** (optional, manual for MVP):
- Full workflow: Create input → Config → Run → View results → Promote

## Acceptance Criteria

**Phase 1-2 Complete**:
- Can create input set with 5 prompts
- Can create 2 configs (different models)
- State persists across page refresh

**Phase 3-4 Complete**:
- Can run 2 configs against 1 input
- See results in grid with JSON tab
- Schema validation shows errors

**Phase 5-6 Complete**:
- Run 3 configs × 5 inputs in parallel (<30s)
- View progress, cancel mid-execution
- Promote config to clipboard as valid code

## Dependencies to Install

```bash
pnpm add @uiw/react-json-view @ai-sdk/openai @ai-sdk/anthropic
pnpm add -D @types/react-json-view
```

## Timeline

- **Day 1**: Phase 1 (4-5hr)
- **Day 2**: Phase 2 (4.5hr)
- **Day 3**: Phase 3 (3.75hr)
- **Day 4**: Phase 4 (3.75hr)
- **Day 5**: Phase 5 (1.75hr)
- **Day 6**: Phase 6 (3.25hr)

**Total**: ~21hr across 6 days (sustainable 3-4hr/day pace)

## Next Steps

```bash
git checkout -b feature/genesis-laboratory
pnpm add @uiw/react-json-view @ai-sdk/openai @ai-sdk/anthropic
```

Start with Phase 1, Task 1: Create `types/lab.ts`
