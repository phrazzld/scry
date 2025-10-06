# Question Library Management Dashboard

*Generated: 2025-10-06 | Architecture: Three-State Lifecycle with TanStack Table*

---

## Executive Summary

**Problem**: Users cannot see all their questions at a glance or efficiently manage large question libraries (100+ items). No way to pause questions without deleting them.

**Solution**: Dedicated library view with three-state lifecycle (Active → Archive → Trash), bulk operations, and desktop-optimized table interface.

**User Value**: Browse entire question collection, bulk archive/delete for efficient management, recover deleted items, pause learning on specific topics without losing progress.

**Success Criteria**: Users can view and bulk-manage 100+ questions efficiently, archive system removes questions from review queue, trash recovery available for 30 days.

---

## User Context

- **Who**: Scry users building question libraries (50-500+ questions), power users managing multiple learning topics
- **Problems**:
  - Cannot see what questions exist beyond review queue
  - No way to pause questions without deleting them
  - Deleting questions one-by-one is tedious
  - No recovery mechanism for accidental deletions
- **Benefits**:
  - Complete visibility into question library
  - Efficient bulk operations (archive/delete 10+ items at once)
  - Pause questions for later without losing FSRS progress
  - Safety net for accidental deletions

---

## Requirements

### Functional (What it MUST do)

- [ ] Display all user questions in tabbed interface (Active/Archive/Trash)
- [ ] Show 8 data points per question: question text, topic, performance stats, created date, next review, type, selection checkbox, actions menu
- [ ] Support bulk selection via checkboxes (individual + select all)
- [ ] Provide contextual bulk actions based on current tab:
  - Active tab: Archive, Delete
  - Archive tab: Unarchive, Delete
  - Trash tab: Restore, Permanently Delete
- [ ] Archive functionality removes questions from review queue
- [ ] Soft delete preserves question data for 30 days
- [ ] Permanent delete actually removes from database (trash only)
- [ ] Question preview dialog shows full details + original generation prompt
- [ ] Mobile-responsive layout (table → card view)
- [ ] Per-tab empty states with appropriate CTAs
- [ ] Top-level navbar navigation to /library route

### Non-Functional (How well it performs)

**Performance**:
- Initial load: <500ms for 500 questions
- Bulk operations: <2s for 100 items
- Responsive interactions: <100ms feedback

**Security**:
- Verify user ownership before all mutations
- Permanent delete requires explicit action (not accidental)

**Reliability**:
- Optimistic updates with rollback on error
- Toast notifications for all state changes
- Loading states during async operations

**Maintainability**:
- Reuse existing UI components (shadcn/ui)
- Follow established patterns (server/client component split)
- Type-safe queries/mutations with Convex validator

---

## Architecture

### Selected Approach

**Three-State Lifecycle with TanStack Table**

Questions exist in one of three states:
1. **Active**: In review queue, visible to spaced repetition algorithm
2. **Archived**: Paused, not in review queue, preserves FSRS data
3. **Trash**: Soft-deleted, recoverable for 30 days, then purged

**Rationale**:
- **User Value**: Archive solves "pause learning" use case without losing progress
- **Simplicity**: Clear state transitions, explicit tabs, no complex filtering UI yet
- **Explicitness**: State visible in UI, no hidden behavior
- **Constraints**: Works with existing schema (additive changes only)

**Alternatives Considered**:

| Approach | Value | Simplicity | Risk | Why Not |
|----------|-------|------------|------|---------|
| Single list + filters | Med | High | Low | No pause mechanism, complex filters in MVP |
| Archive via tags | Med | Low | Med | Requires tag system implementation first |
| Hard delete only | Low | High | High | No recovery, doesn't solve pause use case |

### System Design

**Components**:

