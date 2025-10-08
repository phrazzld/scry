# TODO: Fix restoreQuestions Bug + Type Safety Infrastructure

**Context**: Frontend-backend contract mismatch - `library-client.tsx` calls non-existent `restoreQuestions()` mutation, causing undo functionality to fail at runtime with "Could not find public function" error.

**Root Cause**: Implemented undo pattern assuming symmetric mutation pairs existed, but backend only has `bulkDelete` (soft delete) without its inverse `restoreQuestions`.

**Impact**: Users cannot undo delete operations in Library, breaking core UX pattern.

---

## Phase 1: Critical Bug Fix

### Backend Implementation

- [ ] **Create `restoreQuestions` mutation in `convex/questions.ts`**

  Location: After `bulkDelete` mutation (line ~766)

  Implementation requirements:
  - Follow atomic validation pattern from `bulkDelete`:
    1. Fetch all questions first (`Promise.all` + `ctx.db.get`)
    2. Validate ALL before mutating ANY (existence + ownership checks)
    3. Execute patches in parallel only after validation passes
  - Clear soft delete: `deletedAt: undefined`
  - Update timestamp: `updatedAt: now`
  - Return object: `{ restored: args.questionIds.length }`
  - Use same error messages as sibling mutations for consistency

  Success criteria: Mutation clears `deletedAt` field, restoring questions from trash to active state. Maintains same validation rigor as `bulkDelete`.

  ```typescript
  export const restoreQuestions = mutation({
    args: {
      questionIds: v.array(v.id('questions')),
    },
    handler: async (ctx, args) => {
      const user = await requireUserFromClerk(ctx);
      const userId = user._id;
      const now = Date.now();

      // Atomic validation: fetch all questions first
      const questions = await Promise.all(args.questionIds.map((id) => ctx.db.get(id)));

      // Validate ALL before mutating ANY
      questions.forEach((question, index) => {
        if (!question) {
          throw new Error(`Question not found: ${args.questionIds[index]}`);
        }
        if (question.userId !== userId) {
          throw new Error(`Unauthorized access to question: ${args.questionIds[index]}`);
        }
      });

      // All validations passed - execute mutations in parallel
      await Promise.all(
        args.questionIds.map((id) =>
          ctx.db.patch(id, {
            deletedAt: undefined,  // Clear soft delete
            updatedAt: now,
          })
        )
      );

      return { restored: args.questionIds.length };
    },
  });
  ```

### Type System Verification

- [ ] **Verify Convex type generation and imports**

  Process:
  1. Save mutation in `convex/questions.ts`
  2. Observe `npx convex dev` output for "Convex functions ready!" message
  3. Check `convex/_generated/api.d.ts` contains `restoreQuestions` in exports
  4. Open `app/library/_components/library-client.tsx` in editor
  5. Verify TypeScript autocomplete shows `api.questions.restoreQuestions`
  6. Run `pnpm build` - should complete without errors

  Success criteria: No TypeScript errors, mutation properly typed in `api.questions` namespace, frontend imports resolve correctly.

### Integration Testing

- [ ] **Manual test: Delete → Undo flow in Library**

  Test scenario:
  1. Navigate to `/library` in development server
  2. Select 1-3 questions from Active tab
  3. Click "Delete" action (moves to trash via `bulkDelete`)
  4. Observe success toast with "Undo" button appears
  5. Click "Undo" button within 5 seconds
  6. Verify questions reappear in Active tab (not in Trash)
  7. Check browser console - should be no errors
  8. Verify Convex logs show successful `restoreQuestions` mutation

  Success criteria: Undo button successfully calls `restoreQuestions`, questions move from trash back to active state, no console errors, toast shows "Action undone" confirmation.

- [ ] **Manual test: Restore → Undo flow in Library**

  Test scenario:
  1. Navigate to `/library` → Trash tab
  2. Select questions already in trash
  3. Click "Restore" action (moves to active via `restoreQuestions`)
  4. Observe success toast with "Undo" button
  5. Click "Undo" button
  6. Verify questions move back to Trash (via `bulkDelete`)
  7. Check both forward and reverse operations work

  Success criteria: Restore and its undo both work correctly, demonstrating proper mutation pairing.

---

## Phase 2: Type Safety Infrastructure

### Pre-Commit Type Checking

- [ ] **Install Husky for Git hooks** (if not already installed)

  Commands:
  ```bash
  pnpm add -D husky
  npx husky init
  ```

  Success criteria: `.husky/` directory created, `package.json` has Husky prepare script.

