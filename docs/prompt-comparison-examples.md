# Prompt Enhancement: Before & After Comparison

This document shows the key differences between the old counting-based approach and the new atomicity-first approach.

---

## Step 1: Intent Clarification

### BEFORE (Counting-Based)

```markdown
You are an educational strategist translating raw learner input into a clear, actionable study plan.

Produce a natural description that:
- Corrects any obvious wording/term issues in passing.
- Expands shorthand and clarifies intent.
- States the target in your own words, then sketches a compact "study map" at three tiers:
  • Foundations: essential terms/facts/conventions
  • Applications: problems/tasks they should be able to handle
  • Extensions: deeper or adjacent ideas worth knowing if time allows
- Right-size the plan with concrete question counts:
  • Single fact (e.g., "capital of France") → 2-4 questions
  • Small list (e.g., "primary colors" - 3 items) → 6-9 questions
  • Medium list (e.g., "NATO alphabet" - 26 items) → 30-40 questions
  • Multiple lists (e.g., "deadly sins + virtues" - 14 items) → 20-30 questions
  • Broad topic (e.g., "React hooks") → 20-35 questions

For enumerable lists: Plan roughly 1-1.5 questions per item (recognition + recall).
For broad topics: Focus on core concepts, common patterns, and key distinctions.

Keep it human and concise (2–4 short paragraphs).
```

**Problems:**
- ❌ Focus on hitting a number range
- ❌ No explicit atomic analysis
- ❌ Same heuristic for all content types
- ❌ No synthesis planning
- ❌ Vague guidance for complex content

### AFTER (Atomicity-First)

```markdown
You are an expert educational assessment designer analyzing content for comprehensive mastery testing.

TASK: Identify what someone needs to know to demonstrate mastery of this content.

ATOMIC ANALYSIS - Choose the appropriate approach:

📋 For ENUMERABLE content (poems, lists, prayers, alphabets, sequential passages):
List every discrete element that must be learned.
Examples:
• "Sonnet 18" → Line 1, Line 2, Line 3, ... Line 14 (14 line atoms)
• "NATO alphabet" → A→Alfa, B→Bravo, C→Charlie, ... Z→Zulu (26 pair atoms)
• "Lord's Prayer" → Phrase 1, Phrase 2, ... (N phrase atoms)

🧠 For CONCEPTUAL content (theories, systems, skills, frameworks):
Identify the key testable facets of each concept.
Examples:
• "useState hook" → Core atoms: purpose, syntax, return values, re-render rules, constraints, common mistakes (6 facets)
• "Photosynthesis" → Core atoms: definition, location, inputs, outputs, light reactions, Calvin cycle, equation (7 facets)

🔀 For MIXED content:
Identify both enumerable elements AND conceptual facets.
Example: "React hooks" → 8 enumerable hooks (useState, useEffect, etc.) × 5-6 facets each

SYNTHESIS OPPORTUNITIES:
Beyond individual atoms, what connections/integrations should be tested?
• Relationships between atoms (how X relates to Y)
• Sequential/causal dependencies (X must happen before Y)
• System-level understanding (how parts form the whole)
• Practical applications (using multiple atoms together)

OUTPUT STRUCTURE:
Clearly state:
1. What type of content this is (enumerable/conceptual/mixed)
2. The atomic knowledge units (list them or state the count if large)
3. Synthesis opportunities (key connections to test)
4. Testing strategy: How many questions per atom? How many synthesis questions?
```

**Improvements:**
- ✅ Explicit atomic analysis framework
- ✅ Content-type classification
- ✅ Clear enumeration for poems/lists
- ✅ Facet identification for concepts
- ✅ Synthesis planning
- ✅ Testing strategy based on atom types

---

## Step 2: Question Generation

### BEFORE (Counting-Based)

```markdown
You are a master tutor creating a practice set directly from this goal:

---
${clarifiedIntent}
---

Produce a set of questions that, if mastered, would make the learner confident they've covered what matters.

CRITICAL COUNTING GUIDANCE:
First, count what needs coverage. Then generate questions.

Aim for roughly 1-1.5 questions per item for enumerable lists.
Quality over quantity - focused coverage beats exhaustive repetition.

Examples:
• "Primary colors" (3 items) → 6-9 questions
• "NATO alphabet" (26 letters) → 30-40 questions
• "Deadly sins + heavenly virtues" (14 items) → 20-30 questions
• "React hooks" (~10 core hooks) → 20-35 questions

For enumerable lists, vary question types:
- Recognition: "Which of these is X?"
- Recall: "What is the X for Y?"
- Application: "Which X applies here?"
- Contrast: "How does X differ from Y?"

Vary form with purpose:
  • Multiple-choice (exactly 4 options) when you can write distinct, plausible distractors
  • True/False (exactly "True","False") for crisp claims or quick interleaving checks.
- Order items so the learner warms up, then stretches.
- For every item, include a short teaching explanation

Return only the questions, answers, and explanations (no extra commentary).
```

