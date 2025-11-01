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
Match format to content nature:
- **Cloze deletion**: Verbatim memorization, fill-in-blank within context
- **Multiple choice**: Discrimination between similar concepts, recognition testing
- **True/false**: Binary distinctions, common misconceptions
- Mix types to maintain engagement and test different retrieval paths

## 5. Discriminative Contrast (Multiple Choice)
Distractors should:
- Represent plausible errors or common misconceptions
- Test genuine understanding, not random guessing
- Force discrimination between similar concepts
- Avoid trick questions or trivial differences

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
 * Production Configuration Metadata
 *
 * ARCHITECTURE CHANGE (2025-11-01):
 * Moved from 5-phase architecture to 1-phase learning science approach.
 *
 * RATIONALE:
 * - 5-phase architecture caused information fragmentation across phases
 * - Quality issues: grammar errors, duplicates, missing content, unwanted complexity
 * - GPT-5 with high reasoning performs better with comprehensive single prompts
 * - Principle-based guidance (WHAT to achieve) vs procedural prescription (HOW to do it)
 *
 * COST COMPARISON:
 * - 5-phase: ~30K tokens (3K gpt-5, 27K gpt-5-mini), 5 API calls
 * - 1-phase: ~15K tokens (all gpt-5), 1 API call
 * - Cost change: Similar total cost, but better quality and lower latency
 *
 * QUALITY IMPROVEMENTS:
 * - No information loss between phases
 * - Model determines optimal strategy per content type
 * - No contradictory instructions across phases
 * - Trusts GPT-5's intelligence over rigid procedures
 */
export const PROD_CONFIG_METADATA = {
  provider: 'openai' as const,
  model: 'gpt-5', // Upgraded from gpt-5-mini for better quality
  reasoningEffort: 'high' as const, // Maximum reasoning for quality
  verbosity: 'high' as const, // Visibility into model's thinking
  // Temperature omitted - model chooses optimal value for structured outputs
} as const;
