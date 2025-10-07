# TODO: Replace Native Confirmations with Accessible AlertDialog System

## Context

**Approach:** Promise-based confirmation hook with queue management + undo toast pattern for soft deletes

**Key Files to Create:**
- `hooks/use-confirmation.tsx` - Confirmation hook with Context provider
- `hooks/use-undoable-action.tsx` - Undo toast hook for reversible actions

**Key Files to Modify:**
- `app/layout.tsx:54` - Add ConfirmationProvider
- `app/library/_components/library-client.tsx:121-144` - Replace confirm() + add undo toasts
- `components/review-flow.tsx:131-146` - Replace window.confirm()

**Patterns to Follow:**
- Context pattern: `contexts/current-question-context.tsx` (createContext, Provider, consumer hook)
- Hook structure: `hooks/use-question-mutations.ts` (useCallback, optimistic updates)
- Hook tests: `hooks/use-question-mutations.test.ts` (vitest, renderHook, mock convex)
- Toast patterns: `app/library/_components/library-client.tsx:55-141` (success/error messages)

**Build/Test Commands:**
```bash
pnpm lint           # ESLint checking
pnpm test           # Run vitest tests
pnpm build          # Next.js build (includes type checking)
```

---

## Phase 1: Core Confirmation Infrastructure (2-3 hours)

### Task 1.1: Create Confirmation Hook with Context Provider

**Module:** `hooks/use-confirmation.tsx` (~150 lines)

**Responsibility:** Global confirmation dialog system with queue management, focus restoration, and type-to-confirm support

**Interface (What it hides):**
- Queue-based state management (FIFO for race conditions)
- Focus restoration via triggerRef storage
- AlertDialog rendering via Portal
- Keyboard event handling (Escape, Tab, Enter)
- Type-to-confirm input validation

```typescript
// Public API
<ConfirmationProvider>{children}</ConfirmationProvider>
const confirm = useConfirmation();
const confirmed = await confirm({
  title: string | ReactNode,
  description: string | ReactNode,
  confirmText?: string,
  cancelText?: string,
  variant?: 'default' | 'destructive',
  requireTyping?: string,
});
```

**Files:**
- Create: `hooks/use-confirmation.tsx`

**Approach:**
Follow `contexts/current-question-context.tsx` pattern:
1. Define types for ConfirmationOptions and ConfirmationRequest
2. Create Context with createContext<ConfirmationFn | null>(null)
3. ConfirmationProvider component with queue state management
4. AlertDialog renderer (only shows activeRequest = queue[0])
5. useConfirmation hook with error if outside Provider

**Implementation Details:**

```typescript
'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Types
type ConfirmationOptions = {
  title: React.ReactNode;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  requireTyping?: string;
};

type ConfirmationRequest = {
  id: string;
  options: ConfirmationOptions;
  resolve: (confirmed: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
};

type ConfirmationFn = (options: ConfirmationOptions) => Promise<boolean>;

// Context
const ConfirmationContext = React.createContext<ConfirmationFn | null>(null);

// Provider
export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<ConfirmationRequest[]>([]);
  const [typedText, setTypedText] = React.useState('');

  const activeRequest = queue[0];
  const requireTyping = activeRequest?.options.requireTyping;
  const isTypingValid = !requireTyping ||
    typedText.toLowerCase() === requireTyping.toLowerCase();

  const confirm = React.useCallback((options: ConfirmationOptions) => {
    return new Promise<boolean>((resolve) => {
      setQueue((prev) => [...prev, {
        id: crypto.randomUUID(),
        options,
        resolve,
        triggerRef: { current: document.activeElement as HTMLElement },
      }]);
    });
  }, []);

  const handleClose = React.useCallback((confirmed: boolean) => {
    if (!activeRequest) return;

    activeRequest.resolve(confirmed);
    activeRequest.triggerRef.current?.focus();
    setQueue((prev) => prev.slice(1));
    setTypedText(''); // Reset for next confirmation
  }, [activeRequest]);

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {activeRequest && (
        <AlertDialog open={true} onOpenChange={() => handleClose(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{activeRequest.options.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {activeRequest.options.description}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {requireTyping && (
              <div className="space-y-2">
                <Label htmlFor="confirm-typing">
                  Type "{requireTyping}" to confirm:
                </Label>
                <Input
                  id="confirm-typing"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder={requireTyping}
                  autoFocus
                  className={typedText && !isTypingValid ? 'border-error' : ''}
                />
                {typedText && !isTypingValid && (
                  <p className="text-xs text-error">Text does not match</p>
                )}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleClose(false)}>
                {activeRequest.options.cancelText || 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleClose(true)}
                disabled={!isTypingValid}
                className={
                  activeRequest.options.variant === 'destructive'
                    ? 'bg-error hover:bg-error/90'
                    : ''
                }
              >
                {activeRequest.options.confirmText || 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </ConfirmationContext.Provider>
  );
}

// Consumer hook
export function useConfirmation() {
  const context = React.useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
}
```

