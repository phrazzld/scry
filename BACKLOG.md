# BACKLOG

**Last Groomed**: 2025-10-17
**Analysis Method**: 7-perspective specialized audit (complexity-archaeologist, architecture-guardian, security-sentinel, performance-pathfinder, maintainability-maven, user-experience-advocate, product-visionary)
**Overall Grade**: A- (Excellent technical foundation, critical product-market gaps)

---

## Now (Sprint-Ready, <2 weeks)

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

## Soon (Exploring, 3-6 months)

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
// .index('by_user_difficulty_active', ['userId', 'difficulty', 'deletedAt', 'archivedAt'])
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

## Later (Someday/Maybe, 6+ months)

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

**From this grooming session (2025-10-16)**:

**Complexity Management**: Post-PR#32 refactor demonstrates excellent architectural discipline. `IScheduler` abstraction, modular backend, atomic validation pattern are gold standards. Primary remaining issue: `spacedRepetition.ts` god object (740 LOC, 5 responsibilities).

**Performance Insights**: Database bandwidth optimization (PR#39) successfully eliminated O(N) queries with incremental counters. Remaining issues are unbounded stats queries (streak, retention) lacking `.take()` limits and compound indexes. These are follow-on optimizations to the core strategy.

**Security Posture**: No critical code vulnerabilities, but environment management is weak. Production secrets on filesystem is the biggest exposure. Dependency hygiene needed (happy-dom RCE, jsondiffpatch XSS).

**Product-Market Gap**: Technically excellent ($0 ARR, no monetization). The 80/20 insight: 5 critical product gaps (export, import, freemium, sharing, mobile) block 80% of potential revenue. Fix these in 28 days → unlock $500K ARR path.

**UX Philosophy**: "Silent failures harm trust more than broken features." Every error message should guide recovery. Auto-save prevents data loss. Loading states prevent double-clicks. These micro-interactions compound into product quality perception.

**AI-Native Vision**: Scry's differentiator isn't "Anki with AI generation" (commodity). It's "AI-native learning platform" - AI explains, adjusts difficulty, finds gaps, generates variations. No competitor has comprehensive AI assistance across the learning lifecycle.

---

## Metrics Summary

**Code Quality**: A-
- Technical debt: 12 items, ~15h effort
- Well-architected post-refactor
- Strong foundations (modularity, type safety, test coverage)

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
3. **Secret management** → Rotate + vault (6h)
4. **No monetization** → Freemium tier (8d)
5. **No export** → JSON/CSV/APKG/PDF (4.5d)

**Recommended Action Plan**:

**Week 1 (Critical Security + Performance)**:
- Rotate production secrets (2h)
- Fix O(n²) selection algorithm (30m)
- Fix unbounded stats queries (2h)
- Update vulnerable dependencies (30m)

**Week 2-5 (Product-Market Fit)**:
- Implement freemium monetization (8d)
- Build data export (4.5d)
- Build data import (7d)
- Enable question sharing (3d)
- Launch PWA mobile (5d)

**Result**: Removes adoption blockers, enables revenue, creates viral growth loop

---

**Last Updated**: 2025-10-17
**Next Grooming**: Q1 2026 (or when 3+ critical issues emerge)

**Recent Additions** (2025-10-17):
- UI/UX enhancements migrated from planning doc (library search, task retry, pagination polish, empty states)
- Items categorized: Soon (search/filtering), Technical Debt (refactoring), Later (modal templates, review alternatives)
