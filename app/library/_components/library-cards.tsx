'use client';

import { useEffect, useRef, useState } from 'react';
import { Archive, Calendar, Clock, ListChecks, RotateCcw, Target, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { formatDueTime, formatShortRelativeTime } from '@/lib/utils/date-format';
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

      <div className="grid grid-cols-1 gap-3">
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
                className="px-4 pt-2 pb-0 flex flex-col cursor-pointer"
                onClick={() => handleCardTap(question)}
                onTouchStart={() => handleLongPressStart(question._id)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(question._id)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
              >
                {/* Question content */}
                <div className="flex items-start gap-2.5 pb-1">
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
                    <p className="text-sm font-medium leading-tight line-clamp-2">
                      {question.question}
                    </p>
                  </div>
                </div>

                {/* Metadata row: Twitter-style with separator and hover states */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2.5 mt-1">
                  {/* Type */}
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="group flex items-center gap-1 cursor-pointer">
                          <ListChecks className="h-3.5 w-3.5 transition-colors group-hover:text-blue-500" />
                          <span className="transition-colors group-hover:text-blue-500">
                            {question.type === 'multiple-choice' ? 'MC' : 'T/F'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {question.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Due Status */}
                  {currentTab === 'active' ? (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="group flex items-center gap-1 cursor-pointer">
                            <Clock className="h-3.5 w-3.5 transition-colors group-hover:text-amber-500" />
                            <span className="transition-colors group-hover:text-amber-500">
                              {isDue
                                ? 'Due now'
                                : question.nextReview
                                  ? formatDueTime(question.nextReview)
                                  : 'Not scheduled'}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Next review time</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="group flex items-center gap-1 cursor-pointer">
                            <Clock className="h-3.5 w-3.5 transition-colors group-hover:text-amber-500" />
                            <span className="transition-colors group-hover:text-amber-500">
                              {currentTab === 'archived' && question.archivedAt
                                ? formatShortRelativeTime(question.archivedAt)
                                : currentTab === 'trash' && question.deletedAt
                                  ? formatShortRelativeTime(question.deletedAt)
                                  : formatShortRelativeTime(question.generatedAt)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {currentTab === 'archived'
                              ? 'Archived'
                              : currentTab === 'trash'
                                ? 'Deleted'
                                : 'Created'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* Performance */}
                  {currentTab === 'active' ? (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="group flex items-center gap-1 cursor-pointer">
                            <Target className="h-3.5 w-3.5 transition-colors group-hover:text-purple-500" />
                            <span className="transition-colors group-hover:text-purple-500">
                              {question.attemptCount === 0
                                ? '-'
                                : `${Math.round(((question.successRate || 0) * question.attemptCount) / 100)}/${question.attemptCount}`}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Correct / Total attempts</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <div className="group flex items-center gap-1 cursor-pointer opacity-40">
                      <Target className="h-3.5 w-3.5 transition-colors group-hover:text-purple-500 group-hover:opacity-100" />
                      <span className="transition-colors group-hover:text-purple-500 group-hover:opacity-100">
                        -
                      </span>
                    </div>
                  )}
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
                <SheetTitle className="text-left leading-snug">
                  {selectedQuestion.question}
                </SheetTitle>
              </SheetHeader>

              {/* Metadata */}
              <div className="px-4 space-y-2">
                {/* Compact badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                    {selectedQuestion.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False'}
                  </Badge>
                  {selectedQuestion.embedding ? (
                    <Badge
                      variant="outline"
                      className="px-2 py-0.5 text-xs text-success border-success/30"
                    >
                      Semantically Searchable
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="px-2 py-0.5 text-xs text-muted-foreground border-border"
                    >
                      Not Embedded
                    </Badge>
                  )}
                </div>

                {/* Icon-value stats */}
                <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                  {currentTab === 'active' && (
                    <>
                      {/* Performance */}
                      <div className="flex items-center gap-1.5">
                        <Target className="h-4 w-4" />
                        <span>
                          {selectedQuestion.attemptCount > 0
                            ? `${selectedQuestion.successRate}% (${Math.round(((selectedQuestion.successRate || 0) * selectedQuestion.attemptCount) / 100)}/${selectedQuestion.attemptCount})`
                            : 'Not attempted'}
                        </span>
                      </div>

                      {/* Due status */}
                      {selectedQuestion.nextReview && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          <span>
                            {selectedQuestion.nextReview < Date.now()
                              ? 'Due now'
                              : formatDueTime(selectedQuestion.nextReview)}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Archived/Deleted date */}
                  {currentTab === 'archived' && selectedQuestion.archivedAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>Archived {formatShortRelativeTime(selectedQuestion.archivedAt)}</span>
                    </div>
                  )}
                  {currentTab === 'trash' && selectedQuestion.deletedAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>Deleted {formatShortRelativeTime(selectedQuestion.deletedAt)}</span>
                    </div>
                  )}

                  {/* Created date */}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>Created {formatShortRelativeTime(selectedQuestion.generatedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <SheetFooter className="border-t border-border/40 pt-4 gap-2">
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
