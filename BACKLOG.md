# BACKLOG

**Last Groomed**: 2025-10-20
**Analysis Method**: Strategic roadmap synthesis + 7-perspective specialized audit
**Overall Grade**: A- (Excellent technical foundation, strategic intelligence layer needed)

---

### [AI] Migrate provider to OpenRouter or Vercel AI SDK
- support arbitrary set of model compositions for question generation and other ai / llm / generative features
- sometimes we want gemini-2.5-flash, sometimes we want gpt-5-mini, sometimes we want something else etc

### [BUSINESS] Paywall the Service
- brainstorm and determine the best pricing model for scry
- freemium? straight up total paywall? 7-30 day free trial? tokens?
- how do we balance the usage-based costs we have -- particularly the generative ai costs -- with a good user experience?

### [SECURITY] Update Vulnerable Dependencies
**File**: `package.json`
**Perspectives**: security-sentinel
**Severity**: HIGH

**Vulnerabilities**:
- `happy-dom@18.0.1` - RCE via VM context escape (CVE CVSS 9.8)
- `jsondiffpatch` - XSS in HtmlFormatter (transitive via `ai` package)

**Fix**:
```bash
pnpm update happy-dom@^20.0.2
pnpm update ai@latest
pnpm audit --audit-level=critical
```

**Effort**: 30m | **Risk**: HIGH (test environment RCE, potential supply chain attack)

---

### [PERFORMANCE] Library Selection O(n²) Algorithm
**File**: `app/library/_components/library-table.tsx:286-318`
**Perspectives**: performance-pathfinder, complexity-archaeologist
**Severity**: CRITICAL
**Impact**: 500ms UI freeze with 500 questions

**Problem**: Nested loop - 50 selected × 500 questions = 25,000 `findIndex()` operations
```typescript
const index = questions.findIndex((q) => q._id === id); // O(n) in O(m) loop!
```

**Fix**: Build index Map with useMemo (O(1) lookups)
```typescript
const questionIndexMap = useMemo(
  () => new Map(questions.map((q, idx) => [q._id, idx])),
  [questions]
);
const index = questionIndexMap.get(id); // O(1)!
```

**Effort**: 30m | **Impact**: 500ms → 5ms (100x speedup)
**Acceptance**: Select 100 questions in library with <50ms perceived lag

---

### [PERFORMANCE] Unbounded Stats Queries
**Files**: `convex/spacedRepetition.ts:509-696`
**Perspectives**: performance-pathfinder
**Severity**: CRITICAL
**Impact**: 30MB bandwidth for single dashboard load, hits monthly quota in 2 visits

**Problems**:
1. `getUserStreak` - fetches ALL interactions (10k docs, no limit)
2. `getRetentionRate` - filters 7-day window in memory (should use index)
3. `getRecallSpeedImprovement` - 2× unbounded queries

**Solution**: Add compound index + limits
```typescript
// schema.ts - NEW INDEX
interactions: defineTable({ /* ... */ })
  .index('by_user_time', ['userId', 'attemptedAt'])

// getUserStreak - limit to max possible streak
const interactions = await ctx.db
  .query('interactions')
  .withIndex('by_user_time', q => q.eq('userId', userId))
  .order('desc')
  .take(1000); // Max 1000-day streak by design

// getRetentionRate - DB-level time filtering
const recentInteractions = await ctx.db
  .query('interactions')
  .withIndex('by_user_time', q =>
    q.eq('userId', userId).gte('attemptedAt', sevenDaysAgo)
  )
  .take(2500); // 350 reviews/day × 7
```

**Effort**: 2h (includes schema migration) | **Impact**: 30MB → 400KB (75x reduction)
**Acceptance**: Dashboard loads in <500ms for users with 10k+ reviews

---

### [MAINTAINABILITY] Centralize Stats Delta Calculations
**File**: `convex/questionsBulk.ts:109-242`
**Perspectives**: complexity-archaeologist, maintainability-maven
**Severity**: MEDIUM
**Impact**: State counting logic duplicated 3× across bulk operations

**Problem**: Adding new card state requires editing 3 functions
```typescript
// Duplicated in bulkDelete, restoreQuestions, permanentlyDelete
for (const question of questions) {
  totalDecrement++;
  if (!question.state || question.state === 'new') newDecrement++;
  else if (question.state === 'learning') learningDecrement++;
  // ... repeated 3 times
}
```

**Fix**: Extract to `userStatsHelpers.ts`
```typescript
export function calculateStatsDelta(
  questions: Doc<'questions'>[],
  multiplier: 1 | -1 = 1
): StatDeltas {
  const deltas: StatDeltas = { totalCards: 0, newCount: 0, /* ... */ };
  for (const question of questions) {
    deltas.totalCards! += multiplier;
    const state = question.state || 'new';
    if (state === 'new') deltas.newCount! += multiplier;
    // ... centralized logic
  }
  return deltas;
}

// Usage: const deltas = calculateStatsDelta(questions, -1);
```

**Effort**: 45m | **Impact**: Eliminates 60 lines, centralizes state logic
**Acceptance**: Future state additions (suspended, buried) edit 1 function

---

### [UX] Auto-Save Generation Prompts
**File**: `components/generation-modal.tsx`
**Perspectives**: user-experience-advocate
**Severity**: CRITICAL
**Impact**: Users lose 2+ minutes of work on accidental modal close

**Fix**: Auto-save to localStorage every 2-3 seconds
```typescript
useEffect(() => {
  if (open && !prompt) {
    const draft = localStorage.getItem('scry-generation-draft');
    if (draft) {
      setPrompt(draft);
      toast.info('Draft restored');
    }
  }
}, [open]);

useEffect(() => {
  if (prompt) localStorage.setItem('scry-generation-draft', prompt);
}, [prompt]);
```

**Effort**: 45m | **Impact**: CRITICAL - Prevents frustrating data loss
**Acceptance**: Close/reopen modal restores typed prompt

---

### [UX] Specific Error Messages for Answer Tracking
**File**: `hooks/use-quiz-interactions.ts:42-45`
**Perspectives**: user-experience-advocate, security-sentinel
**Severity**: HIGH
**Impact**: Generic "Failed to save" doesn't help users recover

**Current**: All failures show same message
**Fix**: Classify errors with recovery steps
```typescript
if (errorMsg.includes('fetch') || errorMsg.includes('NetworkError')) {
  toast.error('Connection lost', {
    description: 'Check internet. Answer will save when reconnected.',
  });
} else if (errorMsg.includes('unauthorized')) {
  toast.error('Session expired', {
    description: 'Refresh to sign in again.',
    action: { label: 'Refresh', onClick: () => window.location.reload() },
  });
} // ... rate limit, generic fallback
```

**Effort**: 1h | **Impact**: Users understand failures and know next steps
**Acceptance**: Network error shows "Connection lost" with guidance

---

## Next (This Quarter, <3 months)

### [ENHANCEMENT] Vector Search Robustness Improvements
**Files**: `convex/embeddings.ts`, `app/library/_components/library-client.tsx`
**Source**: PR #47 review feedback (Claude comprehensive reviews)
**Severity**: LOW
**Impact**: Edge case handling and UX polish for semantic search

**Context**: MVP vector search functional, these enhancements improve robustness and user experience but aren't blocking for launch.

**Items**:

1. **Embedding generation timeout protection** (1h)
   - Add Promise.race pattern with 10-second timeout
   - Prevents hung jobs if Google API hangs
   - Location: `convex/embeddings.ts:generateEmbedding`
   - Pattern: `Promise.race([embedCall, timeoutPromise])`

2. **Client-side similarity threshold filter** (30m)
   - Hide search results with similarity score <0.4
   - Improves relevance of displayed results
   - Location: `library-client.tsx` search results rendering
   - Need production data to determine optimal threshold

3. **Fuzzy text search for typos/accents** (4h)
   - Handle Unicode normalization ("café" vs "cafe")
   - Levenshtein distance for close matches
   - Consider Convex native search index when available
   - Location: `questionsLibrary.ts:textSearchQuestions`
   - Alternative: Document as known limitation for MVP

4. **E2E test coverage for search flow** (2h)
   - Playwright test: Generate questions → Search → Verify results
   - Test semantic similarity (different phrasing finds same content)
   - Test view filtering (active/archived/trash)
   - Test empty states and error handling

5. **Embedding coverage monitoring dashboard** (4h)
   - UI showing percentage of questions with embeddings
   - Coverage by topic/collection
   - Failed generation queue with retry button
   - Currently relies on Pino logs grep (acceptable for MVP)

6. **Code cleanup: Duplicate fingerprint function** (15m)
   - Import `getSecretDiagnostics` from `lib/envDiagnostics.ts`
   - Remove duplicate from `embeddings.ts:32-62`
   - Low impact (diagnostic code only)

7. **Text concatenation cleanup** (5m)
   - Use `.join(' ')` instead of direct concatenation
   - Location: `aiGeneration.ts:380` and `embeddings.ts`
   - Marginal quality improvement for embeddings

8. **Search debounce cleanup** (15m)
   - Add isMounted flag to prevent state updates on unmounted component
   - Location: `library-client.tsx:51-89`
   - Cosmetic (prevents console warnings)

**Total Effort**: ~11h | **Impact**: LOW - Nice-to-have polish
**Acceptance**: Timeout protection prevents hung jobs, low-score results hidden, E2E tests pass, monitoring dashboard shows coverage
**Priority**: Defer until after MVP launch, reassess based on production usage patterns

---

### [PRODUCT] Free Response Questions with AI Grading
**File**: `convex/schema.ts`, `convex/aiGrading.ts`
**Perspectives**: product-visionary, user-experience-advocate
**Severity**: HIGH
**Impact**: Major differentiation - deeper learning beyond multiple choice

**The Opportunity**: Move beyond recognition (multiple choice) to recall (free response)

**Research Findings**:
- LLM-as-judge pattern proven effective for grading
- Structured output with reasoning + score
- Compare student answer vs ground truth with rubric

**Schema Changes**:
```typescript
questions: defineTable({
  // ... existing fields ...
  type: v.union(
    v.literal('multiple-choice'),
    v.literal('true-false'),
    v.literal('free-response') // NEW
  ),
  // For free-response questions
  expectedAnswer: v.optional(v.string()), // Sample correct answer
  gradingRubric: v.optional(v.string()), // Criteria for correctness
})

interactions: defineTable({
  // ... existing fields ...
  aiGrading: v.optional(v.object({
    score: v.number(), // 0.0 to 1.0
    reasoning: v.string(), // Why correct/incorrect
    feedback: v.optional(v.string()), // Improvement suggestions
    gradedAt: v.number(),
  }))
})
```