- [ ] **Create pre-commit hook for type checking**

  File: `.husky/pre-commit`

  Implementation:
  ```bash
  #!/bin/sh
  . "$(dirname "$0")/_/husky.sh"

  echo "🔍 Running pre-commit type check..."

  # Type check without building (faster)
  pnpm exec tsc --noEmit

  if [ $? -ne 0 ]; then
    echo "❌ Type check failed - frontend references non-existent backend functions"
    echo "Run 'npx convex dev' to ensure types are current, then fix type errors"
    exit 1
  fi

  echo "✅ Type check passed"
  ```

  Make executable: `chmod +x .husky/pre-commit`

  Success criteria: Committing code with missing mutation reference (e.g., `api.questions.nonExistent`) fails with clear error message before commit is created.

- [ ] **Test pre-commit hook catches missing mutations**

  Test scenario:
  1. Temporarily add line to `library-client.tsx`: `const test = useMutation(api.questions.fakeFunction);`
  2. Stage change: `git add app/library/_components/library-client.tsx`
  3. Attempt commit: `git commit -m "test"`
  4. Observe hook runs `tsc --noEmit` and fails
  5. Remove test line, verify normal commits work

  Success criteria: Hook prevents committing code with type errors, provides actionable error message.

### API Contract Testing

- [ ] **Create API contract test suite**

  File: `tests/api-contract.test.ts`

  Implementation:
  ```typescript
  import { describe, expect, it } from 'vitest';
  import { api } from '@/convex/_generated/api';

  describe('API Contract: Library Mutations', () => {
    it('all required mutations exist', () => {
      // Archive operations (reversible pair)
      expect(api.questions.archiveQuestions).toBeDefined();
      expect(api.questions.unarchiveQuestions).toBeDefined();

      // Delete/Restore operations (reversible pair)
      expect(api.questions.bulkDelete).toBeDefined();
      expect(api.questions.restoreQuestions).toBeDefined();

      // Permanent delete (irreversible)
      expect(api.questions.permanentlyDelete).toBeDefined();
    });

    it('mutation pairs are symmetric', () => {
      // Archive ↔ Unarchive
      expect(api.questions.archiveQuestions).toBeDefined();
      expect(api.questions.unarchiveQuestions).toBeDefined();

      // Delete ↔ Restore
      expect(api.questions.bulkDelete).toBeDefined();
      expect(api.questions.restoreQuestions).toBeDefined();
    });

    it('library-client.tsx dependencies are satisfied', () => {
      // All mutations referenced in library-client.tsx must exist
      const requiredMutations = [
        'archiveQuestions',
        'unarchiveQuestions',
        'bulkDelete',
        'restoreQuestions',
        'permanentlyDelete',
      ] as const;

      requiredMutations.forEach((mutation) => {
        expect(api.questions[mutation]).toBeDefined();
      });
    });
  });

  describe('API Contract: Review Flow Mutations', () => {
    it('review-flow.tsx dependencies are satisfied', () => {
      // Mutations used in review-flow.tsx
      expect(api.questions.updateQuestion).toBeDefined();
      expect(api.questions.softDeleteQuestion).toBeDefined();
    });
  });
  ```

  Success criteria: Tests pass when all mutations exist, fail immediately if any mutation is removed or renamed. Serves as living documentation of frontend-backend contract.

- [ ] **Add contract tests to CI pipeline**

  File: `package.json` (update test script)

  Change:
  ```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:contract": "vitest run tests/api-contract.test.ts"
  }
  ```

  Success criteria: `pnpm test` runs contract tests, `pnpm build` includes contract validation in CI workflow.

---

## Phase 3: Documentation & Developer Experience

### Mutation Pair Documentation

