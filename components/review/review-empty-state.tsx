'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';

import { PageContainer } from '@/components/page-container';
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
 *
 * Three states:
 * - Generating (totalCards === 0 && activeJobs): "Hang tight..."
 * - Empty library (totalCards === 0 && !activeJobs): "Nothing yet"
 * - All reviews done (totalCards > 0): "All done"
 */
export function ReviewEmptyState() {
  const router = useRouter();

  // Get next review time and total cards from user stats
  const stats = useQuery(api.spacedRepetition.getUserCardStats);
  const nextReviewTime = stats?.nextReviewTime ?? null;
  const totalCards = stats?.totalCards ?? 0;

  // Check for active generation jobs (only fetch 1 to minimize bandwidth)
  const recentJobs = useQuery(api.generationJobs.getRecentJobs, { pageSize: 1 });
  const hasActiveJobs =
    recentJobs?.results?.some(
      (job: { status: string }) => job.status === 'processing' || job.status === 'pending'
    ) ?? false;

  // Determine which state to show
  const isEmptyLibrary = totalCards === 0;
  const isGenerating = isEmptyLibrary && hasActiveJobs;

  return (
    <PageContainer className="py-6">
      <div className="flex items-center min-h-[calc(100vh-12rem)]">
        <div className="max-w-7xl">
          {/* Hero section - tight grouping for related message */}
          <div className="space-y-4">
            <h1 className="text-7xl md:text-8xl font-bold tracking-tight text-foreground">
              {isGenerating ? (
                <>
                  Hang tight<span className="opacity-70">.</span>
                </>
              ) : isEmptyLibrary ? (
                <>
                  Nothing yet<span className="opacity-70">.</span>
                </>
              ) : (
                <>
                  All done<span className="opacity-70">.</span>
                </>
              )}
            </h1>

            <p className="text-2xl md:text-3xl text-muted-foreground">
              {isGenerating
                ? 'Your questions will be ready shortly.'
                : isEmptyLibrary
                  ? 'Get started.'
                  : "You're on top of your learning."}
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
            {!isEmptyLibrary && !isGenerating && (
              <div className="text-xs uppercase tracking-wider text-muted-foreground/60">
                Ready for More?
              </div>
            )}
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
    </PageContainer>
  );
}
