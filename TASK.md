### Spaced Repetition Engine
- [ ] **Integrate ts-fsrs with Convex** [3 days]
  * Problem: Library installed but unused, no scheduling system
  * Solution: Convex cron jobs + FSRS algorithm + real-time updates
  * Success: Users see next review time immediately after answering
  * UI: Smart review queue that updates in real-time

---

# Enhanced Specification

## Research Findings

### Industry Best Practices
- **FSRS Algorithm Superiority**: The Free Spaced Repetition Scheduler (FSRS) represents the current state-of-the-art, achieving 30-50% fewer reviews than SM-2 while maintaining higher retention rates
- **Unified Review Stream**: Modern systems favor a single, algorithmically-optimized review queue over multiple decks/categories
- **Server-Side Processing**: All scheduling calculations should happen server-side for data integrity and consistency
- **Real-Time Updates**: Leverage Convex's reactive queries for instant UI updates when cards become due
- **Mobile-First Design**: Majority of spaced repetition happens on mobile devices during micro-learning sessions

### Technology Analysis
- **ts-fsrs**: Provides TypeScript-native FSRS implementation with strong typing and proven algorithm
- **Convex Real-Time**: Perfect for reactive review queues and instant scheduling updates
- **Database Indexes**: Critical for performance - `by_user_next_review` index enables efficient due card queries
- **No External Dependencies**: System can be fully self-contained within existing stack

### Codebase Integration
- **Extend Questions Table**: Questions already have user ownership and interaction tracking - natural fit for FSRS fields
- **Existing Patterns**: `recordInteraction` mutation perfect for triggering FSRS updates
- **Authentication**: Magic link auth provides user isolation for personalized schedules
- **Real-Time UI**: Existing `useQuery` patterns work perfectly for reactive review queues

## Detailed Requirements

### Functional Requirements
- **Automatic Scheduling**: 100% of questions automatically enter spaced repetition upon first interaction
- **Unified Review Stream**: Single queue showing the most important question to review next (no categories/decks)
- **FSRS Integration**: Use ts-fsrs for all scheduling calculations with standard parameters
- **Previous Attempts Display**: Show success rate and attempt history for each question during review
- **Immediate Updates**: Next review time calculated and displayed instantly after answering
- **No Manual Management**: No reset, bulk operations, or manual scheduling adjustments

### Non-Functional Requirements
- **Performance**: Review queue generation must complete in <100ms for up to 10,000 questions per user
- **Mobile Optimization**: All interfaces optimized for mobile-first usage
- **Simplicity**: No statistics dashboards, gamification, or complex configuration in v1
- **Reliability**: Server-side calculations only - no client-side scheduling logic

## Architecture Decisions

### Technology Stack
- **Algorithm**: ts-fsrs (not yet installed - needs `pnpm add ts-fsrs`)
- **Backend**: Convex mutations and queries for all FSRS calculations
- **Database**: Extend existing questions table with FSRS fields
- **Frontend**: React with existing real-time hooks

### Design Patterns
- **Single Source of Truth**: Database stores complete FSRS state - no recalculation from history
- **Atomic Updates**: Use Convex mutations to ensure consistent state updates
- **Denormalization**: Store computed next review time for efficient querying

## Implementation Strategy

### Development Approach
1. Install ts-fsrs dependency
2. Extend questions schema with FSRS fields
3. Create Convex mutations for review scheduling
4. Build unified review interface
5. Add real-time review queue query
6. Integrate with existing quiz flow

### MVP Definition
1. Questions automatically scheduled after first interaction
2. Single review queue showing next card due
3. Four rating buttons (Again/Hard/Good/Easy) 
4. Display of previous attempts and success rate
5. Instant next review calculation

### Technical Risks
- **Risk 1**: Performance with large question sets → Mitigation: Proper indexing on nextReview field
- **Risk 2**: Migration of existing questions → Mitigation: Lazy initialization on first review
- **Risk 3**: Algorithm parameter tuning → Mitigation: Start with FSRS defaults, iterate based on data

## Integration Requirements

### Schema Extension
```typescript
// Add to existing questions table
questions: defineTable({
  // ... existing fields ...
  
  // FSRS scheduling fields
  nextReview: v.optional(v.number()), // Timestamp of next review
  stability: v.optional(v.number()),   // FSRS stability parameter
  fsrsDifficulty: v.optional(v.number()), // FSRS difficulty (not quiz difficulty)
  elapsedDays: v.optional(v.number()),
  scheduledDays: v.optional(v.number()),
  reps: v.optional(v.number()),
  lapses: v.optional(v.number()),
  state: v.optional(v.union(
    v.literal("new"),
    v.literal("learning"), 
    v.literal("review"),
    v.literal("relearning")
  )),
  lastReview: v.optional(v.number()),
})
  .index("by_user_next_review", ["userId", "nextReview"])
```

