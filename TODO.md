## Question Generation Pipeline Improvements

- [x] Strengthen intent clarification prompt in `lib/ai-client.ts` (buildIntentClarificationPrompt)
  * Replace vague "Right-size the plan" with concrete counting examples
  * Add: Single fact (2-4q), Small list (6-9q), Medium list (50-80q), Multiple lists (40-60q), Broad topic (30-50q)
  * Add: "For enumerable lists: Plan minimum 2-3 questions per item"
  * Add: "Be generous - better to over-plan than leave gaps"
  * Success criteria: Prompt explicitly guides AI on expected question counts with examples

- [x] Strengthen question generation prompt in `lib/ai-client.ts` (buildQuestionPromptFromIntent)
  * Replace vague "handful of items" with "CRITICAL COUNTING GUIDANCE" section
  * Add examples: Primary colors (6-9q), NATO alphabet (50-80q), Deadly sins + virtues (40-60q), React hooks (30-50q)
  * Add enumerable list question types: Recognition, Recall, Definition, Application, Contrast
  * Add: "First, count what needs coverage. Then generate questions."
  * Success criteria: Prompt enforces generous counting with concrete examples before existing guidance

- [x] Add low-count warning in `lib/ai-client.ts` after question mapping (line ~241)
  * Insert warning check: `if (questions.length < 15)` log warning with event 'ai.question-generation.low-count'
  * Include questionCount and topic in log metadata
  * Success criteria: Warning appears in logs when AI generates fewer than 15 questions

## Complete Difficulty Field Removal

- [x] Remove difficulty from database schema in `convex/schema.ts`
  * Delete line: `difficulty: v.string(),` from questions table definition (~line 20)
  * Note: Existing records will retain field harmlessly (Convex ignores extra fields)
  * Success criteria: Schema no longer defines difficulty field

- [x] Remove difficulty from mutation signature in `convex/questions.ts` (saveGeneratedQuestions)
  * Delete from args object: `difficulty: v.string(),` (~line 10)
  * Delete from db.insert: `difficulty: args.difficulty,` (~line 34)
  * Success criteria: Mutation neither accepts nor writes difficulty field

- [x] Remove difficulty from API validation in `lib/prompt-sanitization.ts`
  * Already completed - difficulty removed from sanitizedQuizRequestSchema

- [x] Remove difficulty from API route in `app/api/generate-questions/route.ts`
  * Already completed - removed from destructuring, logging, and response

- [x] Remove difficulty from generation modal in `components/generation-modal.tsx`
  * Delete from fetch body: `difficulty: currentQuestion?.difficulty || 'medium',` (~line 131)
  * Delete from saveQuestions call: `difficulty: result.difficulty || currentQuestion?.difficulty || 'medium',` (~line 169)
  * Success criteria: Modal never sends or uses difficulty

- [x] Remove difficulty from empty states in `components/empty-states.tsx` (4 locations)
  * First occurrence (~line 55): Remove `difficulty: 'medium'` from fetch body
  * Second occurrence (~line 71): Remove `difficulty: result.difficulty || 'medium'` from saveQuestions
  * Third occurrence (~line 212): Remove `difficulty: 'medium'` from fetch body
  * Fourth occurrence (~line 228): Remove `difficulty: result.difficulty || 'medium'` from saveQuestions
  * Success criteria: Empty states never send or use difficulty field

- [x] Remove difficulty references from `components/generation-modal.tsx`
  * Line 106: Remove `difficulty` from currentQuestion context (conditional)
  * Line 168: Remove `difficulty` from saveQuestions call
  * Success criteria: Modal never references difficulty

- [x] Remove difficulty from test fixtures in `convex/fsrs.test.ts` (8 occurrences)
  * Remove all `difficulty: 'medium',` from mock question objects
  * Success criteria: Tests pass without difficulty field

- [x] Remove difficulty from test fixtures in `convex/spacedRepetition.test.ts` (3 occurrences)
  * Remove all `difficulty: 'medium',` from mock question objects
  * Success criteria: Tests pass without difficulty field

- [x] Remove difficulty from test fixtures in `convex/questions.mutations.test.ts` (3 occurrences)
  * Remove `difficulty: 'medium',` from mock objects
  * Remove assertions checking difficulty value
  * Success criteria: Tests pass without difficulty field

- [x] Remove difficulty from `convex/questions.ts` query functions
  * Line 423: Remove `difficulty: baseQuestion.difficulty,` from listQuestionsForTopic
  * Line 474: Remove `difficulty: baseQuestion.difficulty,` from saveRelatedQuestions
  * Success criteria: Queries don't include difficulty in results

- [x] Remove difficulty from `convex/migrations.ts`
  * Line 104: Remove `difficulty: quizResult.difficulty,` from migration
  * Success criteria: Migration doesn't reference difficulty

## Review Dashboard Enhancement

- [ ] when no reviews are due, we should show how many questions are in the library and when the next review will be etc
  * useful "dashboard" info
  * there should also be no "go home" button because *we are home*
  * and the whole page should be bigger and more meaningful, since this is essentially a homescreen -- style it up! but keep it clean sophisticated and hypersimple. spacing and typography and icons and subtle micro animations will be key
