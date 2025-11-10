'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { ConceptDetail } from '@/components/concepts/concept-detail';
import { PageContainer } from '@/components/page-container';
import { api } from '@/convex/_generated/api';
import { useConceptActions } from '@/hooks/use-concept-actions';

interface ConceptDetailClientProps {
  conceptId: string;
}

export function ConceptDetailClient({ conceptId }: ConceptDetailClientProps) {
  const router = useRouter();
  const detail = useQuery(api.concepts.getDetail, { conceptId: conceptId as string });

  const actions = useConceptActions({ conceptId });

  const content = useMemo(() => {
    if (detail === undefined) {
      return (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Loading concept…
        </div>
      );
    }

    if (!detail) {
      return (
        <div className="text-sm text-muted-foreground">
          Concept not found.{' '}
          <button
            type="button"
            className="text-foreground underline"
            onClick={() => router.push('/concepts')}
          >
            Return to concepts library.
          </button>
        </div>
      );
    }

    return (
      <ConceptDetail
        concept={detail.concept}
        phrasings={detail.phrasings}
        pendingGeneration={detail.pendingGeneration}
        onGenerate={actions.requestMorePhrasings}
        onSetCanonical={(id) => actions.setCanonical(id)}
        onArchive={(id) => actions.archivePhrasing(id)}
        isSettingCanonical={actions.isSettingCanonical}
        isArchiving={actions.isArchiving}
        isRequestingGeneration={actions.isRequestingGeneration}
      />
    );
  }, [actions, detail, router]);

  return <PageContainer className="py-8">{content}</PageContainer>;
}