**Problems:**
- ❌ Still focused on hitting number ranges
- ❌ No explicit coverage verification
- ❌ Unclear how to handle complex concepts
- ❌ No synthesis requirement
- ❌ Question types mixed with counting guidance

### AFTER (Atomicity-First)

```markdown
You are a master tutor creating a comprehensive mastery assessment.

ANALYSIS FROM STEP 1:
---
${clarifiedIntent}
---

The analysis identified atomic knowledge units and synthesis opportunities.

YOUR TASK: Generate questions ensuring EVERY atom is thoroughly tested.

GENERATION STRATEGY:

1️⃣ ATOMIC QUESTIONS - For each atom identified:

📋 Discrete atoms (lines, items, list elements, facts):
→ Generate 1-2 questions per atom (recognition + recall)
→ Examples:
  • Line testing: "What comes after [line N]?" + "What is line [N+1]?"
  • List items: "What letter is Charlie?" + "What is C in NATO alphabet?"
  • Facts: "What is X?" + "Which of these is X?"

🧠 Conceptual atoms (ideas, mechanisms, principles, facets):
→ Generate 2-4 questions per atom (test from multiple angles)
→ Examples:
  • Understanding: "What does X do?"
  • Application: "When would you use X?"
  • Edge cases: "What happens if X in situation Y?"
  • Common mistakes: "Why is Z wrong when using X?"

Test each atom from different angles:
- Recall: "What is X?"
- Recognition: "Which is X?"
- Application: "How/when to use X?"
- Analysis: "Why does X work this way?"
- Comparison: "How does X differ from Y?"

2️⃣ SYNTHESIS QUESTIONS (15-20% of total):
For the connections/integrations identified in the analysis:
→ Integration: "How does atom A connect to atom B?"
→ Sequential: "What's the relationship between X and Y?"
→ Application: "Apply atoms X, Y, Z together to solve..."
→ System-level: "How do the parts form the whole?"
→ Comparison: "Compare and contrast X and Y"

COVERAGE REQUIREMENTS:
✓ Every atom from the analysis has questions
✓ Atoms tested from appropriate angles (1-2 for discrete, 2-4 for concepts)
✓ Synthesis questions included (15-20% of total)
✓ No redundancy - same knowledge tested from different angles is good, identical questions is bad
✓ No gaps - every atom must be covered

QUESTION QUALITY:
- Multiple-choice: Exactly 4 options with distinct, plausible distractors reflecting real confusions
- True/False: Exactly 2 options ["True", "False"] for crisp, unambiguous claims
- Order questions from simpler to more complex (warm up, then stretch)
- Every question includes explanation addressing: why correct, why wrong options are wrong, common misconception to avoid

FINAL CHECK:
Could someone answer all these questions correctly yet still lack mastery?
- If YES: You have gaps, add missing questions
- If NO: Coverage is complete

Generate the questions now. Return only the questions array (no extra commentary).
```

**Improvements:**
- ✅ References Step 1 atomic analysis
- ✅ Clear generation strategy per atom type
- ✅ Explicit synthesis requirement (15-20%)
- ✅ Coverage checklist
- ✅ Quality verification gate
- ✅ Multiple testing angles per atom
- ✅ No arbitrary number targets

---

## Example Output Comparison

### Input: "Memorize Shakespeare's Sonnet 18"

#### BEFORE (Counting-Based Step 1 Output)

```
The learner wants to memorize Shakespeare's Sonnet 18, a 14-line poem.

Foundations: The 14 lines of the sonnet, basic vocabulary and phrasing.
Applications: Ability to recite the sonnet from memory, understand the metaphors.
Extensions: Understanding of Shakespearean sonnet structure, literary devices used.

For a 14-line poem, we should plan roughly 1-1.5 questions per line for memorization:
14 lines × 1.5 = 21 questions, plus a few for structure and theme = 20-28 questions total.

This should provide comprehensive coverage of the sonnet for memorization purposes.
```

**Issues:**
- ✓ Gets to ~20-28 questions (decent)
- ❌ No atomic enumeration
- ❌ Vague on testing strategy
- ❌ No synthesis planning

#### AFTER (Atomicity-First Step 1 Output)

