'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { PageContainer } from '@/components/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useConfirmation } from '@/hooks/use-confirmation';
import { useUndoableAction } from '@/hooks/use-undoable-action';

import { BulkActionsBar } from './bulk-actions-bar';
import { LibraryTabContent } from './library-tab-content';
import { useLibraryDisplayMode } from './use-library-display-mode';

type LibraryView = 'active' | 'archived' | 'trash';

export function LibraryClient() {
  const { isSignedIn } = useUser();
  const [currentTab, setCurrentTab] = useState<LibraryView>('active');
  const [selectedIds, setSelectedIds] = useState<Set<Id<'questions'>>>(new Set());

  // Pagination state
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(25);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<unknown[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchLimit, setSearchLimit] = useState<number>(20);

  // Race condition protection: Track request IDs to ignore stale responses.
  // Pattern: Increment counter on each search, only apply results if ID matches current.
  // Prevents fast typing from causing older requests to overwrite newer results.
  const searchRequestIdRef = useRef(0);

  // Query questions for current view with pagination
  // Skip query when not authenticated to prevent race condition during Clerk auth loading
  const paginationData = useQuery(
    api.questionsLibrary.getLibrary,
    isSignedIn ? { view: currentTab, cursor: cursor ?? undefined, pageSize } : 'skip'
  );

  // Extract pagination results
  const questions = paginationData?.results;
  const continueCursor = paginationData?.continueCursor ?? null;
  const isDone = paginationData?.isDone ?? true;

  // Search action
  const searchAction = useAction(api.embeddings.searchQuestions);

  // Debounced search effect (300ms delay)
  useEffect(() => {
    // Skip if query is empty or user not signed in
    if (!searchQuery.trim() || !isSignedIn) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Capture request ID for this search to detect stale responses
    const requestId = ++searchRequestIdRef.current;

    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchAction({
          query: searchQuery,
          limit: searchLimit,
          view: currentTab,
        });

        // Only update if this is still the latest request (prevent race condition)
        if (requestId === searchRequestIdRef.current) {
          setSearchResults(results);
        }
      } catch {
        // Only show error for latest request
        if (requestId === searchRequestIdRef.current) {
          toast.error('Search failed. Please try again.');
          setSearchResults([]);
        }
      } finally {
        // Only clear loading state for latest request
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentTab, searchAction, isSignedIn, searchLimit]);

  // Mutations for bulk operations
  const archiveQuestions = useMutation(api.questionsBulk.archiveQuestions);
  const unarchiveQuestions = useMutation(api.questionsBulk.unarchiveQuestions);
  const bulkDelete = useMutation(api.questionsBulk.bulkDelete);
  const restoreQuestions = useMutation(api.questionsBulk.restoreQuestions);
  const permanentlyDelete = useMutation(api.questionsBulk.permanentlyDelete);

  // Confirmation and undo hooks
  const confirm = useConfirmation();
  const undoableAction = useUndoableAction();

  // Handle selection changes
  const handleSelectionChange = (newSelectedIds: Set<Id<'questions'>>) => {
    setSelectedIds(newSelectedIds);
  };

  // Clear selection when switching tabs
  const handleTabChange = (value: string) => {
    setCurrentTab(value as LibraryView);
    setSelectedIds(new Set());
    // Reset pagination when switching tabs
    setCursor(null);
    setCursorStack([]);
    // Clear search when switching tabs
    setSearchQuery('');
    setSearchResults([]);
    setSearchLimit(20); // Reset search limit
  };

  // Clear selection handler
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (!continueCursor || isDone) return;

    // Push current cursor to stack for backward navigation
    if (cursor !== null) {
      setCursorStack([...cursorStack, cursor]);
    } else {
      // First page -> second page, push null to stack
      setCursorStack([...cursorStack, '']);
    }

    setCursor(continueCursor);
    setSelectedIds(new Set()); // Clear selection when changing pages
  };

  const handlePrevPage = () => {
    if (cursorStack.length === 0) return;

    // Pop last cursor from stack
    const newStack = [...cursorStack];
    const previousCursor = newStack.pop();
    setCursorStack(newStack);

    // Empty string represents null (first page)
    setCursor(previousCursor === '' ? null : (previousCursor ?? null));
    setSelectedIds(new Set()); // Clear selection when changing pages
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCursor(null);
    setCursorStack([]);
    setSelectedIds(new Set()); // Clear selection when changing page size
  };

  // Reset pagination when pageSize changes (via useEffect for safety)
  useEffect(() => {
    setCursor(null);
    setCursorStack([]);
  }, [pageSize]);

  // Bulk operation handlers with undo pattern for reversible actions
  const handleArchive = async (ids: Id<'questions'>[]) => {
    const count = ids.length;
    if (count === 0) return;

    try {
      await undoableAction({
        action: () => archiveQuestions({ questionIds: ids }),
        message: `Archived ${count} ${count === 1 ? 'question' : 'questions'}`,
        undo: () => unarchiveQuestions({ questionIds: ids }),
      });

      // Remove operated items from selection
      const newSelection = new Set(selectedIds);
      ids.forEach((id) => newSelection.delete(id));
      setSelectedIds(newSelection);
    } catch (error) {
      toast.error('Failed to archive questions');
      console.error(error);
    }
  };

  const handleUnarchive = async (ids: Id<'questions'>[]) => {
    const count = ids.length;
    if (count === 0) return;

    try {
      await undoableAction({
        action: () => unarchiveQuestions({ questionIds: ids }),
        message: `Unarchived ${count} ${count === 1 ? 'question' : 'questions'}`,
        undo: () => archiveQuestions({ questionIds: ids }),
      });

      // Remove operated items from selection
      const newSelection = new Set(selectedIds);
      ids.forEach((id) => newSelection.delete(id));
      setSelectedIds(newSelection);
    } catch (error) {
      toast.error('Failed to unarchive questions');
      console.error(error);
    }
  };

  const handleDelete = async (ids: Id<'questions'>[]) => {
    const count = ids.length;
    if (count === 0) return;

    try {
      await undoableAction({
        action: () => bulkDelete({ questionIds: ids }),
        message: `Deleted ${count} ${count === 1 ? 'question' : 'questions'}`,
        undo: () => restoreQuestions({ questionIds: ids }),
      });

      // Remove operated items from selection
      const newSelection = new Set(selectedIds);
      ids.forEach((id) => newSelection.delete(id));
      setSelectedIds(newSelection);
    } catch (error) {
      toast.error('Failed to delete questions');
      console.error(error);
    }
  };

  const handleRestore = async (ids: Id<'questions'>[]) => {
    const count = ids.length;
    if (count === 0) return;

    try {
      await undoableAction({
        action: () => restoreQuestions({ questionIds: ids }),
        message: `Restored ${count} ${count === 1 ? 'question' : 'questions'}`,
        undo: () => bulkDelete({ questionIds: ids }),
      });

      // Remove operated items from selection
      const newSelection = new Set(selectedIds);
      ids.forEach((id) => newSelection.delete(id));
      setSelectedIds(newSelection);
    } catch (error) {
      toast.error('Failed to restore questions');
      console.error(error);
    }
  };

  const handlePermanentDelete = async (ids: Id<'questions'>[]) => {
    const count = ids.length;
    if (count === 0) return;

    const confirmed = await confirm({
      title: `Permanently delete ${count} ${count === 1 ? 'question' : 'questions'}?`,
      description: 'This action cannot be undone. Type DELETE to confirm.',
      confirmText: 'Delete Forever',
      cancelText: 'Cancel',
      variant: 'destructive',
      requireTyping: 'DELETE',
    });

    if (!confirmed) return;

    try {
      await permanentlyDelete({ questionIds: ids });
      toast.success(`Permanently deleted ${count} ${count === 1 ? 'question' : 'questions'}`);

      // Remove operated items from selection
      const newSelection = new Set(selectedIds);
      ids.forEach((id) => newSelection.delete(id));
      setSelectedIds(newSelection);
    } catch (error) {
      toast.error('Failed to permanently delete questions');
      console.error(error);
    }
  };

  // Compute display mode (single source of truth for all UI state)
  const displayMode = useLibraryDisplayMode({
    questions,
    searchQuery,
    searchResults,
    isSearching,
    searchLimit,
  });

  return (
    <TooltipProvider>
      <PageContainer className="py-8">
        <h1 className="text-3xl font-bold mb-6">Question Library</h1>

        {/* Search Input */}
        <div className="mb-6 relative">
          <Input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-20"
          />
          {isSearching && (
            <div
              className="absolute right-10 top-1/2 -translate-y-1/2"
              data-testid="search-loading"
            >
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSearchLimit(20); // Reset limit when clearing search
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {/* Search Results Count - Only shown for search-results mode */}
        {displayMode.type === 'search-results' && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {displayMode.canLoadMore ? (
                <>Showing top 20 matches for &quot;{displayMode.query}&quot;</>
              ) : displayMode.results.length < displayMode.limit ? (
                <>
                  {displayMode.results.length}{' '}
                  {displayMode.results.length === 1 ? 'result' : 'results'} for &quot;
                  {displayMode.query}&quot;
                </>
              ) : (
                <>
                  All {displayMode.results.length} results for &quot;{displayMode.query}&quot;
                </>
              )}
            </div>
            {displayMode.canLoadMore && (
              <Button variant="outline" size="sm" onClick={() => setSearchLimit(50)}>
                Load More Results
              </Button>
            )}
          </div>
        )}

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archive</TabsTrigger>
            <TabsTrigger value="trash">Trash</TabsTrigger>
          </TabsList>

          <BulkActionsBar
            selectedCount={selectedIds.size}
            currentTab={currentTab}
            onArchive={() => handleArchive(Array.from(selectedIds))}
            onUnarchive={() => handleUnarchive(Array.from(selectedIds))}
            onDelete={() => handleDelete(Array.from(selectedIds))}
            onRestore={() => handleRestore(Array.from(selectedIds))}
            onPermanentDelete={() => handlePermanentDelete(Array.from(selectedIds))}
            onClearSelection={handleClearSelection}
          />

          <TabsContent value="active" className="mt-6">
            <LibraryTabContent
              mode={displayMode}
              currentTab={currentTab}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
              hasPrevious={cursorStack.length > 0}
              onPageSizeChange={handlePageSizeChange}
              pageSize={pageSize}
              isDone={isDone}
              onLoadMoreResults={() => setSearchLimit(50)}
            />
          </TabsContent>

          <TabsContent value="archived" className="mt-6">
            <LibraryTabContent
              mode={displayMode}
              currentTab={currentTab}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
              hasPrevious={cursorStack.length > 0}
              onPageSizeChange={handlePageSizeChange}
              pageSize={pageSize}
              isDone={isDone}
              onLoadMoreResults={() => setSearchLimit(50)}
            />
          </TabsContent>

          <TabsContent value="trash" className="mt-6">
            <LibraryTabContent
              mode={displayMode}
              currentTab={currentTab}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
              hasPrevious={cursorStack.length > 0}
              onPageSizeChange={handlePageSizeChange}
              pageSize={pageSize}
              isDone={isDone}
              onLoadMoreResults={() => setSearchLimit(50)}
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </TooltipProvider>
  );
}
