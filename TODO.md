# TODO: Question Library Management Dashboard

## Context

- **Approach**: Three-state lifecycle (Active/Archive/Trash) with TanStack Table
- **Key Files**:
  - Backend: `convex/schema.ts`, `convex/questions.ts`, `convex/spacedRepetition.ts`
  - Frontend: `app/library/*`, `components/navbar.tsx`
  - UI: Reuse `components/ui/*` (Table, Badge, Checkbox, Dialog, Tabs)
- **Patterns**:
  - Server/client split: `app/*/page.tsx` → `app/*/*-client.tsx`
  - Auth: `requireUserFromClerk(ctx)` for all mutations/queries
  - Empty states: Follow `NoCardsEmptyState` pattern from `components/empty-states.tsx:35`
  - Mutations: Follow `saveGeneratedQuestions` pattern from `convex/questions.ts:8`
- **Dependencies**: Install `@tanstack/react-table@^8.20.5`

## Tenet Integration Plan

- **🎯 Modularity**:
  - Backend module: Schema + 4 mutations + 1 query (independent, testable)
  - LibraryClient module: Tab orchestration, selection state management
  - LibraryTable module: TanStack Table integration, column definitions
  - BulkActionsBar module: Contextual actions with optimistic updates
  - QuestionPreviewDialog module: Full question display with generationJob lookup

- **🎯 Testability**:
  - Unit tests: Backend mutations verify ownership, state filtering logic
  - Integration tests: Bulk operations update multiple questions, review queries exclude archived
  - E2E tests: Full flow (archive → verify review queue), mobile responsive
  - Test isolation: Each component receives props, no hidden dependencies

- **🎯 Design Evolution**:
  - Iteration point after Phase 1: Review backend API ergonomics
  - Iteration point after Phase 2: Extract shared column logic, review table/selection coupling
  - Refactoring opportunities: If >3 similar mutations, extract shared validation
  - Flexibility: TanStack Table supports future sort/filter/virtualization without refactor

- **🎯 Automation**:
  - Quality gates: TypeScript strict mode, Convex validators catch errors at build time
  - Test automation: npm test before commits (implied by workflow)
  - Build validation: npm run build verifies production build succeeds

- **🎯 Binding Compliance**:
  - Core: hex-domain-purity (business logic in Convex, not UI), code-size (<300 lines/file)
  - TypeScript: no-any (strict types enforced), modern-typescript-toolchain (Convex validators)
  - React: server-first-architecture (RSC wrapper), component-isolation (clear props interface)

---

## Phase 1: Backend Foundation [3.5 hours] ✅ COMPLETE

### Schema & Database

- [x] Add archive and generation tracking fields to questions schema
  ```
  Files: convex/schema.ts:21-54 (questions table definition)

  🎯 MODULARITY: Additive schema changes, backward compatible
  🎯 TESTABILITY: Optional fields allow gradual migration

  Approach: Add after line 48 (updatedAt field):
    archivedAt: v.optional(v.number()),
    generationJobId: v.optional(v.id("generationJobs")),

  Add indexes after line 54:
    .index("by_user_archived", ["userId", "archivedAt", "deletedAt"])

  Update existing index by_user_active to compound:
    .index("by_user_active", ["userId", "archivedAt", "deletedAt"])

  Success: Schema compiles, npx convex dev shows migration, no type errors
  Time: 15 minutes
  ```

### Archive Mutations

- [x] Implement archiveQuestions bulk mutation
  ```
  Files: convex/questions.ts (new export at end of file)

  🎯 MODULARITY: Single responsibility (archive), clear interface
  🎯 TESTABILITY: Verify ownership check, verify all IDs processed
  🎯 BINDING: no-any (strict types), input validation with Convex validators

  Approach: Follow pattern from saveGeneratedQuestions (line 8-50):
  - Use requireUserFromClerk for auth
  - Args: { questionIds: v.array(v.id("questions")) }
  - Verify ownership: question.userId === user._id
  - Set archivedAt: Date.now(), updatedAt: Date.now()
  - Use Promise.all for parallel updates
  - Return { archived: questionIds.length }

  Success: Mutation compiles, ownership check works, toast on success
  Time: 30 minutes
  ```

