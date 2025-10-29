'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { formatShortRelativeTime } from '@/lib/utils/date-format';

import { ActiveEmptyState, ArchivedEmptyState, TrashEmptyState } from './library-empty-states';

type LibraryView = 'active' | 'archived' | 'trash';

// Extended question type with derived stats from getLibrary query
type LibraryQuestion = Doc<'questions'> & {
  failedCount: number;
  successRate: number | null;
};

interface LibraryCardsProps {
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

export function LibraryCards({
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
}: LibraryCardsProps) {
  // Selection mode state (hidden checkboxes until long-press)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<LibraryQuestion | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Long-press detection
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressThreshold = 500; // 500ms for long-press

  // Exit selection mode when no items selected
  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) {
      setSelectionMode(false);
    }
  }, [selectedIds.size, selectionMode]);

  const handleToggleSelection = (questionId: Id<'questions'>) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(questionId)) {
      newSelection.delete(questionId);
    } else {
      newSelection.add(questionId);
    }
    onSelectionChange(newSelection);
  };

  const handleLongPressStart = (questionId: Id<'questions'>) => {
    longPressTimer.current = setTimeout(() => {
      // Enter selection mode and select this card
      setSelectionMode(true);
      if (!selectedIds.has(questionId)) {
        handleToggleSelection(questionId);
      }
      // Haptic feedback (iOS/Android)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, longPressThreshold);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCardTap = (question: LibraryQuestion) => {
    if (selectionMode) {
      // In selection mode, toggle selection
      handleToggleSelection(question._id);
    } else {
      // Normal mode, show detail sheet
      // Haptic feedback on sheet open
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      setSelectedQuestion(question);
      setSheetOpen(true);
      onPreviewClick?.(question);
    }
  };

  const handleSheetAction = (action: () => void) => {
    action();
    setSheetOpen(false);
    setSelectedQuestion(null);
  };

  // Show empty state if no questions
  if (!questions || questions.length === 0) {
    if (currentTab === 'active') return <ActiveEmptyState />;
    if (currentTab === 'archived') return <ArchivedEmptyState />;
    if (currentTab === 'trash') return <TrashEmptyState />;
  }

  return (
    <>
      {/* Selection mode header */}
      {selectionMode && (
        <div className="mb-3 flex items-center justify-between p-2.5 bg-muted/50 rounded-lg animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectionMode(false);
              onSelectionChange(new Set());
            }}
          >
            Exit
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {questions.map((question) => {
          const isSelected = selectedIds.has(question._id);
          const isDue =
            currentTab === 'active' && question.nextReview && question.nextReview < Date.now();

          return (
            <Card
              key={question._id}
              className={`
                transition-all duration-150 ease-out
                ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}
                ${!selectionMode ? 'active:scale-[0.98]' : ''}
              `}
            >
              <div
                className="p-3 min-h-[100px] flex flex-col gap-2 cursor-pointer"
                onClick={() => handleCardTap(question)}
                onTouchStart={() => handleLongPressStart(question._id)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(question._id)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
              >
                {/* Header row: checkbox (if selection mode) + question */}
                <div className="flex items-start gap-2.5">
                  {selectionMode && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleSelection(question._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 shrink-0 animate-in fade-in-0 slide-in-from-left-1 duration-200"
                      aria-label="Select question"
                    />
                  )}

                  {/* Two-line question text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug line-clamp-2">
                      {question.question}
                    </p>
                  </div>
                </div>

                {/* Metadata row: type, status, date */}
                <div className="flex items-center gap-2 text-xs">
                  {/* Type badge with embedding indicator */}
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {question.type === 'multiple-choice' ? 'MC' : 'T/F'}
                    {question.embedding && (
                      <span
                        className="ml-1 text-success"
                        role="img"
                        aria-label="Semantic search enabled"
                      >
                        ●
                      </span>
                    )}
                  </Badge>

                  {/* Due status - prominent on active tab */}
                  {currentTab === 'active' && isDue && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-warning" />
                      <span className="text-warning font-semibold">Due now</span>
                    </div>
                  )}

                  {/* Stats - only on active tab, de-emphasized */}
                  {currentTab === 'active' && !isDue && (
                    <span className="text-muted-foreground truncate">
                      {question.attemptCount === 0
                        ? 'Not attempted'
                        : `${question.successRate}% · ${question.attemptCount} ${question.attemptCount === 1 ? 'attempt' : 'attempts'}`}
                    </span>
                  )}

                  {/* Date - contextual based on tab */}
                  <span className="text-muted-foreground ml-auto shrink-0">
                    {currentTab === 'archived' && question.archivedAt
                      ? formatShortRelativeTime(question.archivedAt)
                      : currentTab === 'trash' && question.deletedAt
                        ? formatShortRelativeTime(question.deletedAt)
                        : formatShortRelativeTime(question.generatedAt)}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Detail Sheet - shown when tapping a card */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh]">
          {selectedQuestion && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left leading-relaxed">
                  {selectedQuestion.question}
                </SheetTitle>
              </SheetHeader>

              {/* Metadata */}
              <div className="px-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {selectedQuestion.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False'}
                  </Badge>
                  {selectedQuestion.embedding && (
                    <Badge variant="outline" className="text-success border-success/30">
                      Semantic Search Enabled
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                {currentTab === 'active' && (
                  <div className="text-sm space-y-1">
                    {selectedQuestion.attemptCount > 0 ? (
                      <>
                        <div>
                          <span className="font-medium">
                            {selectedQuestion.successRate}% success rate
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          {selectedQuestion.attemptCount}{' '}
                          {selectedQuestion.attemptCount === 1 ? 'attempt' : 'attempts'}
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground">Not attempted yet</div>
                    )}

                    {selectedQuestion.nextReview && (
                      <div className="text-muted-foreground">
                        Next review:{' '}
                        {selectedQuestion.nextReview < Date.now() ? (
                          <span className="text-warning font-medium">Due now</span>
                        ) : (
                          formatDistanceToNow(selectedQuestion.nextReview, { addSuffix: true })
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  {currentTab === 'archived' && selectedQuestion.archivedAt
                    ? `Archived ${formatDistanceToNow(selectedQuestion.archivedAt, { addSuffix: true })}`
                    : currentTab === 'trash' && selectedQuestion.deletedAt
                      ? `Deleted ${formatDistanceToNow(selectedQuestion.deletedAt, { addSuffix: true })}`
                      : `Created ${formatDistanceToNow(selectedQuestion.generatedAt, { addSuffix: true })}`}
                </div>
              </div>

              {/* Actions */}
              <SheetFooter className="gap-2">
                {currentTab === 'active' && (
                  <>
                    {onArchive && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleSheetAction(() => onArchive([selectedQuestion._id]))}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleSheetAction(() => onDelete([selectedQuestion._id]))}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </>
                )}

                {currentTab === 'archived' && (
                  <>
                    {onUnarchive && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleSheetAction(() => onUnarchive([selectedQuestion._id]))}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Unarchive
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleSheetAction(() => onDelete([selectedQuestion._id]))}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </>
                )}

                {currentTab === 'trash' && (
                  <>
                    {onRestore && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleSheetAction(() => onRestore([selectedQuestion._id]))}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore
                      </Button>
                    )}
                    {onPermanentDelete && (
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() =>
                          handleSheetAction(() => onPermanentDelete([selectedQuestion._id]))
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Forever
                      </Button>
                    )}
                  </>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
