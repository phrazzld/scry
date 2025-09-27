import { HomepageStatsSkeleton } from '@/components/ui/loading-skeletons';

export default function Loading() {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="doc-layout flex-grow">
        <div className="prose">
          {/* Header skeleton */}
          <header className="text-center mb-16" aria-busy="true" aria-hidden="true">
            <div className="font-mono text-5xl uppercase tracking-wider mb-6 h-16 w-32 mx-auto bg-muted animate-pulse rounded" />
            <div className="h-8 w-96 mx-auto bg-muted animate-pulse rounded mb-4" />
            <div className="space-y-2">
              <div className="h-6 w-80 mx-auto bg-muted animate-pulse rounded" />
              <div className="h-6 w-64 mx-auto bg-muted animate-pulse rounded" />
            </div>
          </header>

          {/* Stats skeleton */}
          <section className="mb-16">
            <HomepageStatsSkeleton />
          </section>
        </div>
      </div>
    </div>
  );
}