**Success Criteria:**
- ✅ TypeScript compiles without errors
- ✅ Hook throws error if used outside Provider
- ✅ Queue handles multiple simultaneous requests (FIFO)
- ✅ Focus returns to trigger element on close
- ✅ Type-to-confirm disables button until valid
- ✅ Escape closes dialog, Cancel button works
- ✅ Destructive variant applies red styling

**Test Strategy:**
- Unit tests not required initially (Provider needs DOM, complex to mock)
- Manual testing: Multiple confirm() calls, keyboard nav, type-to-confirm
- Integration test in Phase 3 after usage sites implemented

**Time Estimate:** 1.5-2 hours

---

### Task 1.2: Integrate ConfirmationProvider into App Layout

**Module:** `app/layout.tsx`

**Responsibility:** Add ConfirmationProvider to provider tree, making useConfirmation() available globally

**Files:**
- Modify: `app/layout.tsx:54-68`

**Approach:**
Wrap ClerkConvexProvider with ConfirmationProvider (similar to ThemeProvider wrapping):

```typescript
// Line 11 - Add import
import { ConfirmationProvider } from '@/hooks/use-confirmation';

// Line 54-68 - Wrap ClerkConvexProvider
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  <ConfirmationProvider>
    <ClerkConvexProvider>
      <DeploymentVersionGuard>
        {/* ... rest unchanged ... */}
      </DeploymentVersionGuard>
    </ClerkConvexProvider>
  </ConfirmationProvider>
</ThemeProvider>
```

**Success Criteria:**
- ✅ App builds without errors (`pnpm build`)
- ✅ No hydration errors in browser console
- ✅ useConfirmation() can be called in any client component

**Test Strategy:**
- Build test: `pnpm build` succeeds
- Runtime test: Navigate to /library, no console errors
- Hook test: Import useConfirmation in library-client.tsx (next phase)

**Time Estimate:** 15 min

---

## Phase 2: Undo Toast Pattern (1-2 hours)

### Task 2.1: Create Undoable Action Hook

**Module:** `hooks/use-undoable-action.tsx` (~80 lines)

**Responsibility:** Optimistic updates with undo toasts for reversible actions

**Interface (What it hides):**
- Optimistic update orchestration
- Toast lifecycle management (create, show, dismiss)
- Undo timeout handling (default 5s)
- Loading state during undo execution
- Error handling for failed undo

```typescript
// Public API
const undoableAction = useUndoableAction();
await undoableAction({
  action: () => Promise<void>,
  message: string,
  undo: () => Promise<void>,
  duration?: number,
});
```

**Files:**
- Create: `hooks/use-undoable-action.tsx`

**Approach:**
Simple hook returning single function (similar to `hooks/use-quiz-interactions.ts`):

```typescript
'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

interface UndoableActionOptions {
  action: () => Promise<void>;
  message: string;
  undo: () => Promise<void>;
  duration?: number;
}

/**
 * Hook for executing actions with undo toast support
 * Shows success toast with undo button for reversible operations
 */
export function useUndoableAction() {
  const execute = useCallback(async ({
    action,
    message,
    undo,
    duration = 5000,
  }: UndoableActionOptions) => {
    try {
      // Execute action optimistically
      await action();

      // Show success toast with undo option
      toast.success(message, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await undo();
              toast.success('Action undone');
            } catch (error) {
              console.error('Failed to undo action:', error);
              toast.error('Failed to undo action');
            }
          },
        },
        duration,
      });
    } catch (error) {
      console.error('Action failed:', error);
      toast.error('Action failed');
      throw error;
    }
  }, []);

  return execute;
}
```

**Success Criteria:**
- ✅ TypeScript compiles without errors
- ✅ Action executes immediately (optimistic)
- ✅ Toast shows with undo button
- ✅ Undo button triggers reverse mutation
- ✅ Error handling for both action and undo failures

