'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { BulkActionsBar } from './bulk-actions-bar';
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

  // Bulk operation handlers with optimistic updates
  const handleArchive = async () => {
    const count = selectedIds.size;
    try {
      await archiveQuestions({ questionIds: Array.from(selectedIds) });
      toast.success(`Archived ${count} ${count === 1 ? 'question' : 'questions'}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to archive questions');
      console.error(error);
    }
  };

  const handleUnarchive = async () => {
    const count = selectedIds.size;
    try {
      await unarchiveQuestions({ questionIds: Array.from(selectedIds) });
      toast.success(`Unarchived ${count} ${count === 1 ? 'question' : 'questions'}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to unarchive questions');
      console.error(error);
    }
  };

  const handleDelete = async () => {
    const count = selectedIds.size;
    try {
      await bulkDelete({ questionIds: Array.from(selectedIds) });
      toast.success(`Deleted ${count} ${count === 1 ? 'question' : 'questions'}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to delete questions');
      console.error(error);
    }
  };

  const handleRestore = async () => {
    const count = selectedIds.size;
    try {
      await restoreQuestions({ questionIds: Array.from(selectedIds) });
      toast.success(`Restored ${count} ${count === 1 ? 'question' : 'questions'}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to restore questions');
      console.error(error);
    }
  };

  const handlePermanentDelete = async () => {
    const count = selectedIds.size;
    try {
      await permanentlyDelete({ questionIds: Array.from(selectedIds) });
      toast.success(`Permanently deleted ${count} ${count === 1 ? 'question' : 'questions'}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to permanently delete questions');
      console.error(error);
    }
  };

  return (
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
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
          onClearSelection={handleClearSelection}
        />

        <TabsContent value="active" className="mt-6">
          {questions === undefined ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <LibraryTable
              questions={questions}
              currentTab={currentTab}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
            />
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          {questions === undefined ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <LibraryTable
              questions={questions}
              currentTab={currentTab}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
            />
          )}
        </TabsContent>

        <TabsContent value="trash" className="mt-6">
          {questions === undefined ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <LibraryTable
              questions={questions}
              currentTab={currentTab}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
