# TODO: Pedagogically-Enhanced Question Generation

## Phase 1: Prompt Improvements (Learning Science Foundation)

### Budget Guidance Enhancement
- [ ] Add "QUESTION BUDGET DISCIPLINE" section to `buildIntentClarificationPrompt()` in `convex/lib/promptTemplates.ts`
  - Rule: 1 question per enumerable atom (lines, list items)
  - Rule: 1-2 questions per simple concept (definitions, facts)
  - Rule: 2-3 questions per complex concept (systems, frameworks) from different angles
  - Rule: Reserve 15-20% for synthesis questions (multiple atoms together)
  - Instruction: "State your question budget target based on atom count and complexity"
  - Success criteria: Phase 1 output should include explicit total question estimate (e.g., "Target: 18-22 questions")

### Format Matching Rules
- [ ] Add "FORMAT SELECTION BY CONTENT TYPE" section to `buildQuestionPromptFromIntent()` in `convex/lib/promptTemplates.ts`
  - Rule: Verbatim content (poems, prayers, speeches, lists) → CLOZE DELETION format
  - Template for cloze: "In [Source], complete: '[prefix] ___________?'" with actual content as answer
  - Rule: Conceptual content → multiple-choice or true/false
  - Example: Cloze for poetry - Answer: "summer's day", NOT "line 3"
  - Success criteria: Generated questions for poems/prayers should be 80%+ cloze format

### Standalone Context Injection
- [ ] Add "EVERY QUESTION MUST BE STANDALONE" section to `buildQuestionPromptFromIntent()` in `convex/lib/promptTemplates.ts`
  - Rule: Extract source title/identifier from user input in Phase 1
  - Rule: Prepend "In [Source Title], ..." to EVERY question stem
  - Provide good/bad examples in prompt
  - Success criteria: 100% of generated questions should contain source context in stem

### Content-Level Answer Enforcement
- [ ] Add "FORBIDDEN ANSWER TYPES" section to `buildQuestionPromptFromIntent()` in `convex/lib/promptTemplates.ts`
  - Forbidden: Structural references ("line 11", "stanza 2", "verse 3")
  - Forbidden: Meta-answers ("the third option", "both A and B")
  - Rule: ALWAYS use actual content as answers for verbatim memorization
  - Emphasis: "Test the WORDS, not the location"
  - Success criteria: Zero questions with structural reference answers in generated sets

### Budget Enforcement
- [ ] Add "RESPECT QUESTION BUDGETS FROM PHASE 1" section to `buildQuestionPromptFromIntent()` in `convex/lib/promptTemplates.ts`
  - Rule: Use Phase 1's question budget target as generation limit
  - Rule: If testing "different angles", ensure angles are truly semantically distinct
  - Rule: Synthesis questions must require multiple atoms, not restate single atoms
  - Success criteria: Generated question count should be within ±20% of Phase 1 budget estimate

## Phase 2: Testing and Validation

### Genesis Lab Test Cases
- [ ] Create test input: "Shakespeare's Sonnet 18" (full text) in Genesis Lab
  - Expected: 14-16 questions (14 lines + 2 synthesis)
  - Expected: 80%+ cloze deletion format
  - Expected: All questions contain "In Shakespeare's Sonnet 18"
  - Expected: Zero "line N" answers
  - Success criteria: Manual review confirms all expectations met

- [ ] Create test input: "React useState Hook Documentation" (conceptual excerpt) in Genesis Lab
  - Expected: 8-12 questions (not 30+)
  - Expected: Multiple-choice format
  - Expected: All questions contain "In React Hooks documentation" or similar context
  - Success criteria: Question count reasonable for content complexity

- [ ] Create test input: "Lord's Prayer" (verbatim prayer) in Genesis Lab
  - Expected: 10-15 questions (phrases as atoms)
  - Expected: 80%+ cloze deletion format
  - Expected: All questions contain "In the Lord's Prayer"
  - Expected: Answers are actual prayer text, not structural references
  - Success criteria: Manual review confirms verbatim recall testing quality

### Baseline Comparison
- [ ] Document current PROD config performance before changes
  - Run all 3 test cases through current PROD config in Genesis Lab
  - Record: question count, format distribution, standalone context %, structural answers count
  - Save results as baseline in Genesis Lab
  - Success criteria: Baseline metrics documented for comparison

- [ ] Create experimental config with new prompts in Genesis Lab
  - Copy PROD config, name "Enhanced Pedagogical (Experimental)"
  - Apply all prompt improvements from Phase 1
  - Run same 3 test cases
  - Success criteria: Can compare experimental vs baseline side-by-side

### Quality Assessment
- [ ] Analyze experimental config results vs baseline
  - Metric 1: Question count reduction (target: 30-40% fewer questions)
  - Metric 2: Cloze format % for verbatim content (target: 80%+)
  - Metric 3: Standalone context presence (target: 100%)
  - Metric 4: Structural answer elimination (target: 0 instances)
  - Document findings in Genesis Lab notes or temporary markdown file
  - Success criteria: All 4 targets met or clear path to iteration identified

## Phase 3: Production Rollout

- [ ] Update `PROD_CONFIG_METADATA` in `convex/lib/promptTemplates.ts`
  - Add comment documenting pedagogical principles behind prompt design
  - Reference: learning science foundations (distributed practice, format matching, interleaved practice)
  - Success criteria: Future maintainers understand WHY prompts are structured this way

- [ ] Update Genesis Lab to refresh PROD config with new prompts
  - PROD config auto-updates on lab mount from `createProdConfig()`
  - Verify: Opening Genesis Lab shows updated PROD prompts
  - Success criteria: Genesis Lab PROD baseline reflects production prompts

## Documentation

- [ ] Add inline comments to prompt template functions explaining pedagogical rationale
  - `buildIntentClarificationPrompt()`: Explain budget discipline prevents duplicates
  - `buildQuestionPromptFromIntent()`: Explain each of 4 rule sections
  - Link to learning science principles where applicable (distributed practice, desirable difficulty)
  - Success criteria: Prompt code is self-documenting for future modifications

- [ ] Update `CLAUDE.md` in project root with question generation quality guidelines
  - Add section: "Question Generation Philosophy"
  - Document: Format matching principle (verbatim → cloze, conceptual → MCQ)
  - Document: Standalone context requirement for interleaved practice
  - Document: Budget discipline for distributed practice
  - Success criteria: New contributors understand quality standards
