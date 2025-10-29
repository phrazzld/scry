# Genesis Laboratory: Generation Infrastructure Testing Tool

## Executive Summary

Build a local-only development tool for testing different question generation infrastructure configurations. The lab enables saving test input sets, defining multiple generation configs (prompt chains, models, parameters), running them in parallel, comparing outputs manually, and promoting winning configs to production code.

**User Value**: Experiment with generation infrastructure changes (2-phase → 3-phase prompting, different templates, model selection) without manual job submission, waiting, and code editing.

**Success Criteria**: Define 3 infrastructure configs, run against 5 test inputs, compare outputs side-by-side, promote best config to production files in under 5 minutes.

## User Context

**Who**: Solo developer (local dev environment only)
**Problem**: Testing generation infrastructure changes requires:
1. Manually editing `convex/aiGeneration.ts`
2. Submitting test jobs via UI
3. Waiting for background processing
4. Inspecting results
5. Repeating for each variation
6. Reverting code to test next variation

**Benefit**:
- Test 5 infrastructure variations in parallel vs. 5 sequential manual runs
- Save/reuse test input sets for consistent comparison
- Instant feedback on architectural changes
- One-click promotion to production code

## Requirements

### Functional Requirements

**Test Input Management**
- Create/edit/delete named test input sets
- Input set = array of test prompts (e.g., ["Master NATO alphabet", "Learn React hooks"])
- Save to localStorage, export/import JSON
- Quick actions: Add sample inputs, clear all

**Infrastructure Configuration**
- Define N infrastructure configs (1 prod baseline + N experiments)
- Each config specifies:
  - Name and description
  - Model selection (provider + model ID)
  - Prompt chain architecture (1-phase, 2-phase, 3-phase, custom)
  - Prompt templates (full text for each phase)
  - Parameters (temperature, maxTokens, topP)
- PROD config: Read-only, loaded from current `aiGeneration.ts`
- Save configs to localStorage, export/import JSON

**Parallel Execution**
- Select input set + select configs to run
- Execute all enabled configs against all inputs in parallel
- Display progress (X/Y complete)
- Results grid: Inputs (rows) × Configs (columns)
- Cancel all running generations

**Output Comparison**
- Side-by-side view of all config outputs for same input
- Display metrics: question count, latency, schema validation
- Raw JSON view with syntax highlighting
- Question card preview (reuse existing QuestionCard component)
- Highlight schema validation errors

**Promotion to Production**
- Select winning config
- Generate updated `convex/aiGeneration.ts` with new prompts/chain/model
- Options:
  - Copy code snippet to clipboard
  - Direct file edit (write to filesystem)
- Show git diff of changes before applying

### Non-Functional Requirements

**Performance**: Execute 3 configs × 5 inputs = 15 parallel generations in <30s (network-bound)
**Security**: Dev-only, no production access, runs against dev Convex deployment
**Maintainability**: Isolated from production code, safe to experiment
**Usability**: Zero-config startup, persistent state across sessions

## Architecture Decision

### Selected Approach: Local React App + Convex Lab Actions

**Rationale**:
- **Simplicity**: Client-side state (localStorage), no database
- **Explicitness**: Clear dev-only separation via `/lab` route
- **User Value**: Fast iteration, visual comparison, safe experimentation

### Module Boundaries

**`app/lab/page.tsx`** - Main laboratory interface
- **Interface**: Full-screen layout with panels (inputs, configs, results)
- **Responsibility**: State orchestration, localStorage persistence
- **Hidden Complexity**: Parallel execution coordination, result caching

**`convex/lab.ts`** - Laboratory execution actions
- **Interface**: `executeConfig(config, testInput)` → `{questions, metrics, errors}`
- **Responsibility**: Multi-phase prompt execution, provider integration
- **Hidden Complexity**: Prompt template interpolation, error handling, timing

**`components/lab/input-set-manager.tsx`** - Test input CRUD
- **Interface**: `<InputSetManager sets={} onSelect={} onCreate={} />`
- **Responsibility**: Input set management UI
- **Hidden Complexity**: Validation, localStorage sync

**`components/lab/config-editor.tsx`** - Infrastructure config editor
- **Interface**: `<ConfigEditor config={} onChange={} />`
- **Responsibility**: Prompt chain architecture definition
- **Hidden Complexity**: Template validation, model selection, phase management

