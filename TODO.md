# PR #49 Review Feedback - MERGE BLOCKERS

**Source**: CodeRabbit automated review (11 inline + 3 nitpicks + 1 outside-diff)
**Priority**: Address immediately before merge
**Total Work**: ~3h

---

## 🔴 CRITICAL (Must Fix to Merge)

### ✅ 1. Fix Responses API JSON Parsing [COMPLETED - b84f042]
**File**: `convex/lib/responsesApi.ts:107`
**Status**: Fixed in commit b84f042
**Solution**: Now prefers `output_json` content type, falls back to `output_text`

---

### ✅ 2. Fix Questions Discarded from Single-Phase Runs [COMPLETED - 205c161]
**File**: `convex/lab.ts:316-317`
**Status**: Fixed in commit 205c161
**Solution**: Defaults `expectsQuestions = true` when `outputType === undefined`

---

### ✅ 3. Add Production Guard to executeConfig [COMPLETED - 6032586]
**File**: `convex/lab.ts:106-111`
**Status**: Fixed in commit 6032586
**Solution**: Guards against production execution with clear error message

---

## 🟠 HIGH PRIORITY (Fix Before Merge)

### 4. Fix Config Editor Form State Sync
**File**: `app/lab/configs/_components/config-manager-page.tsx:276`
**Issue**: Form state initialized only on mount. Switching tabs shows stale values → saving corrupts target config.
**Impact**: Major functional bug - editing corrupts configs
**Fix**: Add `useEffect` to resync when `config` changes

```typescript
useEffect(() => {
  setName(config.name);
  setDescription(config.description || '');
  setProvider(config.provider);
  setModel(config.model);
  setTemperature(config.temperature?.toString() || '');
  setMaxTokens(config.provider === 'google' && config.maxTokens !== undefined ? config.maxTokens.toString() : '');
  setPhases(config.phases);
}, [config]);
```

---

### 5. Fix Comparison Mode Error Handling
**File**: `app/lab/_components/unified-lab-client.tsx:215`
**Issue**: `Promise.all` rejects on first failure, overwrites both results with same error. Hides successful config results.
**Impact**: Comparison workflow broken when one config fails
**Fix**: Use `Promise.allSettled`, handle results independently

```typescript
const [result1, result2] = await Promise.allSettled([/* ... */]);

// Map each result independently
const finalResult1 = result1.status === 'fulfilled' ? result1.value : toFailedResult(config1, result1.reason);
const finalResult2 = result2.status === 'fulfilled' ? result2.value : toFailedResult(config2, result2.reason);
```

---

### 6. Preserve OpenAI Config Parameters
**File**: `components/lab/config-editor.tsx:148`
**Issue**: Editing drops `maxCompletionTokens`, `reasoningEffort`, `verbosity`. Not displayed or rehydrated.
**Impact**: Any edit loses critical OpenAI parameters
**Fix**: Round-trip all OpenAI-specific fields

```typescript
// When saving OpenAI config, merge existing fields
const newConfig: OpenAIInfraConfig = {
  ...baseFields,
  provider: 'openai',
  // Preserve existing OpenAI params or use form values
  maxCompletionTokens: config.provider === 'openai' ? config.maxCompletionTokens : undefined,
  reasoningEffort: config.provider === 'openai' ? config.reasoningEffort : undefined,
  verbosity: config.provider === 'openai' ? config.verbosity : undefined,
  temperature: parsedTemp,
};
```

---

### 7. Return Text Output from Final Phase
**File**: `convex/lab.ts:276`
**Issue**: Text branch never assigns `finalOutput` for terminal phases. Text-only configs return `null`.
**Impact**: Single-phase Google configs (common) broken
**Fix**: Assign `finalOutput` when terminal phase is text

```typescript
if (outputType === 'text') {
  const output = response.text;
  if (phase.outputTo) {
    context[phase.outputTo] = output;
  }

  // NEW: Surface final text output
  if (i === args.phases.length - 1) {
    finalOutput = output;
  }
}
```

---

### 8. Remove Unsupported Anthropic Provider
**Files**: 3 locations
- `app/lab/configs/_components/config-manager-page.tsx:375`
- `components/lab/config-editor.tsx:216`
- `components/lab/config-management-dialog.tsx:370`

**Issue**: UI offers "Anthropic" but type system only supports `'google' | 'openai'`. Selection falls through to OpenAI → mislabeled config.
**Fix**: Remove all 3 `<SelectItem value="anthropic">` instances

---

