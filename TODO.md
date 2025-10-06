# TODO: Library Dashboard Pre-Merge Tasks

> **Context**: Addressing PR #30 review feedback
> **Branch**: `feature/library-dashboard`
> **Status**: ✅ All tasks complete! Ready for merge.

---

## 🔴 Critical (Merge-Blocking)

### ✅ COMPLETED: Fix Missing `restoreQuestions` Bulk Mutation
**Status**: Fixed in commit e4105e2
**Resolution**: Refactored all handlers to accept `ids` parameter instead of relying on state

### ✅ COMPLETED: Fix "Archived 0 Questions" Toast Bug
**Status**: Fixed in commit e4105e2
**Resolution**: Handlers now use `ids.length` instead of `selectedIds.size`

---

## ⚠️ High Priority (Should Fix Before Merge)

### 1. [x] Add Permanent Delete Confirmation Dialog

**Location**: `app/library/_components/library-client.tsx:121-137`
**Status**: ✅ Fixed in commit 68a3640

**Problem**: No confirmation before irreversible deletion creates data loss risk.

**Implementation**:
```typescript
// Option A: Native browser confirm (quick fix)
const handlePermanentDelete = async (ids: Id<'questions'>[]) => {
  const count = ids.length;
  if (count === 0) return;

  const confirmed = confirm(
    `Permanently delete ${count} ${count === 1 ? 'question' : 'questions'}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    await permanentlyDelete({ questionIds: ids });
    toast.success(`Permanently deleted ${count} ${count === 1 ? 'question' : 'questions'}`);

    const newSelection = new Set(selectedIds);
    ids.forEach((id) => newSelection.delete(id));
    setSelectedIds(newSelection);
  } catch (error) {
    toast.error('Failed to permanently delete questions');
    console.error(error);
  }
};
```

```typescript
// Option B: shadcn AlertDialog (better UX, consistent with design system)
// 1. Import AlertDialog components
// 2. Add state: const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
// 3. Add state: const [pendingDeleteIds, setPendingDeleteIds] = useState<Id<'questions'>[]>([])
// 4. Wrap handler to open dialog first
// 5. Add AlertDialog component in JSX with destructive variant
```

**Acceptance Criteria**:
- [ ] Dialog shows question count and warns action is irreversible
- [ ] Cancel button dismisses without action
- [ ] Confirm button executes permanent delete
- [ ] Works for both single (dropdown) and bulk (selection bar) operations
- [ ] Consistent with existing UI patterns

**Testing**:
- [ ] Click "Delete Permanently" from dropdown → see confirmation
- [ ] Select multiple questions → "Delete Permanently" → see count in dialog
- [ ] Click "Cancel" → no questions deleted, selection unchanged
- [ ] Click "Confirm" → questions deleted, toast shows correct count
- [ ] Mobile: dialog renders properly on small screens

**Estimated Effort**: 30-45 minutes (native confirm), 1-2 hours (AlertDialog)

---

### 2. [x] Improve Bulk Mutation Error Handling

**Location**: `convex/questions.ts` - functions at lines:
- `archiveQuestions` (659-682)
- `unarchiveQuestions` (699-722)
- `bulkDelete` (741-764)
- `permanentlyDelete` (782-798)
**Status**: ✅ Fixed in commit f198245

**Problem**: Current pattern uses `Promise.all` which fails entire batch if one question fails ownership check. Questions 1-49 may already be patched when question 50 fails.

**Current Pattern** (Problematic):
```typescript
await Promise.all(
  args.questionIds.map(async (id) => {
    const question = await ctx.db.get(id);
    if (!question || question.userId !== userId) {
      throw new Error('Question not found or unauthorized'); // ❌ Partial execution
    }
    await ctx.db.patch(id, { archivedAt: now, updatedAt: now });
  })
);
```

**Better Pattern** (Atomic Validation):
```typescript
// Step 1: Fetch all questions in parallel
const questions = await Promise.all(
  args.questionIds.map(id => ctx.db.get(id))
);

