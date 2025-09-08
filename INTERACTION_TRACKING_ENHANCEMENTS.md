# Interaction Tracking Enhancements Plan

## Executive Summary
This document outlines proposed enhancements to the `interactions` table to build a more intelligent learning system with deeper insights into user behavior, learning patterns, and performance optimization opportunities.

## Current State

### Existing Fields
The `interactions` table currently tracks:
```typescript
{
  userId: Id<"users">,           // User who answered
  questionId: Id<"questions">,   // Question answered
  userAnswer: string,             // Answer provided
  isCorrect: boolean,             // Correctness
  attemptedAt: number,            // Timestamp
  timeSpent?: number,             // Time in milliseconds
  context?: {
    sessionId?: string,           // Session grouping
    isRetry?: boolean,            // Retry indicator
  }
}
```

### Current Capabilities
- ✅ Track answer accuracy
- ✅ Record response time
- ✅ Link to user and question
- ✅ Group by session
- ✅ Identify retry attempts

### Limitations
- ❌ No confidence tracking
- ❌ No device/platform information
- ❌ No difficulty perception
- ❌ No environmental context
- ❌ No learning modality preferences
- ❌ No attention/focus indicators

## Proposed Enhancements

### Phase 1: Core Behavioral Metrics (High Priority)

#### 1. Confidence Tracking
```typescript
confidence?: {
  preAnswer?: number,    // 1-5 scale before answering
  postAnswer?: number,   // 1-5 scale after seeing result
  certainty?: 'guess' | 'unsure' | 'confident' | 'certain'
}
```
**Benefits**:
- Identify overconfidence patterns
- Detect knowledge gaps vs lucky guesses
- Improve FSRS difficulty calibration
- Personalize review scheduling

#### 2. Response Patterns
```typescript
responsePattern?: {
  changedAnswer?: boolean,      // Did user change selection
  hesitationTime?: number,      // Time before first selection
  abandonedAt?: number,         // If user left without answering
  interruptions?: number,       // Focus lost during answer
}
```
**Benefits**:
- Detect uncertainty signals
- Identify difficult content
- Optimize question presentation
- Track engagement quality

#### 3. Device & Environment Context
```typescript
deviceContext?: {
  platform: 'web' | 'mobile' | 'tablet',
  screenSize?: 'small' | 'medium' | 'large',
  inputMethod: 'touch' | 'mouse' | 'keyboard',
  networkQuality?: 'slow' | 'medium' | 'fast',
  timezone?: string,
  locale?: string,
}
```
**Benefits**:
- Optimize for device-specific UX
- Understand platform preferences
- Adjust for network conditions
- Time-of-day learning patterns

### Phase 2: Advanced Learning Analytics (Medium Priority)

#### 4. Cognitive Load Indicators
```typescript
cognitiveLoad?: {
  readingTime?: number,         // Time spent reading question
  optionHoverTime?: number[],   // Time hovering over each option
  scrollEvents?: number,        // Question re-reads indicator
  focusLostCount?: number,      // Tab switches/distractions
}
```
**Benefits**:
- Measure question complexity
- Identify reading difficulties
- Detect attention issues
- Optimize question length

#### 5. Learning Style Preferences
```typescript
learningPreferences?: {
  preferredDifficulty?: 'easy' | 'medium' | 'hard',
  sessionLength?: 'short' | 'medium' | 'long',
  reviewFrequency?: 'daily' | 'spaced' | 'cramming',
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night',
}
```
**Benefits**:
- Personalize difficulty curves
- Optimize session duration
- Schedule reviews intelligently
- Adapt to circadian patterns

#### 6. Performance Context
```typescript
performanceContext?: {
  streakCount?: number,         // Consecutive correct answers
  sessionFatigue?: number,      // Questions into session
  previousTopicSwitch?: boolean,// Changed topics recently
  warmupNeeded?: boolean,       // First question of session
}
```
**Benefits**:
- Detect fatigue patterns
- Identify optimal session length
- Track context switching costs
- Implement warmup strategies

### Phase 3: Predictive Intelligence (Low Priority)

#### 7. Emotional & Motivational Signals
```typescript
emotionalContext?: {
  frustrationIndicators?: number,  // Rapid/random clicking
  engagementLevel?: 'low' | 'medium' | 'high',
  motivationTrend?: 'declining' | 'stable' | 'improving',
}
```

#### 8. Social Learning Context
```typescript
socialContext?: {
  studyGroupId?: string,
  comparedToAverage?: number,   // Percentile performance
  sharedWithOthers?: boolean,
}
```

## Implementation Strategy