**AI Grading Implementation**:
```typescript
// Based on LLM-as-judge pattern
const GRADING_PROMPT = `You are an expert teacher grading a student's answer.

QUESTION: {question}

EXPECTED ANSWER (reference): {expectedAnswer}

GRADING RUBRIC:
{rubric}

STUDENT ANSWER: {userAnswer}

Grade the student's response:
1. Factual accuracy relative to expected answer
2. Completeness (captures key points)
3. No conflicting statements
4. Allow extra information if accurate

Provide:
- Score: 0.0 (completely wrong) to 1.0 (perfect)
- Reasoning: Step-by-step explanation
- Feedback: How to improve (if not perfect)`;

export const gradeResponse = internalAction({
  args: {
    questionId: v.id('questions'),
    userAnswer: v.string(),
  },
  handler: async (ctx, args) => {
    const question = await ctx.runQuery(/* get question */);

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_AI_API_KEY
    });

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        score: z.number().min(0).max(1),
        reasoning: z.string(),
        feedback: z.string().optional(),
      }),
      prompt: GRADING_PROMPT
        .replace('{question}', question.question)
        .replace('{expectedAnswer}', question.expectedAnswer || '')
        .replace('{rubric}', question.gradingRubric || 'Standard accuracy')
        .replace('{userAnswer}', args.userAnswer)
    });

    return object;
  }
});
```

**Review UX**:
```typescript
// Free response input
<Textarea
  placeholder="Type your answer..."
  value={userAnswer}
  onChange={(e) => setUserAnswer(e.target.value)}
/>
<Button onClick={handleSubmitFreeResponse}>Submit Answer</Button>

// After AI grading
<Card>
  <CardHeader>
    <Badge variant={score >= 0.7 ? 'success' : 'destructive'}>
      Score: {Math.round(score * 100)}%
    </Badge>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">{reasoning}</p>
    {feedback && (
      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>{feedback}</AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

**FSRS Integration**:
```typescript
// Convert AI score to isCorrect for FSRS
const isCorrect = aiGrading.score >= 0.7; // 70% threshold

await scheduleReview({
  questionId,
  userAnswer,
  isCorrect,
  // Store grading details in interaction
  aiGrading: {
    score: aiGrading.score,
    reasoning: aiGrading.reasoning,
    feedback: aiGrading.feedback,
    gradedAt: Date.now()
  }
});
```

**Generation Enhancement**:
```typescript
// Update prompt to generate free-response questions
const QUESTION_TYPES = `
- multiple-choice: 4 options with 1 correct
- true-false: Binary claim
- free-response: Open-ended, requires written answer (NEW)
`;

// In generation schema
questions: [{
  type: "free-response",
  question: "Explain the difference between let and const in JavaScript",
  expectedAnswer: "let allows reassignment, const does not. Both are block-scoped.",
  gradingRubric: "Must mention: reassignment difference, block scoping",
  explanation: "..."
}]
```

**Cost Considerations**:
- Grading API call: ~$0.0001 per question (Gemini Flash)
- User reviewing 100 questions: ~$0.01
- Acceptable for premium tier, may need rate limiting for free tier

**Monetization**:
- Free: 10 free-response reviews/month
- Premium: Unlimited free-response

**Effort**: 5-6d (schema, grading action, UX, FSRS integration, generation) | **Impact**: HIGH - Major differentiator
**Acceptance**: Generate free-response question, type answer, receive AI score + feedback, FSRS schedules next review

---

### [PRODUCT] Deduplication & Consolidation System
**File**: `convex/deduplication.ts`
**Perspectives**: product-visionary, maintainability-maven
**Severity**: HIGH
**Impact**: AI generates similar questions, creates clutter and review overhead

**The Problem**:
- Generating from related prompts creates semantic duplicates
- "What is useState?" vs "Explain the useState hook" are functionally identical
- Manual deletion tedious, users don't notice until library is cluttered

**Research Findings**:
- AnkiFuzzy uses fuzzy text matching (token sort, partial ratio)
- Semantic similarity via embeddings superior for concept matching
- Assisted deduplication (user confirms) preferred over automatic

**Architecture - 3 Phases**:

**Phase 1: Detection (Automated Cron)**
```typescript
// Daily cron: Find potential duplicates
export const detectDuplicates = internalMutation({
  handler: async (ctx) => {
    // Get questions created in last 7 days (most likely to have duplicates)
    const recentQuestions = await ctx.db
      .query('questions')
      .withIndex('by_user_active')
      .filter(/* created in last 7 days */)
      .take(500);

    const duplicatePairs = [];

    // Pairwise similarity check
    for (let i = 0; i < recentQuestions.length; i++) {
      for (let j = i + 1; j < recentQuestions.length; j++) {
        const similarity = cosineSimilarity(
          recentQuestions[i].embedding,
          recentQuestions[j].embedding
        );

        if (similarity > 0.90) { // 90% similarity threshold
          duplicatePairs.push({
            userId: recentQuestions[i].userId,
            question1Id: recentQuestions[i]._id,
            question2Id: recentQuestions[j]._id,
            similarity,
            status: 'pending', // pending, dismissed, merged
          });
        }
      }
    }

    // Store for user review
    await Promise.all(
      duplicatePairs.map(pair =>
        ctx.db.insert('duplicateCandidates', pair)
      )
    );
  }
});
```

**Phase 2: Review UI (Human-in-Loop)**
```typescript
// Library page component
<DuplicatesAlert
  count={duplicateCandidates.length}
  onClick={() => setShowDuplicatesModal(true)}
/>

// Modal with side-by-side comparison
<DuplicateReviewModal>
  {duplicatePairs.map(pair => (
    <ComparisonCard>
      <QuestionPreview question={pair.question1} />
      <div className="text-center">
        <Badge>{Math.round(pair.similarity * 100)}% similar</Badge>
      </div>
      <QuestionPreview question={pair.question2} />

      <div className="flex gap-2">
        <Button onClick={() => mergeDuplicates(pair.question1Id, pair.question2Id)}>
          Merge →
        </Button>
        <Button variant="outline" onClick={() => keepBoth(pair.id)}>
          Keep Both
        </Button>
        <Button variant="ghost" onClick={() => dismissPair(pair.id)}>
          Dismiss
        </Button>
      </div>
    </ComparisonCard>
  ))}
</DuplicateReviewModal>
```

**Phase 3: Smart Merge (Preserve FSRS)**
```typescript
export const mergeDuplicates = mutation({
  args: {
    keepId: v.id('questions'),
    deleteId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    const keep = await ctx.db.get(args.keepId);
    const remove = await ctx.db.get(args.deleteId);

    // Merge interaction histories
    const removeInteractions = await ctx.db
      .query('interactions')
      .withIndex('by_question', q => q.eq('questionId', args.deleteId))
      .collect();

    // Update all interactions to point to kept question
    await Promise.all(
      removeInteractions.map(i =>
        ctx.db.patch(i._id, { questionId: args.keepId })
      )
    );

    // Merge denormalized stats
    await ctx.db.patch(args.keepId, {
      attemptCount: keep.attemptCount + remove.attemptCount,
      correctCount: keep.correctCount + remove.correctCount,
    });

    // Preserve better FSRS state (more mature card)
    if (remove.reps > keep.reps) {
      await ctx.db.patch(args.keepId, {
        stability: remove.stability,
        fsrsDifficulty: remove.fsrsDifficulty,
        state: remove.state,
        reps: remove.reps,
        lapses: remove.lapses,
      });
    }

    // Soft delete duplicate
    await ctx.db.patch(args.deleteId, {
      deletedAt: Date.now(),
      deletedReason: 'merged_duplicate'
    });

    return { success: true };
  }
});
```

**Effort**: 6-7d (detection cron, UI, merge logic, testing) | **Impact**: HIGH - Reduces clutter
**Requires**: Vector embeddings (Phase 1 dependency)
**Acceptance**: System detects 5 duplicate pairs, review in modal, merge 3 pairs, FSRS state preserved

---

### [PRODUCT] Adaptive Question Generation
**File**: `convex/adaptiveGeneration.ts`
**Perspectives**: product-visionary
**Severity**: HIGH
**Impact**: System doesn't learn from user struggles - major differentiation opportunity

**The Opportunity**: Close the feedback loop - generate easier/harder questions based on performance

**Research Findings**:
- Adaptive learning systems show 3x better retention
- VoiceScholar: "struggling? Get simpler cards" + "mastered? Get challenges"
- Competitive moat - most SRS systems don't adapt

**Difficulty Analysis**:
```typescript
// Categorize questions by performance
export const analyzeQuestionDifficulty = query({
  handler: async (ctx) => {
    const user = await requireUserFromClerk(ctx);
    const userId = user._id;

    // Get all user questions with performance stats
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_user_active')
      .filter(q => q.eq('deletedAt', undefined))
      .collect();

    const analysis = {
      tooEasy: [], // >90% success, low lapses
      appropriate: [], // 60-85% success
      tooHard: [], // <50% success, high lapses
    };

    for (const q of questions) {
      if (q.attemptCount < 3) continue; // Need minimum data

      const successRate = q.correctCount / q.attemptCount;

      if (successRate > 0.9 && q.lapses < 2) {
        analysis.tooEasy.push(q);
      } else if (successRate < 0.5 || q.lapses > 3) {
        analysis.tooHard.push(q);
      } else {
        analysis.appropriate.push(q);
      }
    }

    return analysis;
  }
});
```

**Automated Generation Triggers**:
```typescript
// Daily cron: Generate adaptive questions
export const generateAdaptiveQuestions = internalAction({
  handler: async (ctx) => {
    // Find struggling questions
    const strugglingQuestions = await ctx.runQuery(
      internal.adaptiveGeneration.getStrugglingQuestions
    );

    // Generate EASIER related questions
    for (const question of strugglingQuestions.slice(0, 10)) { // Limit batch
      const easierPrompt = buildAdaptivePrompt(question, 'easier');

      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
        schema: questionsSchema,
        prompt: easierPrompt
      });

      // Save with link to original
      await ctx.runMutation(internal.questionsCrud.saveBatch, {
        userId: question.userId,
        topic: `${question.topic} (Easier)`,
        questions: object.questions,
        relatedToQuestionId: question._id,
      });
    }

    // Similarly for mastered questions → harder variants
  }
});