**`components/lab/results-grid.tsx`** - Comparison matrix
- **Interface**: `<ResultsGrid inputs={} configs={} results={} />`
- **Responsibility**: Side-by-side display, navigation
- **Hidden Complexity**: Layout computation, lazy loading

**`components/lab/promotion-dialog.tsx`** - Code generation
- **Interface**: `<PromotionDialog config={} onPromote={} />`
- **Responsibility**: Generate production code, show diff
- **Hidden Complexity**: Code template generation, file I/O

### Alternatives Considered

| Approach | Simplicity | User Value | Why Not Chosen |
|----------|-----------|------------|----------------|
| **CLI Tool** | High | Low | No visual output comparison |
| **Separate Repo** | Low | High | Deployment overhead for solo dev |
| **Jupyter Notebook** | Medium | Low | Poor UX for prompt editing |
| **Selected: Next.js Route** | **High** | **High** | ✅ Best balance |

## Dependencies & Assumptions

### External Dependencies
- Existing: `@ai-sdk/google`, `ai` (Vercel AI SDK)
- New: `@ai-sdk/openai`, `@ai-sdk/anthropic` (optional, for model flexibility)
- `react-json-view` or `@uiw/react-json-view` (JSON viewer with syntax highlighting)
- `monaco-react` (optional, for prompt template editing with syntax highlighting)

### Environment Requirements
- Development only: `NODE_ENV=development` or explicit dev guard
- Convex dev deployment URL (amicable-lobster-935)
- API keys already configured in Convex env

### Scale Expectations
- Max 10 test inputs per set
- Max 5 infrastructure configs running in parallel
- Test inputs <5KB each
- Total results <5MB (localStorage limit ~10MB)

### Integration Constraints
- Must read production config from `convex/aiGeneration.ts` (parse source file)
- Must not modify production code automatically (manual review required)
- Must work offline after initial config load

## Implementation Phases

### Phase 1: Foundation (Day 1-2)

**Day 1: Core UI & State**
- Create `/app/lab/page.tsx` with dev-only guard (`process.env.NODE_ENV === 'development'`)
- Build 3-panel layout: Inputs (left) | Configs (center) | Results (right)
- Implement localStorage hooks for persistence
- Create `InputSetManager` component (CRUD for test inputs)
- Create `ConfigEditor` component (basic form: name, model, 1 prompt template)

**Day 2: Backend Execution**
- Create `convex/lab.ts` with `executeConfig` action
- Implement 2-phase execution (current prod architecture)
- Support model switching (Gemini 2.5 Flash, Pro, Flash-Lite)
- Return structured results: `{questions, metrics: {latency, count, valid}, errors}`
- Add basic error handling and timeout (30s per execution)

**Acceptance**: Create 2 test inputs, define 2 configs (different models), run in parallel, view raw JSON results

### Phase 2: Comparison & Architecture Flexibility (Day 3-4)

**Day 3: Multi-Phase Support**
- Extend `ConfigEditor` to support 1-phase, 2-phase, 3-phase architectures
- Add prompt template editor for each phase
- Implement template variable interpolation (e.g., `{{userInput}}`, `{{clarifiedIntent}}`)
- Update `convex/lab.ts` to execute N-phase chains dynamically

**Day 4: Results Comparison**
- Build `ResultsGrid` component with inputs × configs matrix
- Add tabbed view per cell: JSON | Question Cards | Metrics
- Implement schema validation display with error highlighting
- Add question card preview (reuse existing `QuestionCard`)
- Show latency, token count, validation status per config

**Acceptance**: Define 3-phase config, run against 5 inputs, compare outputs in grid, view question cards

### Phase 3: Production Integration (Day 5)

**Day 5: Config Promotion**
- Create `PromotionDialog` component
- Implement code generation:
  - Parse current `convex/aiGeneration.ts`
  - Generate updated version with new prompts/chain/model
  - Show diff (use `react-diff-viewer-continued` or Monaco diff editor)
- Options:
  1. Copy to clipboard (safe, manual paste)
  2. Write to file (requires Node fs API via Next.js API route)
- Add git diff preview before applying changes

**Acceptance**: Select winning config, generate code, view diff, copy to clipboard, manually apply to `aiGeneration.ts`

### Phase 4: Polish (Day 6 - Optional)

