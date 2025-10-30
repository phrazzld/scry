'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LibraryPaginationProps {
  isDone: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  hasPrevious: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalShown: number;
}

export function LibraryPagination({
  isDone,
  onNextPage,
  onPrevPage,
  hasPrevious,
  pageSize,
  onPageSizeChange,
  totalShown,
}: LibraryPaginationProps) {
  return (
    <div className="py-4 border-t border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Pagination controls */}
        <div className="flex items-center justify-between sm:justify-start gap-2 order-2 sm:order-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevPage}
            disabled={!hasPrevious}
            className="gap-1 flex-1 sm:flex-none"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden xs:inline">Previous</span>
            <span className="xs:hidden">Prev</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={isDone}
            className="gap-1 flex-1 sm:flex-none"
          >
            <span className="hidden xs:inline">Next</span>
            <span className="xs:hidden">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Info and page size selector */}
        <div className="flex items-center justify-between sm:justify-end gap-3 order-1 sm:order-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {totalShown} {totalShown !== 1 ? 'questions' : 'question'}
          </span>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Per page:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