- [ ] **Add "Convex Mutations: Reversible Operations" section to CLAUDE.md**

  Location: After "Background Question Generation" section (around line 280)

  Content:
  ```markdown
  ## Convex Mutations: Reversible Operations

  ### Mutation Pairs (Action ↔ Undo)

  The application implements reversible operations using mutation pairs. Every action mutation MUST have a corresponding undo mutation implemented in the backend.

  | Action | Mutation | Effect | Undo | Mutation | Effect |
  |--------|----------|--------|------|----------|--------|
  | Archive | `archiveQuestions` | Sets `archivedAt: now` | Unarchive | `unarchiveQuestions` | Clears `archivedAt` |
  | Soft Delete | `bulkDelete` | Sets `deletedAt: now` | Restore | `restoreQuestions` | Clears `deletedAt` |
  | Hard Delete | `permanentlyDelete` | Removes from DB | ❌ None | - | **Irreversible** |

  ### Critical Rule: Mutation Symmetry

  **Before implementing undo UI pattern:**
  1. ✅ Verify BOTH mutations exist in `convex/questions.ts`
  2. ✅ Test both forward and reverse operations manually
  3. ✅ Add contract tests in `tests/api-contract.test.ts`

  **Common failure mode:** Implementing frontend undo assuming backend mutation exists, discovering at runtime the mutation is missing. Pre-commit hooks and contract tests prevent this.

  ### File: `convex/questions.ts`

  **Mutation Implementation Pattern:**
  ```typescript
  // Standard pattern for all bulk mutations
  export const operationName = mutation({
    args: { questionIds: v.array(v.id('questions')) },
    handler: async (ctx, args) => {
      // 1. Auth
      const user = await requireUserFromClerk(ctx);

      // 2. Atomic validation (fetch ALL first)
      const questions = await Promise.all(
        args.questionIds.map((id) => ctx.db.get(id))
      );

      // 3. Validate ALL before mutating ANY
      questions.forEach((question, index) => {
        if (!question) throw new Error(`Question not found: ${args.questionIds[index]}`);
        if (question.userId !== userId) throw new Error(`Unauthorized: ${args.questionIds[index]}`);
      });

      // 4. Execute mutations in parallel
      await Promise.all(
        args.questionIds.map((id) => ctx.db.patch(id, { /* changes */ }))
      );

      return { count: args.questionIds.length };
    },
  });
  ```
  ```

  Success criteria: Future developers can quickly identify required mutation pairs, understand implementation pattern, avoid frontend-backend contract mismatches.

### Development Workflow Documentation

- [ ] **Add "Backend-First Development Workflow" to CLAUDE.md**

  Location: After "Key Development Patterns" section

  Content:
  ```markdown
  ## Backend-First Development Workflow

  When implementing features that require new backend mutations or queries, follow this strict order to prevent frontend-backend contract mismatches:

  ### Checklist for Backend-Requiring Features

  1. **Backend First**: Implement mutation/query in `convex/`
     - Define args schema with `v.object({ ... })`
     - Implement handler with proper auth and validation
     - Follow atomic validation pattern for bulk operations
     - Add JSDoc comments explaining purpose and edge cases

  2. **Generate Types**: Ensure types are current
     - Verify `npx convex dev` is running and sees your changes
     - Wait for "Convex functions ready!" message in terminal
     - Confirm `convex/_generated/api.d.ts` contains new function

  3. **Frontend Second**: Use mutation/query in components
     - Import from generated API: `import { api } from '@/convex/_generated/api'`
     - Use with Convex hooks: `useMutation(api.module.function)`
     - TypeScript autocomplete should show your new function

  4. **Type Check**: Verify before committing
     - Run `pnpm build` or `pnpm exec tsc --noEmit`
     - Fix any type errors before staging changes
     - Pre-commit hook will enforce this automatically

  5. **Test Integration**: Manual end-to-end test
     - Test happy path in development environment
     - Test error cases (auth failures, invalid data)
     - Verify loading states and error messages

  ### Anti-Pattern: Frontend-First (Causes Runtime Errors)

  ❌ **Don't do this:**
  ```typescript
  // Writing frontend code first, assuming backend exists
  const restore = useMutation(api.questions.restoreQuestions); // DOESN'T EXIST YET!
  ```

  This compiles but fails at runtime with "Could not find public function" error.

  ✅ **Do this instead:**
  1. Implement `restoreQuestions` in `convex/questions.ts`
  2. Wait for type generation
  3. Then use in frontend

  ### Mutation Pairs Require Both Implementations

  When implementing undo patterns:
  - ✅ Implement both action and undo mutations BEFORE writing frontend code
  - ✅ Test both directions work (archive → unarchive, delete → restore)
  - ✅ Add contract tests to prevent future regressions
  ```

  Success criteria: Clear, actionable guidance prevents common mistake of implementing frontend before backend. New developers understand correct workflow order.

---

## Testing & Verification

- [ ] **End-to-end workflow test**

  Full test scenario combining all phases:
  1. Make trivial change to `library-client.tsx` (add comment)
  2. Stage change: `git add app/library/_components/library-client.tsx`
  3. Commit: `git commit -m "test: verify pre-commit hook"`
  4. Verify commit succeeds (types are valid)
  5. Run `pnpm test` - contract tests should pass
  6. Navigate to `/library` in browser
  7. Test delete → undo flow (Phase 1 verification)
  8. Test restore → undo flow (Phase 1 verification)

  Success criteria: All systems work together - pre-commit hook validates types, contract tests pass, undo functionality works in UI, documentation provides clear guidance for future work.
