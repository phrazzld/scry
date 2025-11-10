'use client';

import { formatDistanceToNow } from 'date-fns';
import { Check, SplitSquareHorizontal, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Doc } from '@/convex/_generated/dataModel';

type ActionCard = Doc<'actionCards'>;

interface ConceptSnapshot {
  conceptId: string;
  title: string;
  description?: string;
  phrasingCount?: number;
  conflictScore?: number;
  thinScore?: number;
}

interface MergeActionPayload {
  canonicalConceptId: string;
  mergeConceptId: string;
  similarity?: number;
  titleSimilarity?: number;
  conceptSnapshots?: ConceptSnapshot[];
  llmDecision?: {
    reason?: string;
    confidence?: number;
  };
}

interface ActionCardProps {
  card: ActionCard;
  isSelected: boolean;
  onAccept: () => void;
  onReject: () => void;
  disabled?: boolean;
  pending?: boolean;
}

export function ActionInboxCard({
  card,
  isSelected,
  onAccept,
  onReject,
  disabled,
  pending,
}: ActionCardProps) {
  const payload = (card.payload ?? {}) as MergeActionPayload;
  const canonical = payload.conceptSnapshots?.find(
    (snapshot) => snapshot.conceptId === payload.canonicalConceptId
  );
  const mergeCandidate = payload.conceptSnapshots?.find(
    (snapshot) => snapshot.conceptId === payload.mergeConceptId
  );

  return (
    <Card
      className={`space-y-4 border ${
        isSelected ? 'border-primary shadow-lg' : 'border-border'
      } p-4`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Merge Concepts</Badge>
          {payload.similarity !== undefined ? (
            <Badge variant="secondary">Sim: {(payload.similarity * 100).toFixed(1)}%</Badge>
          ) : null}
          {payload.titleSimilarity !== undefined ? (
            <Badge variant="secondary">Title: {(payload.titleSimilarity * 100).toFixed(1)}%</Badge>
          ) : null}
          {card.createdAt ? (
            <span className="text-xs text-muted-foreground">
              Proposed {formatDistanceToNow(card.createdAt, { addSuffix: true })}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ConceptSummary title="Keep" snapshot={canonical} highlight="Keep canonical phrasing" />
          <ConceptSummary
            title="Merge into keep"
            snapshot={mergeCandidate}
            highlight="This concept will be merged"
          />
        </div>

        {payload.llmDecision?.reason ? (
          <p className="text-sm text-muted-foreground">{payload.llmDecision.reason}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onAccept} disabled={disabled || pending}>
          {pending ? (
            <>
              <Check className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Applying…
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" aria-hidden />
              Accept
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} disabled={disabled || pending}>
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Reject
        </Button>
      </div>
    </Card>
  );
}

function ConceptSummary({
  title,
  snapshot,
  highlight,
}: {
  title: string;
  snapshot?: ConceptSnapshot;
  highlight: string;
}) {
  if (!snapshot) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Missing concept snapshot
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <SplitSquareHorizontal className="h-4 w-4 text-primary" aria-hidden />
        {title}
      </div>
      <p className="font-medium">{snapshot.title}</p>
      {snapshot.description ? (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{snapshot.description}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">
          {snapshot.phrasingCount ?? 0} phrasing
          {(snapshot.phrasingCount ?? 0) === 1 ? '' : 's'}
        </Badge>
        {snapshot.thinScore ? (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-900">
            Thin
          </Badge>
        ) : null}
        {snapshot.conflictScore ? (
          <Badge variant="secondary" className="bg-red-500/10 text-red-900">
            Conflict
          </Badge>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-medium text-foreground">{highlight}</p>
    </div>
  );
}