### API Design
```typescript
// Core mutations
export const scheduleReview = mutation({
  args: {
    questionId: v.id("questions"),
    rating: v.union(v.literal("Again"), v.literal("Hard"), v.literal("Good"), v.literal("Easy")),
    timeSpent: v.number(),
  },
  handler: async (ctx, args) => {
    // Update FSRS state and record interaction
  },
});

// Review queue query
export const getNextReview = query({
  handler: async (ctx) => {
    // Return single most important question to review
  },
});
```

### Data Flow
1. User completes quiz → Questions saved with initial FSRS state
2. User answers question → `scheduleReview` mutation updates FSRS fields
3. Review interface queries `getNextReview` → Shows most important card
4. Real-time updates when cards become due

## Testing Strategy

### Unit Testing
- FSRS calculation accuracy
- State transitions (new → learning → review)
- Edge cases (lapses, relearning)

### Integration Testing
- Review scheduling after quiz completion
- Real-time queue updates
- Interaction recording with FSRS updates

### End-to-End Testing
- Complete review session flow
- Mobile responsiveness
- Performance with realistic data volumes

## Deployment Considerations

### Database Migration
- Lazy initialization: FSRS fields populated on first review
- No need to migrate historical data
- Backward compatible with existing questions

### Monitoring
- Track average retention rates
- Monitor review queue generation performance
- Alert on scheduling calculation errors

## Success Criteria

### Acceptance Criteria
- All questions automatically enter spaced repetition
- Review queue updates in real-time
- Next review times display immediately after answering
- Previous attempts visible during review
- Mobile-optimized interface

### Performance Metrics
- Review queue generation <100ms
- Zero scheduling calculation errors
- 100% of questions trackable via FSRS

## Future Enhancements

### Post-MVP Features
- Personalized FSRS parameters based on user performance
- Automatic difficulty adjustment
- Review statistics dashboard
- Batch review mode
- Offline support with sync

### Scalability Roadmap
- Implement FSRS optimizer for parameter tuning
- Add review forecasting
- Support for multimedia questions
- Advanced analytics and insights

## Implementation Notes

### Automatic Difficulty Adjustment
**Decision**: Include in this PR if straightforward, otherwise add to BACKLOG.md

After investigation, automatic difficulty adjustment involves:
1. Tracking consistent performance patterns (e.g., always rating "Easy" on a question)
2. Adjusting the FSRS difficulty parameter accordingly
3. This is built into FSRS algorithm - happens automatically with each review

**Recommendation**: This is inherent to FSRS and requires no additional work. The algorithm automatically adjusts difficulty based on user performance through the `fsrs.next()` method.

### Key Decisions Made
1. **Single Table**: Extend questions table rather than separate cardStates table
2. **No Categories**: Unified review stream only
3. **No Limits**: No daily limits or vacation mode
4. **Server-Side Only**: All FSRS calculations in Convex
5. **Mobile-First**: All UI optimized for mobile devices
6. **Simplicity**: No stats, gamification, or personalization in v1
7. **Unified Interface**: Quiz and review interfaces consolidated into one
8. **Immediate Availability**: Questions without nextReview date appear immediately in queue
9. **FSRS Retrievability**: Use FSRS's retrievability calculation for prioritization
10. **All History Shown**: Display complete interaction history (with scalable UI)
11. **No Migration**: Start fresh with FSRS - no historical data migration
12. **Immediate Deployment**: No feature flags - deploy to all users

### Implementation Specifics

#### Review Queue Logic
```typescript
// Questions appear in review queue if:
// 1. nextReview is null/undefined (new questions)
// 2. nextReview <= current time (due for review)
// Priority: Sort by FSRS retrievability (lowest first)
```

#### Historical Attempts Display
- Show all attempts in a scrollable list
- Display: date, rating given, time spent
- Visual indicator for success/failure
- Collapse/expand for questions with many attempts

#### Unified Quiz/Review Interface
- Single component handles both new questions and reviews
- Context determines UI elements (e.g., show history for reviews)
- Seamless transition between quiz generation and review mode

#### Empty State Handling
- No questions at all: "Create your first quiz to start learning!"
- All reviews complete: "Great job! All reviews complete for now. Create more questions or check back later."

#### Default FSRS State
- All questions created with state: "new"
- First interaction triggers FSRS scheduling
- No special handling for existing questions