```
Content Type: ENUMERABLE (poem with sequential lines)

Atomic knowledge units:
📋 Sequential atoms (14 line atoms):
- Line 1: "Shall I compare thee to a summer's day?"
- Line 2: "Thou art more lovely and more temperate:"
- Line 3: "Rough winds do shake the darling buds of May,"
[... lines 4-14 ...]

🧠 Structural/conceptual atoms:
- Rhyme scheme (ABAB CDCD EFEF GG)
- Sonnet structure (3 quatrains + couplet)
- Central metaphor (comparison to summer)
- Volta/turn (shift at line 9: "But thy eternal summer...")
- Theme (eternal beauty through poetry)

Synthesis opportunities:
- How the quatrains build the argument
- Relationship between volta and conclusion
- How rhyme scheme reinforces structure
- Connection between metaphor and theme

Testing strategy:
- 14 line atoms × 1.5-2 questions = 21-28 line questions
  • Line completion: "What comes after...?"
  • Line recall: "What is line N?"
  • Location: "Which line contains...?"
- 5-7 structural/conceptual questions
- 3-4 synthesis questions (argument flow, thematic unity)

Total: 29-39 questions for comprehensive mastery
```

**Improvements:**
- ✅ Explicit line enumeration
- ✅ Structural concepts identified
- ✅ Clear synthesis opportunities
- ✅ Detailed testing strategy
- ✅ Higher question count (more thorough)

---

### Input: "Teach me React hooks"

#### BEFORE (Counting-Based Step 1 Output)

```
The learner wants to understand React hooks, the modern way to use state and lifecycle features in functional components.

Foundations: Core hooks (useState, useEffect, useContext), basic syntax and usage.
Applications: Using hooks to manage state, handle side effects, access context in real components.
Extensions: Advanced hooks (useReducer, useCallback, useMemo, useRef), custom hooks, best practices.

React has roughly 10 core hooks. At 2-3.5 questions per hook:
10 hooks × 3 = 30 questions, plus integration and patterns = 30-40 questions total.

This covers the essential hooks comprehensively.
```

**Issues:**
- ✓ Reasonable estimate (30-40)
- ❌ Doesn't identify facets per hook
- ❌ Vague on "integration and patterns"
- ❌ Treats all hooks as equal complexity

#### AFTER (Atomicity-First Step 1 Output)

```
Content Type: MIXED (8 enumerable hooks, each with multiple conceptual facets)

Atomic knowledge units:
🔀 Enumerable hooks (8 core hooks):
1. useState
2. useEffect
3. useContext
4. useReducer
5. useCallback
6. useMemo
7. useRef
8. Custom hooks

🧠 Conceptual facets per hook (example: useState):
- Purpose: Managing state in function components
- Syntax: const [state, setState] = useState(initialValue)
- Return values: [current state, updater function]
- Re-render behavior: Calling setState triggers re-render
- Functional updates: setState(prev => prev + 1)
- Constraints: Must be called at top level, same order every render
- Common mistakes: Mutating state directly, closure issues

Similar facets for each hook (5-7 facets each).

Synthesis opportunities:
- When to use useState vs useReducer
- useEffect + useContext patterns
- useCallback + useMemo performance optimization
- Rules of hooks (why they exist, how to follow them)
- Custom hook composition patterns
- Common anti-patterns across hooks

Testing strategy:
- 8 hooks × 4-5 facet questions = 32-40 hook-specific questions
  • Purpose: "What does X do?"
  • Syntax: "What does X return?"
  • Behavior: "When does X trigger re-render?"
  • Edge cases: "What happens if...?"
  • Mistakes: "Why is this wrong?"
- 6-8 synthesis questions
  • Hook selection: "When to use X vs Y?"
  • Composition: "How to combine X and Y?"
  • Rules: "Why must hooks be at top level?"
  • Patterns: "What's the data fetching pattern?"

Total: 38-48 questions for comprehensive mastery
```

**Improvements:**
- ✅ Each hook enumerated
- ✅ Facets identified (7 per hook)
- ✅ Specific synthesis opportunities
- ✅ Question types per facet
- ✅ More thorough coverage

---

## Key Takeaways

### Counting-Based Approach
- Starts with number ranges
- Works backward from counts to content
- Question count is the goal
- Generic guidance for all content

### Atomicity-First Approach
- Starts with atomic analysis
- Works forward from atoms to questions
- Comprehensive coverage is the goal
- Content-specific strategies

### Result
- ✅ More accurate question counts
- ✅ Better coverage of complex content
- ✅ Clear synthesis integration
- ✅ Foundation for knowledge graphs
- ✅ Alignment with learning science
