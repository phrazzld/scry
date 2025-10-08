'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useConfirmation } from '@/hooks/use-confirmation';
import { useUndoableAction } from '@/hooks/use-undoable-action';

import { BulkActionsBar } from './bulk-actions-bar';
import { LibraryCards } from './library-cards';
import { LibraryTable } from './library-table';

type LibraryView = 'active' | 'archived' | 'trash';

export function LibraryClient() {
  const [currentTab, setCurrentTab] = useState<LibraryView>('active');
  const [selectedIds, setSelectedIds] = useState<Set<Id<'questions'>>>(new Set());

  // Query questions for current view
  const questions = useQuery(api.questions.getLibrary, { view: currentTab });

  // Mutations for bulk operations
  const archiveQuestions = useMutation(api.questions.archiveQuestions);
  const unarchiveQuestions = useMutation(api.questions.unarchiveQuestions);
  const bulkDelete = useMutation(api.questions.bulkDelete);
  const restoreQuestions = useMutation(api.questions.restoreQuestions);
  const permanentlyDelete = useMutation(api.questions.permanentlyDelete);

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
  };

  // Clear selection handler
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

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
      <div className="container mx-auto px-4 py-8 max-w-7xl">
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
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
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
              </>
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-6">
            {questions === undefined ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
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
              </>
            )}
          </TabsContent>

          <TabsContent value="trash" className="mt-6">
            {questions === undefined ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
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
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