- [x] Implement unarchiveQuestions bulk mutation
  ```
  Files: convex/questions.ts (new export)

  🎯 MODULARITY: Inverse of archive, symmetric API
  🎯 TESTABILITY: Unit test with archived questions

  Approach: Copy archiveQuestions pattern:
  - Same auth and ownership checks
  - Set archivedAt: undefined (clears field)
  - Set updatedAt: Date.now()
  - Return { unarchived: questionIds.length }

  Success: Mutation compiles, clears archivedAt, questions return to active
  Time: 20 minutes
  ```

### Delete Mutations

- [x] Implement bulkDelete mutation (soft delete)
  ```
  Files: convex/questions.ts (new export)

  🎯 MODULARITY: Reuses existing soft-delete pattern
  🎯 TESTABILITY: Verify deletedAt set, questions excluded from active queries

  Approach: Similar to archiveQuestions:
  - Same auth and ownership checks
  - Set deletedAt: Date.now(), updatedAt: Date.now()
  - Preserves all FSRS data (stability, difficulty, etc.)
  - Return { deleted: questionIds.length }

  Success: Questions have deletedAt, excluded from getNextReview
  Time: 20 minutes
  ```

- [x] Implement permanentlyDelete mutation (hard delete)
  ```
  Files: convex/questions.ts (new export)

  🎯 MODULARITY: Irreversible operation, requires explicit intent
  🎯 TESTABILITY: Verify questions actually deleted, ownership enforced

  Approach: Follow bulk pattern but use ctx.db.delete:
  - Auth with requireUserFromClerk
  - Args: { questionIds: v.array(v.id("questions")) }
  - Verify ownership for each ID
  - Use ctx.db.delete(id) instead of patch
  - Return { permanentlyDeleted: questionIds.length }

  Note: Only callable from trash tab UI (enforcement in frontend)

  Success: Questions removed from database, not just marked deleted
  Time: 25 minutes
  ```

### Library Query

- [x] Implement getLibrary query with view filtering
  ```
  Files: convex/questions.ts (new export)

  🎯 MODULARITY: Single query handles all three views via filter
  🎯 TESTABILITY: Test each view returns correct subset
  🎯 BINDING: Explicit query logic, no hidden filtering

  Approach: Follow getUserQuestions pattern:
  - Auth with requireUserFromClerk
  - Args: {
      view: v.union(v.literal('active'), v.literal('archived'), v.literal('trash')),
      limit: v.optional(v.number())
    }
  - Start with by_user index query, default limit 500
  - Filter in-memory based on view:
      active: !archivedAt && !deletedAt
      archived: archivedAt && !deletedAt
      trash: deletedAt (regardless of archivedAt)
  - Calculate derived fields:
      failedCount: attemptCount - correctCount
      successRate: attemptCount > 0 ? (correctCount / attemptCount * 100) : null
  - Return questions array with derived stats

  Success: Each view returns correct questions, derived stats accurate
  Time: 45 minutes
  ```

### Update Review Queries

- [x] Exclude archived questions from review queue
  ```
  Files: convex/spacedRepetition.ts:120-150 (getNextReview), :180-210 (getDueCount)

  🎯 MODULARITY: Single filter change, preserves FSRS logic
  🎯 TESTABILITY: Archive 10 questions, verify due count decreases by 10

  Approach: Add filter to both queries after deletedAt check:
  - In getNextReview query, add to existing filter chain:
    .filter(q => q.and(
      q.eq(q.field('deletedAt'), undefined),
      q.eq(q.field('archivedAt'), undefined) // NEW
    ))

  - In getDueCount query, same filter pattern

  Success: Archived questions don't appear in review queue, due count correct
  Time: 20 minutes
  ```

