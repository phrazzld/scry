'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';

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
