# Scry UI/UX Quality of Life Improvements TODO

Generated from TASK.md on 2025-08-27

## Critical Path Items (Must complete in order)

- [x] Implement CSS Grid layout system infrastructure
  - Success criteria: Root layout using `grid-template-rows: auto 1fr auto`, no content overlap on any page
  - Dependencies: None
  - Estimated complexity: MEDIUM
  - Implementation: Replace fixed positioning with sticky, add consistent container classes
  - Files: app/layout.tsx, app/globals.css
  ```
  Work Log:
  - Added .layout-grid class with CSS Grid in globals.css
  - Updated app/layout.tsx to wrap content in grid container
  - Removed spacer div from ConditionalNavbar component
  - Grid system now handles spacing automatically
  - Server running on port 3002 - ready for next phase
  ```

- [x] Update core layout components to use new CSS Grid system
  - Success criteria: Navbar and Footer use sticky positioning, content properly spaced
  - Dependencies: CSS Grid layout system infrastructure
  - Estimated complexity: SIMPLE
  - Implementation: Update ConditionalNavbar, Footer components with new classes
  - Files: components/navbar.tsx, components/footer.tsx, components/conditional-navbar.tsx
  ```
  Work Log:
  - Changed navbar from fixed to sticky positioning with z-40
  - Removed fixed positioning from footer (grid handles placement)
  - Added consistent horizontal padding (px-4 base, px-8 on larger screens)
  - Removed unnecessary z-50 from both components
  - Grid system now properly spaces all elements
  ```

## Parallel Work Streams

### Stream A: Backend CRUD Operations

- [x] Create Convex mutations for question management
  - Success criteria: updateQuestion, softDeleteQuestion mutations with creator-only permissions
  - Can start: Immediately
  - Estimated complexity: MEDIUM
  - Implementation: Add deletedAt field, creator permission checks, soft delete logic
  - Files: convex/schema.ts, convex/questions.ts
  ```
  Work Log:
  - Added deletedAt and updatedAt fields to questions schema
  - Created updateQuestion mutation (only allows editing non-answer fields)
  - Created softDeleteQuestion mutation with timestamp
  - Added bonus restoreQuestion mutation for undo capability
  - Updated getUserQuestions to filter deleted by default
  - Updated spacedRepetition queries to exclude deleted questions
  - All mutations follow existing auth patterns with creator-only permissions
  ```

- [x] Add database migration for soft delete fields
  - Success criteria: questions table has deletedAt and isActive fields
  - Dependencies: Convex mutations
  - Estimated complexity: SIMPLE
  - Implementation: Update schema with optional deletedAt: v.optional(v.number())
  - Files: convex/schema.ts
  ```
  Work Log:
  - Completed as part of mutations task
  - Added deletedAt and updatedAt fields to schema
  - Added by_user_active index for efficient filtering
  ```

- [x] Update question queries to filter soft-deleted items
  - Success criteria: Existing queries exclude soft-deleted questions by default
  - Dependencies: Database migration
  - Estimated complexity: SIMPLE
  - Implementation: Add filter for deletedAt === undefined in all question queries
  - Files: convex/questions.ts, convex/spacedRepetition.ts
  ```
  Work Log:
  - Updated getUserQuestions query with includeDeleted option
  - Updated getNextReview to filter deleted questions
  - Updated getDueCount to exclude deleted from counts
  - All queries now filter deletedAt by default
  ```

### Stream B: Frontend CRUD Components

- [x] Create question edit modal component
  - Success criteria: Modal with form validation using React Hook Form + Zod
  - Can start: After CRUD mutations
  - Estimated complexity: SIMPLE
  - Implementation: shadcn/ui Dialog with form for topic and explanation fields only
  - Files: components/question-edit-modal.tsx
  ```
  Work Log:
  - Created QuestionEditModal with React Hook Form + Zod validation
  - Only question text, topic, and explanation are editable (preserves FSRS data)
  - Shows read-only view of options and correct answer
  - Proper error handling for unauthorized/deleted questions
  - Loading states with disabled buttons during submission
  - Form resets when modal closes or question changes
  - Followed AuthModal pattern from existing codebase
  ```