**Day 6: UX Refinement**
- Add keyboard shortcuts (Cmd+Enter to run, Cmd+S to save config)
- Implement export/import for configs and input sets
- Add "Load from Production" to auto-populate PROD baseline config
- Show cost estimation per config (token usage × model pricing)
- Add batch actions: Run all configs, Clear all results, Export all

**Acceptance**: Use keyboard shortcuts, export configs to JSON, reload in fresh session

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **localStorage limit (10MB)** | Medium | Medium | Clear old results, warn at 8MB, compression |
| **Parallel execution rate limits** | Low | Low | Solo dev, reasonable usage |
| **Code gen breaks production** | High | Critical | Manual review required, show diff, clipboard-only default |
| **Prompt template syntax errors** | Medium | Low | Validation before execution, clear error messages |

## Key Decisions

### 1. localStorage vs. Convex Database
**Decision**: localStorage for all state
**Rationale**: Simple, no backend overhead, sufficient for solo dev
**Tradeoff**: No cross-device sync, 10MB limit

### 2. Code Generation vs. Manual Copy-Paste
**Decision**: Generate code + manual review
**Rationale**: Explicitness, safety, git workflow compatibility
**Tradeoff**: Extra step vs. automated (but risky) file editing

### 3. Parallel Execution All at Once vs. Queue
**Decision**: Parallel execution with `Promise.all()`
**Rationale**: Fast feedback (5x speedup for 5 configs)
**Tradeoff**: Higher concurrent API usage (acceptable for dev)

### 4. Monaco Editor vs. Textarea
**Decision**: Start with textarea, upgrade to Monaco if needed
**Rationale**: Simpler initial implementation, good enough for prompts
**Tradeoff**: No syntax highlighting initially (can add later)

## Quality Validation

### Deep Modules Check
✅ **InputSetManager**: Simple CRUD interface hides localStorage sync, validation
✅ **lab.ts**: Simple `executeConfig` hides multi-phase orchestration, error handling
✅ **ResultsGrid**: Simple display interface hides layout computation, lazy loading

### Information Hiding Check
✅ **Prompt chain changes isolated**: Adding 4-phase doesn't break UI
✅ **Storage implementation hidden**: Can swap localStorage → Convex without UI changes
✅ **Code generation isolated**: Template changes don't affect comparison UI

### Abstraction Layers Check
✅ **UI Layer**: Configs, Inputs, Results (user concepts)
✅ **Execution Layer**: Prompt chains, Model calls, Validation (generation concepts)
✅ **Storage Layer**: Persistence, Serialization (infrastructure concepts)