// Step 2: Validate ALL before mutating ANY
questions.forEach((question, index) => {
  if (!question) {
    throw new Error(`Question not found: ${args.questionIds[index]}`);
  }
  if (question.userId !== userId) {
    throw new Error(`Unauthorized access to question: ${args.questionIds[index]}`);
  }
});

// Step 3: All validations passed - execute mutations
await Promise.all(
  args.questionIds.map(id =>
    ctx.db.patch(id, { archivedAt: now, updatedAt: now })
  )
);

return { archived: args.questionIds.length };
```

**Alternative Pattern** (Graceful Partial Failures - More Complex):
```typescript
const results = await Promise.allSettled(
  args.questionIds.map(async (id) => {
    const question = await ctx.db.get(id);
    if (!question || question.userId !== userId) {
      throw new Error('Question not found or unauthorized');
    }
    await ctx.db.patch(id, { archivedAt: now, updatedAt: now });
    return id;
  })
);

const succeeded = results.filter(r => r.status === 'fulfilled').length;
const failed = results.filter(r => r.status === 'rejected');

if (failed.length > 0) {
  console.error('Partial failure:', failed.map(f => f.reason));
}

return {
  archived: succeeded,
  failed: failed.length,
  partial: failed.length > 0 && succeeded > 0
};
```

**Frontend Changes** (if using partial failure pattern):
```typescript
// library-client.tsx
const handleArchive = async (ids: Id<'questions'>[]) => {
  const count = ids.length;
  if (count === 0) return;

  try {
    const result = await archiveQuestions({ questionIds: ids });

    if (result.partial) {
      toast.warning(
        `Archived ${result.archived} of ${count} questions. ${result.failed} failed.`
      );
    } else {
      toast.success(`Archived ${count} ${count === 1 ? 'question' : 'questions'}`);
    }

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

**Recommendation**: Start with **Atomic Validation pattern** (simpler, still fixes the issue). Consider partial failures only if users frequently encounter authorization errors.

**Acceptance Criteria**:
- [ ] All bulk mutations use atomic validation (fetch → validate → mutate)
- [ ] Mutations only execute if ALL questions pass validation
- [ ] Error messages include question IDs for debugging
- [ ] No partial state corruption (all-or-nothing transactions)
- [ ] Return value includes count of affected questions

**Testing**:
- [ ] Archive 10 questions owned by user → all succeed
- [ ] Try to archive 1 question not owned by user → all fail, clear error
- [ ] Archive mix of owned/not-owned → graceful failure, helpful error
- [ ] Archive 100 questions → performance acceptable
- [ ] Error toast shows which operation failed

**Files to Update**:
1. `convex/questions.ts` - Refactor all 4 bulk mutations
2. (Optional) Frontend handlers if using partial failure pattern

**Estimated Effort**: 2-3 hours (atomic validation), 4-5 hours (partial failures + frontend)

---

## 📋 Additional Context

**Review Source**: PR #30 received 5 AI-generated code review comments identifying these issues consistently.

**Already Fixed**:
- Missing `restoreQuestions` mutation (refactored to handler parameter pattern)
- Toast message showing "0 questions" (fixed by using `ids.length`)

**Deferred to Backlog**:
- Selection state simplification (use TanStack `getRowId`)
- Performance monitoring for client-side filtering
- Test coverage expansion
- Custom hook extraction for mutations
- Empty state text correction (30-day retention claim)

**Not Blocking Merge**:
- Error boundaries (Next.js 15 RSC handles differently)
- Rate limiting for bulk ops (low risk - users only affect own data)
- Loading skeletons (nice-to-have UI polish)
- Additional JSDoc comments (code is self-documenting)

---

**Last Updated**: 2025-10-06
**Next Review**: After addressing tasks 1-2 above