**Test Strategy:**
- Unit tests optional (simple orchestration, hard to mock toast)
- Integration test in Phase 3 with actual mutations
- Manual test: Archive question, click undo, verify restored

**Time Estimate:** 45 min - 1 hour

---

## Phase 3: Migration & Integration (1-2 hours)

### Task 3.1: Replace Permanent Delete Confirmation in Library

**Module:** `app/library/_components/library-client.tsx`

**Responsibility:** Replace native confirm() with type-to-confirm AlertDialog

**Files:**
- Modify: `app/library/_components/library-client.tsx:121-144`

**Approach:**

1. Add import at top:
```typescript
import { useConfirmation } from '@/hooks/use-confirmation';
```

2. In LibraryClient component, after existing hooks:
```typescript
const confirm = useConfirmation();
```

3. Replace handlePermanentDelete function (lines 121-144):
```typescript
const handlePermanentDelete = async (ids: Id<'questions'>[]) => {
  const count = ids.length;
  if (count === 0) return;

  const confirmed = await confirm({
    title: `Permanently delete ${count} ${count === 1 ? 'question' : 'questions'}?`,
    description: 'This action cannot be undone. Type DELETE to confirm.',
    confirmText: 'Delete Forever',
    cancelText: 'Cancel',
    variant: 'destructive',
    requireTyping: 'DELETE',
  });

  if (!confirmed) return;

  try {
    await permanentlyDelete({ questionIds: ids });
    toast.success(`Permanently deleted ${count} ${count === 1 ? 'question' : 'questions'}`);

    // Remove operated items from selection
    const newSelection = new Set(selectedIds);
    ids.forEach((id) => newSelection.delete(id));
    setSelectedIds(newSelection);
  } catch (error) {
    toast.error('Failed to permanently delete questions');
    console.error(error);
  }
};
```

**Success Criteria:**
- ✅ No more native confirm() in handlePermanentDelete
- ✅ Dialog shows with type-to-confirm input
- ✅ Button disabled until "DELETE" typed
- ✅ Case-insensitive match works
- ✅ Clicking cancel dismisses without deleting
- ✅ Successful deletion shows toast

**Test Strategy:**
- Manual test: Go to Library → Trash → Select questions → Delete Permanently
- Keyboard test: Escape cancels, Tab cycles, Enter confirms
- Mobile test: Touch targets are 44x44px minimum

**Time Estimate:** 30 min

---

### Task 3.2: Replace Soft Delete Handlers with Undo Toasts

**Module:** `app/library/_components/library-client.tsx`

**Responsibility:** Replace immediate success toasts with undoable action pattern

**Files:**
- Modify: `app/library/_components/library-client.tsx:49-119` (4 handlers)

**Approach:**

1. Add import:
```typescript
import { useUndoableAction } from '@/hooks/use-undoable-action';
```

2. Add hook after useConfirmation:
```typescript
const undoableAction = useUndoableAction();
```

3. Replace 4 handlers:

**handleArchive (lines 49-65):**
```typescript
const handleArchive = async (ids: Id<'questions'>[]) => {
  const count = ids.length;
  if (count === 0) return;

  try {
    await undoableAction({
      action: () => archiveQuestions({ questionIds: ids }),
      message: `Archived ${count} ${count === 1 ? 'question' : 'questions'}`,
      undo: () => unarchiveQuestions({ questionIds: ids }),
    });

    // Remove operated items from selection
    const newSelection = new Set(selectedIds);
    ids.forEach((id) => newSelection.delete(id));
    setSelectedIds(newSelection);
  } catch (error) {
    toast.error('Failed to archive questions');
    console.error(error);
  }
};
```

**handleUnarchive (lines 67-83):**
```typescript
const handleUnarchive = async (ids: Id<'questions'>[]) => {
  const count = ids.length;
  if (count === 0) return;

  try {
    await undoableAction({
      action: () => unarchiveQuestions({ questionIds: ids }),
      message: `Unarchived ${count} ${count === 1 ? 'question' : 'questions'}`,
      undo: () => archiveQuestions({ questionIds: ids }),
    });

    const newSelection = new Set(selectedIds);
    ids.forEach((id) => newSelection.delete(id));
    setSelectedIds(newSelection);
  } catch (error) {
    toast.error('Failed to unarchive questions');
    console.error(error);
  }
};
```