### Database Schema Updates
```typescript
// Enhanced interactions table
interactions: defineTable({
  // Existing fields
  userId: v.id("users"),
  questionId: v.id("questions"),
  userAnswer: v.string(),
  isCorrect: v.boolean(),
  attemptedAt: v.number(),
  timeSpent: v.optional(v.number()),
  
  // Phase 1 additions
  confidence: v.optional(v.object({
    preAnswer: v.optional(v.number()),
    postAnswer: v.optional(v.number()),
    certainty: v.optional(v.union(
      v.literal('guess'),
      v.literal('unsure'),
      v.literal('confident'),
      v.literal('certain')
    )),
  })),
  
  responsePattern: v.optional(v.object({
    changedAnswer: v.optional(v.boolean()),
    hesitationTime: v.optional(v.number()),
    abandonedAt: v.optional(v.number()),
    interruptions: v.optional(v.number()),
  })),
  
  deviceContext: v.optional(v.object({
    platform: v.union(
      v.literal('web'),
      v.literal('mobile'),
      v.literal('tablet')
    ),
    inputMethod: v.union(
      v.literal('touch'),
      v.literal('mouse'),
      v.literal('keyboard')
    ),
    screenSize: v.optional(v.string()),
    networkQuality: v.optional(v.string()),
    timezone: v.optional(v.string()),
    locale: v.optional(v.string()),
  })),
  
  // Existing context field expanded
  context: v.optional(v.object({
    sessionId: v.optional(v.string()),
    isRetry: v.optional(v.boolean()),
    // New context fields
    sessionIndex: v.optional(v.number()),
    previousQuestionId: v.optional(v.id("questions")),
  })),
})
```

### Data Collection Points

#### Frontend (ReviewFlow Component)
```typescript
const trackInteraction = async (answer: string) => {
  const deviceContext = {
    platform: detectPlatform(),
    inputMethod: lastInputMethod,
    screenSize: getScreenCategory(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
  };
  
  const responsePattern = {
    changedAnswer: answerChanges > 0,
    hesitationTime: timeToFirstClick,
    interruptions: focusLostCount,
  };
  
  await recordInteraction({
    // existing fields...
    deviceContext,
    responsePattern,
    confidence: {
      certainty: userCertainty,
    }
  });
};
```

### Analytics Queries

#### Performance Insights Query
```typescript
export const getPerformanceInsights = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const interactions = await ctx.db
      .query("interactions")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .collect();
    
    return {
      averageConfidence: calculateAverageConfidence(interactions),
      optimalTimeOfDay: findBestPerformanceTime(interactions),
      devicePreference: getMostSuccessfulDevice(interactions),
      difficultyCurve: analyzeDifficultyProgression(interactions),
      fatiguePoint: detectAverageFatiguePoint(interactions),
    };
  }
});
```

## Benefits & Use Cases

### 1. Personalized Learning Paths
- Adjust difficulty based on confidence patterns
- Schedule reviews at optimal times
- Adapt to device preferences

### 2. Early Intervention
- Detect struggling before failure
- Identify overconfidence risks
- Prevent learning fatigue

### 3. Quality Metrics
- Measure true understanding vs guessing
- Track learning efficiency
- Validate question quality

### 4. Research & Insights
- Understand learning patterns
- A/B test different approaches
- Build predictive models

## Migration Plan

### Phase 1 (Week 1-2)
1. Add confidence tracking UI
2. Implement device detection
3. Update recordInteraction mutation
4. Deploy schema changes

### Phase 2 (Week 3-4)
1. Add response pattern tracking
2. Build analytics dashboard
3. Create insight queries
4. Test data collection

### Phase 3 (Month 2)
1. Implement predictive models
2. Add personalization features
3. Deploy recommendations

## Privacy & Ethics Considerations

### Data Minimization
- Only collect data with clear learning benefits
- Implement data retention policies
- Allow users to opt-out of advanced tracking

### Transparency
- Show users what data is collected
- Explain how it improves their learning
- Provide data export capabilities

### Security
- Encrypt sensitive patterns
- Anonymize aggregate analytics
- Regular privacy audits

## Success Metrics

### Short-term (1 month)
- [ ] 20% improvement in answer confidence accuracy
- [ ] 15% reduction in review fatigue
- [ ] Device-optimized experiences deployed

### Medium-term (3 months)
- [ ] 30% better prediction of knowledge retention
- [ ] Personalized scheduling for 100% of users
- [ ] 25% improvement in learning efficiency

### Long-term (6 months)
- [ ] ML models predicting success with 85% accuracy
- [ ] Adaptive difficulty maintaining optimal challenge
- [ ] Platform-wide learning insights dashboard

## Technical Considerations

### Performance Impact
- Additional fields: ~200 bytes per interaction
- Indexing strategy: Add composite indexes for common queries
- Data retention: Archive old interactions after 1 year

### Backward Compatibility
- All new fields optional
- Graceful degradation for missing data
- Progressive enhancement approach

### Testing Strategy
- A/B test each enhancement
- Monitor data quality
- Validate predictions against outcomes

## Conclusion

These enhancements transform the interactions table from a simple answer log into a comprehensive learning intelligence system. By capturing richer behavioral data, we can:

1. **Understand** how users learn, not just what they know
2. **Predict** future performance and intervene proactively  
3. **Personalize** the experience for optimal learning
4. **Measure** true understanding beyond correct/incorrect

The phased approach ensures we can deliver value incrementally while building toward a sophisticated learning analytics platform.