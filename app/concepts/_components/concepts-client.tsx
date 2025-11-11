'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { ConceptsEmptyState } from '@/components/concepts/concepts-empty-state';
import { ConceptsTable } from '@/components/concepts/concepts-table';
import { PageContainer } from '@/components/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConceptsQuery, type ConceptsSort, type ConceptsView } from '@/hooks/use-concepts-query';

const VIEW_TABS: { value: ConceptsView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'thin', label: 'Thin' },
  { value: 'conflict', label: 'Conflict' },
];

export function ConceptsClient() {
  const { isSignedIn } = useUser();
  const [view, setView] = useState<ConceptsView>('all');
  const [sort, setSort] = useState<ConceptsSort>('nextReview');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    setCursor(null);
    setCursorStack([]);
  }, [view, sort, pageSize]);

  useEffect(() => {
    if (debouncedSearch) {
      setCursor(null);
      setCursorStack([]);
    }
  }, [debouncedSearch]);

  const conceptsData = useConceptsQuery({
    enabled: Boolean(isSignedIn),
    cursor: debouncedSearch ? null : cursor,
    pageSize,
    view,
    search: debouncedSearch,
    sort,
  });

  const isLoading = isSignedIn && conceptsData === undefined;
  const concepts = conceptsData?.concepts ?? [];
  const continueCursor =
    debouncedSearch || !conceptsData ? null : (conceptsData.continueCursor ?? null);
  const isDone = debouncedSearch ? true : (conceptsData?.isDone ?? true);
  const serverTime = conceptsData?.serverTime ?? Date.now();

  const hasResults = concepts.length > 0;

  const paginationDisabled = !!debouncedSearch;

  const searchLabel = useMemo(() => {
    if (!debouncedSearch) return null;
    return `Showing top matches for “${debouncedSearch}”`;
  }, [debouncedSearch]);

  const handleNextPage = () => {
    if (!continueCursor || isDone || paginationDisabled) return;
    if (cursor !== null) {
      setCursorStack([...cursorStack, cursor]);
    } else {
      setCursorStack([...cursorStack, '']);
    }
    setCursor(continueCursor);
  };

  const handlePrevPage = () => {
    if (cursorStack.length === 0 || paginationDisabled) return;
    const nextStack = [...cursorStack];
    const previousCursor = nextStack.pop();
    setCursorStack(nextStack);
    setCursor(previousCursor === '' ? null : (previousCursor ?? null));
  };

  return (
    <PageContainer className="py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Concepts Library</h1>
        <p className="text-sm text-muted-foreground">
          Concept-first view of your knowledge. Track due status, thin spots, and conflict signals
          at a glance.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs
            value={view}
            onValueChange={(value) => {
              setView(value as ConceptsView);
              setCursor(null);
              setCursorStack([]);
            }}
            className="w-full md:w-auto"
          >
            <TabsList className="grid grid-cols-2 sm:inline-flex">
              {VIEW_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="px-3 py-1.5">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-col gap-1">
              <Label htmlFor="concept-search" className="text-xs text-muted-foreground">
                Search concepts
              </Label>
              <Input
                id="concept-search"
                placeholder="Search by title"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full md:w-64"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Sort</Label>
                <Select value={sort} onValueChange={(value) => setSort(value as ConceptsSort)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nextReview">Next review</SelectItem>
                    <SelectItem value="recent">Recently created</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Page size</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => setPageSize(Number(value))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 75, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {searchLabel && (
          <Badge variant="secondary" className="w-fit">
            {searchLabel}
          </Badge>
        )}
      </Card>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading concepts…
          </div>
        </div>
      ) : hasResults ? (
        <ConceptsTable concepts={concepts} serverTime={serverTime} />
      ) : (
        <ConceptsEmptyState view={view} searchTerm={debouncedSearch} />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {debouncedSearch
            ? 'Pagination disabled while searching'
            : concepts.length === 0
              ? 'No concepts to paginate'
              : isDone
                ? 'End of results'
                : 'Use the buttons to navigate'}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrevPage}
            disabled={paginationDisabled || cursorStack.length === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={handleNextPage}
            disabled={paginationDisabled || !continueCursor || isDone || concepts.length === 0}
          >
            Next
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