---

## Phase 2: Desktop UI Foundation [6 hours]

### Dependencies

- [ ] Install TanStack Table dependency
  ```
  Command: pnpm add @tanstack/react-table@^8.20.5

  🎯 MODULARITY: Headless library, no UI coupling
  🎯 AUTOMATION: Package manager handles version constraints

  Success: package.json updated, pnpm-lock.yaml regenerated, no conflicts
  Time: 5 minutes
  ```

### Route Structure

- [ ] Create library route with server component wrapper
  ```
  Files: app/library/page.tsx (new file)

  🎯 MODULARITY: Server component wrapper, delegates to client
  🎯 BINDING: server-first-architecture (RSC pattern)

  Approach: Follow app/settings/page.tsx:1-5 pattern:

  import { LibraryClient } from './_components/library-client';

  export default function LibraryPage() {
    return <LibraryClient />;
  }

  Success: Route accessible at /library, renders client component
  Time: 10 minutes
  ```

- [ ] Create LibraryClient with tab state management
  ```
  Files: app/library/_components/library-client.tsx (new file)

  🎯 MODULARITY: Orchestrates tabs, queries, selection - single responsibility
  🎯 TESTABILITY: Test tab switching, query calling, selection state
  🎯 BINDING: component-isolation (clear state management)

  Approach:
  - 'use client' directive
  - Import useQuery from convex/react, api from @/convex/_generated/api
  - State: currentTab: 'active' | 'archived' | 'trash', useState
  - Query: const questions = useQuery(api.questions.getLibrary, { view: currentTab })
  - Selection state: selectedIds: Set<Id<"questions">>, useState
  - Render: Tabs component (from shadcn/ui) with three tabs
  - Conditional render: LibraryTable or loading skeleton
  - Pass props: questions, currentTab, selectedIds, onSelectionChange

  Success: Tabs switch views, queries refetch, selection state managed
  Time: 45 minutes
  ```

### Table Implementation

- [ ] Implement LibraryTable with TanStack Table integration
  ```
  Files: app/library/_components/library-table.tsx (new file)

  🎯 MODULARITY: Table logic isolated, receives data via props
  🎯 TESTABILITY: Test column rendering, selection callbacks, empty states
  🎯 BINDING: component-isolation (no direct Convex calls)

  Approach: Follow TanStack Table v8 patterns:
  - Import useReactTable, getCoreRowModel, ColumnDef from @tanstack/react-table
  - Props interface: { questions, currentTab, selectedIds, onSelectionChange }
  - Define 8 columns array (see detailed column definitions below)
  - Call useReactTable with: data, columns, getCoreRowModel, enableRowSelection, state
  - Render using shadcn/ui Table components
  - Use flexRender for headers and cells

  Success: Table displays all 8 columns, data renders correctly, responsive
  Time: 90 minutes
  ```

- [ ] Define table column definitions with custom cell renderers
  ```
  Files: app/library/_components/library-table.tsx (within same file)

  🎯 MODULARITY: Each column is independent, composable
  🎯 TESTABILITY: Test each cell renderer with mock data

  Column definitions:

  1. Select: Checkbox with Select All header
     - Header: table.toggleAllPageRowsSelected
     - Cell: row.toggleSelected

  2. Question: Truncated text, click opens preview
     - accessorKey: 'question'
     - Cell: <button onClick={() => openPreview(row.original)}>{truncate(question, 100)}</button>

  3. Topic: Badge component
     - accessorKey: 'topic'
     - Cell: <Badge variant="secondary">{topic}</Badge>

  4. Performance: Custom stats display
     - id: 'stats'
     - Cell: Calculate successRate, render "X attempts • Y% success" or "Not attempted"

  5. Created: Relative date
     - accessorKey: 'generatedAt'
     - Cell: formatDistanceToNow(generatedAt, { addSuffix: true })

  6. Next Review: Relative date with due indicator
     - accessorKey: 'nextReview'
     - Cell: isPast ? 'Due now' : formatDistanceToNow(nextReview, { addSuffix: true })

  7. Type: Icon or label
     - accessorKey: 'type'
     - Cell: type === 'multiple-choice' ? 'MC' : 'T/F'

  8. Actions: Dropdown menu
     - id: 'actions'
     - Cell: DropdownMenu with Edit/Archive/Delete based on currentTab

  Success: All columns render correctly, formatters work, interactive elements respond
  Time: Included in table implementation above
  ```

