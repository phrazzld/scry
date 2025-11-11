'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Doc } from '@/convex/_generated/dataModel';

interface ConceptsTableProps {
  concepts: Doc<'concepts'>[];
  serverTime: number;
}

export function ConceptsTable({ concepts, serverTime }: ConceptsTableProps) {
  if (concepts.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Concept</TableHead>
            <TableHead className="w-[20%]">Next review</TableHead>
            <TableHead className="w-[15%] text-center">Phrasings</TableHead>
            <TableHead className="w-[15%] text-center">Signals</TableHead>
            <TableHead className="w-[15%] text-right pr-6">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {concepts.map((concept) => {
            const dueState = getDueState(concept, serverTime);
            const hasThinSignal = (concept.thinScore ?? 0) > 0;
            const hasConflictSignal = (concept.conflictScore ?? 0) > 0;

            return (
              <TableRow key={concept._id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/concepts/${concept._id}`}
                        className="group inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {concept.title}
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </Link>
                      {concept.fsrs.state && (
                        <Badge variant="outline" className="text-xs">
                          {concept.fsrs.state}
                        </Badge>
                      )}
                    </div>
                    {concept.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {concept.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge className={dueState.badgeClass}>{dueState.label}</Badge>
                    {dueState.nextReviewLabel && (
                      <span className="text-xs text-muted-foreground">
                        {dueState.nextReviewLabel}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="justify-center text-sm">
                    {concept.phrasingCount} {concept.phrasingCount === 1 ? 'phrasing' : 'phrasings'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {hasThinSignal && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-900 dark:text-amber-200"
                      >
                        Thin
                      </Badge>
                    )}
                    {hasConflictSignal && (
                      <Badge
                        variant="outline"
                        className="bg-red-500/10 text-red-900 dark:text-red-300"
                      >
                        Conflict
                      </Badge>
                    )}
                    {!hasThinSignal && !hasConflictSignal && (
                      <span className="text-xs text-muted-foreground">Clean</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right pr-6">
                  {concept.updatedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3 w-3" aria-hidden />
                      Updated {formatDistanceToNow(concept.updatedAt, { addSuffix: true })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Auto-generated</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function getDueState(concept: Doc<'concepts'>, now: number) {
  const nextReview = concept.fsrs.nextReview;
  const hasNeverBeenReviewed = (concept.fsrs.reps ?? 0) === 0;

  if (!nextReview || hasNeverBeenReviewed) {
    return {
      label: 'New',
      badgeClass: 'bg-blue-500/10 text-blue-900 dark:text-blue-200',
      nextReviewLabel: null,
    };
  }

  if (nextReview <= now) {
    return {
      label: 'Due now',
      badgeClass: 'bg-red-500 text-white',
      nextReviewLabel: null,
    };
  }

  return {
    label: 'Scheduled',
    badgeClass: 'bg-muted text-foreground',
    nextReviewLabel: formatDistanceToNow(nextReview, { addSuffix: true }),
  };
}