**handleDelete (lines 85-101):**
```typescript
const handleDelete = async (ids: Id<'questions'>[]) => {
  const count = ids.length;
  if (count === 0) return;

  try {
    await undoableAction({
      action: () => bulkDelete({ questionIds: ids }),
      message: `Deleted ${count} ${count === 1 ? 'question' : 'questions'}`,
      undo: () => restoreQuestions({ questionIds: ids }),
    });

    const newSelection = new Set(selectedIds);
    ids.forEach((id) => newSelection.delete(id));
    setSelectedIds(newSelection);
  } catch (error) {
    toast.error('Failed to delete questions');
    console.error(error);
  }
};
```

**handleRestore (lines 103-119):**
```typescript
const handleRestore = async (ids: Id<'questions'>[]) => {
  const count = ids.length;
  if (count === 0) return;

  try {
    await undoableAction({
      action: () => restoreQuestions({ questionIds: ids }),
      message: `Restored ${count} ${count === 1 ? 'question' : 'questions'}`,
      undo: () => bulkDelete({ questionIds: ids }),
    });

    const newSelection = new Set(selectedIds);
    ids.forEach((id) => newSelection.delete(id));
    setSelectedIds(newSelection);
  } catch (error) {
    toast.error('Failed to restore questions');
    console.error(error);
  }
};
```

**Success Criteria:**
- ✅ No blocking confirmation dialogs for soft deletes
- ✅ Success toast appears with undo button
- ✅ Undo button reverses action
- ✅ Toast dismisses after 5 seconds
- ✅ Error handling preserved

**Test Strategy:**
- Manual test: Archive → Undo → Verify active
- Manual test: Delete → Undo → Verify active
- Manual test: Let toast timeout → Verify no undo
- Error test: Disconnect network, trigger action

**Time Estimate:** 45 min - 1 hour

---

### Task 3.3: Replace Question Delete in Review Flow

**Module:** `components/review-flow.tsx`

**Responsibility:** Replace window.confirm() with confirmation hook

**Files:**
- Modify: `components/review-flow.tsx:131-146`

**Approach:**

1. Add import after existing imports (line ~6):
```typescript
import { useConfirmation } from '@/hooks/use-confirmation';
```

2. Add hook in ReviewFlow component (after existing hooks, ~line 35):
```typescript
const confirm = useConfirmation();
```

3. Replace handleDelete function (lines 131-146):
```typescript
// Delete handler with confirmation
const handleDelete = useCallback(async () => {
  if (!question || !questionId) return;

  const confirmed = await confirm({
    title: 'Delete this question?',
    description: 'This will move the question to trash. You can restore it later from the Library.',
    confirmText: 'Move to Trash',
    cancelText: 'Cancel',
    variant: 'destructive',
  });

  if (confirmed) {
    const result = await optimisticDelete({ questionId });
    if (result.success) {
      // Toast already shown by optimisticDelete hook
      // Move to next question after delete
      handlers.onReviewComplete();
    }
  }
}, [question, questionId, optimisticDelete, handlers, confirm]);
```

**Success Criteria:**
- ✅ No more window.confirm() in review-flow.tsx
- ✅ Dialog shows with clear messaging
- ✅ Cancel preserves question
- ✅ Confirm moves to trash and advances to next question
- ✅ Keyboard navigation works (Escape cancels)

**Test Strategy:**
- Manual test: Review flow → Click delete icon → Verify dialog
- Manual test: Cancel → Question remains
- Manual test: Confirm → Question deleted, next question loads
- Keyboard test: Escape cancels, Enter confirms

**Time Estimate:** 20 min

---

### Task 3.4: Verify No Remaining Native Confirmations

**Module:** Codebase-wide verification

**Responsibility:** Ensure no window.confirm() or confirm() usage remains

**Files:**
- All TypeScript/TSX files

**Approach:**

Run grep to find any remaining usage:
```bash
grep -r "window\.confirm\|^\s*confirm(" \
  --include="*.ts" --include="*.tsx" \
  app/ components/ hooks/ contexts/ lib/ \
  | grep -v node_modules \
  | grep -v ".next"
```

Expected output: None (or only in comments/tests)

**Success Criteria:**
- ✅ No window.confirm() in production code
- ✅ No standalone confirm() calls (except our hook)
- ✅ Comments/documentation updated if needed

**Test Strategy:**
- Grep search as above
- Build test: `pnpm build` succeeds
- Lint test: `pnpm lint` passes

**Time Estimate:** 10 min

---

## Phase 4: Polish & Accessibility (30min-1h)

### Task 4.1: Add JSDoc Documentation to Hooks

**Module:** Hook documentation

