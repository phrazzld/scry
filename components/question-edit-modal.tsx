'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useLiveRegion } from '@/components/ui/live-region';
import { Textarea } from '@/components/ui/textarea';
import { Id } from '@/convex/_generated/dataModel';
import { useOptimisticEdit } from '@/hooks/use-question-mutations';

// Schema for question edit form - only editable fields to preserve FSRS integrity
const questionEditSchema = z.object({
  question: z
    .string()
    .min(1, 'Question is required')
    .max(500, 'Question must be less than 500 characters'),
  explanation: z.string().max(1000, 'Explanation must be less than 1000 characters').optional(),
});

type QuestionEditFormValues = z.infer<typeof questionEditSchema>;

interface QuestionEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: {
    _id: Id<'questions'>;
    question: string;
    explanation?: string;
    type: 'multiple-choice' | 'true-false';
    options: string[];
    correctAnswer: string;
  };
  onSuccess?: () => void;
}

export function QuestionEditModal({
  open,
  onOpenChange,
  question,
  onSuccess,
}: QuestionEditModalProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const { optimisticEdit } = useOptimisticEdit();

  // Live region for accessibility announcements
  const { announce, LiveRegionComponent } = useLiveRegion();

  const form = useForm<QuestionEditFormValues>({
    resolver: zodResolver(questionEditSchema),
    defaultValues: {
      question: question.question,
      explanation: question.explanation || '',
    },
  });

  // Reset form when modal opens/closes or question changes
  React.useEffect(() => {
    if (open) {
      form.reset({
        question: question.question,
        explanation: question.explanation || '',
      });
    }
  }, [open, question, form]);

  const handleSubmit = async (values: QuestionEditFormValues) => {
    setIsLoading(true);

    // Close modal immediately for optimistic UX
    onOpenChange(false);
    form.reset();

    // Optimistic edit handles all error cases and rollback
    const result = await optimisticEdit({
      questionId: question._id,
      question: values.question,
      explanation: values.explanation || undefined,
    });

    if (result.success) {
      announce('Question updated successfully', 'polite');
      onSuccess?.();
    } else {
      announce('Failed to update question. Please try again.', 'assertive');
    }

    setIsLoading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      if (!newOpen) {
        form.reset();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
          <DialogDescription>changed to preserve learning history.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the question"
                      className="resize-none"
                      rows={3}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>The main question text that users will see</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="explanation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Explanation (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide additional context or explanation for the correct answer"
                      className="resize-none"
                      rows={4}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Help users understand why the answer is correct</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Read-only display of non-editable fields */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="text-sm">
                  {question.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Options</p>
                <ul className="text-sm space-y-1 mt-1">
                  {question.options.map((option, index) => (
                    <li
                      key={index}
                      className={
                        option === question.correctAnswer ? 'font-medium text-success' : ''
                      }
                    >
                      • {option} {option === question.correctAnswer && '✓'}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                Options and correct answer cannot be changed to preserve learning integrity
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Question'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Live region for screen reader announcements */}
      {LiveRegionComponent}
    </Dialog>
  );
}
