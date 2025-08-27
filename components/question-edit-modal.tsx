'use client'

import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

// Schema for question edit form - only editable fields to preserve FSRS integrity
const questionEditSchema = z.object({
  question: z
    .string()
    .min(1, 'Question is required')
    .max(500, 'Question must be less than 500 characters'),
  topic: z
    .string()
    .min(1, 'Topic is required')
    .max(100, 'Topic must be less than 100 characters'),
  explanation: z
    .string()
    .max(1000, 'Explanation must be less than 1000 characters')
    .optional(),
})

type QuestionEditFormValues = z.infer<typeof questionEditSchema>

interface QuestionEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: {
    _id: Id<'questions'>
    question: string
    topic: string
    explanation?: string
    type: 'multiple-choice' | 'true-false'
    options: string[]
    correctAnswer: string
  }
  onSuccess?: () => void
}

export function QuestionEditModal({ 
  open, 
  onOpenChange, 
  question,
  onSuccess 
}: QuestionEditModalProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const { sessionToken } = useAuth()
  const updateQuestion = useMutation(api.questions.updateQuestion)

  const form = useForm<QuestionEditFormValues>({
    resolver: zodResolver(questionEditSchema),
    defaultValues: {
      question: question.question,
      topic: question.topic,
      explanation: question.explanation || '',
    },
  })

  // Reset form when modal opens/closes or question changes
  React.useEffect(() => {
    if (open) {
      form.reset({
        question: question.question,
        topic: question.topic,
        explanation: question.explanation || '',
      })
    }
  }, [open, question, form])

  const handleSubmit = async (values: QuestionEditFormValues) => {
    if (!sessionToken) {
      toast.error('You must be logged in to edit questions')
      return
    }

    setIsLoading(true)
    try {
      const result = await updateQuestion({
        sessionToken,
        questionId: question._id,
        question: values.question,
        topic: values.topic,
        explanation: values.explanation || undefined,
      })

      if (result.success) {
        toast.success('Question updated successfully')
        onSuccess?.()
        onOpenChange(false)
        form.reset()
      } else {
        toast.error('Failed to update question')
      }
    } catch (error) {
      console.error('Failed to update question:', error)
      
      // Handle specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Failed to update question'
      
      if (errorMessage.includes('unauthorized')) {
        toast.error('You are not authorized to edit this question')
      } else if (errorMessage.includes('deleted')) {
        toast.error('Cannot edit a deleted question')
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
      if (!newOpen) {
        form.reset()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
          <DialogDescription>
            Update the question text, topic, or explanation. Note that answers and options cannot be changed to preserve learning history.
          </DialogDescription>
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
                  <FormDescription>
                    The main question text that users will see
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., JavaScript, History, Science"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Category or subject area for this question
                  </FormDescription>
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
                  <FormDescription>
                    Help users understand why the answer is correct
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Read-only display of non-editable fields */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="text-sm">{question.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False'}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground">Options</p>
                <ul className="text-sm space-y-1 mt-1">
                  {question.options.map((option, index) => (
                    <li key={index} className={option === question.correctAnswer ? 'font-medium text-green-600' : ''}>
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
              <Button
                type="submit"
                disabled={isLoading || !form.formState.isDirty}
              >
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
    </Dialog>
  )
}