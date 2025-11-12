# TODO: Concepts & Phrasings - Bug Fixes + Architecture Consolidation

## Context

**Problem**: Dual-system architecture (legacy questions + new concepts/phrasings) causing UX confusion and bugs.

**Root issues identified**:
1. `getDue()` fallback logic bypasses FSRS scheduling → same concept loops infinitely
2. Interactions query uses `by_user_concept` index → shows history from wrong phrasings
3. Due count badge queries `questions` table → lies about what's actually reviewable
4. No unified view of knowledge → phrasings invisible in library
5. Legacy questions orphaned (no `conceptId`) → counted but never shown in review

**Strategy**: Fix critical bugs (Week 1), improve UX (Week 2), migrate & consolidate (Weeks 3-4).

---

## Week 1: Critical Bug Fixes

### Task 1: Fix getDue() Fallback Logic (Same-Concept Loop Bug)

**File**: `convex/concepts.ts` (lines 117-127)

**Problem**: When no concepts are due (e.g., user just reviewed the only concept and it's scheduled for 1min from now), fallback logic fetches ALL concepts sorted by `nextReview` and returns the soonest one—which is the concept just reviewed. User sees same concept 4x with different phrasings within 2 minutes.

**Fix**:
- [x] Remove the fallback logic that returns non-due concepts (lines 122-127)
- [x] Return `null` when no concepts have `nextReview <= nowMs` AND no concepts are in `'new'` state
- [x] Update fallback to ONLY return concepts where `state === 'new'` (never been reviewed)
- [x] Add comment explaining: "Never return future-scheduled concepts—breaks FSRS intervals"

**Success criteria**: After answering correctly, user should see "No reviews due" or move to orphaned questions, NOT immediately re-see the same concept.

**Code change**:
```typescript
// OLD (lines 122-127):
const candidates = dueConcepts.length
  ? dueConcepts
  : await ctx.db.query('concepts')...  // Returns ALL concepts

// NEW:
const newConcepts = dueConcepts.length === 0
  ? await ctx.db.query('concepts')
      .withIndex('by_user_next_review', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('fsrs.state'), 'new'))  // Only truly new
      .take(MAX_CONCEPT_CANDIDATES)
  : [];

const candidates = dueConcepts.length > 0 ? dueConcepts : newConcepts;
```

---

### Task 2: Add `by_user_phrasing` Index to Interactions Table

**File**: `convex/schema.ts` (lines 110-116)

**Problem**: No index exists for querying interactions by `phrasingId`, causing next task's query to be inefficient or impossible.

**Fix**:
- [x] Add new index to `interactions` table: `.index('by_user_phrasing', ['userId', 'phrasingId', 'attemptedAt'])`
- [x] Deploy schema change via `npx convex dev` (local) or `npx convex deploy` (production)
- [x] Verify index created: Check Convex dashboard → Data → interactions → Indexes tab

```
Work Log:
- Deployed schema to production (uncommon-axolotl-639)
- Confirmed index added: interactions.by_user_phrasing ["userId","phrasingId","attemptedAt","_creationTime"]
- All concepts/phrasings indexes also deployed successfully (14 new indexes total)
```

**Success criteria**: Index `by_user_phrasing` appears in schema, queryable via Convex dashboard.

**Code change**:
```typescript
// convex/schema.ts (after line 115)
interactions: defineTable({
  // ... existing fields
})
  .index('by_user', ['userId', 'attemptedAt'])
  .index('by_user_session', ['userId', 'sessionId', 'attemptedAt'])
  .index('by_question', ['questionId', 'attemptedAt'])
  .index('by_user_question', ['userId', 'questionId'])
  .index('by_user_concept', ['userId', 'conceptId', 'attemptedAt'])
  .index('by_user_phrasing', ['userId', 'phrasingId', 'attemptedAt']),  // ← ADD THIS
  .index('by_concept', ['conceptId', 'attemptedAt']),
```

**Dependency**: Must complete before Task 3.

---

### Task 3: Fix Interactions Query to Use `phrasingId` Instead of `conceptId`

**File**: `convex/concepts.ts` (lines 136-142)

**Problem**: Query fetches ALL interactions for a concept (across all 4 phrasings), showing user history from unrelated questions. Confusing—"I've never seen this question before, why does it say I got it wrong yesterday?"

**Fix**:
- [x] Change query from `by_user_concept` index to `by_user_phrasing` index (requires Task 2 complete)
- [x] Update query parameters to filter by `phrasingSelection.phrasing._id` instead of `concept._id`
- [x] Verify interactions returned are specific to the current phrasing

```
Work Log:
- Updated convex/concepts.ts:146-152 to use by_user_phrasing index
- Changed filter from conceptId to phrasingId (phrasingSelection.phrasing._id)
- TypeScript compilation passed
- Code simplicity review: Already optimal, no further changes needed
- Edge cases verified: early return at line 142 guarantees valid phrasingSelection
```

**Success criteria**: User sees ONLY their attempt history for the specific phrasing currently displayed, not history from other phrasings of the same concept.

**Code change**:
```typescript
// OLD (lines 136-142):
const interactions = await ctx.db
  .query('interactions')
  .withIndex('by_user_concept', (q) =>
    q.eq('userId', userId).eq('conceptId', candidate.concept._id)
  )
  .order('desc')
  .take(MAX_INTERACTIONS);

// NEW:
const interactions = await ctx.db
  .query('interactions')
  .withIndex('by_user_phrasing', (q) =>
    q.eq('userId', userId).eq('phrasingId', phrasingSelection.phrasing._id)
  )
  .order('desc')
  .take(MAX_INTERACTIONS);
```

**Dependency**: Requires Task 2 (index) completed and deployed.

---

### Task 4: Implement Hybrid Due Count (Honest Badge Numbers)

**Files**:
- `convex/concepts.ts` (new query)
- `components/review-flow.tsx` (line 75, update query call)

**Problem**: Badge shows "163 concepts due" but actually counting orphaned questions from `userStats.dueNowCount` (questions table). Review flow only shows concepts, so user sees "163 due" but loops on 1 concept forever.

**Fix**:
- [x] Create new query: `concepts.getConceptsDueCount()` that counts ONLY concepts with `nextReview <= nowMs` AND `phrasingCount > 0`
- [x] Query should return: `{ conceptsDue: number, orphanedQuestions: number }`
- [x] Update `review-flow.tsx` line 75 to call new query instead of `api.spacedRepetition.getDueCount`
- [x] Update badge UI to show: "X concepts due" (accurate) with tooltip: "Plus Y orphaned questions (need migration)"

```
Work Log:
- Added getConceptsDueCount query to convex/concepts.ts (lines 181-211)
- Used DB-level filtering (.filter on phrasingCount > 0) instead of .collect()
- Fixed correctness: queries orphaned questions directly (conceptId === undefined)
- Updated review-flow.tsx to use new query with unified state object
- Simplified tooltip implementation (removed TooltipProvider nesting)
- Code simplicity review identified and fixed:
  * Backend: Wrong data source (userStats.totalCards → direct query)
  * Backend: O(N) bandwidth issue (.collect() → .take(1000) with DB filter)
  * Frontend: Redundant state (2 variables → 1 object)
  * Removed unused totalReviewable field (YAGNI)
```

**Success criteria**: Badge shows accurate count of reviewable concepts. User understands orphaned questions exist but aren't yet reviewable.

**New query**:
```typescript
// convex/concepts.ts (add new export)
export const getConceptsDueCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;
    const nowMs = Date.now();

    const dueConcepts = await ctx.db
      .query('concepts')
      .withIndex('by_user_next_review', (q) =>
        q.eq('userId', userId).lte('fsrs.nextReview', nowMs)
      )
      .collect();

    const reviewableConcepts = dueConcepts.filter(c => c.phrasingCount > 0);

    // Count orphaned questions (no conceptId)
    const stats = await ctx.db
      .query('userStats')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    const orphanedCount = stats?.questionCount || 0;  // Legacy questions without concepts

    return {
      conceptsDue: reviewableConcepts.length,
      orphanedQuestions: orphanedCount,
      totalReviewable: reviewableConcepts.length + orphanedCount,
    };
  },
});
```

**UI update**:
```typescript
// review-flow.tsx (line 75)
// OLD:
const dueCountData = useQuery(api.spacedRepetition.getDueCount);

// NEW:
const dueCountData = useQuery(api.concepts.getConceptsDueCount);

// Update badge display (line 252):
<span className="text-sm font-medium tabular-nums">
  <span className="text-foreground">{dueCountData.conceptsDue}</span>
  <span className="text-muted-foreground ml-1">concepts due</span>
  {dueCountData.orphanedQuestions > 0 && (
    <Tooltip content={`${dueCountData.orphanedQuestions} orphaned questions need migration`}>
      <Info className="h-3 w-3 ml-1 inline" />
    </Tooltip>
  )}
</span>
```

---

## Week 2: UX Improvements

### Task 5: Add FSRS State Indicator Badge to Review UI

**File**: `components/review-flow.tsx` (after line 255, before concept title)

**Problem**: Users don't understand they're in "learning mode" with short intervals. Seeing same concept multiple times feels like a bug, but it's correct FSRS behavior for new concepts.

**Fix**:
- [x] Add badge component showing FSRS state when `concept.fsrs.state === 'learning'`
- [x] Display: "Learning Mode • Step X of 4" (where X = `concept.fsrs.reps + 1`)
- [x] Use distinct color (blue) to differentiate from error states
- [x] Position above concept title for visibility

```
Work Log:
- Modified useReviewFlow hook to pass conceptFsrs state through
- Added conceptFsrs to ReviewModeState interface with state and reps
- Updated all reducer cases (LOAD_EMPTY, QUESTION_RECEIVED)
- Modified dispatch calls to extract FSRS data from nextReview.concept.fsrs
- Updated all test fixtures in use-review-flow.test.ts
- Added Brain icon and Badge imports to review-flow.tsx
- Implemented learning mode badge with blue styling (light/dark mode)
- Badge positioned between due count indicator and concept title
- Code simplicity review: Implementation safe to merge, follows existing patterns
```

**Success criteria**: When reviewing new concepts, user sees clear indicator they're in learning phase with stepped repetitions.

**Code addition**:
```typescript
// review-flow.tsx (after line 255, inside article)
{conceptId && question && (
  <div className="space-y-6">
    {/* FSRS State Badge */}
    {question.fsrs?.state === 'learning' && (
      <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
        <Brain className="h-3 w-3 mr-1" />
        Learning Mode • Step {(question.fsrs.reps ?? 0) + 1} of 4
      </Badge>
    )}

    {/* Existing concept title */}
    {conceptTitle && (
      <div className="space-y-1">
        ...
```

**Note**: May need to pass `concept.fsrs` down from `useReviewFlow` hook—verify data availability.

---

### Task 6: Add Phrasing Context Display (Which Question of N)

**File**: `components/review-flow.tsx` (after line 265, inside concept title section)

**Problem**: User sees 4 different questions for same concept and thinks they're separate items. No indication these are variations testing the same knowledge.

**Fix**:
- [ ] Query total phrasing count for current concept
- [ ] Determine current phrasing's index (1-4)
- [ ] Display: "Phrasing X of Y • [Selection reason]" below concept title
- [ ] Selection reason: "Your preferred phrasing" (canonical), "Least practiced" (least-seen), "Random rotation"

**Success criteria**: User understands they're seeing one concept tested multiple ways, with context about which variation and why it was selected.

**Code addition**:
```typescript
// review-flow.tsx (after line 270, after concept title)
{conceptTitle && (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
      <span>Concept</span>
      {selectionBadge && (
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground/80">
          {selectionBadge}
        </span>
      )}
    </div>
    <h1 className="text-2xl font-semibold text-foreground break-words">
      {conceptTitle}
    </h1>

    {/* ADD THIS: Phrasing context */}
    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
      <span>Phrasing {currentPhrasingIndex} of {totalPhrasings}</span>
      <Separator orientation="vertical" className="h-4" />
      <span className="text-xs">
        {selectionReason === 'canonical' ? 'Your preferred phrasing' :
         selectionReason === 'least-seen' ? 'Least practiced phrasing' :
         'Random rotation'}
      </span>
    </div>
  </div>
)}
```

**Data requirements**: Need to add `totalPhrasings` and `currentPhrasingIndex` to `useReviewFlow` return value. May require additional query or pass concept's `phrasingCount`.

---

### Task 7: Enhance History Timeline (Grouped by Outcome)

**File**: `components/question-history.tsx`

**Problem**: Previous attempts list is flat and dense, hard to scan. After fixing interactions query (Task 3), need better visual presentation of phrasing-specific history.

**Fix**:
- [ ] Refactor history display from flat list to timeline format
- [ ] Group by outcome: Correct (green badge) / Incorrect (red badge)
- [ ] Show timestamp as relative time ("2 hours ago")
- [ ] Add metadata: time spent, FSRS scheduling result ("Scheduled for 10min later")
- [ ] Show max 5 recent attempts, collapse older ones with "Show all X attempts" expander

**Success criteria**: User can quickly scan their performance on THIS specific phrasing with clear visual hierarchy.

**Code refactor** (pseudocode):
```tsx
// components/question-history.tsx
export function QuestionHistory({ interactions }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Your Attempts</h4>
      <div className="space-y-3">
        {interactions.slice(0, 5).map((attempt) => (
          <div key={attempt._id} className="flex items-start gap-3">
            <Badge variant={attempt.isCorrect ? 'success' : 'destructive'}>
              {attempt.isCorrect ? '✓' : '✗'}
            </Badge>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {attempt.isCorrect ? 'Correct' : 'Incorrect'}
                </span>
                <span className="text-muted-foreground">
                  {formatRelativeTime(attempt.attemptedAt)}
                </span>
              </div>
              {attempt.timeSpent && (
                <span className="text-xs text-muted-foreground">
                  Took {Math.round(attempt.timeSpent / 1000)}s
                </span>
              )}
            </div>
          </div>
        ))}
        {interactions.length > 5 && (
          <Button variant="ghost" size="sm">
            Show all {interactions.length} attempts
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

### Task 8: Add First-Time Learning Mode Explainer

**File**: `components/review/learning-mode-explainer.tsx` (new file)

**Problem**: First time a user sees learning mode, they don't understand why they're seeing the same concept multiple times in quick succession.

**Fix**:
- [ ] Create new component: `<LearningModeExplainer />` (dismissible alert/card)
- [ ] Show ONCE per user: use localStorage key `'hasSeenLearningModeExplainer'`
- [ ] Display when: `concept.fsrs.state === 'learning'` AND `concept.fsrs.reps === 0` (first learning review)
- [ ] Content: "New concept! You'll see this a few times today with short intervals to encode it into long-term memory. This is normal spaced repetition practice."
- [ ] Include "Got it, don't show again" button

**Success criteria**: First-time users understand learning mode behavior, not surprised by immediate re-reviews.

**New component**:
```tsx
// components/review/learning-mode-explainer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Brain, X } from 'lucide-react';

export function LearningModeExplainer() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hasSeenExplainer = localStorage.getItem('hasSeenLearningModeExplainer');
    if (!hasSeenExplainer) {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('hasSeenLearningModeExplainer', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <Alert className="mb-4 border-blue-500 bg-blue-50">
      <Brain className="h-4 w-4 text-blue-700" />
      <AlertTitle className="text-blue-900">Learning Mode Active</AlertTitle>
      <AlertDescription className="text-blue-800">
        New concept! You'll see this a few times today with short intervals to encode
        it into long-term memory. This is normal spaced repetition practice.
      </AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="mt-2 text-blue-700 hover:text-blue-900"
      >
        Got it, don't show again
      </Button>
    </Alert>
  );
}
```

**Integration**: Import and render in `review-flow.tsx` conditionally when `concept.fsrs.state === 'learning'` and `reps === 0`.

---

## Week 3: Migration Preparation

### Task 9: Build Semantic Clustering System for Question Grouping

**Files**:
- `convex/migrations/clusterQuestions.ts` (new file)
- `convex/migrations/embeddingsHelpers.ts` (new file - shared utilities)

**Problem**: 163 orphaned questions need migration to concepts. Naive approach (1 question = 1 concept) creates 163 single-phrasing concepts. Better: cluster related questions into multi-phrasing concepts.

**Fix**:
- [ ] Create clustering algorithm using cosine similarity on existing embeddings
- [ ] Similarity threshold: 0.85+ = same concept, 0.70-0.85 = related (manual review), <0.70 = separate
- [ ] For questions without embeddings, generate using OpenAI embeddings API
- [ ] Return clusters: `Array<{ questions: Question[], avgSimilarity: number }>`
- [ ] Include singleton detection: questions with no close matches become 1-phrasing concepts

**Success criteria**: Function accepts array of questions, returns clustered groups with similarity scores. Validates on test data before production use.

**Algorithm pseudocode**:
```typescript
// convex/migrations/clusterQuestions.ts
export async function clusterQuestionsBySimilarity(
  questions: Doc<'questions'>[],
  options: { threshold: number } = { threshold: 0.85 }
): Promise<Array<{ questions: Doc<'questions'>[], avgSimilarity: number }>> {
  // 1. Ensure all questions have embeddings
  const questionsWithEmbeddings = await ensureEmbeddings(questions);

  // 2. Build similarity matrix
  const similarityMatrix = buildSimilarityMatrix(questionsWithEmbeddings);

  // 3. Cluster using agglomerative approach
  const clusters = agglomerativeClustering(similarityMatrix, options.threshold);

  // 4. Return clusters with metadata
  return clusters.map(cluster => ({
    questions: cluster.questions,
    avgSimilarity: calculateAvgSimilarity(cluster.indices, similarityMatrix),
  }));
}

function buildSimilarityMatrix(questions: QuestionWithEmbedding[]): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i < questions.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < questions.length; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        matrix[i][j] = cosineSimilarity(
          questions[i].embedding!,
          questions[j].embedding!
        );
      }
    }
  }
  return matrix;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
