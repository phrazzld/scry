# Atomicity-First Question Generation

**Status:** Implemented
**Date:** 2025-01-04
**Author:** System Design Team

---

## Overview

We've enhanced the question generation system to focus on **atomic concept coverage** rather than arbitrary question counts. This ensures comprehensive mastery testing across diverse content types.

## Core Philosophy

**Before:** "Count units → estimate questions → hit the number"
**After:** "Identify atoms → test each thoroughly → coverage emerges"

### Key Principles

1. **Atomicity is primary** - Question count is a natural consequence of thorough atomic coverage
2. **Content-aware strategies** - Different approaches for enumerable vs conceptual content
3. **Comprehensive testing** - Every atom tested from appropriate angles
4. **Synthesis questions** - 15-20% of questions test connections between atoms
5. **Natural language reasoning** - Let the model reason about coverage, structure only final output

## Implementation

### Step 1: Atomic Analysis

The clarification prompt now explicitly asks the model to:

1. **Classify content type:**
   - 📋 Enumerable (poems, lists, prayers, alphabets)
   - 🧠 Conceptual (theories, systems, skills)
   - 🔀 Mixed (both enumerable and conceptual)

2. **Identify atomic units:**
   - Enumerable: List every discrete element
   - Conceptual: Identify key testable facets
   - Mixed: Both

3. **Plan synthesis:**
   - Relationships between atoms
   - Sequential/causal dependencies
   - System-level understanding

4. **Propose testing strategy:**
   - How many questions per atom type
   - How many synthesis questions
   - Reasoning for the approach

### Step 2: Comprehensive Generation

The generation prompt now ensures:

1. **Atomic coverage:**
   - Discrete atoms: 1-2 questions (recognition + recall)
   - Conceptual atoms: 2-4 questions (multiple angles)

2. **Multiple testing angles:**
   - Recall, recognition, application, analysis, comparison

3. **Synthesis questions:**
   - 15-20% of total
   - Test connections and integration

4. **Coverage verification:**
   - Every atom has questions
   - No redundancy (same thing tested identically)
   - No gaps (atoms without coverage)

5. **Quality check:**
   - "Could someone answer all these correctly yet lack mastery?"
   - If yes, add missing questions

## Expected Outcomes

### Enumerable Content Example: Sonnet 18 (14 lines)

**Atomic Analysis:**
- Content type: Enumerable (poem)
- Atoms: 14 lines + structural elements (rhyme scheme, theme, volta)
- Strategy: 1.5-2 questions per line + synthesis

**Expected Questions:**
- 21-28 line questions (line completion, recall, location)
- 4-6 synthesis questions (structure, theme, literary devices)
- **Total: 25-34 questions**

**Quality:**
- Every line tested
- Structural understanding verified
- Theme and technique covered

### Conceptual Content Example: React Hooks

**Atomic Analysis:**
- Content type: Mixed (8 enumerable hooks, each with 5-6 conceptual facets)
- Atoms: useState, useEffect, useContext, useReducer, useCallback, useMemo, useRef, custom hooks
- Facets per hook: purpose, syntax, behavior, rules, common mistakes
- Strategy: 3-5 questions per hook + patterns/rules synthesis

**Expected Questions:**
- 24-40 hook-specific questions (covering facets)
- 5-8 synthesis questions (hook composition, when to use which, rules)
- **Total: 29-48 questions**

**Quality:**
- All hooks covered from multiple angles
- Edge cases and gotchas included
- Patterns and best practices tested

### Enumerable List Example: NATO Alphabet (26 items)

**Atomic Analysis:**
- Content type: Enumerable (paired list)
- Atoms: 26 letter-word pairs
- Strategy: 1.5 questions per pair (both directions) + usage context

**Expected Questions:**
- 36-42 pairing questions (A→Alfa, Alfa→A, variations)
- 3-5 context questions (when/why used, spelling rationale)
- **Total: 39-47 questions**

**Quality:**
- All pairs tested bidirectionally
- Contextual understanding verified
- Practical application covered

## Benefits

### For Learning Outcomes

- ✅ **Comprehensive coverage** - No knowledge gaps
- ✅ **Atomic mastery** - Each concept thoroughly tested
- ✅ **Integration testing** - Connections verified
- ✅ **Appropriate depth** - Content-aware difficulty

### For Knowledge Graph Integration

