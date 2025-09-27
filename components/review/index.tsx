'use client';

import { useUser } from '@clerk/nextjs';

import { ReviewFlow } from '@/components/review-flow';

/**
 * Unified review flow component - everything is review mode.
 * Questions are reviewed based on FSRS spaced repetition priority.
 */
export default function UnifiedQuizFlow() {
  const { isSignedIn } = useUser();

  if (!isSignedIn) {
    // Review mode requires authentication
    return (
      <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-muted-foreground">Please sign in to start reviewing.</p>
      </div>
    );
  }

  return <ReviewFlow />;
}

// Re-export review components for external use
export { ReviewFlow } from '@/components/review-flow';
export { ReviewEmptyState } from './review-empty-state';
export { ReviewCompleteState } from './review-complete-state';
