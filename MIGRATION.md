# Migration Guide for PR #23: Remove Card Components Refactor

This guide helps you migrate your code to work with the breaking changes introduced in PR #23 (branch: `refactor/remove-card-components`).

## Overview

PR #23 simplifies the UI architecture by removing Card-based layouts in favor of cleaner, more maintainable component structures. The primary breaking changes are:

1. **API Endpoint Rename**: `/api/generate-quiz` → `/api/generate-questions`
2. **Component Architecture**: Removal of Card wrapper components from quiz/review states
3. **Test Infrastructure**: Updated test selectors using `data-testid` attributes

## Breaking Changes

### 1. API Endpoint Change

The quiz generation endpoint has been renamed for clarity and consistency.

#### Before
```typescript
const response = await fetch('/api/generate-quiz', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic, difficulty })
});
```

#### After
```typescript
const response = await fetch('/api/generate-questions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic, difficulty })
});
```

**Backwards Compatibility**: A temporary redirect is in place at `/api/generate-quiz` that forwards requests to the new endpoint. This redirect includes deprecation headers and will be removed in 90 days.

**Deprecation Headers**:
- `Deprecation: true`
- `X-Alternative-Endpoint: /api/generate-questions`
- `Warning: 299 - "This endpoint is deprecated. Please use /api/generate-questions instead."`
- `Sunset: <date 90 days from deployment>`

### 2. Component Import Changes

If you've been importing and using Card components from the UI library, these patterns have changed.

#### Before
```tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function MyComponent() {
  return (
    <Card>
      <CardHeader>Title</CardHeader>
      <CardContent>
        {/* content */}
      </CardContent>
    </Card>
  );
}
```

#### After
```tsx
// Card components are still available but no longer used in core quiz/review flows
// For quiz/review states, use direct layout components:

function MyComponent() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Title</h2>
      <div>
        {/* content */}
      </div>
    </div>
  );
}
```

**Note**: The Card components still exist in `@/components/ui/card` for backward compatibility, but the core application states (QuizReadyState, QuizGeneratingState, ReviewCompleteState, etc.) no longer use them.

### 3. Test Selector Updates

E2E tests now use stable `data-testid` attributes instead of role-based selectors with text.

#### Before
```typescript
await page.getByRole('button', { name: 'Generate' }).click();
await page.getByRole('button', { name: 'Generate Quiz' }).click();
```

#### After
```typescript
await page.getByTestId('generate-quiz-button').click();
```

**Updated Test IDs**:
- `data-testid="generate-quiz-button"` - Main quiz generation button
- `data-testid="user-menu"` - User menu in navbar
- `data-testid="answer-option-{index}"` - Answer options in quiz (0-indexed)

### 4. Type Safety Improvements

The untyped API responses have been replaced with proper TypeScript interfaces.

#### Before
```typescript
const data: Record<string, unknown> = await response.json();
```

#### After
```typescript
import type { GenerateQuestionsResponse, GenerateQuestionsError } from '@/types/api-responses';

const data: GenerateQuestionsResponse = await response.json();
```

## Migration Steps

### Step 1: Update API Calls

Search your codebase for `/api/generate-quiz` and replace with `/api/generate-questions`:

```bash
# Find all occurrences
grep -r "generate-quiz" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# Update each occurrence to use the new endpoint
```

### Step 2: Update Component Imports

If you have custom components using the Card layout pattern from quiz/review states:

1. Review the updated implementations in:
   - `components/quiz-states/`
   - `components/review-states/`

2. Update your components to follow the new patterns (direct layouts without Card wrappers)

### Step 3: Update Tests

Update E2E and integration tests to use the new test IDs:

```typescript
// Old pattern
const button = await page.getByRole('button', { name: /generate/i });

// New pattern
const button = await page.getByTestId('generate-quiz-button');
```

### Step 4: Update Type Imports

Add type imports for API responses:

```typescript
import type {
  GenerateQuestionsResponse,
  GenerateQuestionsError
} from '@/types/api-responses';
```

## Code Quality Improvements

This refactor also includes several code quality improvements that don't require migration but you should be aware of:

### Memory Leak Fixes
- Fixed requestAnimationFrame cleanup in `components/debug-panel.tsx`
- Fixed polling interval cleanup in `hooks/use-simple-poll.ts`

### Magic Numbers Extracted
```typescript
// Constants now defined at module level
const MIN_TEXTAREA_HEIGHT = 80;
const MAX_TEXTAREA_HEIGHT = 200;
const REVIEW_POLL_INTERVAL_MS = 30000;
const DASHBOARD_POLL_INTERVAL_MS = 60000;
```

### Console Logging Guards
All console.log statements are now wrapped with environment checks:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info');
}
```

## Testing Your Migration

After making the changes:

1. **Run the test suite**:
   ```bash
   pnpm test
   pnpm test:e2e
   ```

2. **Check for deprecation warnings** in the browser console when using the old endpoint

3. **Verify UI rendering** - quiz and review states should appear cleaner without card borders

4. **Monitor performance** - the removal of wrapper components should slightly improve render performance

## Timeline

- **Immediate**: Update to new endpoint `/api/generate-questions`
- **30 days**: Update component patterns if using Card-based layouts
- **90 days**: Legacy endpoint `/api/generate-quiz` will be removed

## Need Help?

If you encounter issues during migration:

1. Check the PR discussion at #23
2. Review the updated component implementations in the `components/` directory
3. Run `git diff master..refactor/remove-card-components` to see all changes

## Summary

The main changes are:
- API endpoint: `/api/generate-quiz` → `/api/generate-questions`
- UI components: Card wrappers removed from core states
- Test selectors: Role-based → `data-testid` attributes
- Type safety: Proper TypeScript interfaces for API responses

The changes simplify the codebase and improve maintainability while providing backward compatibility during the transition period.