## UI/UX Wireframe

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🧪 Genesis Laboratory                    [Export] [Import] [Settings] │
├───────────────┬────────────────────┬───────────────────────────────────┤
│ Test Inputs   │ Infrastructure     │ Results                           │
│               │ Configs            │                                   │
│ ┌───────────┐ │ ┌────────────────┐ │ ┌───────────────────────────────┐ │
│ │ Input Set │ │ │ ✅ PROD        │ │ │    Input 1   Input 2   Input 3│ │
│ │ "Sample"  │ │ │ 2-phase        │ │ ├───────────────────────────────┤ │
│ │ ▸ (5)     │ │ │ Gemini 2.5 Pro│ │ │ PROD │ 26 ✅  │ 18 ✅  │ 30 ✅ │ │
│ └───────────┘ │ │ [Read-Only]    │ │ │      │ 12.4s  │ 8.1s   │ 15.2s│ │
│               │ └────────────────┘ │ ├──────┼────────┼────────┼──────┤ │
│ ┌───────────┐ │ ┌────────────────┐ │ │Draft1│ 34 ⚠️ │ 22 ✅  │ 40 ✅ │ │
│ │ + New Set │ │ │ ✅ Draft 1     │ │ │      │ 8.7s   │ 6.2s   │ 11.5s│ │
│ └───────────┘ │ │ 3-phase        │ │ ├──────┼────────┼────────┼──────┤ │
│               │ │ GPT-5 Mini     │ │ │Draft2│ 28 ✅  │ 20 ✅  │ 32 ✅ │ │
│ Current:      │ │ T=0.7          │ │ │      │ 10.1s  │ 7.4s   │ 13.8s│ │
│ Sample (5)    │ │ [Edit][Delete] │ │ └──────┴────────┴────────┴──────┘ │
│               │ └────────────────┘ │                                   │
│ 1. NATO alpha │ ┌────────────────┐ │ Selected: PROD × Input 1          │
│ 2. React hooks│ │ ⬜ Draft 2     │ │ ┌───────────────────────────────┐ │
│ 3. Photosyn   │ │ 1-phase        │ │ │ [JSON] [Cards] [Metrics]      │ │
│ 4. Python OOP │ │ Claude Opus 4  │ │ │                               │ │
│ 5. Civil War  │ │ T=0.8          │ │ │ {                             │ │
│               │ │ [Edit][Delete] │ │ │   "questions": [              │ │
│ [Edit Set]    │ └────────────────┘ │ │     {                         │ │
│               │                    │ │       "question": "What is A  │ │
│               │ ┌────────────────┐ │ │        in NATO alphabet?",    │ │
│               │ │ + New Config   │ │ │       "type": "multiple-choi  │ │
│               │ └────────────────┘ │ │        ce",                   │ │
│               │                    │ │       ...                     │ │
│               │ [Run All Enabled]  │ │                               │ │
│               │                    │ │ [Promote to Prod]             │ │
│               │                    │ └───────────────────────────────┘ │
└───────────────┴────────────────────┴───────────────────────────────────┘
```

## Data Structures

### Test Input Set
```typescript
interface InputSet {
  id: string;
  name: string;
  description?: string;
  inputs: string[]; // User prompts to test
  createdAt: number;
  updatedAt: number;
}
```

### Infrastructure Config
```typescript
interface InfraConfig {
  id: string;
  name: string;
  description?: string;
  isProd: boolean; // Read-only production baseline

  // Model configuration
  provider: 'google' | 'openai' | 'anthropic';
  model: string; // e.g., 'gemini-2.5-flash', 'gpt-5-mini'
  temperature: number;
  maxTokens: number;
  topP?: number;

  // Prompt chain architecture
  phases: PromptPhase[];

  createdAt: number;
  updatedAt: number;
}

interface PromptPhase {
  name: string; // e.g., "Intent Clarification", "Question Generation"
  template: string; // Prompt template with {{variables}}
  outputTo?: string; // Variable name for next phase (e.g., "clarifiedIntent")
}
```

### Execution Result
```typescript
interface ExecutionResult {
  configId: string;
  input: string;

  // Output
  questions: Question[]; // Generated questions
  rawOutput: any; // Full AI response

  // Metrics
  latency: number; // ms
  tokenCount?: number;
  valid: boolean; // Schema validation
  errors: string[];

  // Metadata
  executedAt: number;
}
```

## Implementation Checklist

**Setup**:
- [ ] Create `/app/lab` route with dev-only guard
- [ ] Install optional dependencies (`@uiw/react-json-view`, `react-diff-viewer-continued`)
- [ ] Add `.env.local` check for required API keys

**Backend (convex/lab.ts)**:
- [ ] Create `executeConfig` action with multi-phase support
- [ ] Implement provider factory (Google/OpenAI/Anthropic)
- [ ] Add template variable interpolation
- [ ] Implement metrics tracking (latency, tokens)
- [ ] Add schema validation with Zod
- [ ] Error handling and timeout (30s)

**UI Components**:
- [ ] Build `InputSetManager` (CRUD for test inputs)
- [ ] Build `ConfigEditor` (prompt chain architecture)
- [ ] Build `ResultsGrid` (comparison matrix)
- [ ] Build `PromotionDialog` (code generation + diff)
- [ ] Implement localStorage hooks for persistence
- [ ] Add export/import functionality

**Production Integration**:
- [ ] Parse current `convex/aiGeneration.ts` to extract PROD config
- [ ] Generate updated code with new prompts/chain/model
- [ ] Show git diff preview
- [ ] Copy to clipboard functionality
- [ ] Optional: File write API route (requires user confirmation)

**Testing**:
- [ ] Test 1-phase, 2-phase, 3-phase architectures
- [ ] Verify parallel execution with 5+ configs
- [ ] Test localStorage persistence across sessions
- [ ] Verify schema validation with invalid outputs
- [ ] Test promotion code generation accuracy

---

**Timeline**: 5-6 days (MVP + Polish)

**Next Step**: Run `/plan` to break into granular tasks, or start with Phase 1 Day 1 foundation.
