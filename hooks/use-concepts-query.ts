'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';

export type ConceptsView = 'all' | 'due' | 'thin' | 'conflict';
export type ConceptsSort = 'recent' | 'nextReview';

export interface ConceptLibraryResponse {
  concepts: Doc<'concepts'>[];
  continueCursor: string | null;
  isDone: boolean;
  serverTime: number;
  mode: 'standard' | 'search';
}

interface UseConceptsQueryArgs {
  enabled: boolean;
  cursor: string | null;
  pageSize: number;
  view: ConceptsView;
  search: string;
  sort: ConceptsSort;
}

export function useConceptsQuery({
  enabled,
  cursor,
  pageSize,
  view,
  search,
  sort,
}: UseConceptsQueryArgs) {
  const queryArgs = enabled
    ? {
        cursor: cursor ?? undefined,
        pageSize,
        view,
        search: search || undefined,
        sort,
      }
    : 'skip';

  return useQuery(api.concepts.listForLibrary, queryArgs);
}