function buildAdaptivePrompt(question: Question, direction: 'easier' | 'harder') {
  const stats = {
    successRate: question.correctCount / question.attemptCount,
    lapses: question.lapses,
    fsrsDifficulty: question.fsrsDifficulty
  };

  return `
Original Question: "${question.question}"
Performance: ${Math.round(stats.successRate * 100)}% correct, ${stats.lapses} lapses
FSRS Difficulty: ${stats.fsrsDifficulty}

Generate a ${direction} related question testing the same concept.

${direction === 'easier'
  ? `Make it EASIER by:
     - Using clearer, simpler language
     - Providing more context in the question
     - Breaking complex concepts into steps
     - Using concrete examples instead of abstract
     - Reducing the number of conditions to consider`
  : `Make it HARDER by:
     - Requiring deeper reasoning
     - Combining multiple related concepts
     - Adding edge cases or exceptions
     - Using more technical/precise terminology
     - Testing application in novel scenarios`
}

Generate 2-3 questions that maintain the core concept but adjust difficulty.
`;
}
```

**User Control**:
```typescript
// Settings toggle
<Switch
  checked={settings.autoGenerateAdaptive}
  onCheckedChange={(enabled) => updateSettings({ autoGenerateAdaptive: enabled })}
/>
<Label>
  Auto-generate easier questions for struggling topics
</Label>

// Manual trigger in library
<DropdownMenuItem onClick={() => generateRelated(questionId, 'easier')}>
  <Sparkles className="mr-2 h-4 w-4" />
  Generate Easier Variant
</DropdownMenuItem>
```

**Approval Workflow**:
```typescript
// Generated questions go to "Review & Approve" queue
<Card>
  <CardHeader>
    <Badge>AI-Generated</Badge>
    <CardTitle>3 easier questions generated for "useState hook"</CardTitle>
  </CardHeader>
  <CardContent>
    {generatedQuestions.map(q => (
      <QuestionPreview
        question={q}
        actions={
          <>
            <Button onClick={() => approveQuestion(q.id)}>Add to Library</Button>
            <Button variant="outline" onClick={() => editQuestion(q.id)}>Edit</Button>
            <Button variant="ghost" onClick={() => dismissQuestion(q.id)}>Dismiss</Button>
          </>
        }
      />
    ))}
  </CardContent>
</Card>
```

**Effort**: 7-8d (analysis, generation, approval UI, settings) | **Impact**: VERY HIGH - Major differentiator
**Acceptance**: System detects struggling questions, auto-generates 3 easier variants, user approves 2, added to library

---

### [UX] Postpone Action with Related Items
**File**: `convex/questionsCrud.ts`
**Perspectives**: user-experience-advocate
**Severity**: MEDIUM
**Impact**: No middle ground between delete/archive and review now

**Use Cases**:
- "Need to review prerequisite material first"
- "Context-dependent on another topic I'm learning"
- "Not in the mood for calculus, but don't want to delete"

**Schema**:
```typescript
questions: defineTable({
  // ... existing fields ...
  postponedUntil: v.optional(v.number()), // Timestamp when to resume
})
```

**Simple Implementation**:
```typescript
export const postponeQuestion = mutation({
  args: {
    questionId: v.id('questions'),
    duration: v.union(
      v.literal(300000), // 5 minutes
      v.literal(3600000), // 1 hour
      v.literal(86400000), // 1 day
      v.literal(604800000), // 1 week
      v.literal(2592000000), // 1 month
    ),
  },
  handler: async (ctx, args) => {
    const postponeUntil = Date.now() + args.duration;
    await ctx.db.patch(args.questionId, { postponedUntil });
    return { success: true, postponeUntil };
  }
});

// Update getNextReview to exclude postponed
.filter(q =>
  q.and(
    q.eq(q.field('deletedAt'), undefined),
    q.eq(q.field('archivedAt'), undefined),
    q.or(
      q.eq(q.field('postponedUntil'), undefined),
      q.lt(q.field('postponedUntil'), now)
    )
  )
)
```

**Advanced: Postpone Related Items** (requires embeddings):
```typescript
export const postponeWithRelated = mutation({
  args: {
    questionId: v.id('questions'),
    duration: v.number(),
    includeRelated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const postponeUntil = Date.now() + args.duration;

    // Always postpone the main question
    await ctx.db.patch(args.questionId, { postponedUntil });

    if (args.includeRelated) {
      const question = await ctx.db.get(args.questionId);

      // Use vector similarity to find related questions
      const similar = await ctx.db
        .query('questions')
        .withIndex('by_embedding')
        .search(question.embedding, {
          limit: 20,
          filter: q => q.eq('userId', question.userId)
        });

      // Filter by similarity threshold (>0.85)
      const related = similar.filter(s => s.score > 0.85);

      // Postpone all related questions
      await Promise.all(
        related.map(q =>
          ctx.db.patch(q._id, { postponedUntil })
        )
      );

      return {
        success: true,
        postponedCount: 1 + related.length
      };
    }

    return { success: true, postponedCount: 1 };
  }
});
```

**Review UX**:
```typescript
// During review session
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <Clock className="mr-2 h-4 w-4" />
      Postpone
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => postpone(5 * 60 * 1000)}>
      5 minutes
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => postpone(60 * 60 * 1000)}>
      1 hour
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => postpone(24 * 60 * 60 * 1000)}>
      1 day
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => postpone(7 * 24 * 60 * 60 * 1000)}>
      1 week
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onClick={() => setShowRelatedPrompt(true)}
      disabled={!hasEmbedding}
    >
      <Network className="mr-2 h-4 w-4" />
      Include related items
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

