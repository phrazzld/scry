/**
 * Shared Prompt Templates
 *
 * Single source of truth for production question generation prompts.
 * Used by both production generation (aiGeneration.ts) and Genesis Laboratory.
 *
 * ARCHITECTURE: 1-Phase Learning Science Approach
 * - Leverages GPT-5 with high reasoning effort
 * - Principle-based guidance, not procedural prescription
 * - Trusts model intelligence to determine optimal strategy per content type
 *
 * NOTE: Reasoning models (GPT-5/O1/O3) perform best with:
 * - Simple, direct task descriptions
 * - Clear principles and objectives
 * - NO chain-of-thought prompts ("think step by step")
 * - NO few-shot examples (degrades performance)
 * - Trust over prescription
 */

/**
 * Learning Science Prompt - Single Phase
 *
 * Comprehensive prompt incorporating all learning science principles
 * for effective spaced repetition flashcard generation.
 *
 * Used by: Production question generation (gpt-5, high reasoning, high verbosity)
 */
export function buildLearningSciencePrompt(userInput: string): string {
  return `# Task
Generate spaced repetition flashcards that maximize long-term retention and deep understanding.

# Learning Science Principles

## 1. Intent Analysis
Analyze the user's learning objectives from their input:
- **Content type**: verbatim text, conceptual knowledge, procedural skill, factual data, etc.
- **Learning goal**: exact recall, flexible application, pattern recognition, etc.
- **Appropriate cognitive load** for this material

## 2. Atomicity
Each flashcard tests ONE retrievable unit:
- Avoid compound questions bundling multiple facts
- Questions requiring multi-step reasoning should have a single clear answer
- Break complex content into meaningful, independently-recallable chunks

## 3. Desirable Difficulty
Challenge enough for effortful retrieval, not so hard it's demotivating:
- **Verbatim content**: Test exact recall where precision matters, paraphrased recognition where it doesn't
- **Conceptual content**: Test understanding through application/transfer, not just definition regurgitation
- **Procedural content**: Test reasoning behind steps, not just sequence

## 4. Question Type Appropriateness

**For Verbatim Memorization (prayers, poems, quotes, definitions):**
- Test sequential recall line-by-line or phrase-by-phrase
- Q1: "What is the first line/phrase of [text]?"
- Q2-N: "After [previous line], what comes next?"
- Use all multiple-choice format (NOT fill-in-blank text input)

**Distractor Strategy (CRITICAL for effective testing):**
- **PREFER**: Meaningful word/phrase substitutions that:
  - Are grammatically compatible with the question position
  - Make semantic sense in context
  - Test actual knowledge of specific words, not just logic
  - Examples: "defend us" → "protect us" / "guide us" / "stand with us"
- **AVOID**: Random other lines from the text that are:
  - Grammatically incompatible (e.g., dependent clause as answer to "what comes first?")
  - Obviously wrong from context alone (e.g., closing "Amen" as distractor for early lines)
  - Eliminable through logic without knowing the actual text
- Distractors MUST NOT be:
  - Capitalization variants (e.g., "may God" vs "May God")
  - Punctuation variants (e.g., semicolon vs period)
  - Trivial reorderings of the same words

**Quality Check**: If a learner can eliminate a distractor through grammar/context alone without knowing the text, it's a bad distractor.

**For Conceptual Content:**
- **Multiple choice**: Discrimination between similar concepts, recognition testing
- **True/false**: Binary distinctions, common misconceptions
- Mix types to test understanding from different angles

**Anti-Patterns (NEVER create these):**
- Meta-questions confirming user intent ("Select the version you want to memorize...")
- Questions testing punctuation as primary knowledge ("Does this line end with a semicolon?")
- Questions testing capitalization ("Is 'Saint' spelled out or abbreviated?")
- Large text blocks (>50 characters) embedded in answer options

## 5. Discriminative Contrast (Multiple Choice)
Distractors should:
- Represent plausible errors or common misconceptions
- Test genuine understanding, not formatting trivia or logic puzzles
- Force discrimination between similar concepts
- **For verbatim sequential recall**: Prefer meaningful word/phrase substitutions over random other lines
- **Quality test**: Could a learner eliminate this distractor through grammar/context without knowing the content? If yes, it's too weak.
- NEVER use capitalization/punctuation variants as distractors

## 6. Elaborative Encoding
Explanations build understanding:
- **WHY** the correct answer is correct (underlying principle)
- **WHY** distractors are wrong (misconception they represent)
- Connect to broader concepts when relevant
- Keep concise but meaningful

## 7. Complete Coverage
Systematically cover all memorizable content:
- Don't skip "obvious" elements
- Include endings, conclusions, terminal punctuation if part of what should be learned
- Balance breadth (covering everything) with depth (testing understanding)

## 8. No Redundancy
Each question tests something unique:
- Avoid asking same fact in slightly different ways
- Exception: Progressive elaboration (simple → complex) is good; mere repetition is not

# Generation Approach

1. Analyze user's content and infer learning objectives
2. Determine appropriate question strategy for this content type
3. Generate flashcards following the principles above
4. Ensure complete coverage, appropriate difficulty, and format compliance

# Content

${userInput}`;
}

/**
 * ARCHITECTURE NOTE: Production Configuration
 *
 * Production config is NO LONGER defined here as a static constant.
 * Instead, it's dynamically read from Convex environment variables at runtime.
 *
 * See: convex/lib/productionConfig.ts (getProductionConfig query)
 *
 * This ensures Genesis Lab always tests with the exact same configuration
 * that production uses, making divergence architecturally impossible.
 *
 * To view current production config:
 * - Genesis Lab: Loads dynamically from getProductionConfig()
 * - Convex Dashboard: Settings → Environment Variables
 *   - AI_PROVIDER (openai/google)
 *   - AI_MODEL (gpt-5/gpt-5-mini/gemini-2.0-flash-exp)
 *   - AI_REASONING_EFFORT (minimal/low/medium/high)
 *   - AI_VERBOSITY (low/medium/high)
 */