```
┌─────────────────────────────────────────┐
│           Navbar (Library Link)          │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│     /library Route (Server Component)    │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│        LibraryClient (Client Comp)       │
│  ┌─────────────────────────────────┐    │
│  │  Tabs: Active│Archive│Trash     │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │   Desktop: LibraryTable         │    │
│  │   Mobile: LibraryCards          │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │   BulkActionsBar (when selected)│    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Convex Backend                   │
│  - getLibrary(view, limit)              │
│  - archiveQuestions(questionIds)        │
│  - unarchiveQuestions(questionIds)      │
│  - bulkDelete(questionIds)              │
│  - permanentlyDelete(questionIds)       │
│  - Updated: getNextReview (exclude arch)│
│  - Updated: getDueCount (exclude arch)  │
└─────────────────────────────────────────┘
```

**Module Boundaries** (Deep modules):

- **LibraryClient**:
  - Interface: `<LibraryClient />` (no props, self-contained)
  - Responsibility: Tab state, query orchestration, selection state
  - Hidden complexity: View filtering, loading states, error handling

- **TanStack Table**:
  - Interface: Column definitions, data array, selection callbacks
  - Responsibility: Rendering, selection, responsive layout
  - Hidden complexity: Virtual DOM optimization, keyboard navigation, ARIA

- **BulkActionsBar**:
  - Interface: `{ selectedCount, currentTab, onAction callbacks }`
  - Responsibility: Contextual action display and execution
  - Hidden complexity: Optimistic updates, error rollback, toast notifications

**Abstraction Layers**:
- **UI Layer**: React components, TanStack Table, shadcn/ui primitives
- **Data Layer**: Convex queries/mutations, optimistic updates
- **Business Logic**: State filtering (active/archived/trash), FSRS exclusions

*Each layer changes vocabulary and abstraction level*

**Technology Stack**:
- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS v4
- **Backend**: Convex (database + real-time queries)
- **UI Library**: shadcn/ui (Radix primitives + custom styling)
- **Table**: TanStack Table v8.20.5 (headless, 12kb gzipped)
- **Date Formatting**: date-fns (already in project)

---

## Dependencies & Assumptions

**Dependencies**:
- **New**: `@tanstack/react-table@^8.20.5` (headless table library)
- **Existing**: Next.js 15, Convex, shadcn/ui, date-fns, Clerk auth

**Assumptions**:
- Users will have 50-500 questions (optimize for 100-200)
- Desktop is primary management interface (mobile functional but secondary)
- 30-day trash retention is sufficient
- Most users won't need >500 questions visible at once (defer pagination)
- Bulk operations on <100 items at a time is typical
- Archive use case: "I'm not ready for Advanced Topic X, pause until later"

**Constraints**:
- Must preserve existing FSRS data when archiving
- Must exclude archived questions from review queue
- Must maintain backward compatibility (additive schema changes only)
- Must work with existing Clerk authentication
- Must follow Hypersimplicity principle (defer search/sort/filter)

---

## Implementation

### Phase 1: Backend (Convex) - 4 hours

**Schema Changes** (convex/schema.ts):
```typescript
questions: defineTable({
  // ... existing fields
  archivedAt: v.optional(v.number()),
  generationJobId: v.optional(v.id("generationJobs")),
})
  // CHANGED IN IMPLEMENTATION: Indexes removed in favor of client-side filtering
  // Actual: Uses by_user index + .filter() for archive/delete states
  // Reason: Simpler, more flexible, adequate performance for current scale
  // See convex/schema.ts comments for details
```

**New Mutations** (convex/questions.ts):
- [ ] `archiveQuestions({ questionIds })` - Set archivedAt timestamp
- [ ] `unarchiveQuestions({ questionIds })` - Clear archivedAt
- [ ] `bulkDelete({ questionIds })` - Set deletedAt timestamp
- [ ] `permanentlyDelete({ questionIds })` - Actually delete from DB

**New Query** (convex/questions.ts):
- [ ] `getLibrary({ view, limit })` - Filter by active/archived/trash, return with derived stats

