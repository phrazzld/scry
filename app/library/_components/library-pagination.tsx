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
    <div className="flex items-center justify-between py-4 border-t border-border/50">
      {/* Previous button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevPage}
        disabled={!hasPrevious}
        className="gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>

      {/* Center info: item count + page size selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Showing {totalShown} question{totalShown !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
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

      {/* Next button */}
      <Button variant="outline" size="sm" onClick={onNextPage} disabled={isDone} className="gap-1">
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
