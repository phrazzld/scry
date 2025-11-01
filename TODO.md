# TODO: 5-Phase Question Generation with Self-Correction

## Overview

Implementing **5-Phase Architecture with Bidirectional Self-Correction** to fix quality issues (e.g., Q3 cloze duplication error).

**Problem Identified**: Current 2-phase prompt has too many simultaneous responsibilities, causing cognitive overload and logic errors.

**Solution**: Separate concerns into 5 focused phases with explicit error detection and correction.

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

### Genesis Lab Incremental Testing
- [ ] Test Phase 1 alone: Verify content analysis output
- [ ] Test Phase 1+2: Verify pedagogical blueprint
- [ ] Test Phase 1+2+3: Verify draft questions (expect errors like Q3)
- [ ] Test Phase 1+2+3+4: Verify error detection catches Q3 cloze duplication
- [ ] Test Phase 1+2+3+4+5: Verify final output has no Q3-style errors

### Regression Testing
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