**Updated Queries** (convex/spacedRepetition.ts):
- [ ] `getNextReview` - Add `.filter(q.eq(q.field('archivedAt'), undefined))`
- [ ] `getDueCount` - Add `.filter(q.eq(q.field('archivedAt'), undefined))`

**Success**: All mutations work, review queries exclude archived, getLibrary returns correct subsets

### Phase 2: Desktop UI - 7 hours

**Route Structure** (app/library/):
- [ ] `page.tsx` - Server component wrapper
- [ ] `_components/library-client.tsx` - Main client component with tab state
- [ ] `_components/library-table.tsx` - TanStack Table integration
- [ ] `_components/bulk-actions-bar.tsx` - Contextual action bar
- [ ] `_components/question-preview-dialog.tsx` - Full question details

**TanStack Table Setup**:
- [ ] Install `@tanstack/react-table@^8.20.5`
- [ ] Define 8 column definitions (checkbox, question, topic, stats, created, nextReview, type, actions)
- [ ] Implement row selection state
- [ ] Wire up to `getLibrary` query with proper loading states

**Bulk Operations**:
- [ ] Checkbox column with "Select All" header
- [ ] Selection state management (`rowSelection`)
- [ ] Bulk actions bar appears when selectedCount > 0
- [ ] Context-dependent actions based on currentTab
- [ ] Optimistic updates with error handling
- [ ] Toast notifications for all actions

**Success**: Desktop table displays all data, bulk operations work, proper loading/error states

### Phase 3: Mobile + Polish - 4 hours

**Mobile Responsive**:
- [ ] `_components/library-cards.tsx` - Card layout for mobile
- [ ] Responsive breakpoint: `<div className="hidden md:block"><LibraryTable /></div>`
- [ ] Card shows: checkbox, question (truncated), topic badge, stats, dates, actions

**Navigation**:
- [ ] Add "Library" link to navbar between "Review" and "Settings"
- [ ] Highlight active route

**Empty States** (per tab):
- [ ] Active: "Generate your first questions" with CTA button
- [ ] Archive: "Archive questions to pause learning"
- [ ] Trash: "Deleted questions appear here"

**Preview Dialog**:
- [ ] Show full question text (not truncated)
- [ ] Display all options, correct answer, explanation
- [ ] Show stats: attempt history, success rate
- [ ] Link to generationJob to show original prompt
- [ ] Actions: Edit, Archive/Unarchive, Delete/Restore

**Success**: Mobile layout functional, empty states display correctly, preview dialog shows all info

### Phase 4: Testing & Edge Cases - 3 hours

- [ ] Test bulk operations with 100+ items
- [ ] Test responsive breakpoints on various devices
- [ ] Test all state transitions (active→archive→trash→restore)
- [ ] Test permanent delete (confirm irreversible)
- [ ] Test empty states for all tabs
- [ ] Test with 0 questions, 1 question, 500 questions
- [ ] Test selection edge cases (select all, deselect all)
- [ ] Verify archived questions don't appear in review queue

**Success**: All flows work, no bugs found, performance acceptable

---

## Testing

**Unit**:
- Convex mutations verify ownership before acting
- State filtering logic (active/archived/trash) works correctly
- Derived stats calculations (successRate, failedCount) accurate

**Integration**:
- Bulk operations correctly update multiple questions
- Review queries properly exclude archived questions
- Tab switching updates query and displays correct subset

**E2E**:
- User can archive 10 questions, verify they leave review queue
- User can delete questions, restore from trash
- User can permanently delete from trash (irreversible)
- Mobile card layout displays and functions correctly

**Performance**:
- Load time <500ms for 500 questions
- Bulk operation time <2s for 100 items
- No layout shift during loading

---

## Success Metrics

**User Value** (Primary):
- Users can view entire question library in single interface
- Bulk operations reduce time to manage 10+ questions (seconds vs minutes)
- Archive removes questions from review queue (verified via getDueCount)
- Trash recovery prevents accidental data loss