- ✅ **Natural concept tagging** - Questions explicitly linked to atoms
- ✅ **Foundation ready** - Atomic structure supports mastery propagation
- ✅ **Coverage tracking** - Can verify which atoms a user has mastered
- ✅ **Synthesis identification** - Integration questions clearly marked

### For User Experience

- ✅ **Right-sized question sets** - Not too few, not too many
- ✅ **Content-appropriate** - Poems handled differently than concepts
- ✅ **Transparent reasoning** - Step 1 analysis explains the approach
- ✅ **Quality consistency** - Every atom gets appropriate coverage

## Technical Details

### Files Modified

1. **lib/ai-client.ts**
   - `buildIntentClarificationPrompt()` - Enhanced with atomic analysis framework
   - `buildQuestionPromptFromIntent()` - Enhanced with coverage requirements
   - `generateQuestionsDirectly()` - Fallback uses same atomic approach

2. **convex/aiGeneration.ts**
   - Same prompt functions updated to match

### Prompt Engineering Techniques

1. **Clear categorization** - Emoji-based content type markers (📋 🧠 🔀)
2. **Concrete examples** - Multiple examples per content type
3. **Explicit requirements** - Checklist-style coverage verification
4. **Quality gates** - Final check question before generation
5. **Natural reasoning** - Prose output from Step 1, structured output only for final questions

### Respecting the Bitter Lesson

We deliberately avoided:
- ❌ JSON schemas for intermediate steps
- ❌ Rigid counting formulas
- ❌ Programmatic heuristics
- ❌ Over-prescriptive structures

We embraced:
- ✅ Natural language reasoning
- ✅ Model judgment for coverage
- ✅ Flexible adaptation to content
- ✅ Structure only where necessary (final output)

## Testing & Validation

### Manual Testing Checklist

Test the system with:

1. **Short poem** (e.g., "Memorize 'The Road Not Taken' by Robert Frost")
   - Expect: ~20-35 questions (20 lines × 1.5 + synthesis)
   - Verify: All lines covered, structure/theme tested

2. **Technical concept** (e.g., "Teach me Promise.all vs Promise.race")
   - Expect: ~15-25 questions (2 concepts × 4-5 facets + comparison)
   - Verify: Both concepts covered, comparison questions included

3. **Large list** (e.g., "NATO phonetic alphabet")
   - Expect: ~40-50 questions (26 pairs × 1.5 + context)
   - Verify: All pairs tested, bidirectional coverage

4. **Prayer/liturgical** (e.g., "Lord's Prayer")
   - Expect: ~15-25 questions (phrases + meaning + context)
   - Verify: Sequential coverage, understanding verified

5. **Mixed content** (e.g., "React hooks")
   - Expect: ~30-50 questions (8 hooks × 3-5 facets + patterns)
   - Verify: All hooks covered, composition tested

### Success Criteria

- ✅ 90%+ accurate content type detection
- ✅ Question counts match atomic unit analysis
- ✅ Comprehensive coverage of all identified units
- ✅ Synthesis questions present (15-20% of total)
- ✅ No user complaints about gaps or excessive redundancy

## Future Enhancements

### Phase 2: Concept Tagging (Ready for Implementation)

The atomic analysis provides natural tags for knowledge graph:
```typescript
{
  questionId: "q123",
  atoms: ["Sonnet 18 line 3", "iambic pentameter", "Shakespearean sonnet"],
  atomTypes: ["sequential-content", "conceptual", "conceptual"],
  synthesisOf: ["Sonnet 18 line 2", "Sonnet 18 line 3"] // if synthesis question
}
```

### Phase 3: Mastery Propagation

With atomic tagging:
- User masters "Sonnet 18 line 3" → boost other Shakespearean sonnet questions
- User masters "useState hook" → boost other React state management questions
- Sequential content (poem lines) → no propagation within same poem

### Phase 4: Adaptive Generation

Learn from usage patterns:
- Track: content type → actual question count → user satisfaction
- Refine: atomic unit identification accuracy
- Personalize: per-user coverage preferences

## Conclusion

The atomicity-first approach shifts focus from **hitting a number** to **ensuring mastery**. By letting the model reason naturally about atomic units and comprehensive coverage, we get:

- Better question quality
- Appropriate question counts for diverse content
- Foundation for knowledge graph integration
- Alignment with learning science

The question count is no longer a target—it's a natural outcome of thorough atomic coverage.