{showRelatedPrompt && (
  <AlertDialog>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Postpone related questions?</AlertDialogTitle>
        <AlertDialogDescription>
          This will also postpone ~{relatedCount} questions with similar content.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>No, just this one</AlertDialogCancel>
        <AlertDialogAction onClick={() => postponeWithRelated()}>
          Yes, postpone all
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

**Effort**: 3-4h (basic) / 6-7h (with related items) | **Impact**: MEDIUM
**Requires**: Vector embeddings for "related items" feature
**Acceptance**: Click postpone during review, select "1 day + related", 8 questions postponed

---

### [ARCHITECTURE] Split spacedRepetition.ts God Object
**File**: `convex/spacedRepetition.ts:1-740`
**Perspectives**: complexity-archaeologist, architecture-guardian, maintainability-maven
**Severity**: HIGH
**Impact**: 740 LOC with 5 responsibilities, comprehension barrier

**Responsibilities Mixed**:
1. Review scheduling + FSRS priority calculations
2. Queue management (getNextReview, getDueCount)
3. User analytics (streak, retention, recall speed)
4. Freshness decay algorithm
5. Stats update mutations

**Refactor Plan**:
```
├── reviewScheduling.ts (150 LOC) - scheduleReview mutation
├── reviewQueue.ts (200 LOC) - getNextReview, getDueCount, priority calc
├── userAnalytics.ts (250 LOC) - getUserStreak, getRetentionRate, getRecallSpeed
└── lib/priorityAlgorithm.ts (100 LOC) - calculateRetrievabilityScore, freshnessDecay
```

**Effort**: 6-8h | **Impact**: 740 LOC → 4 focused modules, clearer boundaries
**Approach**: Extract analytics first (least coupled), then queue, then scheduling

---

### [ENHANCEMENT] Dynamic Urgency Threshold for Shuffle
**File**: `convex/spacedRepetition.ts:293`
**Source**: PR #44 review feedback
**Perspectives**: performance-pathfinder, user-experience-advocate
**Severity**: LOW
**Impact**: Hard-coded N=10 shuffle tier may mix items with different urgency levels

**The Problem**: Current implementation shuffles top 10 items regardless of retrievability spread. If items 1-5 have retrievability 0.05-0.10 (urgent) but items 6-10 have 0.30-0.40 (less urgent), they get mixed.

**Solution**: Adaptive threshold based on retrievability delta
```typescript
// Instead of hard-coded N=10, use dynamic threshold
const URGENCY_DELTA = 0.05; // Only shuffle items within 5% retrievability
const urgentTier = [];
const baseRetrievability = questionsWithPriority[0].retrievability;

for (const item of questionsWithPriority) {
  if (item.retrievability - baseRetrievability <= URGENCY_DELTA) {
    urgentTier.push(item);
  } else {
    break; // Stop when urgency gap too large
  }
}

// Shuffle urgentTier (variable size)
```

**Tradeoff**: More complexity vs better FSRS fidelity

**Effort**: 2-3h (research optimal delta, implementation, testing) | **Impact**: LOW-MEDIUM
**Acceptance**: Top 3 items have retrievability 0.05-0.08, only those 3 shuffled (not full 10)

**Reference**: https://github.com/phrazzld/scry/pull/44#discussion_r2

---

### [PRODUCT] Freemium Monetization Strategy
**Perspectives**: product-visionary
**Severity**: CRITICAL
**Impact**: Currently $0 ARR, no business model

**Tier Structure**:
- **Free**: 500 questions, 10 AI gens/month, JSON export, web only
- **Premium** ($10/mo): Unlimited questions/AI, advanced exports, mobile app
- **Team** ($20/user/mo): Shared collections, team analytics
- **Enterprise** (custom): SSO, LMS integration, white-label

**Implementation**:
- Stripe integration: 2d
- Usage tracking middleware: 2d
- Paywall UI: 2d
- Admin subscription dashboard: 2d

**Business Case**:
- 1,000 users → 75 Premium = $9K ARR
- 10,000 users → 750 Premium = $90K ARR
- 50,000 users → 3,750 Premium = $450K ARR

**Effort**: 8d | **Strategic Value**: CRITICAL - Enables revenue from $0 baseline
**Acceptance**: User can upgrade to Premium, see usage limits, manage subscription

---

### [PRODUCT] Data Export (Adoption Blocker)
**Perspectives**: product-visionary, user-experience-advocate
**Severity**: CRITICAL
**Impact**: Blocks 20% of trial conversions (vendor lock-in fear)

**Market Analysis**: Top SRS feature request, required for enterprise compliance (GDPR)

**Formats**:
1. **JSON** (1d) - Raw data, preserves FSRS state
2. **CSV** (0.5d) - Excel-compatible
3. **Anki APKG** (2d) - SQLite packaging, SM2→FSRS mapping
4. **PDF** (1d) - Print-friendly study guide

**Monetization**:
- Free: JSON/CSV only, 100 questions/export, 3 exports/month
- Premium: All formats, unlimited exports

**Effort**: 4.5d | **Strategic Value**: CRITICAL - Removes #1 adoption objection
**Acceptance**: Export 100 questions as APKG, import into Anki successfully

---

### [PRODUCT] Data Import (Switching Friction)
**Perspectives**: product-visionary
**Severity**: HIGH
**Impact**: 60% of users have existing decks, can't migrate

**Opportunity**: Import from Anki (.apkg), CSV, Quizlet

**FSRS State Mapping Challenge**:
- Anki SM-2 (interval, ease, reps) → Scry FSRS (stability, difficulty)
- Conservative mapping: Treat as "learning" state, preserve rep count

**Implementation**:
- CSV parser: 2d
- Anki APKG parser (SQLite): 4d
- FSRS state mapper: 1d

**Monetization**:
- Free: 100 questions/import, CSV only
- Premium: Unlimited, all formats, FSRS state preservation

**Effort**: 7d | **Strategic Value**: HIGH - Removes switching friction for 60% of market
**Acceptance**: Import 500-card Anki deck with scheduling preserved in <2 minutes

---

### [PRODUCT] Question Sharing (Viral Growth)
**Perspectives**: product-visionary
**Severity**: HIGH
**Impact**: Zero organic growth mechanism (viral coefficient 0.0)

**Opportunity**: Public share links, fork/clone decks

**Implementation**:
```typescript
export const createShareLink = mutation({
  handler: async (ctx, { questionIds }) => {
    const shareToken = generateSecureToken();
    await ctx.db.insert('sharedDecks', { questionIds, shareToken, /* ... */ });
    return { url: `${APP_URL}/shared/${shareToken}` };
  }
});
```

**Features**:
- Public links (1d) - Read-only viewing
- Fork/Clone (0.5d) - Copy to your library
- Social previews (0.5d) - OpenGraph meta tags
- Embed widget (1d) - iFrame for blogs

**Viral Mechanics**: 0.3 viral coefficient → 30% monthly growth from sharing

**Effort**: 3d | **Strategic Value**: CRITICAL - Primary organic growth engine
**Acceptance**: Share deck, view on another device logged out, fork to account

---

### [PRODUCT] PWA Mobile (Quick Mobile Win)
**Perspectives**: product-visionary, user-experience-advocate
**Severity**: HIGH
**Impact**: Missing 40% of market (mobile-only users)

**Approach**: Start with PWA (5d), build React Native (15d) for premium tier later

**PWA Features**:
- manifest.json + service worker
- Add to home screen
- Offline caching (questions, assets)
- Push notifications for due reviews

**Monetization**:
- Free: Web + PWA
- Premium: Native mobile apps (React Native, future)

**Effort**: 5d PWA | **Strategic Value**: Opens 40% of TAM, 2x engagement
**Acceptance**: Install PWA on iOS, review 5 questions offline in subway

---

### [TESTING] Review Flow State Machine Tests
**File**: `hooks/use-review-flow.ts`
**Perspectives**: maintainability-maven
**Severity**: HIGH
**Impact**: Complex state machine (6 actions) with ZERO unit tests

**Critical Paths Untested**:
- Transition from loading → reviewing when question received
- Ignore updates when lockId is set (user mid-review)
- Timeout after 5s loading
- Handle same question returning (FSRS immediate re-review)
- Clear lock when moving to next question

**Implementation**:
```typescript
describe('useReviewFlow state machine', () => {
  it('should prevent question switching when user is reviewing (lock)');
  it('should reset state cleanly for immediate re-review (FSRS)');
  it('should timeout after 5 seconds if no question received');
  // ... 5-10 tests covering all transitions
});
```

**Effort**: 4h | **Value**: CRITICAL - Prevent regression in core flow
**Acceptance**: All state transitions covered with tests

---

### [TESTING] Retrievability Spread Validation Test
**File**: `convex/spacedRepetition.test.ts`
**Source**: PR #44 review feedback
**Perspectives**: maintainability-maven
**Severity**: LOW
**Impact**: Shuffle assumes top-10 items have similar retrievability - untested assumption

**The Gap**: Current shuffle tests validate variance and FSRS priority respect, but don't verify the core assumption that top-10 items are actually similar urgency.

**Test Implementation**:
```typescript
describe('Shuffle tier urgency assumption', () => {
  it('should validate top-10 items have similar retrievability (<0.10 spread)', async () => {
    // Create 20 questions with known retrievability pattern
    const questions = [
      { retrievability: 0.05 }, // Urgent
      { retrievability: 0.06 },
      { retrievability: 0.08 },
      { retrievability: 0.09 },
      { retrievability: 0.10 }, // Still urgent
      { retrievability: 0.35 }, // Less urgent - should NOT be in top-10 shuffle
      // ...
    ];

    const topTier = questions.slice(0, 10);
    const spread = Math.max(...topTier.map(q => q.retrievability)) -
                   Math.min(...topTier.map(q => q.retrievability));

    expect(spread).toBeLessThan(0.10); // Validate assumption
  });

  it('should identify when assumption breaks (mixed urgency in top-10)', async () => {
    // Edge case: top-10 contains both urgent (0.05) and less urgent (0.40)
    // This would indicate dynamic threshold needed (see BACKLOG enhancement)
  });
});
```

**Effort**: 1h | **Impact**: LOW - Validates design assumption, informs future dynamic threshold work
**Acceptance**: Test passes for realistic datasets, fails if urgency gap >0.10 in top-10

**Reference**: https://github.com/phrazzld/scry/pull/44#discussion_r3

---

### [MAINTAINABILITY] Document FSRS Magic Numbers
**File**: `convex/scheduling.ts:88-92`
**Perspectives**: maintainability-maven, complexity-archaeologist
**Severity**: HIGH
**Impact**: Developers afraid to tune parameters without understanding

**Problem**: No documentation of WHY
- `maximum_interval: 365` - Why not 180 or 730?
- `enable_fuzz: true` - What does "fuzz" mean algorithmically?
- `enable_short_term: true` - What's the tradeoff?

**Fix**: Comprehensive inline documentation
```typescript
// FSRS Parameters - Tuned for Anki-scale collections (1000+ cards)
// Based on FSRS recommendations: https://github.com/open-spaced-repetition/fsrs4anki/wiki/Parameters
this.fsrs = new FSRS(
  generatorParameters({
    // Maximum interval: 365 days (1 year)
    // Rationale: Prevents intervals exceeding practical review frequency.
    // Anki uses 100-365 days based on content type.
    // Current: 365 suitable for foundational knowledge (programming, language vocab).
    // Consider: 180 days for rapidly-changing knowledge (current events).
    maximum_interval: 365,

    // Fuzz: Add ±2.5% random variance to intervals
    // Rationale: Prevents "review clustering" where many cards due simultaneously.
    // Example: 10-day interval becomes 9-10 days randomly.
    // Disable for testing (deterministic scheduling).
    enable_fuzz: true,

    // ... detailed explanations for each parameter
  })
);
```

**Effort**: 15m | **Benefit**: Informed future tuning, algorithm transparency
**Acceptance**: New developer can tune parameters based on documented rationale

---

### [OPERATIONS] Migration Rollback Documentation
**File**: `docs/runbooks/production-deployment.md`, `docs/guides/writing-migrations.md`
**Source**: PR #44 review feedback
**Perspectives**: maintainability-maven, architecture-guardian
**Severity**: MEDIUM
**Impact**: No documented rollback pattern for breaking schema migrations

**The Gap**: Current migration guide documents forward path (3-phase removal) but not recovery strategy if migration fails mid-execution or introduces data corruption.

**Required Documentation**:

1. **Rollback Strategy Patterns**:
   - Field removal migrations: Re-add field as optional, backfill from backup
   - Data transformation: Inverse transformation mutation
   - Structural changes: Maintain shadow tables during transition period

2. **Recovery Procedures**:
   ```typescript
   // Emergency rollback mutation template
   export const rollbackMigration = internalMutation({
     args: { migrationName: v.string() },
     handler: async (ctx, args) => {
       // Document rollback steps here
       // 1. Identify affected records
       // 2. Restore previous state from backup/shadow table
       // 3. Log rollback for audit trail
     }
   });
   ```

3. **Backup Verification**:
   - Pre-migration snapshots: `npx convex export` before running migration
   - Shadow table pattern: Keep old data in separate table during transition
   - Verification queries: Diagnostic queries that validate data integrity

4. **Risk Assessment Matrix**:
   - Irreversible migrations (like PR #44 topic removal): Require extra verification
   - Reversible migrations: Can restore via rollback mutation
   - Safe migrations (additive only): No rollback needed

**Effort**: 2-3h (runbook update, rollback templates) | **Impact**: MEDIUM
**Acceptance**: Migration guide includes "Rollback Procedures" section with templates

**Reference**: https://github.com/phrazzld/scry/pull/44#discussion_r4 (migration safety concern)

---

## Soon (Exploring, 3-6 months)

### [PRODUCT] Content-Aware FSRS (Research Breakthrough)
**Perspectives**: product-visionary, complexity-archaeologist
**Severity**: HIGH (Strategic)
**Impact**: First content-aware FSRS implementation - massive competitive moat

**The Opportunity**:
- Current FSRS is **content-agnostic**: Treats "What is 2+2?" same as "Explain quantum entanglement"
- Current FSRS is **deck-agnostic**: Each card in isolation, no prerequisite awareness

**Research**: Hacker News discussion on "Content-Aware Spaced Repetition" reveals this is the next frontier

**Implementation Strategy**:
```typescript
// Use embeddings to detect question types
export const categorizeQuestionType = async (question: Question) => {
  // Cluster questions by semantic type using embeddings
  const questionTypes = {
    factual: [], // Definition, date, formula, vocabulary
    conceptual: [], // Explain, why, how, compare
    application: [], // Solve, apply, analyze, evaluate
  };

  // Use embedding patterns to classify
  // Factual questions cluster near "define", "what is", "when"
  // Conceptual cluster near "why", "how", "explain"
  // Application cluster near "solve", "apply", "use"
};

// Adjust FSRS parameters by content type
const fsrsParams = {
  factual: {
    // Factual: Longer intervals (faster forgetting acceptable)
    // Definitions stabilize quickly, can be reviewed less frequently
    request_retention: 0.85,
    maximum_interval: 365,
  },
  conceptual: {
    // Conceptual: Shorter intervals (deeper encoding needed)
    // Understanding requires more repetition
    request_retention: 0.90,
    maximum_interval: 180,
  },
  application: {
    // Application: Moderate intervals, high retention target
    // Skills need practice but stabilize with use
    request_retention: 0.88,
    maximum_interval: 270,
  }
};
```

**Competitive Moat**: This would be the FIRST content-aware FSRS implementation in production

**Effort**: 10-12d (research, classification, parameter tuning, A/B testing) | **Impact**: Revolutionary
**Requires**: Vector embeddings, significant testing/validation
**Status**: Research phase - needs experimentation

---

### [PRODUCT] Prompt Engineering Improvements
**File**: `convex/aiGeneration.ts`
**Perspectives**: product-visionary, maintainability-maven
**Severity**: MEDIUM
**Impact**: Better question quality from AI generation

**Current State**: Prompts work but can be improved

**Enhancements**:

**1. Few-Shot Examples**:
```typescript
const EXAMPLES = `
GOOD EXAMPLE:
Q: What is the primary function of mitochondria?
Type: multiple-choice
Options: [A) Protein synthesis, B) Energy production, C) DNA storage, D) Waste removal]
Correct: B
Explanation: Mitochondria are the "powerhouses" - they produce ATP through cellular respiration.

