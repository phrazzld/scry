# BACKLOG

## P0: Foundation Shift — Ship Fast or Die

## P1: Core Features — Now 10x Easier

### Quiz Submission Pipeline
- [ ] **Build submission API** [2 days]
  * Problem: No way to save quiz results, scores lost on refresh
  * Solution: Convex-based submission handler with validation
  * Success: Every quiz attempt saved with full analytics
  * Schema: Store answers, time spent, score calculation

### Dynamic Quiz Generation
- [ ] **True/False Questions** [1 day]
  * Problem: Only multiple choice supported
  * Solution: Extend quiz schema, update AI prompts
  * Success: Mix of question types in single quiz
  * AI: Smarter prompts for better true/false questions

- [ ] **Free Response with AI Grading** [3 days]
  * Problem: No open-ended questions
  * Solution: Rubric-based AI evaluation with retry logic
  * Success: Students get detailed feedback on written answers
  * Tech: Stream feedback as AI processes response

### Smart Study Features
- [ ] **Context-Aware Generation** [1 week]
  * Problem: Duplicate questions, no personalization
  * Solution: Vector embeddings of past quizzes in Convex
  * Success: Never see duplicate question, difficulty adapts
  * Implementation: Embed on save, similarity search on generate

- [ ] **Study Notifications** [2 days]
  * Problem: Users forget to study
  * Solution: Push notifications via Convex scheduled functions
  * Success: 50% increase in daily active users
  * Channels: Web push, email digests, mobile when ready

## P2: Polish & Scale

### Performance
- [ ] **AI Response Caching** [2 days]
  * Problem: Expensive AI calls for similar topics
  * Solution: Convex-based semantic cache with fuzzy matching
  * Success: 90% cache hit rate for popular topics
  * Saves: $100s/month in AI costs

- [ ] **Edge Deployment** [1 day]
  * Problem: Single region deployment
  * Solution: Deploy Convex functions globally
  * Success: <100ms latency worldwide
  * Bonus: Automatic failover

### Developer Experience
- [ ] **Hot Test Runner** [1 day]
  * Problem: No watch mode for tests
  * Solution: Vitest with hot reload
  * Success: TDD actually feasible
  * Config: Auto-run affected tests only

- [ ] **Local Dev Stack** [2 days]
  * Problem: Need 5 services running locally
  * Solution: Docker Compose with health checks
  * Success: `pnpm dev:up` and everything works
  * Includes: Mock Convex, AI stubs, email capture

### Security (After Migration)
- [ ] **Rate Limiting 2.0** [1 day]
  * Problem: No protection against abuse
  * Solution: Convex built-in rate limiting
  * Success: Automatic protection, no redis needed
  * Limits: Per-user, per-IP, per-endpoint

- [ ] **Input Validation Framework** [2 days]
  * Problem: Inconsistent validation, prompt injection risk
  * Solution: Zod validation for all inputs
  * Success: Impossible to process unvalidated data
  * Coverage: 100% of user inputs validated

## P3: Future Vision

### Game Changers
- [ ] **AI Study Buddy** [2 weeks]
  * Voice conversations about quiz topics
  * Socratic method teaching
  * Personalized explanations

- [ ] **Knowledge Graph Viz** [1 week]
  * D3.js interactive learning map
  * See connections between topics
  * Identify knowledge gaps visually

- [ ] **Multiplayer Battles** [2 weeks]
  * Real-time quiz competitions
  * Leaderboards and achievements
  * Study group formation

### Nice to Have
- [ ] Universal content import (PDFs, URLs)
- [ ] Mobile app with offline mode
- [ ] Integration with Anki/Remnote
- [ ] Webhook API for third-party tools

## Dropped/Reconsidered

- ~~Complex monitoring~~ → Convex handles this
- ~~PostgreSQL optimizations~~ → Migrating away
- ~~Session caching~~ → Convex is fast enough
- ~~Manual security headers~~ → Use framework defaults
- ~~Component library optimization~~ → Keep it simple

---

**Success Metrics:**
- Ship new features 10x faster
- 90% reduction in error handling code
- Zero database configuration
- Real-time everything by default
- Happy developers = happy users
