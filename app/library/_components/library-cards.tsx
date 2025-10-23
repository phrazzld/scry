'use client';

import { formatDistanceToNow } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Doc, Id } from '@/convex/_generated/dataModel';

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
}

export function LibraryCards({
  questions,
  currentTab,
  selectedIds,
  onSelectionChange,
  onPreviewClick,
}: LibraryCardsProps) {
  const handleToggleSelection = (questionId: Id<'questions'>) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(questionId)) {
      newSelection.delete(questionId);
    } else {
      newSelection.add(questionId);
    }
    onSelectionChange(newSelection);
  };

  // Show empty state if no questions
  if (!questions || questions.length === 0) {
    if (currentTab === 'active') return <ActiveEmptyState />;
    if (currentTab === 'archived') return <ArchivedEmptyState />;
    if (currentTab === 'trash') return <TrashEmptyState />;
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {questions.map((question) => {
        const isSelected = selectedIds.has(question._id);
        const truncated =
          question.question.length > 150
            ? `${question.question.slice(0, 150)}...`
            : question.question;

        return (
          <Card
            key={question._id}
            className={`transition-all ${isSelected ? 'ring-2 ring-primary shadow-md' : ''}`}
          >
            <CardHeader className="pb-4 pt-5 px-5">
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleSelection(question._id)}
                    aria-label="Select question"
                    className="h-5 w-5"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onPreviewClick?.(question)}
                        className="text-left hover:underline text-base font-medium leading-relaxed w-full"
                      >
                        {truncated}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <p className="whitespace-pre-wrap break-words">{question.question}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs cursor-default font-normal">
                          {question.topic}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{question.topic}</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-xs text-muted-foreground">
                      {question.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False'}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pb-5 px-5">
              {/* Performance stats - only for active tab */}
              {currentTab === 'active' && (
                <div className="pt-2 border-t">
                  {question.attemptCount === 0 ? (
                    <span className="text-sm text-muted-foreground">Not attempted yet</span>
                  ) : (
                    <div className="flex items-baseline gap-3">
                      <div>
                        <span className="text-lg font-semibold">{question.successRate}%</span>
                        <span className="text-sm text-muted-foreground ml-1">success</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {question.attemptCount} {question.attemptCount === 1 ? 'attempt' : 'attempts'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Next review - only for active tab */}
              {currentTab === 'active' && question.nextReview && (
                <div className="text-sm">
                  {question.nextReview < Date.now() ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-warning" />
                      <span className="text-warning font-medium">Due now</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      Review {formatDistanceToNow(question.nextReview, { addSuffix: true })}
                    </span>
                  )}
                </div>
              )}

              {/* Contextual date */}
              <div className="text-sm text-muted-foreground">
                {currentTab === 'archived' && question.archivedAt ? (
                  <>Archived {formatDistanceToNow(question.archivedAt, { addSuffix: true })}</>
                ) : currentTab === 'trash' && question.deletedAt ? (
                  <>Deleted {formatDistanceToNow(question.deletedAt, { addSuffix: true })}</>
                ) : (
                  <>Added {formatDistanceToNow(question.generatedAt, { addSuffix: true })}</>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