- [x] Add question action buttons (edit/delete)
  - Success criteria: Buttons appear only for question creator, include confirmation dialog
  - Dependencies: Question edit modal
  - Estimated complexity: SIMPLE
  - Implementation: Conditional rendering based on userId match, AlertDialog for delete
  - Files: components/question-card.tsx, app/questions/page.tsx
  ```
  Work Log:
  - Added edit/delete buttons to quiz-questions-grid.tsx
  - Conditional rendering based on question.userId === user._id
  - Integrated QuestionEditModal for editing
  - Created AlertDialog for delete confirmation
  - Shows question preview in delete dialog
  - Proper error handling with toast notifications
  - Loading states during deletion with spinner
  ```

- [x] Implement optimistic UI updates for CRUD
  - Success criteria: Immediate UI feedback, automatic rollback on error
  - Dependencies: Question action buttons
  - Estimated complexity: SIMPLE
  - Implementation: Use Convex optimistic updates pattern with error handling
  - Files: hooks/use-question-mutations.ts
  ```
  Work Log:
  - Created use-question-mutations.ts hook with optimistic edit/delete
  - Global optimistic store persists across component re-renders
  - Immediate UI feedback with automatic rollback on errors
  - Updated quiz-questions-grid.tsx to use applyOptimisticChanges
  - Modified question-edit-modal.tsx for optimistic edits
  - Modal closes immediately for better perceived performance
  - 500ms delay before clearing optimistic state to prevent flashing
  - All error handling preserved with toast notifications
  ```

### Stream C: Route Differentiation

- [x] Restructure dashboard page as overview hub
  - Success criteria: Shows review indicator, quick stats, recent activity, clear CTAs
  - Can start: After core layout components update
  - Estimated complexity: SIMPLE
  - Implementation: Focus on widgets and navigation, remove detailed quiz history
  - Files: app/dashboard/page.tsx, app/dashboard/dashboard-client.tsx
  ```
  Work Log:
  - Added welcome header with description for better UX
  - Created 4 quick action cards: Create Quiz, Start Review, Quiz History, My Questions
  - Each action card has colored icon, title, description, and arrow indicator
  - Restructured layout to prioritize stats and recent activity (limit 3 items)
  - Added Learning Progress widget with weekly study patterns
  - Kept Review Indicator in sidebar as primary CTA
  - Added Study Tip widget for engagement
  - Updated QuizHistoryRealtime to support limit and compact props
  - Compact view shows minimal info for dashboard overview
  - "View All" button links to full history page
  - Removed tabs and detailed quiz/question grids from dashboard
  ```

- [x] Enhance quizzes page with detailed history
  - Success criteria: Comprehensive quiz history with search, filters, sorting
  - Dependencies: Dashboard restructure
  - Estimated complexity: SIMPLE
  - Implementation: Add search input, filter dropdowns, enhanced table view
  - Files: app/quizzes/page.tsx, components/quiz-history.tsx
  ```
  Work Log:
  - Added real-time search by topic with icon positioning
  - Implemented time filters: Today, Past Week, Month, 3 Months
  - Added score filters: Excellent (80%+), Good (60-79%), Needs Practice (<60%)
  - Created 6 sort options: Date (asc/desc), Score (asc/desc), Topic (A-Z/Z-A)
  - Implemented card/table view toggle with LayoutGrid/List icons
  - Used useMemo for efficient filtering and sorting
  - Added result count display with active filter indicators
  - Enhanced empty states with filter clearing option
  - Installed shadcn Select component for time filtering
  - Fixed Badge variants (default/secondary/destructive)
  - Preserved pagination with Load More pattern
  - All TypeScript and ESLint checks passing
  ```