BAD EXAMPLE (too vague):
Q: What do mitochondria do?
Options: [A) Stuff, B) Things, C) Work, D) Functions]
Correct: A
Explanation: They do stuff.

DO NOT generate questions like the bad example.
`;
```

**2. Better Distractor Engineering**:
```typescript
const DISTRACTOR_GUIDANCE = `
For each WRONG option, use a COMMON MISCONCEPTION or near-miss answer that
reveals a specific gap in understanding. Avoid obviously wrong answers.

Examples of good distractors:
- "Mitochondria perform protein synthesis" (confuses with ribosomes)
- "Mitochondria store genetic information" (confuses with nucleus)

Examples of bad distractors:
- "Mitochondria make pizza" (absurd, tests nothing)
- "Mitochondria are blue" (random, tests nothing)
`;
```

**3. Difficulty Calibration**:
```typescript
// Explicit difficulty tagging
const questionSchema = z.object({
  question: z.string(),
  type: z.enum(['multiple-choice', 'true-false', 'free-response']),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  explanation: z.string(),
  // NEW fields
  estimatedDifficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate']),
  tags: z.array(z.string()).optional(),
});
```

**Effort**: 3-4d | **Impact**: MEDIUM - Better quality questions
**Acceptance**: Generate questions with fewer obvious distractors, appropriate difficulty levels

---

### [PRODUCT] Knowledge Graph Visualization
**Perspectives**: product-visionary, user-experience-advocate
**Severity**: MEDIUM
**Impact**: Engagement and motivation through visual progress

**The Vision**: Show learners their knowledge as a network, not a list

**Features**:
- **Nodes**: Topics (sized by question count)
- **Edges**: Semantic relationships (via embeddings)
- **Colors**: Mastery level (red=struggling, yellow=learning, green=mastered)
- **Interactions**: Click node to drill into questions, zoom/pan
- **Smart Layout**: Force-directed graph or hierarchical

**Implementation**:
```typescript
// Build knowledge graph from embeddings
export const buildKnowledgeGraph = query({
  handler: async (ctx) => {
    const questions = await getAllActiveQuestions(ctx);

    // Cluster questions by topic similarity
    const clusters = clusterByEmbedding(questions);

    // Build graph structure
    const nodes = clusters.map(cluster => ({
      id: cluster.topic,
      label: cluster.topic,
      size: cluster.questions.length,
      color: getMasteryColor(cluster.averageSuccessRate),
    }));

    const edges = findTopicRelationships(clusters);

    return { nodes, edges };
  }
});

// Visualize with react-force-graph or vis-network
<ForceGraph2D
  graphData={knowledgeGraph}
  nodeLabel="label"
  nodeColor="color"
  linkColor={() => '#999'}
  onNodeClick={handleNodeClick}
/>
```

**Engagement Value**:
- Visual progress tracking (gamification)
- Identify weak connections in knowledge
- Motivational - see network growing
- Shareable (social proof)

**Effort**: 5-6d (graph building, visualization, UX) | **Impact**: MEDIUM-HIGH - Engagement
**Requires**: Vector embeddings
**Acceptance**: View knowledge graph, see 10 topic clusters, click to drill into questions

---

### [UX] Library Search & Advanced Filtering
**File**: `app/library/_components/library-client.tsx`
**Perspectives**: user-experience-advocate, performance-pathfinder
**Severity**: MEDIUM
**Impact**: Essential for 1000+ question libraries, hard to find specific items

**Problem**: No search/filter within library view. Users must manually scan paginated results.

**Features**:
1. Text search on question/topic fields with debouncing (300ms)
2. Filter by difficulty, date range, topic
3. Sort by creation date, success rate, last reviewed

**Implementation**:
```typescript
// New Convex query with text search
export const searchLibrary = query({
  args: { view, query: v.string(), filters: v.object({...}) },
  handler: async (ctx, args) => {
    // Use compound indexes for efficient filtering
    // Add text search on question/topic fields
  }
});

// New indexes needed:
// .index('by_user_topic_active', ['userId', 'topic', 'deletedAt', 'archivedAt'])
```

**Trade-offs**:
- ⚠️ Client-side = filters only current page (confusing UX)
- ✅ Backend = proper filtering but requires new indexes (bandwidth consideration per CLAUDE.md)

**Effort**: 4-5h | **Value**: HIGH - Unlocks large library usability
**Acceptance**: Search for "React hooks" in 1000-question library, results in <500ms

---

### [UX] Background Task Retry & Management
**File**: `convex/generationJobs.ts`
**Perspectives**: user-experience-advocate
**Severity**: MEDIUM
**Impact**: Users frustrated by transient failures (network, rate limits) with no recovery

**Features**:
1. **Retry Failed Jobs** (2h)
   - Add `retryCount` field to schema (default 0, max 3)
   - Create `retryJob` mutation: duplicate failed job with incremented count
   - Show retry button only when `retryCount < 3`
   - Display attempt count: "Attempt 2 of 3"

2. **Bulk Job Actions** (2h)
   - Checkbox selection in tasks table
   - Bulk cancel/delete with confirmation
   - Similar to library bulk actions pattern

3. **Job Export** (1h)
   - Export job results (prompt + generated questions) as JSON/CSV
   - Use browser download API: `URL.createObjectURL(new Blob([json]))`

**Effort**: 5h | **Value**: MEDIUM - Improves task management, reduces friction
**Acceptance**: Retry failed job, succeeds on second attempt; bulk delete 10 completed jobs

---

### [PRODUCT] Collections & Organization
**Perspectives**: product-visionary
**Impact**: Unlocks power users (10x LTV), reduces churn at 500+ questions

**Use Cases**:
- Medical students: Organize by system/organ/topic (nested folders)
- Language learners: Tag by grammar/vocabulary
- Teachers: Organize by course/unit/week

**Schema**:
```typescript
collections: defineTable({
  userId, name, parentId, color, icon
}).index('by_user').index('by_parent');

tags: defineTable({
  userId, name, color
}).index('by_user');
```

**Features**: Hierarchical folders, multi-tag, smart collections, bulk move

**Monetization**: Free (3 collections max), Premium (unlimited + nesting)

**Effort**: 5d | Needs design review for UX patterns

---

### [PRODUCT] AI Enhancements Suite
**Perspectives**: product-visionary
**Impact**: Unique differentiator, AI-native positioning

**Features**:
1. Explain This Answer (2d) - AI elaborates on correct answer
2. Adjust Difficulty (1d) - AI rewrites easier/harder
3. Generate Variations (2d) - Similar questions, different angles
4. Find Knowledge Gaps (3d) - Analyze weak areas, suggest questions
5. Semantic Search (2d) - Vector embeddings for related questions
6. Auto-Generated Explanations (2d) - Add "why" to imported questions

**Monetization**: Free (5 AI enhancements/month), Premium (unlimited)

**Effort**: 12d | Differentiation play, PR-worthy "AI-native SRS"

---

### [PRODUCT] Analytics Dashboard
**Impact**: 40% retention lift (progress visualization = motivation)

**Components**:
- Streak calendar (GitHub-style contribution graph)
- Retention curve (knowledge retention over time)
- Topic mastery heatmap (red=struggling, green=mastered)
- Study time tracking
- Forecast & predictions ("Master all cards in 6 weeks")
- Accuracy trends

**Monetization**: Premium tier feature

**Effort**: 9d | Gamification + engagement hooks

---

### [PRODUCT] React Native Mobile Apps
**Impact**: Native mobile experience, 2x engagement vs web

**Approach**: After PWA validation, build native apps

**Features**:
- Offline mode with local DB sync
- Push notifications for due reviews
- Camera for image-based questions (med students)
- Background refresh
- Widget support

**Monetization**: Premium tier (native apps vs free PWA)

**Effort**: 15d | Full platform expansion

---

### [ARCHITECTURE] Genesis Lab: Dynamic Pipeline Executor
**Perspectives**: architecture-guardian, complexity-archaeologist
**Severity**: MEDIUM (Strategic)
**Impact**: Enable arbitrary multi-phase configs in production, instant promotion/rollback

**Current State**: Production is hardcoded 2-phase pipeline (`buildIntentClarificationPrompt` → `buildQuestionPromptFromIntent`). Genesis Lab supports arbitrary phases but can't promote to production.

**The Problem**: Lab configs with 3+ phases or different variable naming can't be promoted without manually rewriting production code. Future vision (context-aware phases with learner data queries) fundamentally incompatible with current architecture.

**Decision Triggers** (build this when ANY occurs):
- Promoting >5 configs/month for 2+ consecutive months
- Production schema changes break all Lab configs (major refactor)
- Context-aware phases become necessary (Phase 2 dependency)

**Architecture Changes**:

**1. Database-Backed Production Config**
```typescript
// New table: productionConfigs
defineTable({
  configId: v.string(), // 'prod'
  name: v.string(),
  phases: v.array(v.object({
    name: v.string(),
    template: v.string(),
    outputTo: v.optional(v.string()),
  })),
  provider: v.string(),
  model: v.string(),
  temperature: v.optional(v.number()),
  maxTokens: v.optional(v.number()),
  isActive: v.boolean(),
  activatedAt: v.number(),
  activatedBy: v.id('users'),
  version: v.number(),
}).index('by_active', ['isActive'])
```

