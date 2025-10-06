'use client';

import { Button } from '@/components/ui/button';

type LibraryView = 'active' | 'archived' | 'trash';

interface BulkActionsBarProps {
  selectedCount: number;
  currentTab: LibraryView;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onClearSelection?: () => void;
}

export function BulkActionsBar({
  selectedCount,
  currentTab,
  onArchive,
  onUnarchive,
  onDelete,
  onRestore,
  onPermanentDelete,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-3 px-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'question' : 'questions'} selected
        </span>

        {currentTab === 'active' && (
          <>
            <Button variant="outline" size="sm" onClick={onArchive}>
              Archive
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </>
        )}

        {currentTab === 'archived' && (
          <>
            <Button variant="outline" size="sm" onClick={onUnarchive}>
              Unarchive
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </>
        )}

        {currentTab === 'trash' && (
          <>
            <Button variant="outline" size="sm" onClick={onRestore}>
              Restore
            </Button>
            <Button variant="destructive" size="sm" onClick={onPermanentDelete}>
              Delete Permanently
            </Button>
          </>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onClearSelection}>
        Clear Selection
      </Button>
    </div>
  );
}
