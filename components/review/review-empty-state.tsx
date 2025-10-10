'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';

import { Button } from '@/components/ui/button';
import { api } from '@/convex/_generated/api';
import { formatNextReviewTime } from '@/lib/format-review-time';

/**
 * Minimalist zen empty state for when all reviews are complete
 *
 * Design philosophy:
 * - Maximum white space for calm, meditative feel
 * - Hero typography (text-8xl) matches Scry branding
 * - Shows next review time (respects Pure FSRS timing)
 * - Single clear action (generate questions)
 * - No redundant "Go Home" button (this IS home)
 */
export function ReviewEmptyState() {
  const router = useRouter();

  // Get next review time from user stats
  const stats = useQuery(api.spacedRepetition.getUserCardStats);
  const nextReviewTime = stats?.nextReviewTime ?? null;

  return (
    <div className="h-[90vh] flex items-center justify-center px-6">
      <div className="text-center space-y-8 max-w-2xl">
        {/* Hero message - matches SignInLanding typography */}
        <h1 className="text-7xl md:text-8xl font-bold tracking-tight text-foreground">
          All done<span className="opacity-70">.</span>
        </h1>

        {/* Success message */}
        <p className="text-2xl md:text-3xl text-muted-foreground">
          You&apos;re on top of your learning.
        </p>

        {/* Next review time - shows when to return */}
        {nextReviewTime && (
          <p className="text-lg text-muted-foreground/80">
            Next review {formatNextReviewTime(nextReviewTime)}
          </p>
        )}

        {/* Single prominent action */}
        <div className="pt-4">
          <Button
            onClick={() => {
              router.push('/');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-generation-modal'));
              }, 100);
            }}
            size="lg"
          >
            Generate Questions
          </Button>
        </div>
      </div>
    </div>
  );
}