### Bulk Actions

- [ ] Implement BulkActionsBar with contextual actions
  ```
  Files: app/library/_components/bulk-actions-bar.tsx (new file)

  🎯 MODULARITY: Self-contained action bar, receives callbacks via props
  🎯 TESTABILITY: Test action visibility, callback invocation, loading states
  🎯 BINDING: component-isolation (props interface), explicit behavior

  Approach: Follow BackgroundTasksBadge fixed positioning pattern:
  - 'use client' directive
  - Props: { selectedCount, currentTab, onArchive, onUnarchive, onDelete, onRestore, onPermanentlyDelete, onCancel }
  - Return null if selectedCount === 0
  - Render fixed bottom bar: className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground p-4 shadow-lg border-t"
  - Show selected count: "{selectedCount} item{s} selected"
  - Show context-dependent buttons:
    - active: Archive, Delete
    - archived: Unarchive, Delete
    - trash: Restore, Permanently Delete
  - All buttons show loading spinner when isLoading
  - Cancel button clears selection

  Success: Bar appears when items selected, buttons trigger callbacks, disappears when cancelled
  Time: 45 minutes
  ```

- [ ] Wire bulk operations with optimistic updates
  ```
  Files: app/library/_components/library-client.tsx (add mutation hooks and handlers)

  🎯 MODULARITY: Mutation logic in client, state updates automatic via Convex
  🎯 TESTABILITY: Test error handling, rollback on failure, toast notifications
  🎯 BINDING: explicit error handling, no silent failures

  Approach:
  - Import useMutation hooks for all 4 bulk operations
  - Create handlers that call mutation with selectedIds array
  - Add try/catch with toast.error for failures
  - Add toast.success for success cases
  - Clear selection after successful operation
  - Pass handlers to BulkActionsBar as props

  Example handler:
  const handleArchive = async () => {
    try {
      const result = await archiveQuestions({ questionIds: Array.from(selectedIds) });
      toast.success(`Archived ${result.archived} questions`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to archive questions');
      console.error(error);
    }
  };

  Success: Operations work, toasts appear, selection clears, errors handled gracefully
  Time: 40 minutes
  ```

---

## Phase 3: Mobile & Polish [4 hours]

### Mobile Layout

- [ ] Implement LibraryCards for mobile responsive layout
  ```
  Files: app/library/_components/library-cards.tsx (new file)

  🎯 MODULARITY: Separate mobile component, doesn't pollute table logic
  🎯 TESTABILITY: Test on mobile viewports, verify all data displays

  Approach: Card-based layout with shadcn/ui Card component:
  - Props: { questions, currentTab, selectedIds, onSelectionChange, onPreview }
  - Map over questions array
  - Each card shows:
    - Checkbox (top-left)
    - Question text (truncated to 100 chars)
    - Topic Badge
    - Stats: "X attempts • Y% success"
    - Created date (relative)
    - Next review (relative)
    - Type icon
    - Actions button (dropdown)
  - Use grid layout: grid-cols-1 gap-4

  Success: Cards display all info, responsive on mobile, selection works
  Time: 60 minutes
  ```