**Technical** (Secondary):
- <500ms initial load time
- <100ms UI interaction feedback
- 0 runtime errors on bulk operations
- 100% type safety (no `any` types)

**Business**:
- Increased user retention (less frustration with question management)
- Enables power users to build 500+ question libraries
- Reduces support requests about "pausing" questions

**Measurement**:
- Track library page views
- Track bulk operation usage (archive/delete counts)
- Monitor trash recovery rate (% of deleted questions restored)

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bulk operations slow on 100+ items | Medium | Medium | Add loading spinner, limit to 100 items with warning, optimize later if needed |
| TanStack Table learning curve | Low | Medium | Use official examples, follow shadcn/ui patterns |
| Mobile card layout complex | Medium | Low | Start with desktop, iterate mobile based on feedback |
| Archived questions still in queue | Low | High | Write tests for review query filters, manual verification |
| Permanent delete too easy | Low | High | Only show in trash tab, add confirmation dialog |

---

## Key Decisions

**Archive System**: Three states (active/archived/trash) instead of two (active/trash)
- **Alternatives**: Tags, filters, flag field
- **Rationale**: Explicit states match user mental model ("pause" ≠ "delete"), simpler than tag system
- **Tradeoffs**: Extra mutation, but solves real use case

**TanStack Table**: Headless library instead of complete component
- **Alternatives**: shadcn/ui data-table, custom implementation, AG Grid
- **Rationale**: Framework for future features (sort/filter/virtualization), minimal bundle size, TypeScript-native
- **Tradeoffs**: More setup than complete component, but far more flexible

**Desktop-Optimized**: Table on desktop, cards on mobile
- **Alternatives**: Mobile-first, cards everywhere, custom responsive
- **Rationale**: Management is desktop activity (reviewing is mobile), 8 columns need space
- **Tradeoffs**: Mobile is functional but not optimal, acceptable given use case

**Defer Search/Sort/Filter**: Focus on visibility + bulk operations
- **Alternatives**: Build everything now
- **Rationale**: Hypersimplicity, deliver value faster, inform design with usage data
- **Tradeoffs**: Power users wait for advanced features, but MVP is still useful

**Link to generationJob**: Add `generationJobId` field now
- **Alternatives**: Wait for userPrompts table
- **Rationale**: Low-risk change (optional field), enables showing original prompt in preview
- **Tradeoffs**: Schema change in this PR, but minimal and high value

---

## Validation

**Ousterhout Principles**:
- ✅ Deep modules: LibraryClient hides complexity (tab state, queries, selection)
- ✅ Info hiding: TanStack Table abstracts rendering, BulkActionsBar hides optimistic updates
- ✅ No leakage: UI doesn't know about Convex internals, backend doesn't know about UI
- ✅ Different abstractions: UI (tabs/tables), Data (queries/mutations), Business (state filtering)
- ✅ Strategic design: 10% time on architecture (TanStack Table setup, component boundaries)

**Tenets**:
- ✅ Simplicity: No search/sort/filter yet, clear three-state model, reuse existing components
- ✅ User value: Solves real problems (visibility, bulk operations, pause mechanism)
- ✅ Explicitness: Clear tabs, visible state, obvious actions, no hidden behavior
- ✅ Maintainability: Follows existing patterns, type-safe, reusable components
- ✅ Observability: Toast notifications, loading states, error messages

**Dijkstra**:
- ✅ Invariants: Archived questions never in review queue (enforced in queries)
- ✅ Edge cases: 0 questions, all selected, permanent delete, restore flow
- ✅ Failure modes: Network errors, permission errors, concurrent modifications

---

## Next Steps

1. ✅ Review PRD with stakeholders
2. ✅ Get approval
3. ⏭️  Exit plan mode and implement
4. ⏭️  Update BACKLOG.md with deferred features

*"A good specification is not when there is nothing left to add, but when there is nothing left to take away."*
