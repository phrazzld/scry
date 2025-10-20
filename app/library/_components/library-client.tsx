'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';

import { PageContainer } from '@/components/page-container';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useConfirmation } from '@/hooks/use-confirmation';
import { useUndoableAction } from '@/hooks/use-undoable-action';

import { BulkActionsBar } from './bulk-actions-bar';
import { LibraryCards } from './library-cards';
import { LibraryPagination } from './library-pagination';
import { LibraryTable } from './library-table';

type LibraryView = 'active' | 'archived' | 'trash';

export function LibraryClient() {
  const [currentTab, setCurrentTab] = useState<LibraryView>('active');
  const [selectedIds, setSelectedIds] = useState<Set<Id<'questions'>>>(new Set());

  // Pagination state
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(25);

  // Query questions for current view with pagination
  const paginationData = useQuery(api.questionsLibrary.getLibrary, {
    view: currentTab,
    cursor: cursor ?? undefined,
    pageSize,
  });

  // Extract pagination results
  const questions = paginationData?.results;
  const continueCursor = paginationData?.continueCursor ?? null;
  const isDone = paginationData?.isDone ?? true;

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

  return (
    <TooltipProvider>
      <PageContainer className="py-8">
        <h1 className="text-3xl font-bold mb-6">Question Library</h1>

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
            {questions === undefined ? (
              <TableSkeleton rows={10} />
            ) : (
              <>
                <div className="hidden md:block">
                  <LibraryTable
                    questions={questions}
                    currentTab={currentTab}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                    onPermanentDelete={handlePermanentDelete}
                  />
                </div>
                <div className="md:hidden">
                  <LibraryCards
                    questions={questions}
                    currentTab={currentTab}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                  />
                </div>

                <LibraryPagination
                  isDone={isDone}
                  onNextPage={handleNextPage}
                  onPrevPage={handlePrevPage}
                  hasPrevious={cursorStack.length > 0}
                  pageSize={pageSize}
                  onPageSizeChange={handlePageSizeChange}
                  totalShown={questions.length}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-6">
            {questions === undefined ? (
              <TableSkeleton rows={10} />
            ) : (
              <>
                <div className="hidden md:block">
                  <LibraryTable
                    questions={questions}
                    currentTab={currentTab}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                    onPermanentDelete={handlePermanentDelete}
                  />
                </div>
                <div className="md:hidden">
                  <LibraryCards
                    questions={questions}
                    currentTab={currentTab}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                  />
                </div>

                <LibraryPagination
                  isDone={isDone}
                  onNextPage={handleNextPage}
                  onPrevPage={handlePrevPage}
                  hasPrevious={cursorStack.length > 0}
                  pageSize={pageSize}
                  onPageSizeChange={handlePageSizeChange}
                  totalShown={questions.length}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="trash" className="mt-6">
            {questions === undefined ? (
              <TableSkeleton rows={10} />
            ) : (
              <>
                <div className="hidden md:block">
                  <LibraryTable
                    questions={questions}
                    currentTab={currentTab}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                    onPermanentDelete={handlePermanentDelete}
                  />
                </div>
                <div className="md:hidden">
                  <LibraryCards
                    questions={questions}
                    currentTab={currentTab}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                  />
                </div>

                <LibraryPagination
                  isDone={isDone}
                  onNextPage={handleNextPage}
                  onPrevPage={handlePrevPage}
                  hasPrevious={cursorStack.length > 0}
                  pageSize={pageSize}
                  onPageSizeChange={handlePageSizeChange}
                  totalShown={questions.length}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </TooltipProvider>
  );
}