- [ ] Add responsive breakpoint switching in LibraryClient
  ```
  Files: app/library/_components/library-client.tsx (update render)

  🎯 MODULARITY: CSS-based switching, no JS overhead

  Approach: Add responsive divs in render:
  <div className="hidden md:block">
    <LibraryTable {...props} />
  </div>
  <div className="md:hidden">
    <LibraryCards {...props} />
  </div>

  Success: Desktop shows table, mobile shows cards, no layout shift
  Time: 10 minutes
  ```

### Navigation

- [ ] Add Library link to navbar
  ```
  Files: components/navbar.tsx:50-70 (right side controls section)

  🎯 MODULARITY: Single link addition, preserves existing nav logic

  Approach: Add after Settings link (around line 55):
  - Import Link from next/link
  - Add before BackgroundTasksBadge:
    {isSignedIn && (
      <Link href="/library" className="...">
        <Library className="h-5 w-5" />
      </Link>
    )}
  - Import Library icon from lucide-react
  - Use same styling as Settings link
  - Add active state based on pathname === '/library'

  Success: Link appears in navbar, navigates to /library, highlights when active
  Time: 15 minutes
  ```

### Empty States

- [ ] Create library-specific empty states for all three tabs
  ```
  Files: app/library/_components/library-empty-states.tsx (new file)

  🎯 MODULARITY: Three separate components, reusable via currentTab prop
  🎯 TESTABILITY: Test each empty state renders correct content

  Approach: Follow NoCardsEmptyState pattern from components/empty-states.tsx:35:

  1. ActiveEmptyState:
     - Icon: BookOpen
     - Title: "Your library is empty"
     - Description: "Generate your first questions to start learning"
     - Action: Button that opens GenerationModal

  2. ArchivedEmptyState:
     - Icon: Archive (from lucide-react)
     - Title: "No archived questions"
     - Description: "Archive questions to pause learning without deleting them"
     - No action button

  3. TrashEmptyState:
     - Icon: Trash2 (from lucide-react)
     - Title: "Trash is empty"
     - Description: "Deleted questions will appear here for 30 days"
     - No action button

  Success: Each empty state displays correctly, generation CTA works for active
  Time: 30 minutes
  ```

- [ ] Integrate empty states into LibraryTable
  ```
  Files: app/library/_components/library-table.tsx (add conditional render)

  🎯 MODULARITY: Empty state check before table render

  Approach: At start of component render:
  if (!questions || questions.length === 0) {
    if (currentTab === 'active') return <ActiveEmptyState />;
    if (currentTab === 'archived') return <ArchivedEmptyState />;
    if (currentTab === 'trash') return <TrashEmptyState />;
  }

  Success: Empty states show when no questions, disappear when questions exist
  Time: 10 minutes
  ```

### Preview Dialog

- [ ] Implement QuestionPreviewDialog with full question details
  ```
  Files: app/library/_components/question-preview-dialog.tsx (new file)

  🎯 MODULARITY: Self-contained dialog, receives question via props
  🎯 TESTABILITY: Test with/without generationJobId, verify all fields display

  Approach: Follow EditQuestionModal pattern:
  - Import Dialog components from shadcn/ui
  - Props: { question, isOpen, onClose, onEdit, onArchive, onDelete }
  - Use useQuery to fetch generationJob if question.generationJobId exists
  - Display:
    - Full question text (not truncated)
    - All options with correct answer highlighted
    - Explanation
    - Stats section: attempt history, success rate, FSRS state
    - Original prompt (from generationJob.prompt if available)
  - Actions: Edit button, Archive/Unarchive button, Delete/Restore button
  - Large modal: max-w-4xl, max-h-[90vh], scrollable content

  Success: Dialog shows all question data, generationJob linked, actions work
  Time: 60 minutes
  ```