**Responsibility:** Document public APIs for future developers

**Files:**
- Modify: `hooks/use-confirmation.tsx` (add JSDoc)
- Modify: `hooks/use-undoable-action.tsx` (add JSDoc)

**Approach:**

Add JSDoc comments to exported functions:

**use-confirmation.tsx:**
```typescript
/**
 * Provider component for confirmation dialogs
 *
 * Manages a queue of confirmation requests to prevent race conditions.
 * Only one dialog is visible at a time (FIFO order).
 *
 * Must wrap the app root to make useConfirmation() available globally.
 *
 * @example
 * <ConfirmationProvider>
 *   <App />
 * </ConfirmationProvider>
 */
export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  // ...
}

/**
 * Hook for showing confirmation dialogs
 *
 * Returns a promise-based confirm function that blocks until user responds.
 * Handles focus restoration and keyboard navigation automatically.
 *
 * @throws {Error} If used outside ConfirmationProvider
 *
 * @example
 * const confirm = useConfirmation();
 * const confirmed = await confirm({
 *   title: 'Delete item?',
 *   description: 'This action cannot be undone.',
 *   variant: 'destructive',
 *   requireTyping: 'DELETE', // Optional: require typing text to confirm
 * });
 * if (confirmed) {
 *   await deleteItem();
 * }
 */
export function useConfirmation() {
  // ...
}
```

**use-undoable-action.tsx:**
```typescript
/**
 * Hook for executing actions with undo support
 *
 * Shows a success toast with undo button for reversible operations.
 * Use for soft deletes, archives, and other reversible actions.
 *
 * @example
 * const undoableAction = useUndoableAction();
 * await undoableAction({
 *   action: () => archiveQuestion(id),
 *   message: 'Question archived',
 *   undo: () => unarchiveQuestion(id),
 *   duration: 5000, // Optional: toast duration in ms
 * });
 */
export function useUndoableAction() {
  // ...
}
```

**Success Criteria:**
- ✅ All exported functions have JSDoc
- ✅ Examples show typical usage
- ✅ Edge cases documented (requireTyping, error handling)
- ✅ TypeScript hover shows documentation

**Test Strategy:**
- Hover test: In VSCode, hover over useConfirmation() → See JSDoc
- Build test: `pnpm build` succeeds (JSDoc syntax valid)

**Time Estimate:** 20 min

---

### Task 4.2: Manual Accessibility Testing

**Module:** Accessibility validation

**Responsibility:** Verify WCAG 2.1 AA compliance

**Files:**
- Test: All confirmation dialogs

**Approach:**

**Keyboard Navigation Test:**
1. Library permanent delete:
   - Tab cycles: Cancel → Input → Delete button
   - Escape closes dialog
   - Enter in input does NOT submit (only clicking button should)

2. Review question delete:
   - Tab cycles: Cancel → Delete button
   - Escape closes
   - Enter on focused button confirms

**Screen Reader Test (macOS VoiceOver):**
1. Enable VoiceOver: Cmd+F5
2. Trigger permanent delete dialog
3. Verify announces:
   - "Alert dialog"
   - Title text
   - Description text
   - "Type DELETE to confirm" for input
   - Button labels ("Cancel", "Delete Forever")

**Mobile Touch Test:**
1. Open on iPhone/Android
2. Verify touch targets:
   - Cancel button: ≥44x44px
   - Confirm button: ≥44x44px
   - Input field: Easy to tap
3. Verify keyboard doesn't obscure dialog

**Success Criteria:**
- ✅ All keyboard shortcuts work as documented
- ✅ Focus indicators visible (2px blue outline)
- ✅ Screen reader announces dialog role and content
- ✅ Touch targets meet 44x44px minimum
- ✅ Mobile keyboard doesn't break layout

**Test Strategy:**
- Desktop: Chrome DevTools accessibility audit
- Mobile: Test on actual device (iOS Safari, Chrome Android)
- Screen reader: VoiceOver on macOS

**Time Estimate:** 30 min

---

## Phase 5: Documentation Update (15 min)

### Task 5.1: Update CLAUDE.md with Confirmation Patterns

**Module:** Project documentation

**Responsibility:** Document new patterns for future development

**Files:**
- Modify: `CLAUDE.md`

**Approach:**

Add section after existing patterns (around line 50):

```markdown
## Confirmation Patterns

### Destructive Actions
Use `useConfirmation()` hook for irreversible actions:

```typescript
import { useConfirmation } from '@/hooks/use-confirmation';

