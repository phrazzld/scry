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
    <div className="grid grid-cols-1 gap-4">
      {questions.map((question) => {
        const isSelected = selectedIds.has(question._id);
        const truncated =
          question.question.length > 100
            ? `${question.question.slice(0, 100)}...`
            : question.question;

        return (
          <Card key={question._id} className={isSelected ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggleSelection(question._id)}
                  aria-label="Select question"
                />
                <div className="flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onPreviewClick?.(question)}
                        className="text-left hover:underline text-sm font-medium"
                      >
                        {truncated}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <p className="whitespace-pre-wrap break-words">{question.question}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="mt-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs cursor-default">
                          {question.topic}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{question.topic}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              {/* Performance stats - only for active tab */}
              {currentTab === 'active' && (
                <div>
                  {question.attemptCount === 0 ? (
                    <span className="text-muted-foreground">Not attempted</span>
                  ) : (
                    <div>
                      <div className="font-medium">{question.successRate}% success</div>
                      <div className="text-muted-foreground">{question.attemptCount} attempts</div>
                    </div>
                  )}
                </div>
              )}

              {/* Contextual date */}
              <div className="text-muted-foreground">
                {currentTab === 'archived' && question.archivedAt ? (
                  <>Archived {formatDistanceToNow(question.archivedAt, { addSuffix: true })}</>
                ) : currentTab === 'trash' && question.deletedAt ? (
                  <>Deleted {formatDistanceToNow(question.deletedAt, { addSuffix: true })}</>
                ) : (
                  <>Created {formatDistanceToNow(question.generatedAt, { addSuffix: true })}</>
                )}
              </div>

              {/* Next review - only for active tab */}
              {currentTab === 'active' && question.nextReview && (
                <div>
                  {question.nextReview < Date.now() ? (
                    <span className="text-warning font-medium">Due now</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Next review {formatDistanceToNow(question.nextReview, { addSuffix: true })}
                    </span>
                  )}
                </div>
              )}

              {/* Type */}
              <div className="text-xs text-muted-foreground">
                {question.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False'}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
