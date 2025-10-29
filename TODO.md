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

- [ ] **Build ConfigEditor component**
  ```
  Files: components/lab/config-editor.tsx (new)
  Approach: Form with shadcn components (Select, Input, Textarea, Slider)
  Interface: <ConfigEditor config={} onChange={} onSave={} onCancel={} />
  Fields: name, description, provider select, model input, temperature slider, maxTokens, phases array
  Success: Edit config, validate (name required, temp 0-2, tokens 1-65536), save to state
  Test: Unit tests for validation, integration test for form submission
  Module: Config CRUD, hides form state management and validation
  Time: 2hr
  ```

- [ ] **Implement PromptPhaseEditor sub-component**
  ```
  Files: components/lab/config-editor.tsx (extend existing)
  Approach: Dynamic array of phase editors (Add/Remove phase buttons)
  Interface: <PhaseEditor phases={} onChange={} />
  Features: Add phase, remove phase, edit template (Textarea), variable hints ({{userInput}})
  Success: Add/remove phases, edit templates, preview variables
  Test: Unit tests for add/remove logic
  Module: Phase management, hides array manipulation complexity
  Time: 1hr
  ```

### Phase 3: Backend Execution (Day 3)

- [ ] **Create lab.ts with executeConfig action**
  ```
  Files: convex/lab.ts (new)
  Approach: Follow convex/aiGeneration.ts pattern - internalAction, error handling, logging
  Interface: executeConfig(config: InfraConfig, testInput: string) → ExecutionResult
  Implementation:
    - Provider factory (google/openai/anthropic from config.provider)
    - Template interpolation (replace {{variables}} with actual values)
    - Execute N-phase chain sequentially
    - Schema validation with existing questionSchema/questionsSchema
    - Metrics (latency, token count from AI SDK response)
  Success: Executes 2-phase with Gemini, returns valid ExecutionResult, handles errors
  Test: Integration test with mock AI SDK, unit tests for template interpolation
  Module: Hides multi-provider complexity, exposes simple execute interface
  Time: 2.5hr
  ```

- [ ] **Implement template variable interpolation**
  ```
  Files: convex/lab.ts (extend existing)
  Approach: Simple string replace with context object
  Interface: interpolateTemplate(template: string, vars: Record<string, string>) → string
  Features: Replace {{varName}} with vars.varName, handle missing vars (throw error)
  Success: Replaces all variables, errors on missing, escapes special chars
  Test: Unit tests for all variable patterns, edge cases (nested, missing)
  Module: Template engine, isolated from execution logic
  Time: 30min
  ```

- [ ] **Add provider factory for multi-model support**
  ```
  Files: convex/lab.ts (extend existing)
  Approach: Factory pattern with switch statement
  Interface: createProvider(provider: string, model: string, apiKey: string) → LanguageModel
  Implementation:
    - google: createGoogleGenerativeAI({apiKey})(model)
    - openai: createOpenAI({apiKey})(model)
    - anthropic: createAnthropic({apiKey})(model)
  Success: Returns correct provider instance, handles missing API keys
  Test: Unit tests for each provider path, error handling
  Module: Provider abstraction, hides SDK initialization
  Time: 45min
  ```

### Phase 4: Results Display (Day 4)

- [ ] **Build ResultsGrid component with matrix layout**
  ```
  Files: components/lab/results-grid.tsx (new)
  Approach: CSS Grid with inputs (rows) × configs (columns)
  Interface: <ResultsGrid inputs={string[]} configs={InfraConfig[]} results={Map<string, ExecutionResult>} />
  Features: Grid headers, cell click to expand, loading states, empty states
  Success: Renders grid, handles sparse results, responsive on smaller screens
  Test: Visual regression test, integration test for cell selection
  Module: Layout computation, lazy loading for large grids
  Time: 1.5hr
  ```

- [ ] **Implement ResultCell with tabbed views**
  ```
  Files: components/lab/results-grid.tsx (extend existing)
  Approach: Tabs component from shadcn (JSON | Cards | Metrics)
  Interface: <ResultCell result={ExecutionResult} />
  Tabs:
    - JSON: Syntax highlighted with @uiw/react-json-view
    - Cards: Map questions to QuestionCard components
    - Metrics: Latency, count, validation status
  Success: All 3 tabs render, JSON highlighted, cards reuse existing component
  Test: Unit tests for tab switching, integration test for question card rendering
  Module: Result visualization, hides rendering complexity
  Time: 1.5hr
  ```

- [ ] **Add schema validation display with error highlighting**
  ```
  Files: components/lab/results-grid.tsx (extend ResultCell)
  Approach: Run Zod validation, display errors inline
  Interface: validationErrors: string[] displayed as Alert component
  Features: Validate against existing questionSchema, show field path and error
  Success: Invalid schema shows errors, valid shows green checkmark
  Test: Unit tests with invalid schemas, integration test for error display
  Module: Validation feedback, isolated from core rendering
  Time: 45min
  ```

### Phase 5: Parallel Execution (Day 5)

- [ ] **Implement parallel execution orchestrator**
  ```
  Files: app/lab/_components/lab-client.tsx (extend existing)
  Approach: Promise.all() with progress tracking
  Interface: handleRunAll() → void (updates results state incrementally)
  Implementation:
    - Filter enabled configs
    - For each input × config, create promise
    - Promise.all() execution
    - Update results Map as each promise resolves
    - Handle partial failures (some configs succeed, others fail)
  Success: Runs 3 configs × 5 inputs in parallel, updates progress, handles errors
  Test: Integration test with mock convex actions, verify parallel execution
  Module: Execution coordination, hides Promise complexity
  Time: 1hr
  ```

- [ ] **Add progress tracking and cancellation**
  ```
  Files: app/lab/_components/lab-client.tsx (extend existing)
  Approach: AbortController pattern, progress state
  Interface: Progress bar showing "X/Y complete", Cancel button
  State: executionProgress: {total, completed, failed}, abortController
  Success: Progress updates in real-time, Cancel stops pending executions
  Test: Integration test for cancellation mid-execution
  Module: Progress feedback, hides abort logic
  Time: 45min
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

- [ ] **Add export/import functionality**
  ```
  Files: app/lab/_components/lab-client.tsx (extend existing)
  Approach: JSON.stringify/parse with file download/upload
  Interface: Export All (downloads configs+inputs JSON), Import (file input)
  Features: Download JSON file, upload and validate JSON structure
  Success: Export creates valid JSON, import restores state, validation works
  Test: Integration test for export/import roundtrip
  Module: Data portability, hides file I/O
  Time: 1hr
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