**2. Refactor aiGeneration.ts to Generic Executor**
```typescript
export const processGenerationJob = internalAction({
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.generationJobs.getJob, { jobId });

    // Read production config from DB (not hardcoded)
    const prodConfig = await ctx.runQuery(internal.configs.getProdConfig);

    // Execute phases dynamically
    const context: Record<string, any> = { userInput: job.userInput };

    for (const phase of prodConfig.phases) {
      const prompt = interpolateVariables(phase.template, context);

      const result = await generateText({
        model: createModel(prodConfig),
        prompt,
      });

      if (phase.outputTo) {
        context[phase.outputTo] = result.text;
      }
    }

    // Final phase output
    return context;
  }
});

function interpolateVariables(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
}
```

**3. Instant Promotion from Lab**
```typescript
// In config-manager-page.tsx
<Button onClick={async () => {
  await promoteToProduction(selectedConfig);
  toast.success('Config promoted to production - live immediately');
}}>
  Promote to PROD
</Button>

// Convex mutation
export const promoteToProduction = mutation({
  args: { configId: v.id('infraConfigs') },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    const user = await requireUser(ctx);

    // Deactivate current PROD
    const current = await ctx.db
      .query('productionConfigs')
      .withIndex('by_active', q => q.eq('isActive', true))
      .first();

    if (current) {
      await ctx.db.patch(current._id, { isActive: false });
    }

    // Activate new config
    await ctx.db.insert('productionConfigs', {
      ...config,
      isActive: true,
      activatedAt: Date.now(),
      activatedBy: user._id,
      version: (current?.version || 0) + 1,
    });

    return { success: true };
  }
});
```

**4. Safety: Fallback to Code + Sync Job**
```typescript
// If DB empty/corrupted, fall back to code
async function getProdConfig(ctx): Promise<InfraConfig> {
  const dbConfig = await ctx.db
    .query('productionConfigs')
    .withIndex('by_active', q => q.eq('isActive', true))
    .first();

  if (dbConfig) return dbConfig;

  // Fallback: Import from code
  return PROD_CONFIG_FROM_CODE;
}

// Hourly cron: Snapshot DB → code for audit trail
export const syncConfigToCode = internalMutation({
  schedule: { hourly: { minuteUTC: 0 } },
  handler: async (ctx) => {
    const prodConfig = await getProdConfig(ctx);

    // Generate PR with snapshot (manual approval)
    // Keeps git history synchronized with DB
  }
});
```

**Implementation Steps**:
1. Add `productionConfigs` table to schema (1h)
2. Migration: Seed initial PROD config from code (1h)
3. Refactor `aiGeneration.ts` to read from DB (4h)
4. Add promotion UI in Lab (2h)
5. Build rollback UI (show version history, revert) (2h)
6. Add monitoring/alerting for config changes (2h)
7. Testing: Verify promotion doesn't break generation (2h)

**Rollback Strategy**:
```typescript
// Instant rollback to previous version
export const rollbackProduction = mutation({
  args: { toVersion: v.number() },
  handler: async (ctx, args) => {
    // Find config at that version
    const target = await findConfigVersion(args.toVersion);

    // Activate it
    await promoteToProduction(ctx, { configId: target._id });
  }
});
```

**Effort**: 2-3 days | **Impact**: HIGH - Enables future evolution
**Prerequisites**: None (standalone improvement)
**Risk**: Runtime dependency on DB (mitigated by code fallback)

---

### [ARCHITECTURE] Genesis Lab: Context-Aware Phases
**Perspectives**: product-visionary, architecture-guardian
**Severity**: HIGH (Strategic)
**Impact**: Multi-action pipelines with learner data - major competitive differentiator

**Current State**: Phases are LLM calls with string template interpolation only. Can't fetch learner performance, query content library, or run computations.

**The Vision**: Question generation informed by learner's past performance, current content library, struggling topics, interests, etc.

**Example Pipeline**:
```typescript
{
  phases: [
    {
      type: 'query',
      name: 'Fetch User Performance',
      query: 'analytics:getUserPerformanceMetrics',
      args: { userId: '{{userId}}', topicId: '{{topicId}}', days: 30 },
      outputTo: 'performance'
    },
    {
      type: 'compute',
      name: 'Calculate Optimal Difficulty',
      function: 'algorithms:computeTargetDifficulty',
      args: {
        recentAccuracy: '{{performance.accuracy}}',
        topicMastery: '{{performance.mastery}}'
      },
      outputTo: 'targetDifficulty'
    },
    {
      type: 'llm',
      name: 'Generate Contextual Questions',
      template: `Generate questions about: {{userInput}}

Learner Context:
- Recent accuracy: {{performance.accuracy}}%
- Struggling with: {{performance.weakAreas}}
- Target difficulty: {{targetDifficulty}}

Generate questions that address their weak areas at appropriate difficulty...`,
      outputTo: 'questions'
    }
  ]
}
```

**Phase Types**:

**1. Query Phase** - Execute Convex query
```typescript
{
  type: 'query',
  name: 'Fetch Related Content',
  query: 'library:getRelatedQuestions',
  args: { topicId: '{{topicId}}', limit: 10 },
  outputTo: 'relatedContent'
}
```

**2. Compute Phase** - Run pure function
```typescript
{
  type: 'compute',
  name: 'Analyze Learning Gaps',
  function: 'analytics:identifyKnowledgeGaps',
  args: {
    performance: '{{performance}}',
    contentLibrary: '{{relatedContent}}'
  },
  outputTo: 'gaps'
}
```

**3. LLM Phase** - Generate with AI (existing)
```typescript
{
  type: 'llm',
  name: 'Generate Targeted Questions',
  template: 'Generate questions filling these gaps: {{gaps}}...',
  outputTo: 'questions'
}
```

**Context Management**:
- Context starts with: `{ userId, userInput, topicId }`
- Each phase adds to context via `outputTo`
- Later phases can reference any prior output
- Use Handlebars/JSONPath for complex references

**Security Considerations**:
- Phases run in action context (have auth)
- Query phases: whitelist of allowed queries
- Compute phases: whitelist of allowed functions
- No arbitrary code execution

**Lab UI Changes**:

**Phase Type Selector**:
```typescript
<Select value={phase.type} onValueChange={...}>
  <SelectItem value="query">Query Phase</SelectItem>
  <SelectItem value="compute">Compute Phase</SelectItem>
  <SelectItem value="llm">LLM Phase</SelectItem>
</Select>
```

**Query Builder** (for query phases):
```typescript
<Combobox
  label="Query to Execute"
  options={availableQueries} // Auto-complete from schema
  value={phase.query}
  onChange={...}
/>

<DynamicArgsEditor args={phase.args} querySchema={selectedQuerySchema} />
```

