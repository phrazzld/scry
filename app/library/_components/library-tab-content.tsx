import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import type { Id } from '@/convex/_generated/dataModel';
import { LibraryCards } from './library-cards';
import { LibraryPagination } from './library-pagination';
import { LibraryTable } from './library-table';
import type { LibraryDisplayMode } from './use-library-display-mode';

type LibraryView = 'active' | 'archived' | 'trash';

interface LibraryTabContentProps {
  // Display mode (single source of truth)
  mode: LibraryDisplayMode;

  // Current tab
  currentTab: LibraryView;

  // Selection state
  selectedIds: Set<Id<'questions'>>;
  onSelectionChange: (selectedIds: Set<Id<'questions'>>) => void;

  // Bulk action handlers
  onArchive: (ids: Id<'questions'>[]) => void;
  onUnarchive: (ids: Id<'questions'>[]) => void;
  onDelete: (ids: Id<'questions'>[]) => void;
  onRestore: (ids: Id<'questions'>[]) => void;
  onPermanentDelete: (ids: Id<'questions'>[]) => void;

  // Pagination handlers (only for library-content mode)
  onNextPage: () => void;
  onPrevPage: () => void;
  hasPrevious: boolean;
  onPageSizeChange: (size: number) => void;
  pageSize: number;
  isDone: boolean;

  // Search result handlers
  onLoadMoreResults: () => void;
}

/**
 * Extracted Tab Content Component
 *
 * Single component used by all 3 tabs (Active/Archive/Trash).
 * Renders based on display mode, eliminating 200+ lines of duplication.
 *
 * Mode-based rendering:
 * - loading: Skeleton
 * - searching: Skeleton
 * - search-empty: Empty message
 * - search-results: Table + Load More
 * - library-empty: Table (shows its own empty state)
 * - library-content: Table + Pagination
 */
export function LibraryTabContent(props: LibraryTabContentProps) {
  const {
    mode,
    currentTab,
    selectedIds,
    onSelectionChange,
    onArchive,
    onUnarchive,
    onDelete,
    onRestore,
    onPermanentDelete,
    onNextPage,
    onPrevPage,
    hasPrevious,
    onPageSizeChange,
    pageSize,
    isDone,
    onLoadMoreResults,
  } = props;

  // Loading state: Show skeleton
  if (mode.type === 'loading' || mode.type === 'searching') {
    return <TableSkeleton rows={10} />;
  }

  // Search empty state: Show empty message
  if (mode.type === 'search-empty') {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No results for &quot;{mode.query}&quot;</p>
        <p className="text-sm mt-2">Try different keywords or check your spelling</p>
      </div>
    );
  }

  // Extract questions for rendering (either search results or library content)
  const questions =
    mode.type === 'search-results'
      ? mode.results
      : mode.type === 'library-content'
        ? mode.results
        : [];

  return (
    <>
      {/* Table/Cards rendering */}
      <div className="hidden md:block">
        <LibraryTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          questions={questions as any}
          currentTab={currentTab}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
        />
      </div>
      <div className="md:hidden">
        <LibraryCards
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          questions={questions as any}
          currentTab={currentTab}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
        />
      </div>

      {/* Search results: Show "Load More" button if available */}
      {mode.type === 'search-results' && mode.canLoadMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={onLoadMoreResults}>
            Load More Results
          </Button>
        </div>
      )}

      {/* Library content: Show pagination */}
      {mode.type === 'library-content' && (
        <LibraryPagination
          isDone={isDone}
          onNextPage={onNextPage}
          onPrevPage={onPrevPage}
          hasPrevious={hasPrevious}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
          totalShown={mode.results.length}
        />
      )}
    </>
  );
}