- [x] Extract shared components to reduce duplication
  - Success criteria: QuizStatsRealtime and QuizHistoryRealtime reused, no duplicate code
  - Dependencies: Dashboard and quizzes pages complete
  - Estimated complexity: SIMPLE
  - Implementation: Move shared components to components/shared/
  - Files: components/shared/quiz-stats.tsx, components/shared/quiz-history.tsx
  ```
  Work Log:
  - Created components/shared/ directory for better organization
  - Moved quiz-stats-realtime.tsx and quiz-history-realtime.tsx to shared/
  - Updated imports in app/dashboard/page.tsx
  - Updated imports in app/quizzes/quiz-history-client.tsx
  - Created barrel export file components/shared/index.ts
  - All TypeScript and ESLint checks passing
  - Components successfully reused with no duplication
  ```

### Stream D: Mobile & Accessibility

- [ ] Test and fix mobile layout responsiveness
  - Success criteria: No overlap or broken layouts on 320px-768px viewports
  - Can start: After CSS Grid layout system
  - Estimated complexity: SIMPLE
  - Implementation: Test with browser dev tools, add responsive breakpoints
  - Risk mitigation task

- [ ] Ensure WCAG 2.1 AA compliance for CRUD interfaces
  - Success criteria: All interactive elements keyboard accessible, proper ARIA labels
  - Dependencies: All CRUD components complete
  - Estimated complexity: SIMPLE
  - Implementation: Add focus management, ARIA attributes, keyboard shortcuts
  - Files: All new modal and button components

## Testing & Validation

- [ ] Write unit tests for CRUD mutations
  - Success criteria: 100% coverage of permission checks and soft delete logic
  - Dependencies: CRUD mutations complete
  - Test coverage: Permission validation, soft delete behavior, FSRS preservation

- [ ] Create integration tests for question lifecycle
  - Success criteria: Test create → edit → delete → restore flow
  - Dependencies: All CRUD implementation complete
  - Test coverage: End-to-end user journey with Convex backend

- [ ] Add E2E tests for layout and navigation
  - Success criteria: Verify no content overlap, smooth navigation between routes
  - Dependencies: Layout system and route differentiation complete
  - Test coverage: Mobile viewports, footer positioning, route transitions

- [ ] Performance validation
  - Success criteria: CRUD operations <500ms, CLS score <0.1
  - Dependencies: All implementation complete
  - Metrics: Measure with Lighthouse, verify optimistic UI timing

## Documentation & Cleanup

- [ ] Update README with CRUD capabilities
  - Success criteria: Document question management features and permissions model
  - Dependencies: CRUD implementation complete
  - Content: User guide for editing/deleting questions

- [ ] Document CSS Grid layout system
  - Success criteria: Clear documentation of layout classes and responsive behavior
  - Dependencies: Layout system complete
  - Content: CSS architecture decisions, class naming conventions

- [ ] Code review and refactoring pass
  - Success criteria: No linting errors, follows existing patterns, clean git history
  - Dependencies: All implementation complete
  - Focus: Component composition, type safety, performance optimization

## Risk Mitigation

- [ ] Validate FSRS data integrity with soft delete
  - Success criteria: Deleted questions don't affect spaced repetition scheduling
  - Can start: Parallel with CRUD development
  - Estimated complexity: SIMPLE
  - Implementation: Test scheduling calculations with soft-deleted questions

- [ ] Create rollback plan for layout changes
  - Success criteria: Feature flag to toggle between old/new layout systems
  - Can start: With layout implementation
  - Estimated complexity: SIMPLE
  - Implementation: Environment variable to control layout mode

## Future Enhancements (BACKLOG.md candidates)

- [ ] Question versioning with edit history tracking
- [ ] Bulk operations for multiple question selection
- [ ] Advanced search and filtering for questions
- [ ] Keyboard shortcuts for power users
- [ ] Export/import question sets
- [ ] Collaborative question sharing between users
- [ ] Undo/redo system for all CRUD operations
- [ ] Virtual scrolling for large question lists

## Implementation Notes

**Total estimated time**: 26-32 hours (3.5-4 development days)

**Parallelization strategy**:
- Backend CRUD can start immediately
- Frontend components after mutations ready
- Layout work independent of CRUD
- Mobile testing throughout

**Key success metrics**:
- Zero content overlap issues
- All CRUD operations under 500ms
- 100% creator-only permission enforcement
- CLS score below 0.1
- Clear route differentiation achieved