### 9. Lower localStorage Quota Warning
**File**: `lib/lab-storage.ts:21`
**Issue**: 8MB default exceeds browser limits (Safari/Firefox ~5MB). Users never warned before failures.
**Fix**: Change to 4MB

```typescript
const DEFAULT_QUOTA_WARNING_BYTES = 4 * 1024 * 1024; // 4MB for safer default
```

---

### 10. Retain Questions When Embeddings Fail
**File**: `convex/aiGeneration.ts:320-345`
**Issue**: Failed embedding → question never pushed to array → lost entirely
**Impact**: Breaks graceful degradation, leaks user content
**Fix**: Push question without embedding in catch block

```typescript
if (result.status === 'rejected') {
  const question = batch[index];
  logger.warn(/* ... */);
  questionsWithEmbeddings.push(question); // FIXED: Retain question
  embeddingFailureCount++;
}
```

---

## 📋 FOLLOW-UP (Post-Merge Cleanup)

- [ ] Delete `components/lab/config-manager.tsx.bak` (checked into repo)
- [ ] Fix markdown linting (code blocks missing language, bare URLs)
- [ ] Reorder `.env.example` (AI_MODEL before AI_PROVIDER)

---

# Question Generation Architecture

## Current Status: 1-Phase Learning Science Approach ✅

**Date Implemented**: 2025-11-01

**Architecture**: Single comprehensive prompt leveraging GPT-5 with high reasoning effort.

**Rationale**:
- 5-phase architecture caused information fragmentation across phases
- Quality issues: grammar errors, duplicates, missing content, unwanted complexity
- GPT-5 with high reasoning performs better with comprehensive single prompts
- Principle-based guidance (WHAT to achieve) vs procedural prescription (HOW to do it)

---

## Previous: 5-Phase Architecture with Bidirectional Self-Correction (Deprecated)

**Problem Identified**: Multi-phase separation caused information loss and contradictory instructions.

**Original Solution**: Separate concerns into 5 focused phases with explicit error detection and correction.

## Architecture

**Phase 1: Content Analysis** (gpt-5-mini, medium reasoning)
- Input: Raw user content
- Responsibility: Identify WHAT to test (atoms, synthesis opportunities)
- Output: Content classification, atomic knowledge units, count estimate
- Cognitive Load: LOW (single analytical task)

