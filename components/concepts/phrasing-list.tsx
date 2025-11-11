'use client';

import { Fragment } from 'react';
import { Archive, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

interface PhrasingListProps {
  phrasings: Doc<'phrasings'>[];
  canonicalPhrasingId?: Id<'phrasings'>;
  onSetCanonical: (phrasingId: Id<'phrasings'>) => Promise<void>;
  onClearCanonical: () => Promise<void>;
  onArchive: (phrasingId: Id<'phrasings'>) => Promise<void>;
  isSettingCanonical: boolean;
  isArchiving: boolean;
}

export function PhrasingList({
  phrasings,
  canonicalPhrasingId,
  onSetCanonical,
  onClearCanonical,
  onArchive,
  isSettingCanonical,
  isArchiving,
}: PhrasingListProps) {
  if (phrasings.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
        No active phrasings yet. Run Stage B to generate candidate review prompts for this concept.
      </Card>
    );
  }

  return (
    <Card className="divide-y">
      {phrasings.map((phrasing, index) => {
        const isCanonical = canonicalPhrasingId === phrasing._id;
        return (
          <Fragment key={phrasing._id}>
            {index > 0 ? <Separator /> : null}
            <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold leading-tight">{phrasing.question}</p>
                  {isCanonical ? (
                    <Badge variant="secondary" className="flex items-center gap-1 text-[11px]">
                      <Star className="h-3 w-3 fill-current" aria-hidden />
                      Canonical
                    </Badge>
                  ) : null}
                </div>
                {phrasing.explanation ? (
                  <p className="text-sm text-muted-foreground">{phrasing.explanation}</p>
                ) : null}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>
                    Attempts: {phrasing.attemptCount ?? 0} · Correct: {phrasing.correctCount ?? 0}
                  </span>
                  {phrasing.lastAttemptedAt ? (
                    <span>
                      Last reviewed: {new Date(phrasing.lastAttemptedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (isCanonical ? onClearCanonical() : onSetCanonical(phrasing._id))}
                  disabled={isSettingCanonical}
                >
                  {isCanonical ? 'Clear canonical' : 'Set canonical'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-muted-foreground hover:text-destructive',
                    isArchiving && 'opacity-70'
                  )}
                  onClick={() => onArchive(phrasing._id)}
                  disabled={isArchiving}
                >
                  <Archive className="mr-2 h-4 w-4" aria-hidden />
                  Archive
                </Button>
              </div>
            </div>
          </Fragment>
        );
      })}
    </Card>
  );
}