```

**Note**: Consider using existing embedding generation logic from `convex/lib/embeddings.ts` if available.

---

### Task 10: Build Concept Synthesis Logic (Auto-Generate Titles)

**File**: `convex/migrations/synthesizeConcept.ts` (new file)

**Problem**: Clusters of 2-5 questions need a unified concept title + description. Can't just use first question's text—need to synthesize the underlying concept.

**Fix**:
- [ ] Create function: `synthesizeConceptFromQuestions(questions: Question[]): { title: string, description: string }`
- [ ] Use OpenAI GPT-4 to analyze question cluster and extract common concept
- [ ] Prompt engineering: "Given these related questions, identify the single underlying concept being tested. Return a concise title (max 120 chars) and description (max 300 chars)."
- [ ] Fallback: If cluster has 1 question, use question text as title, explanation as description
- [ ] Validation: Ensure title is atomic (no "and", "vs", sequential patterns)

**Success criteria**: Function accepts question cluster, returns semantic concept that encompasses all questions. Tested on sample clusters from dev data.

**Implementation**:
```typescript
// convex/migrations/synthesizeConcept.ts
import { openai } from '../lib/openai';  // Reuse existing client

export async function synthesizeConceptFromQuestions(
  questions: Doc<'questions'>[]
): Promise<{ title: string; description: string }> {
  // Fallback for singleton clusters
  if (questions.length === 1) {
    return {
      title: questions[0].question.substring(0, 120),
      description: questions[0].explanation || 'Concept from question migration',
    };
  }

  // Build prompt with question texts
  const questionsText = questions
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join('\n');

  const prompt = `Given these related questions about the same concept, identify the single underlying concept being tested:

${questionsText}

Return a JSON object with:
- "title": A concise concept title (max 120 characters) that captures what all questions test
- "description": A brief description (max 300 characters) explaining the concept

The title must be atomic (no "and", "vs", or sequential terms). Focus on the fundamental knowledge being tested.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(response.choices[0].message.content);

  // Validate and clean
  return {
    title: result.title.trim().substring(0, 120),
    description: result.description.trim().substring(0, 300),
  };
}
```

---

### Task 11: Build Migration Script with Dry-Run Mode

**File**: `convex/migrations/migrateQuestionsToConceptsV2.ts` (new file)

**Problem**: Need to migrate 163 orphaned questions to concepts system with clustering and synthesis. Must be safe, reversible, observable.

**Fix**:
- [ ] Create internal mutation: `migrateQuestionsToConceptsV2({ dryRun: boolean })`
- [ ] Steps:
  1. Query all questions where `conceptId === undefined`
  2. Call `clusterQuestionsBySimilarity()` (Task 9)
  3. For each cluster, call `synthesizeConceptFromQuestions()` (Task 10)
  4. If `dryRun === false`: Create concept, create phrasings, link questions to concept, preserve FSRS state
  5. Log all actions (clusters formed, concepts created, phrasings added)
- [ ] Return migration report: `{ clustersFormed: number, conceptsCreated: number, phrasingsCreated: number, questionsLinked: number }`
- [ ] Include rollback information: Keep original questions untouched (only add `conceptId` field)

**Success criteria**: Dry-run mode logs intended actions without mutations. Real mode creates concepts with preserved FSRS state, links questions, creates phrasings.

**Migration structure**:
```typescript
// convex/migrations/migrateQuestionsToConceptsV2.ts
import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import { clusterQuestionsBySimilarity } from './clusterQuestions';
import { synthesizeConceptFromQuestions } from './synthesizeConcept';

export const migrateQuestionsToConceptsV2 = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    console.log(`[Migration V2] Starting with dryRun=${dryRun}`);

    // 1. Find orphaned questions
    const orphanedQuestions = await ctx.db
      .query('questions')
      .filter((q) => q.eq(q.field('conceptId'), undefined))
      .collect();

    console.log(`[Migration V2] Found ${orphanedQuestions.length} orphaned questions`);

    // 2. Cluster by similarity
    const clusters = await clusterQuestionsBySimilarity(orphanedQuestions, {
      threshold: 0.85,
    });

    console.log(`[Migration V2] Formed ${clusters.length} clusters`);

    const stats = {
      clustersFormed: clusters.length,
      conceptsCreated: 0,
      phrasingsCreated: 0,
      questionsLinked: 0,
    };

    // 3. Process each cluster
    for (const cluster of clusters) {
      // Synthesize concept
      const conceptData = await synthesizeConceptFromQuestions(cluster.questions);

      if (dryRun) {
        console.log(`[DRY RUN] Would create concept: "${conceptData.title}" with ${cluster.questions.length} phrasings`);
        continue;
      }

      // Create concept with FSRS state from most-reviewed question
      const mostReviewedQuestion = cluster.questions.sort(
        (a, b) => (b.reps ?? 0) - (a.reps ?? 0)
      )[0];

      const conceptId = await ctx.db.insert('concepts', {
        userId: mostReviewedQuestion.userId,
        title: conceptData.title,
        description: conceptData.description,
        fsrs: {
          stability: mostReviewedQuestion.stability,
          difficulty: mostReviewedQuestion.difficulty,
          lastReview: mostReviewedQuestion.lastReview,
          nextReview: mostReviewedQuestion.nextReview ?? Date.now(),
          elapsedDays: mostReviewedQuestion.elapsedDays,
          retrievability: mostReviewedQuestion.retrievability,
          scheduledDays: mostReviewedQuestion.scheduledDays,
          reps: mostReviewedQuestion.reps,
          lapses: mostReviewedQuestion.lapses,
          state: mostReviewedQuestion.state ?? 'new',
        },
        phrasingCount: cluster.questions.length,
        createdAt: Date.now(),
        embedding: mostReviewedQuestion.embedding,
        embeddingGeneratedAt: mostReviewedQuestion.embeddingGeneratedAt,
      });

      stats.conceptsCreated++;

      // Create phrasings and link questions
      for (const question of cluster.questions) {
        // Create phrasing
        await ctx.db.insert('phrasings', {
          userId: question.userId,
          conceptId,
          question: question.question,
          explanation: question.explanation,
          type: question.type,
          options: question.options,
          correctAnswer: question.correctAnswer,
          attemptCount: question.attemptCount,
          correctCount: question.correctCount,
          lastAttemptedAt: question.lastAttemptedAt,
          createdAt: question.generatedAt ?? Date.now(),
          embedding: question.embedding,
          embeddingGeneratedAt: question.embeddingGeneratedAt,
        });

        stats.phrasingsCreated++;

        // Link question to concept
        await ctx.db.patch(question._id, { conceptId });
        stats.questionsLinked++;
      }

      console.log(`[Migration V2] Created concept "${conceptData.title}" with ${cluster.questions.length} phrasings`);
    }

    console.log(`[Migration V2] Complete:`, stats);
    return stats;
  },
});

// Diagnostic query
export const checkMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const totalQuestions = await ctx.db.query('questions').collect();
    const orphaned = totalQuestions.filter((q) => !q.conceptId);
    const linked = totalQuestions.filter((q) => q.conceptId);

    return {
      totalQuestions: totalQuestions.length,
      orphaned: orphaned.length,
      linked: linked.length,
      percentMigrated: ((linked.length / totalQuestions.length) * 100).toFixed(1),
    };
  },
});
```

---

### Task 12: Validate Migration on Dev Data

**Manual testing steps** (not code tasks):

- [ ] Copy production database to dev environment (Convex dashboard → Export/Import)
- [ ] Run `migrateQuestionsToConceptsV2({ dryRun: true })` and review logs
- [ ] Verify cluster quality: Are related questions grouped correctly? Singletons appropriate?
- [ ] Run `migrateQuestionsToConceptsV2({ dryRun: false })` on dev data
- [ ] Query `checkMigrationStatus` to verify 100% migration
- [ ] Manually review 10-20 sample concepts:
  - Concept titles make sense?
  - Phrasings are actually related?
  - FSRS state preserved correctly?
- [ ] Test review flow: Can user review migrated concepts? Interactions recorded correctly?
- [ ] Document any clustering failures or edge cases for manual cleanup

**Success criteria**: Migration runs without errors, concept quality is acceptable, review flow works with migrated data.

---

## Week 4: Consolidation & Cleanup

### Task 13: Execute Production Migration

**Prerequisites**: Task 12 validation complete, rollback plan documented.

**Steps**:
- [ ] Schedule maintenance window (or accept zero-downtime with potential UX quirks during migration)
- [ ] Run `npx convex run migrations:migrateQuestionsToConceptsV2 --args '{"dryRun":false}'` on production
- [ ] Monitor Convex logs for errors
- [ ] Run `checkMigrationStatus` query to verify 100% completion
- [ ] User-facing: Display toast/alert: "Your library has been upgraded! All questions now organized into concepts."
- [ ] Monitor Sentry for 24 hours post-migration for unexpected errors

**Rollback plan** (if catastrophic failure):
1. Questions table unchanged (only `conceptId` field added)
2. Can delete all newly-created concepts/phrasings
3. Users revert to legacy question-based review flow
4. Re-attempt migration after fixing bugs

**Success criteria**: All orphaned questions migrated, concepts created, users can review migrated content, no data loss.

---

### Task 14: Mark Questions Table as Deprecated

**Files**:
- `convex/schema.ts` (add deprecation comment)
- `convex/spacedRepetition.ts` (add deprecation warnings)

**Problem**: After migration, questions table still exists but should not receive new data. Need clear deprecation signal for developers.

**Fix**:
- [ ] Add JSDoc comment to `questions` table definition: `@deprecated Migrated to concepts/phrasings system. Read-only for legacy support. Do not insert new questions.`
- [ ] Add console warnings to `scheduleReview` and `getNextReview` mutations/queries: `console.warn('spacedRepetition.scheduleReview is deprecated, use concepts.recordInteraction')`
- [ ] Update documentation: README or CLAUDE.md note about deprecated system
- [ ] Leave table functional (read-only) for 30-day safety period

**Success criteria**: Developers see clear signals not to use questions table. No new questions inserted after migration.

**Code changes**:
```typescript
// convex/schema.ts (line 50-60, questions table)
/**
 * @deprecated MIGRATED TO CONCEPTS/PHRASINGS SYSTEM (v2.4.0)
 *
 * This table is deprecated and read-only. All questions have been migrated
 * to the concepts/phrasings system. Do not insert new questions here.
 *
 * Kept for 30-day safety period (until 2025-XX-XX), then will be dropped.
 * Use `concepts` and `phrasings` tables for all new functionality.
 */
questions: defineTable({
  // ... existing schema
```

```typescript
// convex/spacedRepetition.ts (line 180, scheduleReview mutation)
export const scheduleReview = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    console.warn(
      '[DEPRECATED] spacedRepetition.scheduleReview is deprecated. ' +
      'Use concepts.recordInteraction instead. This mutation will be removed in v3.0.0.'
    );
    // ... existing logic
  },
});
```

---

### Task 15: Remove Duplicate Review Query Logic

**Files**:
- `convex/spacedRepetition.ts` (delete `getNextReview` query)
- Frontend components using `api.spacedRepetition.getNextReview` (search and replace)

**Problem**: Two parallel review systems (`spacedRepetition.getNextReview` and `concepts.getDue`) doing the same job. After migration, only need one.

**Fix**:
- [ ] Search codebase for all imports of `api.spacedRepetition.getNextReview`
- [ ] Replace with `api.concepts.getDue` (functionally equivalent post-migration)
- [ ] Delete `getNextReview` query function from `spacedRepetition.ts` (lines 264-350)
- [ ] Delete `scheduleReview` mutation (lines 180-251) — replaced by `concepts.recordInteraction`
- [ ] Run TypeScript checks to catch any missed references
- [ ] Update tests if any tests reference deleted functions

**Success criteria**: Only one review query exists (`concepts.getDue`), all frontend uses it, no compilation errors.

**Grep command to find usages**:
```bash
rg "spacedRepetition\.(getNextReview|scheduleReview)" --type typescript
```

---

### Task 16: Consolidate Library UI (Rename Concepts → Library)

**Files**:
- `app/concepts/page.tsx` → `app/library/page.tsx` (file rename)
- `app/concepts/_components/*` → `app/library/_components/*` (directory rename)
- Navigation links in layout/sidebar

**Problem**: "Concepts Library" and "Question Library" as separate pages expose internal architecture. Should be single "Library" view.

**Fix**:
- [ ] Rename `app/concepts` directory to `app/library`
- [ ] Update page metadata: "Concepts Library" → "Library" or "Knowledge Library"
- [ ] Update navigation links: Remove "Questions" link (or redirect to `/library`), rename "Concepts" to "Library"
- [ ] Update breadcrumbs and page titles throughout
- [ ] Redirect old `/concepts` route to `/library` (Next.js redirect in config)

**Success criteria**: Single "Library" navigation item, no mention of "concepts" vs "questions" in UI, redirects work.

**Redirect config**:
```typescript
// next.config.js
module.exports = {
  async redirects() {
    return [
      {
        source: '/concepts',
        destination: '/library',
        permanent: true,
      },
      {
        source: '/questions',
        destination: '/library',
        permanent: true,
      },
    ];
  },
};
```

---

### Task 17: Drop Questions Table (30-Day Safety Buffer)

**File**: `convex/schema.ts`

**Problem**: Questions table still exists, consuming storage and causing developer confusion. After 30-day safety period, should be deleted.

**Fix** (DO NOT execute until 30 days after Task 13):
- [ ] Verify no production issues reported in 30 days post-migration
- [ ] Create final backup of questions table (Convex dashboard → Export)
- [ ] Remove `questions` table definition from `schema.ts`
- [ ] Deploy schema change (Convex will drop the table)
- [ ] Monitor for any legacy code that breaks (should be caught by TypeScript)

**Success criteria**: Questions table no longer exists, codebase compiles, no runtime errors.

**Safety checklist before dropping**:
- ✅ All questions have `conceptId` (verified via `checkMigrationStatus`)
- ✅ Review flow works exclusively with concepts
- ✅ No Sentry errors related to questions table in past 30 days
- ✅ Manual testing confirms no legacy flows using questions
- ✅ Backup export completed and stored safely

---

## Additional Files to Create

### BACKLOG.md - Future Enhancements

- [ ] Create `BACKLOG.md` for optional improvements identified during planning

**Contents**:
```markdown
# BACKLOG: Concepts & Phrasings System

## Future Enhancements

- **Manual cluster editing**: UI to manually split/merge concept clusters after auto-migration (estimated: 1 week)
  - Value: Fixes clustering errors without re-running migration
  - Priority: Medium (only needed if clustering quality is poor)

- **Concept-level statistics dashboard**: Aggregate view of accuracy, review frequency, retention across all concepts (estimated: 3 days)
  - Value: Insights into learning patterns
  - Priority: Low (nice-to-have analytics)

- **Bulk phrasing operations**: Multi-select phrasings to archive/delete/move (estimated: 2 days)
  - Value: Easier library management for power users
  - Priority: Medium

- **FSRS parameter tuning UI**: Allow users to customize FSRS intervals (estimated: 1 week)
  - Value: Advanced users can optimize for their learning style
  - Priority: Low (most users don't need customization)

## Nice-to-Have Improvements

- **Learning mode onboarding tour**: Interactive walkthrough showing FSRS states (estimated: 2 days)
  - Impact: Reduces confusion for first-time users

- **Concept tagging system**: Add tags/categories for better organization (estimated: 4 days)
  - Impact: Helps users with 100+ concepts find related content

- **Export/import concepts**: Backup or share concept collections (estimated: 2 days)
  - Impact: Data portability, peace of mind

## Technical Debt Opportunities

- **Consolidate FSRS engines**: Currently have concept scheduler and legacy question scheduler with duplicate logic (estimated: 1 day)
  - Benefit: Simpler codebase, easier to update FSRS algorithm
  - Note: Will be resolved by Task 15 (removing legacy system)

- **Unify embedding generation**: Multiple places call OpenAI embeddings API, should be centralized (estimated: 1 day)
  - Benefit: Consistent embedding parameters, easier to swap providers

- **Add comprehensive integration tests**: E2E test coverage for full review flow (estimated: 3 days)
  - Benefit: Confidence in refactoring, catch regressions early
```

---

## Dependencies Graph

```
Week 1:
Task 1 (getDue fix) → Independent, can ship immediately
Task 2 (add index) → Required before Task 3
Task 3 (interactions query) → Requires Task 2
Task 4 (due count) → Independent

Week 2:
Task 5-8 (UX improvements) → Independent, can work in parallel

Week 3:
Task 9 (clustering) → Required before Task 11
Task 10 (synthesis) → Required before Task 11
Task 11 (migration script) → Requires Tasks 9, 10
Task 12 (validation) → Requires Task 11

Week 4:
Task 13 (run migration) → Requires Task 12
Task 14 (deprecation) → Requires Task 13
Task 15 (delete duplicates) → Requires Task 13
Task 16 (rename UI) → Requires Task 13
Task 17 (drop table) → Requires 30-day buffer after Task 13
```

## Success Metrics

**Week 1 (Bug Fixes)**:
- [ ] User can review concept once, then sees "No reviews due" (loop fixed)
- [ ] Previous attempts show only current phrasing's history (interactions fixed)
- [ ] Badge shows accurate count: "1 concept due" not "163" (count fixed)

**Week 2 (UX)**:
- [ ] User sees "Learning Mode" badge on new concepts (visibility)
- [ ] User understands they're seeing 1 concept, 4 phrasings (context)
- [ ] Previous attempts formatted as clear timeline (polish)

**Week 3-4 (Migration)**:
- [ ] All 163 orphaned questions migrated to concepts (100% migration)
- [ ] Related questions clustered into multi-phrasing concepts (quality clustering)
- [ ] Review flow works exclusively with concepts (consolidation)
- [ ] Zero user-facing errors post-migration (stability)

---

**Total Estimated Effort**: 4 weeks (1 developer, full-time)
**Critical Path**: Task 1 → Task 11 → Task 13 → Task 15
**Parallelizable Work**: Tasks 5-8 (Week 2) can be done concurrently
