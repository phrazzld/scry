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
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-3 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'question' : 'questions'} selected
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          {currentTab === 'active' && (
            <>
              <Button variant="outline" size="sm" onClick={onArchive} className="flex-1 sm:flex-none">
                Archive
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete} className="flex-1 sm:flex-none">
                Delete
              </Button>
            </>
          )}

          {currentTab === 'archived' && (
            <>
              <Button variant="outline" size="sm" onClick={onUnarchive} className="flex-1 sm:flex-none">
                Unarchive
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete} className="flex-1 sm:flex-none">
                Delete
              </Button>
            </>
          )}

          {currentTab === 'trash' && (
            <>
              <Button variant="outline" size="sm" onClick={onRestore} className="flex-1 sm:flex-none">
                Restore
              </Button>
              <Button variant="destructive" size="sm" onClick={onPermanentDelete} className="flex-1 sm:flex-none">
                Delete Permanently
              </Button>
            </>
          )}

          <Button variant="ghost" size="sm" onClick={onClearSelection} className="flex-1 sm:flex-none">
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