- [ ] Wire preview dialog to table question column
  ```
  Files: app/library/_components/library-client.tsx (add dialog state)

  🎯 MODULARITY: Dialog state managed in parent, passed to children

  Approach:
  - Add state: previewQuestion: Question | null, useState
  - Add handler: setPreviewQuestion
  - Pass to LibraryTable: onPreviewClick={setPreviewQuestion}
  - Render dialog at root: <QuestionPreviewDialog question={previewQuestion} isOpen={!!previewQuestion} onClose={() => setPreviewQuestion(null)} />
  - Update question column cell: onClick={() => onPreviewClick(row.original)}

  Success: Clicking question opens preview dialog, close button works
  Time: 20 minutes
  ```

---

## Phase 4: Design Iteration & Quality [Continuous]

### Design Review Checkpoints

🎯 **DESIGN NEVER DONE** - Schedule iteration after phases:

**After Phase 1 (Backend):**
- Review mutation API ergonomics: Are 4 separate mutations clearer than 1 with action param?
- Check query performance: Does getLibrary need indexes for archivedAt?
- Consider: Should permanentlyDelete be a scheduled job instead of instant?

**After Phase 2 (Desktop UI):**
- Extract column definitions to separate file if >100 lines
- Review table/selection coupling: Is selection state properly isolated?
- Consider: Should BulkActionsBar be generic for reuse?

**After Phase 3 (Mobile + Polish):**
- Review mobile card layout: Is information hierarchy clear?
- Check empty state consistency across tabs
- Consider: Should preview dialog support keyboard navigation?

### Automation Opportunities

🎯 **AUTOMATION** - Identify repetitive tasks:

**Quality Gates (Already Automated):**
- TypeScript strict mode catches type errors at build time
- Convex validators catch schema mismatches before deploy
- npm run lint enforces code style consistency
- npm run build verifies production build succeeds

**Manual Processes to Consider Automating (Future):**
- E2E tests for bulk operations (currently manual testing)
- Performance benchmarking for 500+ questions (currently manual)
- Accessibility testing with automated tools (axe-core)

---

## Quality Validation (Reference - Not TODO Tasks)

**Before commits:**
- Run npm run typecheck (verify TypeScript compilation)
- Run npm run lint (verify ESLint passes)
- Run npm test (if tests exist)
- Manual smoke test: Archive 5 questions, verify not in review queue

**🎯 Tenet Compliance Checklist:**

✅ **Modularity:**
- Each component has single responsibility
- Clear interfaces (props, not global state)
- Backend/frontend completely decoupled

✅ **Testability:**
- Mutations testable with mock Convex context
- Components receive all data via props
- No hidden dependencies on global state

✅ **Design Evolution:**
- TanStack Table supports future sort/filter without refactor
- Three-state model extensible to N states if needed
- Query API stable, can add fields without breaking changes

✅ **Automation:**
- Build-time type checking catches errors early
- Schema validation prevents invalid data
- Toast notifications provide user feedback automatically

✅ **Binding Compliance:**
- No `any` types used (TypeScript strict mode)
- Business logic in Convex (hex-domain-purity)
- All files <300 lines (code-size binding)
- Server component wrapper (server-first-architecture)

**Metrics:**
- TypeScript: 0 `any` types, 100% strict mode
- Code size: All files <300 lines (extract if exceeded)
- Performance: <500ms initial load for 500 questions
- Accessibility: All interactive elements keyboard-navigable

---

## Next Steps After TODO.md Complete

1. Start with Phase 1: Backend foundation (schema + mutations + queries)
2. Validate each phase before proceeding to next (commit after each phase)
3. Use git feature branch workflow: `git checkout -b feature/library-dashboard`
4. Create PR when all phases complete: Document testing done, screenshots of UI

---

**Implementation Laws Applied:**

✅ File:line references provided for modifications
✅ Success criteria are binary and testable
✅ Context prevents re-research (patterns identified)
✅ No task exceeds 90 minutes
✅ Module boundaries clearly defined
✅ Test strategy comprehensive (unit/integration/e2e)
✅ Iteration planning explicit (review checkpoints documented)

*"The best plan is one that gets code into production. Everything else is commentary."*