**Phase 2: Pedagogical Blueprint** (gpt-5, high reasoning)
- Input: Phase 1 content analysis
- Responsibility: Plan HOW to test (Bloom's levels, difficulty targets, misconceptions)
- Output: Taxonomy mapping, difficulty distribution, misconception list, question budget
- Cognitive Load: MEDIUM (strategic planning)

**Phase 3: Draft Generation** (gpt-5-mini, high reasoning)
- Input: Phase 1 + Phase 2 blueprints
- Responsibility: Generate questions following format rules (NO self-critique yet)
- Output: Draft questions array (may contain errors)
- Cognitive Load: MEDIUM-HIGH (generation only, no validation)

**Phase 4: Error Detection** (gpt-5-mini, medium reasoning)
- Input: Phase 3 draft questions
- Responsibility: Identify specific problems (cloze duplications, structural references, logic errors)
- Output: Error list with question IDs and fix instructions
- Cognitive Load: LOW-MEDIUM (validation only, no fixes yet)

**Phase 5: Refinement** (gpt-5-mini, high reasoning)
- Input: Phase 3 draft + Phase 4 error list
- Responsibility: Apply fixes for identified errors
- Output: Final corrected questions array
- Cognitive Load: MEDIUM (correction only)

## Phase 1: Content Analysis Prompt

### Implementation
- [x] Create `buildContentAnalysisPrompt(userInput: string)` in `promptTemplates.ts`
- [x] Focus on content type classification (enumerable/conceptual/mixed)
- [x] Extract atomic knowledge units
- [x] Identify synthesis opportunities
- [x] Estimate question count based on atoms
- [x] Keep output concise (no pedagogical planning yet - that's Phase 2)

### Output Structure
```
Content Type: [enumerable/conceptual/mixed]
Atomic Knowledge Units: [list or count]
Synthesis Opportunities: [brief list]
Estimated Question Count: [number]
```

## Phase 2: Pedagogical Blueprint Prompt

### Implementation
- [x] Create `buildPedagogicalBlueprintPrompt(contentAnalysis: string)` in `promptTemplates.ts`
- [x] Map atoms to Bloom's taxonomy levels (Remember/Understand/Apply/Analyze/Evaluate/Create)
- [x] Specify target Bloom's distribution (e.g., "70% Remember, 20% Understand, 10% Analyze")
- [x] Define difficulty calibration targets (40% easy, 40% medium, 20% hard)
- [x] Brainstorm 3-5 common misconceptions for distractor design
- [x] Calculate question budget with difficulty breakdown

### Output Structure
```
Bloom's Taxonomy Mapping:
- Remember: [% and examples]
- Understand: [% and examples]
- Apply: [% and examples]
- Analyze: [% and examples]

Difficulty Distribution:
- Easy: [count] questions
- Medium: [count] questions
- Hard: [count] questions

Common Misconceptions:
1. [misconception]
2. [misconception]
...

Question Budget: [total] questions ([breakdown by difficulty])
```

## Phase 3: Draft Generation Prompt

### Implementation
- [x] Create `buildDraftGenerationPrompt(contentAnalysis: string, blueprint: string)` in `promptTemplates.ts`
- [x] Use Phase 1 atoms and Phase 2 blueprint as context
- [x] Generate questions matching Bloom's levels from blueprint
- [x] Follow difficulty distribution from blueprint
- [x] Use misconceptions from blueprint for distractors
- [x] Apply cloze format for verbatim content
- [x] NO self-critique or error checking (defer to Phase 4)

### Output Format
```json
{
  "questions": [
    {
      "id": "q1",
      "question": "string",
      "type": "multiple-choice" | "true-false",
      "options": ["string", ...],
      "correctAnswer": "string",
      "explanation": "string",
      "bloomLevel": "Remember|Understand|Apply|Analyze|Evaluate|Create",
      "difficulty": "easy|medium|hard"
    }
  ]
}
```

## Phase 4: Error Detection Prompt

### Implementation
- [x] Create `buildErrorDetectionPrompt(draftQuestions: string)` in `promptTemplates.ts`
- [x] Check for cloze format errors (duplicated content in stem and answer)
- [x] Check for structural references ("line 11", "stanza 2", "verse 3")
- [x] Check for meta-answers ("all of the above", "none of the above")
- [x] Check for broken logic (question doesn't make sense)
- [x] Check for missing source context ("In [Source]...")
- [x] Check for schema compliance (type field, option count)
- [x] NO fixes - only identify problems

### Output Format
```json
{
  "errors": [
    {
      "questionId": "q3",
      "errorType": "cloze_duplication",
      "description": "The phrase 'us in battle' appears in both the question stem after the blank AND in the correct answer, causing duplication.",
      "suggestion": "Remove 'us in battle' from question stem, keep only in answer."
    }
  ]
}
```

### Explicit Error Detection Rules
- **Cloze Duplication**: Text after blank in question stem MUST NOT appear in answer
- **Structural References**: Answers must be content, not locations (forbid "line X", "stanza Y")
- **Meta-Answers**: Forbid "all of the above", "none of the above", "both A and B"
- **Missing Context**: Every question must start with "In [Source Title],"
- **Schema Violations**: type must be exactly "multiple-choice" or "true-false"
- **Option Count**: Multiple-choice must have exactly 4 options, true-false exactly 2

## Phase 5: Refinement Prompt

### Implementation
- [x] Create `buildRefinementPrompt(draftQuestions: string, errors: string)` in `promptTemplates.ts`
- [x] Take Phase 3 draft and Phase 4 error list as input
- [x] Apply fixes for each identified error
- [x] Preserve questions that had no errors
- [x] Return final corrected questions array
- [x] NO new error detection (trust Phase 4)

### Output Format
```json
{
  "questions": [
    {
      "id": "q1",
      "question": "string",
      "type": "multiple-choice" | "true-false",
      "options": ["string", ...],
      "correctAnswer": "string",
      "explanation": "string"
    }
  ]
}
```

## Execution Module Updates

### Update convex/lab.ts
- [x] Support 5 phases in `executeConfig` action
- [x] Phase 1-2: Use `generateText` (text output)
- [x] Phase 3-5: Use `generateObject` with appropriate schemas
- [x] Store intermediate outputs in context for next phase
- [x] Log token usage for each phase

### Update convex/aiGeneration.ts
- [x] Implement 5-phase flow in `processJob` action
- [x] Phase 1: Content Analysis → text
- [x] Phase 2: Pedagogical Blueprint → text
- [x] Phase 3: Draft Generation → object (with bloomLevel, difficulty metadata)
- [x] Phase 4: Error Detection → object (error list)
- [x] Phase 5: Refinement → object (final questions)
- [x] Update progress tracking (5 phases instead of 2)

### Update PROD_CONFIG_METADATA
- [x] Document 5-phase architecture
- [x] Specify model for each phase:
  - Phase 1: gpt-5-mini, medium reasoning
  - Phase 2: gpt-5, high reasoning
  - Phase 3: gpt-5-mini, high reasoning
  - Phase 4: gpt-5-mini, medium reasoning
  - Phase 5: gpt-5-mini, high reasoning

## Testing Strategy

### Manual Testing via Genesis Lab UI
Use the Genesis Lab UI (http://localhost:3000/lab) to test the 5-phase architecture:
- PRODUCTION config now uses 5-phase architecture
- Test with various content types (verbatim, conceptual, mixed)
- Inspect intermediate phase outputs in execution logs
- Iterate on prompts directly in UI

### Quality Validation (Manual)
Test with real content to verify quality improvements:
- [ ] "St Michael prayer" (verbatim) - Should fix Q3 cloze duplication
- [ ] "Shakespeare's Sonnet 18" (verbatim) - Should have proper cloze format
- [ ] "React useState Hook" (conceptual) - Should have no structural references
- [ ] "Lord's Prayer" (mixed) - Should handle both verbatim and conceptual

### Success Criteria
- ✅ Zero cloze duplication errors (Q3 type)
- ✅ Zero structural references in answers ("line 11", etc.)
- ✅ Zero meta-answers ("all of the above")
- ✅ 100% source context in questions ("In [Source],...")
- ✅ Schema compliance (correct type strings, option counts)
- ✅ Bloom's taxonomy adherence from Phase 2 blueprint
- ✅ Difficulty distribution matches Phase 2 targets ±10%

## Cost Analysis

**Current (2-phase)**:
- Phase 1: gpt-5-mini, medium (~2K tokens)
- Phase 2: gpt-5-mini, high (~15K tokens)
- **Total**: ~17K tokens (all gpt-5-mini)

**Proposed (5-phase)**:
- Phase 1: gpt-5-mini, medium (~2K tokens)
- Phase 2: gpt-5, high (~3K tokens)
- Phase 3: gpt-5-mini, high (~12K tokens)
- Phase 4: gpt-5-mini, medium (~5K tokens)
- Phase 5: gpt-5-mini, high (~8K tokens)
- **Total**: ~30K tokens (3K gpt-5, 27K gpt-5-mini)

**Cost Increase**: ~75% (mostly from Phase 4 & 5 validation/correction overhead)

**Quality ROI**: Eliminates logic errors, proper self-correction, pedagogically grounded questions

## Implementation Timeline

**Week 1: Prompt Templates** ✅ COMPLETED
- ✅ Day 1-2: Implement Phase 1-3 prompts
- ✅ Day 3: Implement Phase 4 error detection with explicit rules
- ✅ Day 4: Implement Phase 5 refinement
- [ ] Day 5: Test all 5 phases in isolation

**Week 2: Execution Modules** ← CURRENT PHASE
- ✅ Day 1-2: Update `convex/lab.ts` for 5-phase execution
- ✅ Day 3-4: Update `convex/aiGeneration.ts` for 5-phase flow
- [ ] Day 5: Integration testing in Genesis Lab

**Week 3: Validation & Rollout**
- Day 1-2: Regression testing with test cases
- Day 3: Compare quality metrics vs 2-phase baseline
- Day 4: Document findings, adjust prompts if needed
- Day 5: Deploy to production if metrics improve

## Future Enhancements

- [ ] Add Phase 4 confidence scores for each error
- [ ] Track error detection rates (what % of errors caught)
- [ ] Add Phase 6: Final quality assurance (optional verification pass)
- [ ] Implement adaptive phase selection (skip Phase 4-5 if Phase 3 is perfect)
- [ ] Add caching for Phase 1-2 (reuse for similar content)

## Notes

**Design Philosophy**:
- Separation of concerns (each phase does ONE thing well)
- Bidirectional correction (Phase 4 → Phase 5 feedback loop)
- Explicit error detection rules (not just "self-critique")
- Defer validation to Phase 4 (don't overload Phase 3 with simultaneous generation + critique)

**Key Insight from Q3 Failure**:
When an LLM has 6+ simultaneous constraints to satisfy (generate + validate + format + match distribution + design distractors + critique), basic logic errors slip through. Breaking into focused phases reduces cognitive load and improves reliability.
