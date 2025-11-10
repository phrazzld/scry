'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, BookOpenCheck, Clock3 } from 'lucide-react';
import { GeneratePhrasingsDialog } from '@/components/concepts/generate-phrasings-dialog';
import { PhrasingList } from '@/components/concepts/phrasing-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Doc } from '@/convex/_generated/dataModel';

interface ConceptDetailProps {
  concept: Doc<'concepts'>;
  phrasings: Doc<'phrasings'>[];
  pendingGeneration: boolean;
  onGenerate: () => Promise<void>;
  onSetCanonical: (phrasingId: string | null) => Promise<void>;
  onArchive: (phrasingId: string) => Promise<void>;
  isSettingCanonical: boolean;
  isArchiving: boolean;
  isRequestingGeneration: boolean;
}

export function ConceptDetail({
  concept,
  phrasings,
  pendingGeneration,
  onGenerate,
  onSetCanonical,
  onArchive,
  isSettingCanonical,
  isArchiving,
  isRequestingGeneration,
}: ConceptDetailProps) {
  const nextReviewLabel = concept.fsrs.nextReview
    ? formatDistanceToNow(concept.fsrs.nextReview, { addSuffix: true })
    : 'Not scheduled';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        <Link href="/concepts" className="hover:underline">
          Back to concepts
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{concept.title}</h1>
            {concept.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{concept.description}</p>
            ) : null}
          </div>
          <GeneratePhrasingsDialog
            onConfirm={onGenerate}
            disabled={pendingGeneration}
            pending={pendingGeneration || isRequestingGeneration}
          />
        </div>

        <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Next review"
            value={nextReviewLabel}
            icon={<Clock3 className="h-4 w-4" aria-hidden />}
          />
          <Stat
            label="Stability"
            value={concept.fsrs.stability?.toFixed(2) ?? '—'}
            icon={<BookOpenCheck className="h-4 w-4" aria-hidden />}
          />
          <Stat
            label="Phrasings"
            value={`${concept.phrasingCount}`}
            icon={<span className="text-base font-semibold">Σ</span>}
          />
          <Stat
            label="Signals"
            value={
              <div className="flex flex-wrap items-center gap-2">
                {concept.thinScore ? <Badge variant="secondary">Thin</Badge> : null}
                {concept.conflictScore ? (
                  <Badge variant="secondary" className="bg-red-500/10 text-red-900">
                    Conflict
                  </Badge>
                ) : null}
                {!concept.thinScore && !concept.conflictScore ? 'Healthy' : null}
              </div>
            }
          />
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Active phrasings</h2>
            <p className="text-sm text-muted-foreground">
              Set a canonical phrasing for deterministic reviews or archive low-signal ones.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/concepts">View all concepts</Link>
          </Button>
        </div>
        <PhrasingList
          phrasings={phrasings}
          canonicalPhrasingId={concept.canonicalPhrasingId}
          onSetCanonical={(id) => onSetCanonical(id)}
          onClearCanonical={() => onSetCanonical(null)}
          onArchive={(id) => onArchive(id)}
          isSettingCanonical={isSettingCanonical}
          isArchiving={isArchiving}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
