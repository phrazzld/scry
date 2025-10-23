'use client';

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Archive, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Doc, Id } from '@/convex/_generated/dataModel';

import { ActiveEmptyState, ArchivedEmptyState, TrashEmptyState } from './library-empty-states';

type LibraryView = 'active' | 'archived' | 'trash';

// Extended question type with derived stats from getLibrary query
type LibraryQuestion = Doc<'questions'> & {
  failedCount: number;
  successRate: number | null;
};

interface LibraryTableProps {
  questions: LibraryQuestion[];
  currentTab: LibraryView;
  selectedIds: Set<Id<'questions'>>;
  onSelectionChange: (selectedIds: Set<Id<'questions'>>) => void;
  onPreviewClick?: (question: LibraryQuestion) => void;
  onArchive?: (ids: Id<'questions'>[]) => void;
  onUnarchive?: (ids: Id<'questions'>[]) => void;
  onDelete?: (ids: Id<'questions'>[]) => void;
  onRestore?: (ids: Id<'questions'>[]) => void;
  onPermanentDelete?: (ids: Id<'questions'>[]) => void;
}

export function LibraryTable({
  questions,
  currentTab,
  selectedIds,
  onSelectionChange,
  onPreviewClick,
  onArchive,
  onUnarchive,
  onDelete,
  onRestore,
  onPermanentDelete,
}: LibraryTableProps) {
  // Build columns array conditionally based on currentTab
  const selectColumn: ColumnDef<LibraryQuestion> = {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    size: 40,
    enableSorting: false,
    enableHiding: false,
  };

  const questionColumn: ColumnDef<LibraryQuestion> = {
    accessorKey: 'question',
    header: 'Question',
    cell: ({ row }) => {
      const question = row.original.question;
      const truncated = question.length > 100 ? `${question.slice(0, 100)}...` : question;

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onPreviewClick?.(row.original)}
              className="text-left hover:underline truncate block w-full text-sm"
            >
              {truncated}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-md">
            <p className="whitespace-pre-wrap break-words">{question}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
    size: 300,
    minSize: 200,
    maxSize: 400,
  };

  const performanceColumn: ColumnDef<LibraryQuestion> = {
    id: 'stats',
    header: 'Performance',
    cell: ({ row }) => {
      const { attemptCount, successRate } = row.original;
      if (attemptCount === 0) {
        return <span className="text-sm text-muted-foreground truncate block">Not attempted</span>;
      }
      return (
        <div className="text-sm overflow-hidden">
          <div className="font-medium truncate">{successRate}% success</div>
          <div className="text-muted-foreground truncate">{attemptCount} attempts</div>
        </div>
      );
    },
    size: 140,
  };

  const dateColumn: ColumnDef<LibraryQuestion> = {
    id: 'date',
    header: () => {
      if (currentTab === 'archived') return 'Archived';
      if (currentTab === 'trash') return 'Deleted';
      return 'Created';
    },
    cell: ({ row }) => {
      const { archivedAt, deletedAt, generatedAt } = row.original;
      let date = generatedAt;
      if (currentTab === 'archived' && archivedAt) date = archivedAt;
      if (currentTab === 'trash' && deletedAt) date = deletedAt;

      return (
        <span className="text-sm text-muted-foreground truncate block">
          {formatDistanceToNow(date, { addSuffix: true })}
        </span>
      );
    },
    size: 120,
  };

  const nextReviewColumn: ColumnDef<LibraryQuestion> = {
    accessorKey: 'nextReview',
    header: 'Next Review',
    cell: ({ row }) => {
      const { nextReview } = row.original;
      if (!nextReview) {
        return <span className="text-sm text-muted-foreground truncate block">—</span>;
      }

      const isPast = nextReview < Date.now();
      return (
        <span
          className={`text-sm truncate block ${isPast ? 'text-warning font-medium' : 'text-muted-foreground'}`}
        >
          {isPast ? 'Due now' : formatDistanceToNow(nextReview, { addSuffix: true })}
        </span>
      );
    },
    size: 120,
  };

  const typeColumn: ColumnDef<LibraryQuestion> = {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.type;
      return (
        <span className="text-xs text-muted-foreground">
          {type === 'multiple-choice' ? 'MC' : 'T/F'}
        </span>
      );
    },
    size: 60,
  };

  const actionsColumn: ColumnDef<LibraryQuestion> = {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const question = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {currentTab === 'active' && (
              <>
                <DropdownMenuItem onClick={() => onArchive?.([question._id])}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete?.([question._id])}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
            {currentTab === 'archived' && (
              <>
                <DropdownMenuItem onClick={() => onUnarchive?.([question._id])}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Unarchive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete?.([question._id])}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
            {currentTab === 'trash' && (
              <>
                <DropdownMenuItem onClick={() => onRestore?.([question._id])}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onPermanentDelete?.([question._id])}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    size: 60,
  };

  // Conditionally build columns array based on currentTab
  const columns: ColumnDef<LibraryQuestion>[] = [
    selectColumn,
    questionColumn,
    ...(currentTab === 'active' ? [performanceColumn] : []),
    dateColumn,
    ...(currentTab === 'active' ? [nextReviewColumn] : []),
    typeColumn,
    actionsColumn,
  ];

  // Initialize TanStack Table
  const table = useReactTable({
    data: questions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      // Convert TanStack Table selection state to our Set<Id> format
      const currentSelection: Record<string, boolean> =
        typeof updater === 'function'
          ? updater(
              Array.from(selectedIds).reduce(
                (acc, id) => {
                  const index = questions.findIndex((q) => q._id === id);
                  if (index !== -1) acc[index] = true;
                  return acc;
                },
                {} as Record<string, boolean>
              )
            )
          : updater;

      const newSelectedIds = new Set<Id<'questions'>>(
        Object.keys(currentSelection)
          .filter((key) => currentSelection[key])
          .map((key) => questions[parseInt(key)]._id)
      );

      onSelectionChange(newSelectedIds);
    },
    state: {
      rowSelection: Array.from(selectedIds).reduce(
        (acc, id) => {
          const index = questions.findIndex((q) => q._id === id);
          if (index !== -1) acc[index] = true;
          return acc;
        },
        {} as Record<string, boolean>
      ),
    },
  });

  // Show empty state if no questions
  if (!questions || questions.length === 0) {
    if (currentTab === 'active') return <ActiveEmptyState />;
    if (currentTab === 'archived') return <ArchivedEmptyState />;
    if (currentTab === 'trash') return <TrashEmptyState />;
  }

  return (
    <div className="w-full rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{
                    width: header.getSize(),
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No questions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
