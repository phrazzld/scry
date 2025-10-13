'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';

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
    <div className="h-[90vh] flex items-center px-6">
      <div className="max-w-7xl">
        {/* Hero section - tight grouping for related message */}
        <div className="space-y-4">
          <h1 className="text-7xl md:text-8xl font-bold tracking-tight text-foreground">
            All done<span className="opacity-70">.</span>
          </h1>

          <p className="text-2xl md:text-3xl text-muted-foreground">
            You&apos;re on top of your learning.
          </p>
        </div>

        {/* Metadata section - structured label + value */}
        {nextReviewTime && (
          <div className="mt-12">
            <div className="text-xs uppercase tracking-wider text-muted-foreground/60">
              Next Review
            </div>
            <div className="text-sm text-muted-foreground/90 mt-1">
              {formatNextReviewTime(nextReviewTime)}
            </div>
          </div>
        )}

        {/* Action section - matches editorial label pattern */}
        <div className="mt-8">
          <div className="text-xs uppercase tracking-wider text-muted-foreground/60">
            Ready for More?
          </div>
          <button
            onClick={() => {
              router.push('/');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-generation-modal'));
              }, 100);
            }}
            className="group mt-1 text-base text-foreground hover:text-foreground/80 transition-colors flex items-center gap-2"
          >
            <span>Generate Questions</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
