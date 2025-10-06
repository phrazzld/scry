'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

type LibraryView = 'active' | 'archived' | 'trash';

export function LibraryClient() {
  const [currentTab, setCurrentTab] = useState<LibraryView>('active');
  const [_selectedIds, _setSelectedIds] = useState<Set<Id<'questions'>>>(new Set());

  // Query questions for current view
  const questions = useQuery(api.questions.getLibrary, { view: currentTab });

  // Handle selection changes (will be used when table is integrated)
  const _handleSelectionChange = (newSelectedIds: Set<Id<'questions'>>) => {
    _setSelectedIds(newSelectedIds);
  };

  // Clear selection when switching tabs
  const handleTabChange = (value: string) => {
    setCurrentTab(value as LibraryView);
    _setSelectedIds(new Set());
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

        <TabsContent value="active" className="mt-6">
          {questions === undefined ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <div>Active questions: {questions.length}</div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          {questions === undefined ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <div>Archived questions: {questions.length}</div>
          )}
        </TabsContent>

        <TabsContent value="trash" className="mt-6">
          {questions === undefined ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <div>Trash questions: {questions.length}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