const confirm = useConfirmation();
const confirmed = await confirm({
  title: 'Permanent action?',
  description: 'This cannot be undone.',
  variant: 'destructive',
  requireTyping: 'DELETE', // For truly irreversible actions
});
if (confirmed) {
  await destructiveAction();
}
```

### Reversible Actions
Use `useUndoableAction()` hook for soft deletes and archives:

```typescript
import { useUndoableAction } from '@/hooks/use-undoable-action';

const undoableAction = useUndoableAction();
await undoableAction({
  action: () => archiveItem(id),
  message: 'Item archived',
  undo: () => unarchiveItem(id),
});
```

**When to Use Which:**
- Permanent delete from trash → `useConfirmation()` with `requireTyping`
- Soft delete to trash → `useUndoableAction()`
- Archive/unarchive → `useUndoableAction()`
- Any truly irreversible action → `useConfirmation()` with `variant: 'destructive'`
```

**Success Criteria:**
- ✅ Patterns documented with examples
- ✅ Clear guidance on when to use each pattern
- ✅ Code examples are copy-pasteable

**Test Strategy:**
- Readability check: Can new dev understand and use patterns?

**Time Estimate:** 15 min

---

## Design Iteration Points

**After Phase 1 (Core Infrastructure):**
- Review queue logic: Are race conditions handled correctly?
- Test focus restoration: Does focus return to trigger element?
- Validate type-to-confirm UX: Too frustrating or appropriately cautious?

**After Phase 2 (Undo Pattern):**
- Measure undo usage: Are users clicking undo? (Track in analytics if available)
- Review toast duration: Is 5 seconds right, or too short/long?
- Test error handling: What happens if undo fails?

**After Phase 3 (Migration):**
- Search for other potential confirmation needs (quiz discard, settings reset)
- Review mobile UX: Are touch targets large enough? Keyboard issues?
- Measure permanent delete cancellation rate: Are users typing DELETE and canceling?

**After Phase 4 (Polish):**
- Accessibility audit with axe-core or similar tool
- Cross-browser testing (Safari, Firefox, mobile browsers)
- Performance check: Any layout shifts or jank?

---

## Validation Checklist

**Code Quality:**
- [ ] Zero TypeScript errors (`pnpm build`)
- [ ] Zero ESLint errors (`pnpm lint`)
- [ ] No window.confirm() in codebase (grep)
- [ ] All hooks have JSDoc documentation

**Functionality:**
- [ ] ConfirmationProvider in app layout
- [ ] Permanent delete requires typing "DELETE"
- [ ] Soft deletes show undo toasts
- [ ] Undo button reverses actions
- [ ] Error handling preserved in all handlers

**Accessibility:**
- [ ] Keyboard navigation works (Tab, Escape, Enter)
- [ ] Focus restoration works
- [ ] Screen reader announces dialog role
- [ ] Touch targets ≥44x44px on mobile
- [ ] Focus indicators visible

**User Experience:**
- [ ] Confirmation dialogs match app theme
- [ ] Clear, specific messaging (not "Are you sure?")
- [ ] Destructive actions use red variant
- [ ] Non-blocking UX for reversible actions
- [ ] Mobile keyboard doesn't obscure dialogs

---

## Automation Opportunities

**Future Enhancements:**
1. Add Playwright E2E tests for confirmation flows
2. Create custom ESLint rule to prevent window.confirm() usage
3. Add Storybook stories for confirmation dialogs (design system)
4. Track undo usage in analytics (measure feature value)
5. A/B test undo duration (3s vs 5s vs 7s) if conversion rates matter

---

## Time Estimates Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Core confirmation infrastructure | 2-2.25h |
| Phase 2 | Undo toast pattern | 0.75-1h |
| Phase 3 | Migration (4 tasks) | 1.75-2h |
| Phase 4 | Polish & accessibility | 0.5-0.75h |
| Phase 5 | Documentation | 0.25h |
| **Total** | **11 tasks** | **5.25-6.25 hours** |

**Critical Path:**
- Phase 1 → Phase 3.1 (permanent delete needs confirmation hook)
- Phase 2 → Phase 3.2 (soft deletes need undo hook)
- Phases 1-2 can be done in parallel if two developers

**Parallelization Opportunities:**
- Task 1.1 + Task 2.1 (independent modules)
- Task 3.1 + Task 3.3 (different files)
- Task 4.1 + Task 4.2 (different concerns)
