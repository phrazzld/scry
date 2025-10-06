'use client';

import { formatDistanceToNow } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { Doc, Id } from '@/convex/_generated/dataModel';

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
  currentTab: _currentTab,
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

  if (!questions || questions.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No questions found.</div>;
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
                  <button
                    onClick={() => onPreviewClick?.(question)}
                    className="text-left hover:underline text-sm font-medium"
                  >
                    {truncated}
                  </button>
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {question.topic}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              {/* Performance stats */}
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

              {/* Created date */}
              <div className="text-muted-foreground">
                Created {formatDistanceToNow(question.generatedAt, { addSuffix: true })}
              </div>

              {/* Next review */}
              {question.nextReview && (
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