**Context Explorer** (show what's available):
```typescript
<Card>
  <CardHeader>Available Variables</CardHeader>
  <CardContent>
    <code>userId</code>: User ID (always available)
    <code>userInput</code>: User's prompt (always available)
    <code>performance</code>: From "Fetch User Performance" phase
    <code>targetDifficulty</code>: From "Calculate Difficulty" phase
  </CardContent>
</Card>
```

**Implementation Steps**:
1. Extend phase schema to support type + type-specific fields (2h)
2. Build phase executor with type dispatch (4h)
3. Implement query phase executor (2h)
4. Implement compute phase executor (2h)
5. Build Lab UI for phase type selection (3h)
6. Build query builder UI (4h)
7. Build compute function picker UI (3h)
8. Add context explorer/debugger (2h)
9. Testing: End-to-end multi-action pipeline (3h)

**Effort**: 1-2 weeks | **Impact**: Revolutionary - personalized learning at scale
**Prerequisites**: Dynamic Pipeline Executor (Phase 1)
**Risk**: Complexity - need excellent debugging tools

---

### [PRODUCT] Genesis Lab: Automated Testing & Rollout
**Perspectives**: product-visionary, architecture-guardian
**Severity**: MEDIUM (Quality)
**Impact**: Data-driven promotion decisions, safe canary deployments

**Current State**: Manual promotion with no metrics, no A/B testing, no gradual rollout.

**The Vision**: Automated quality assessment, canary deployments, automatic rollback on regression.

**Features**:

**1. A/B Testing Framework**
```typescript
// Run both configs on same inputs, compare results
export const compareConfigs = internalAction({
  args: {
    configA: v.id('infraConfigs'),
    configB: v.id('infraConfigs'),
    testInputs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results = {
      configA: { validCount: 0, avgLatency: 0, avgQuestions: 0 },
      configB: { validCount: 0, avgLatency: 0, avgQuestions: 0 },
    };

    // Run both configs in parallel
    for (const input of args.testInputs) {
      const [resultA, resultB] = await Promise.all([
        executeConfig(args.configA, input),
        executeConfig(args.configB, input),
      ]);

      // Collect metrics
      if (resultA.valid) results.configA.validCount++;
      results.configA.avgLatency += resultA.latency;
      // ... more metrics
    }

    // Statistical significance test
    const winner = determineWinner(results);

    return { results, winner, confidence: calculateConfidence(results) };
  }
});
```

**2. Canary Deployment with Gradual Rollout**
```typescript
// New field in productionConfigs
defineTable({
  // ... existing fields
  rolloutPercentage: v.number(), // 5, 25, 50, 100
  metricsWindow: v.object({
    successRate: v.number(),
    avgLatency: v.number(),
    errorRate: v.number(),
  }),
})

// Modified generation: Sample config by rollout percentage
export const processGenerationJob = internalAction({
  handler: async (ctx, { jobId }) => {
    const configs = await ctx.runQuery(internal.configs.getActiveConfigs);

    // Weighted random selection by rolloutPercentage
    const config = sampleByWeight(configs);

    // Execute and track metrics
    const result = await executeConfig(config, job.userInput);

    // Store metrics for monitoring
    await trackConfigMetrics(ctx, config._id, result);
  }
});
```

**3. Automated Rollback on Regression**
```typescript
// Hourly cron: Check canary metrics
export const monitorCanaryHealth = internalMutation({
  schedule: { hourly: { minuteUTC: 15 } },
  handler: async (ctx) => {
    const canary = await getCanaryConfig(ctx);
    const baseline = await getProdConfig(ctx);

    const canaryMetrics = await getMetrics(ctx, canary._id, last24Hours);
    const baselineMetrics = await getMetrics(ctx, baseline._id, last24Hours);

    // Check for regression (>10% drop in success rate)
    if (canaryMetrics.successRate < baselineMetrics.successRate * 0.9) {
      // Auto-rollback
      await rollbackToBaseline(ctx);

      // Alert
      await sendSlackAlert(`Canary config rolled back due to ${
        (1 - canaryMetrics.successRate / baselineMetrics.successRate) * 100
      }% regression in success rate`);
    } else if (canaryMetrics.successRate >= baselineMetrics.successRate) {
      // Promote to next stage (5% → 25% → 50% → 100%)
      await increaseRollout(ctx, canary._id);
    }
  }
});
```

**4. Metrics Collection**
```typescript
// Track every generation result
defineTable({
  configId: v.id('productionConfigs'),
  timestamp: v.number(),
  valid: v.boolean(),
  questionCount: v.number(),
  latency: v.number(),
  tokenCount: v.number(),
  userId: v.id('users'),
}).index('by_config_time', ['configId', 'timestamp'])

// Quality metrics (LLM-as-judge)
export const assessQuestionQuality = internalAction({
  handler: async (ctx, { questions }) => {
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        scores: z.array(z.object({
          clarity: z.number().min(0).max(1),
          accuracy: z.number().min(0).max(1),
          difficulty: z.enum(['too-easy', 'appropriate', 'too-hard']),
        })),
        overallQuality: z.number().min(0).max(1),
      }),
      prompt: `Rate the quality of these generated questions: ${JSON.stringify(questions)}...`,
    });

    return object;
  }
});
```

**5. Promotion Dashboard**
```typescript
// Show metrics comparison before promoting
<Card>
  <CardHeader>
    <CardTitle>Config Performance Comparison</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead>Current PROD</TableHead>
          <TableHead>Candidate</TableHead>
          <TableHead>Delta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Success Rate</TableCell>
          <TableCell>94.2%</TableCell>
          <TableCell>96.8%</TableCell>
          <TableCell className="text-green-600">+2.6%</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Avg Latency</TableCell>
          <TableCell>2.1s</TableCell>
          <TableCell>1.8s</TableCell>
          <TableCell className="text-green-600">-0.3s</TableCell>
        </TableRow>
        {/* ... more metrics */}
      </TableBody>
    </Table>

    <Button onClick={startCanaryDeployment} disabled={!metricsConfident}>
      Start Canary (5% rollout)
    </Button>
  </CardContent>
</Card>
```

**Implementation Steps**:
1. Add metrics tracking schema (1h)
2. Build metrics collection in generation (2h)
3. Implement A/B testing framework (1d)
4. Build canary deployment system (1d)
5. Automated health monitoring + rollback (1d)
6. LLM-as-judge quality assessment (1d)
7. Promotion dashboard UI (1d)
8. Slack/email alerting integration (0.5d)

**Effort**: 1 week | **Impact**: HIGH - Safe, data-driven promotion
**Prerequisites**: Dynamic Pipeline Executor (Phase 1)
**Risk**: Over-automation - still need human judgment for strategic changes

**Decision Triggers** (build this when ANY occurs):
- Promoting configs weekly and want confidence metrics
- Production incident from bad config (need canary safety)
- Multiple config variants to test (need A/B framework)

---

## Later (Someday/Maybe, 6+ months)

### [PRODUCT] Quality Feedback Loop
**Perspectives**: product-visionary
**Severity**: LOW
**Impact**: Improve AI generation quality over time

**Track which AI-generated questions are good/bad**:
```typescript
questions: defineTable({
  userEdited: v.optional(v.boolean()), // User edited content
  reportedAmbiguous: v.optional(v.boolean()), // Flagged as unclear
  userRating: v.optional(v.number()), // Explicit 1-5 rating
})

// Feed back into generation
// "Here are examples of high-quality vs low-quality questions you generated..."
```

**Effort**: 4-5d | **Impact**: MEDIUM - Continuous improvement
**Status**: Future enhancement after core features

---

### [UX] Generation Modal Enhancements
**File**: `components/generation-modal.tsx`
**Perspectives**: user-experience-advocate
**Severity**: LOW
**Impact**: Onboarding friction, users unsure what to generate

**Features**:
1. **Template/Quick Start Prompts** (1-2h)
   - Dropdown with examples: "NATO alphabet", "React Hooks", "Periodic Table"
   - Render as pills/chips, click to insert into textarea
   - Use Combobox component for searchable template list
   - Store user's recent prompts (last 5) in localStorage

2. **Recent Prompts History** (30m)
   - Show last 5 successfully generated prompts
   - Click to reuse/edit

**Trade-offs**:
- ✅ Easier onboarding, shows what's possible
- ⚠️ May encourage low-quality generic prompts
- ⚠️ Takes vertical space in modal

**Effort**: 2-3h | **Value**: LOW - Onboarding improvement
**Acceptance**: New user clicks "React Hooks" template, modal fills with example

---

### [UX] Review Flow Alternative Layouts
**File**: `components/review-flow.tsx`
**Perspectives**: user-experience-advocate
**Severity**: LOW
**Impact**: Some users may prefer different action button placement

**Alternatives Considered** (each 1-3h):

1. **Sticky Button Bar**
   - Fix buttons to bottom of viewport instead of inline
   - `sticky bottom-0 bg-background/95 backdrop-blur`
   - Trade-off: Always visible but takes screen space, may obscure content
   - Decision: Deferred - moving buttons above feedback is simpler

2. **Sidebar Action Panel** (Desktop Only)
   - Two-column grid: question (2/3) + actions (1/3)
   - Mobile: Stack vertically
   - Trade-off: Sophisticated but complex responsive logic
   - Decision: Deferred - too complex for current benefit

**Status**: Not implementing unless user feedback indicates strong preference

**Effort**: 4-5h for both | **Value**: LOW - Alternative UX patterns
**Reasoning**: Current solution (buttons above feedback) solves core problem with minimal complexity

---

### [UX] Real-time Generation Progress Enhancements
**File**: `components/generation-task-card.tsx`
**Perspectives**: user-experience-advocate
**Severity**: LOW
**Impact**: Better feedback during long generations

**Current State**: ✅ Basic progress already works via Convex `updateProgress` mutation

**Enhancements**:
1. **Visual Progress Bar** (30m) - Show `questionsGenerated / estimatedTotal` as progress bar
2. **ETA Calculation** (1h) - Estimate time remaining based on generation rate
3. **Phase Transitions** (30m) - Show visual transitions: "Parsing" → "Generating" → "Saving"

**Effort**: 2h | **Value**: LOW - Nice-to-have, core functionality already exists
**Acceptance**: See progress bar fill from 0% to 100%, ETA shows "~30 seconds remaining"

---

### [UX] Library View Alternatives
**File**: `app/library/_components/library-client.tsx`
**Perspectives**: user-experience-advocate
**Severity**: LOW
**Impact**: Power users want different navigation patterns for large libraries

**Options Considered**:

1. **Infinite Scroll** (3-4h)
   - Use IntersectionObserver for scroll-triggered loading
   - Append results instead of replacing pages
   - Add "Load More" fallback for accessibility
   - Trade-off: Hard to find specific items, memory growth with 1000+ items

2. **Jump to Page by Number** (2-3h)
   - Direct navigation: 1, 2, 3... with ellipsis (1...5 6 7...20)
   - Requires offset-based pagination (slower than cursor, can skip/duplicate items)
   - Trade-off: Doesn't align with Convex cursor API

**Decision**: Keep cursor pagination as default, add these as opt-in experiments if user demand warrants

**Effort**: 5-7h for both | **Value**: LOW-MEDIUM - Nice-to-have for power users
**Status**: Deferred until user feedback indicates need

---

### [PRODUCT] Question Marketplace
**Impact**: New revenue stream (70/30 revenue share with creators)

Marketplace for paid/free question sets. Teachers sell exam prep decks ($5-50/deck). Platform precedent: Teachers Pay Teachers ($200M ARR).

**Effort**: 13d | Platform revenue opportunity

---

### [PRODUCT] Medical Student Vertical
**Impact**: $35/mo ARPU (10x higher), 6M student TAM

Vertical features: Anatomy diagrams, clinical vignettes, drug cards, USMLE formatting, image questions, medical mnemonics, Anki medical deck import.

**Market**: $180M TAM (6M students × $30/mo avg)

**Effort**: 15d | Premium vertical expansion

---

### [PRODUCT] Public API & Integrations
**Impact**: Platform network effects, ecosystem lock-in

REST API, OAuth, webhooks, Zapier. Integrations: Notion sync, Obsidian plugin, Slack bot, Raycast extension.

**Monetization**: Free (1K calls/mo), Premium (100K calls/mo), Enterprise (unlimited)

**Effort**: 13d | Enterprise deal-maker

---

### [PRODUCT] Voice Interface
**Impact**: Hands-free reviews, accessibility

Voice commands, speak answers, TTS, hands-free mode. Use cases: Commuter (drive mode), visually impaired, athlete (exercise mode).

**Effort**: 10d | Accessibility + differentiation

---

### [PRODUCT] Browser Extension
**Impact**: Ambient learning, lower friction

Chrome/Firefox extension: Sidebar reviews, web clipper (highlight → question), new tab replacement.

**Effort**: 6d | Organic discovery via extension stores

---

## Technical Debt (Schedule)

### [REFACTOR] Named Constant for Shuffle Tier Size
**File**: `convex/spacedRepetition.ts:293`
**Source**: PR #44 review feedback
**Perspectives**: maintainability-maven
**Severity**: LOW
**Impact**: Magic number N=10 lacks semantic meaning

**Current**:
```typescript
const N = 10; // What does 10 represent?
const topCandidates = questionsWithPriority.slice(0, Math.min(N, questionsWithPriority.length));
```

**Better**:
```typescript
const SHUFFLE_TIER_SIZE = 10; // Number of top-priority items to interleave
const topCandidates = questionsWithPriority.slice(0, Math.min(SHUFFLE_TIER_SIZE, questionsWithPriority.length));
```

**Effort**: 5m | **Impact**: LOW - Clarity improvement
**Acceptance**: Variable name self-documents purpose

---

### [REFACTOR] Consolidate Pagination Logic
**File**: `app/library/_components/library-client.tsx`, `app/tasks/_components/tasks-client.tsx`
**Perspectives**: maintainability-maven, architecture-guardian
**Severity**: LOW
**Impact**: Pagination logic duplicated across library and tasks pages

**Problem**: Cursor pagination state management copy-pasted between components. Future pagination features (keyboard shortcuts, URL state) require editing multiple files.

**Solution**: Extract to reusable hook
```typescript
// hooks/use-cursor-pagination.ts
export function useCursorPagination({ initialPageSize = 50 }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const handleNext = (continueCursor: string) => {
    setCursorStack(prev => [...prev, cursor!]);
    setCursor(continueCursor);
  };

  const handlePrevious = () => {
    const prev = cursorStack[cursorStack.length - 1];
    setCursorStack(stack => stack.slice(0, -1));
    setCursor(prev);
  };

  const reset = () => {
    setCursor(null);
    setCursorStack([]);
  };

  return { cursor, pageSize, handleNext, handlePrevious, reset, setPageSize, hasPrevious: cursorStack.length > 0 };
}
```

**Benefit**: DRY, consistent behavior, easier to add features (keyboard shortcuts, URL state sync)

**Effort**: 1-2h | **Value**: MEDIUM - Future-proofs pagination pattern
**Acceptance**: Library and Tasks pages use same hook, add keyboard shortcut to both in one place

---

### [REFACTOR] Extract Unified TaskCard Component
**File**: `components/generation-task-card.tsx`, `app/tasks/_components/tasks-table.tsx`
**Perspectives**: maintainability-maven
**Severity**: LOW
**Impact**: Task display logic duplicated in sheet (GenerationTaskCard) and table (TaskRow)

**Problem**: Changes to job display require editing two components. Inconsistent styling, status badges, action buttons.

**Solution**: Single TaskCard component with view mode prop
```typescript
// components/task-card.tsx
export function TaskCard({
  job,
  view: 'compact' | 'detailed',
  showActions = true
}) {
  // Unified rendering logic
  // compact = for sheet, detailed = for table row
}
```

**Effort**: 2h | **Value**: LOW - Consistency, less duplication
**Acceptance**: Update status badge color, changes reflect in both sheet and tasks page

---

### [UX] Pagination UI Polish
**Files**: `app/library/_components/library-pagination.tsx`, `app/tasks/_components/*`
**Perspectives**: user-experience-advocate
**Severity**: LOW
**Impact**: Small UX improvements to pagination experience

**Enhancements**:
1. **Skeleton Loaders** (30m) - Show shimmer during page transitions instead of blank state
2. **Keyboard Shortcuts** (15m) - `[` and `]` for Previous/Next navigation
3. **Optimistic Loading** (20m) - Disable buttons during fetch, show loading spinner

**Effort**: 1h total | **Value**: LOW - Perceived performance, power user efficiency
**Acceptance**: Press `]` to go to next page, see skeleton loader during transition

---

### [UX] Empty State Illustrations
**Files**: `app/library/_components/library-empty-states.tsx`, `app/tasks/_components/tasks-client.tsx`
**Perspectives**: user-experience-advocate
**Severity**: LOW
**Impact**: Generic empty states lack personality, first-time user experience

**Current**: Text-only empty states with emoji
**Enhancement**: Custom SVG illustrations matching brand (hexagon crystal theme)

**Illustrations Needed**:
- Empty library: Crystal with question marks floating around
- No tasks: Crystal ball with "nothing to see" theme
- No search results: Magnifying glass over crystal

**Effort**: 1-2h (design + implementation) | **Value**: LOW - Brand delight, onboarding
**Acceptance**: Empty library shows custom illustration instead of generic emoji

---

### [SECURITY] Webhook Fails Open Without Secret
**File**: `convex/http.ts:56-62`
**Severity**: CRITICAL

When `CLERK_WEBHOOK_SECRET` not configured, returns 200 instead of failing closed. Authentication bypass if misconfigured in production.

**Fix**: Return 403 in production when secret missing
**Effort**: 15m

---

### [SECURITY] Stack Traces in Production Logs
**File**: `convex/lib/logger.ts:69-86`
**Severity**: MEDIUM

Full stack traces logged (exposes file paths, library versions). Remove stack traces in production, keep error name/message only.

**Effort**: 1h

---

### [PERFORMANCE] Background Tasks Panel Filters
**File**: `components/background-tasks-panel.tsx:22-26`
**Severity**: MEDIUM

4× `.filter()` calls on every render. Memoize filtered arrays.

**Effort**: 5m

---

### [UX] Generic Bulk Operation Errors
**File**: `app/library/_components/library-client.tsx:71-164`
**Severity**: HIGH

5 bulk operations show generic "Failed to archive questions". Classify errors (network, auth, not found) with recovery steps.

**Effort**: 1h (apply to all 5 operations)

---

### [UX] No Loading State on Answer Submission
**File**: `components/review-session.tsx:49-72`
**Severity**: MEDIUM

No feedback during async call, users double-click. Add loading state + disabled button.

**Effort**: 20m

---

### [UX] Small Mobile Touch Targets
**File**: `components/review-session.tsx:95-135`
**Severity**: MEDIUM

Answer buttons ~36px height, below 44px iOS minimum (WCAG). Add `min-h-[44px]`.

**Effort**: 20m

---

### [TESTING] Cron Cleanup Tests
**File**: `convex/generationJobs.ts:260-293`
**Severity**: CRITICAL

Daily cron has no tests. Wrong threshold = data loss or DB bloat. Add contract tests for 7-day/30-day thresholds.

**Effort**: 2h

---

### [CLEANUP] Remove Deprecated Mutations
**Files**: `convex/questionsCrud.ts:213-287`
**Severity**: LOW

`softDeleteQuestion`, `restoreQuestion` marked `@deprecated` with no timeline. Add migration deadline, remove after grace period.

**Effort**: 5m (add timeline) + 30m (eventual removal)

---

## Learnings

**From Strategic Roadmap Session (2025-10-20)**:

**Intelligence Layer is the Moat**: The technical foundation is excellent. The next competitive advantage comes from making the system content-aware:
- Vector embeddings enable semantic understanding (not just text matching)
- Deduplication prevents AI-generated clutter
- Adaptive generation creates personalized learning paths
- Content-aware FSRS optimizes scheduling based on question types

**Pure FSRS + Smart Interleaving**: The tension between "no artificial interleaving" and "fix batching artifacts" is resolved by priority bands. Shuffling within equal-urgency windows respects memory science while improving UX.

**Free Response = Depth**: Moving beyond multiple-choice to free response with AI grading enables deeper learning. LLM-as-judge pattern proven effective, cost acceptable ($0.0001/question).

**Embeddings Unlock Everything**: Vector search is foundational for:
- Deduplication (find similar questions)
- Semantic search (find related content)
- Postpone related items (content grouping)
- Knowledge graphs (visualize connections)
- Content-aware FSRS (question type classification)

**From Previous Grooming (2025-10-17)**:

**Complexity Management**: Post-PR#32 refactor demonstrates excellent architectural discipline. `IScheduler` abstraction, modular backend, atomic validation pattern are gold standards. Primary remaining issue: `spacedRepetition.ts` god object (740 LOC, 5 responsibilities).

**Performance Insights**: Database bandwidth optimization (PR#39) successfully eliminated O(N) queries with incremental counters. Remaining issues are unbounded stats queries (streak, retention) lacking `.take()` limits and compound indexes. These are follow-on optimizations to the core strategy.

**Security Posture**: No critical code vulnerabilities, but environment management is weak. Production secrets on filesystem is the biggest exposure. Dependency hygiene needed (happy-dom RCE, jsondiffpatch XSS).

**Product-Market Gap**: Technically excellent ($0 ARR, no monetization). The 80/20 insight: 5 critical product gaps (export, import, freemium, sharing, mobile) block 80% of potential revenue. Fix these in 28 days → unlock $500K ARR path.

**UX Philosophy**: "Silent failures harm trust more than broken features." Every error message should guide recovery. Auto-save prevents data loss. Loading states prevent double-clicks. These micro-interactions compound into product quality perception.

**AI-Native Vision**: Scry's differentiator isn't "Anki with AI generation" (commodity). It's "AI-native learning platform" - AI explains, adjusts difficulty, finds gaps, generates variations. No competitor has comprehensive AI assistance across the learning lifecycle.

---

## Metrics Summary

**Code Quality**: A-
- Technical debt: 15 items, ~20h effort
- Well-architected post-refactor
- Strong foundations (modularity, type safety, test coverage)

**Strategic Opportunities**: Intelligence Layer
- P0 Foundation: Vector embeddings (4-5d)
- High Impact: Deduplication (6-7d), Free response (5-6d), Adaptive generation (7-8d)
- Differentiation: Content-aware FSRS (10-12d research)

**Product Opportunities**: $500K ARR potential
- Critical gaps: 5 items, 28 days effort
- Differentiation: 4 items, 31 days effort
- Platform expansion: 6 items, 60+ days effort

**Security Posture**: B
- CRITICAL: Secret management (2h fix)
- HIGH: Dependency updates (30m fix)
- MEDIUM: Webhook auth, logging (2h fix)

**Performance**: B+
- CRITICAL: O(n²) selection (30m fix)
- CRITICAL: Unbounded stats (2h fix)
- Post-bandwidth-optimization wins intact

**Cross-Perspective Consensus** (flagged by 3+ agents):
1. **spacedRepetition.ts complexity** → Split into 4 modules (6-8h)
2. **Unbounded stats queries** → Add indexes + limits (2h)
3. **Vector embeddings** → Foundation for intelligence layer (4-5d)
4. **No monetization** → Freemium tier (8d)
5. **No export** → JSON/CSV/APKG/PDF (4.5d)

**Recommended Action Plan**:

**Week 1-2 (Quick Wins + Security)**:
- Smart interleaving (2-3h)
- Progress indicators (2-3h)
- Fix O(n²) selection algorithm (30m)
- Fix unbounded stats queries (2h)
- Update vulnerable dependencies (30m)

**Week 3-6 (Intelligence Foundation)**:
- Vector embeddings infrastructure (4-5d)
- Free response with AI grading (5-6d)
- Deduplication system (6-7d)

**Week 7-10 (Adaptive Features)**:
- Adaptive question generation (7-8d)
- Postpone with related items (6-7h)
- Smart interleaving refinements (2-3d)

**Week 11-14 (Product-Market Fit)**:
- Freemium monetization (8d)
- Data export (4.5d)
- Data import (7d)
- Question sharing (3d)

**Result**: Transforms Scry from "Anki clone with AI" to "First content-aware SRS platform"

---

**Last Updated**: 2025-10-20
**Next Grooming**: Q1 2026 (or when 3+ critical issues emerge)

**Recent Additions** (2025-10-20):
- Strategic roadmap synthesis: Vector embeddings, deduplication, adaptive generation, content-aware FSRS
- Free response questions with AI grading (LLM-as-judge pattern)
- Smart review interleaving (topic dispersion within priority bands)
- Progress indicators for review sessions
- Postpone action with related items support
- Knowledge graph visualization
- Prompt engineering improvements
- Quality feedback loop system
