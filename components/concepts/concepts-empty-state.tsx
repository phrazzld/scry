'use client';

import { Ghost } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { ConceptsView } from '@/hooks/use-concepts-query';
import { cn } from '@/lib/utils';

interface ConceptsEmptyStateProps {
  view: ConceptsView;
  searchTerm?: string;
}

const VIEW_MESSAGES: Record<ConceptsView, string> = {
  all: 'No concepts yet. Generate new material or seed from existing questions.',
  due: 'No concepts are currently due. Great job staying ahead!',
  thin: 'No thin concepts detected. Keep monitoring as you learn new material.',
  conflict: 'No conflict indicators detected. Your library looks clean.',
};

export function ConceptsEmptyState({ view, searchTerm }: ConceptsEmptyStateProps) {
  const message =
    searchTerm && searchTerm.length > 0
      ? `No concepts matched “${searchTerm}”. Try a different search.`
      : VIEW_MESSAGES[view];

  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center text-muted-foreground">
      <Ghost className={cn('h-10 w-10')} aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-foreground">Nothing to show yet</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </Card>
  );
}
