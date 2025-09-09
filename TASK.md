need a better way to see / verify / access freshly generated questions.

example: i just clicked the generate questions button in the navbar. entered "nato phonetic alphabet". submitted. got the spinner, then the success toast. but i'm still on the current question. and the total number of questions in the review progress bar doesn't change. and there's no way for me to go see the questions that have allegedly been generated. not ideal ux!

let's figure out what the best ui/ux design is here, while still adhering to our north star and paramount design principle of hypersimplicity.

---

# Enhanced Specification: Pure FSRS with Fresh Question Priority

## Core Philosophy: Brutal Honesty in Spaced Repetition

### The Hypersimple Truth
We implement **pure FSRS** without comfort features or artificial limits. The Ebbinghaus forgetting curve doesn't care about your comfort - when something needs review, it needs review NOW. Daily limits are a comfortable lie that corrupts the algorithm.

```typescript
// Traditional SRS (scientifically incorrect)
if (dueToday > dailyLimit) {
  postpone(excess)  // This breaks the forgetting curve!
}

// Our approach (scientifically pure)
if (isDue) {
  reviewNow()  // Period. No exceptions.
}
```

### Key Principles
1. **No Daily Limits**: If 300 cards are due, show 300 cards
2. **Fresh First**: New questions always prioritize over reviews (FSRS standard)
3. **Trust Through Predictability**: Generated questions appear immediately in queue
4. **Natural Self-Regulation**: Users learn sustainable pace through experience
5. **Transparent Consequences**: See real impact of generation choices

## Solution Architecture

### The Problem
After generating questions, users experience a "dead end":
- Success toast appears but no way to verify what was created
- Questions saved to database but invisible to user
- Progress counter doesn't update
- Breaks trust and workflow continuity

### The Solution
Maintain review-first paradigm while providing subtle transparency:
- **No Navigation**: Stay in review flow (hypersimplicity)
- **Fresh Priority**: Generated questions appear immediately in queue
- **Real-Time Updates**: Counters and progress update within 2 seconds
- **Visual Confirmation**: "New" badges and enhanced toasts

## FSRS Implementation Details

### Queue Priority Algorithm
```typescript
// FSRS-standard retrievability scoring
const getRetrievability = (question) => {
  if (!question.lastReview) {
    // New questions (including just generated)
    const hoursSinceCreation = (Date.now() - question.createdAt) / 3600000
    if (hoursSinceCreation < 1) {
      return -2  // Ultra-fresh: just generated
    }
    return -1    // Regular new card
  }
  
  // Calculate standard FSRS retrievability for reviewed cards
  return calculateFSRSRetrievability(question)
}

// Queue order (no limits, no slicing)
const queueOrder = [
  ...newQuestions,      // All new (retrievability: -2 to -1)
  ...learningQuestions, // In learning phase (retrievability: ~0)
  ...dueReviews,       // All due reviews (retrievability: 0 to 1)
]
```

### Why Fresh First is Correct
1. **FSRS Standard**: New cards always precede reviews in proper SRS
2. **Memory Science**: Initial encoding must happen before strengthening
3. **User Intent**: Generation = explicit request for new material
4. **Learning Chain**: Introduction → Learning → Review → Retention

## Implementation Strategy

### Phase 1: Immediate Improvements (Ship Today)

#### 1. Enhanced Success Toast
```typescript
// generation-modal.tsx:112
toast.success(`✓ ${savedQuestionIds.length} questions generated`, {
  description: topic,
  duration: 4000,
})

// Dispatch event for UI coordination
window.dispatchEvent(new CustomEvent('questions-generated', {
  detail: { count: savedQuestionIds.length, topic }
}))
```

#### 2. Aggressive Polling
```typescript
// review-flow.tsx
const [pollInterval, setPollInterval] = useState(30000)

useEffect(() => {
  const handleGeneration = () => {
    setPollInterval(1000) // Aggressive for 5 seconds
    setTimeout(() => setPollInterval(30000), 5000)
  }
  window.addEventListener('questions-generated', handleGeneration)
  return () => window.removeEventListener('questions-generated', handleGeneration)
}, [])
```

#### 3. "New" Badge
```typescript
// In question display
{question.createdAt > Date.now() - 3600000 && (
  <Badge variant="secondary" size="sm">
    New
  </Badge>
)}
```

#### 4. Honest Progress Display
```typescript
// No limits, show reality
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>{completed} reviewed</span>
    <span className="font-medium">
      {totalDue} total due
    </span>
  </div>
  <Progress value={(completed / totalDue) * 100} />
  {totalDue > 100 && (
    <p className="text-xs text-muted-foreground">
      This is your real learning debt. Each review matters.
    </p>
  )}
</div>
```

### Phase 2: Smart Scheduling (Week 1)

#### 5. Freshness Decay
```typescript
// Exponential decay over 24 hours
const getFreshnessPriority = (createdAt) => {
  const hoursSinceCreation = (Date.now() - createdAt) / 3600000
  return Math.exp(-hoursSinceCreation / 24) * 1000
}
```

#### 6. Intelligent Interleaving
```typescript
// Prevent topic fatigue
function interleaveQuestions(fresh, reviews) {
  const result = []
  let consecutiveNew = 0
  
  while (fresh.length || reviews.length) {
    if (consecutiveNew >= 3 && reviews.length) {
      result.push(reviews.shift())
      consecutiveNew = 0
    } else if (fresh.length) {
      result.push(fresh.shift())
      consecutiveNew++
    } else {
      result.push(...reviews)
      break
    }
  }
  return result
}
```

#### 7. Visual Cues
- Review button pulse animation after generation
- Subtle highlight on first new question
- Progress bar segments showing new vs due

### Phase 3: Intelligence Layer (Week 2+)
- Learn optimal new/review ratios per user
- Topic fatigue detection
- Predictive queue generation
- Performance-based interleaving

## Technical Requirements

### Backend (Convex)
- Modify `getNextReview` to prioritize by retrievability
- Add freshness calculation to queue generation
- No schema changes required (use existing `createdAt`)

### Frontend (React/Next.js)
- Dynamic polling intervals in `usePollingQuery`
- Event system for generation coordination
- Enhanced toast notifications with Sonner
- Badge component for new questions

### Performance Targets
- Queue update latency < 2 seconds
- Polling overhead < 1% CPU
- Support 1000+ questions efficiently

## Success Metrics

### User Experience
- 90% of generated questions reviewed immediately
- Reduced support tickets about "missing" questions
- Increased generation-to-review conversion

### Technical
- Counter updates within 2 seconds of generation
- No mid-question interruptions
- Smooth queue regeneration between questions

### Learning Outcomes
- Improved retention through immediate review
- Natural pacing through self-regulation
- Respect for memory science principles

## The Beautiful Consequence

This system creates powerful feedback loops:
1. **Generate Responsibly**: Adding 50 questions means 50 reviews
2. **Review Consistently**: Skip a day, face compound interest of memory
3. **Natural Pacing**: Find sustainable rate through experience
4. **True Learning**: No hiding from what needs to be learned

The result: A spaced repetition system in its **purest form** - no compromises, no comfort features, just the algorithm and your commitment to learning.
