'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, Calendar } from 'lucide-react'
import { useReviewFlow } from '@/hooks/use-review-flow'
import { useQuizInteractions } from '@/hooks/use-quiz-interactions'
import { QuestionHistory } from '@/components/question-history'
import { ReviewQuestionDisplay } from '@/components/review-question-display'
import { ReviewEmptyState } from '@/components/review/review-empty-state'
import { QuizFlowSkeleton } from '@/components/ui/loading-skeletons'
import { useRenderTracker } from '@/hooks/use-render-tracker'
import { useCurrentQuestion } from '@/contexts/current-question-context'
import type { Doc } from '@/convex/_generated/dataModel'

/**
 * Unified ReviewFlow component that combines ReviewMode + ReviewSession
 * Eliminates intermediate data transformations and prop drilling
 * Works directly with single questions from the review flow
 */
export function ReviewFlow() {
  // Get review state and handlers from custom hook
  const { phase, question, questionId, interactions, handlers } = useReviewFlow()

  // Track component renders for performance monitoring
  useRenderTracker('ReviewFlow', { phase, questionId })

  // Use context for current question
  const { setCurrentQuestion } = useCurrentQuestion()

  // Local UI state for answer selection and feedback
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [nextReviewInfo, setNextReviewInfo] = useState<{
    nextReview: Date | null
    scheduledDays: number
  } | null>(null)

  const { trackAnswer } = useQuizInteractions()
  const [sessionId] = useState(() => Math.random().toString(36).substring(7))
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())

  // Update context when current question changes
  useEffect(() => {
    if (question && questionId) {
      // Convert SimpleQuestion to a partial Doc<"questions"> format
      setCurrentQuestion({
        ...question,
        _id: questionId,
        type: question.type || 'multiple-choice'
      } as Doc<"questions">)
    } else {
      setCurrentQuestion(undefined)
    }
  }, [question, questionId, setCurrentQuestion])

  // Reset state when question changes
  useEffect(() => {
    if (questionId) {
      setSelectedAnswer('')
      setShowFeedback(false)
      setNextReviewInfo(null)
      setQuestionStartTime(Date.now())
    }
  }, [questionId])

  const handleAnswerSelect = useCallback((answer: string) => {
    if (showFeedback) return

    if (process.env.NODE_ENV === 'development') {
      performance.mark('answer-selected')
      // eslint-disable-next-line no-console
      console.log('[ReviewFlow] Answer selected:', answer)
    }

    setSelectedAnswer(answer)
  }, [showFeedback])

  const handleSubmit = useCallback(async () => {
    if (!selectedAnswer || !question || !questionId) return

    if (process.env.NODE_ENV === 'development') {
      performance.mark('answer-submitted')
      // eslint-disable-next-line no-console
      console.log('[ReviewFlow] Answer submitted:', selectedAnswer)
    }

    const isCorrect = selectedAnswer === question.correctAnswer

    // Batch state updates for single render
    setShowFeedback(true)

    if (process.env.NODE_ENV === 'development') {
      performance.mark('feedback-shown')
      try {
        performance.measure('submit-to-feedback', 'answer-submitted', 'feedback-shown')
        const measure = performance.getEntriesByName('submit-to-feedback')[0]
        // eslint-disable-next-line no-console
        console.log(`[ReviewFlow] Feedback shown in ${measure.duration.toFixed(2)}ms`)
      } catch {
        // Ignore if marks don't exist
      }
    }

    // Track interaction with FSRS scheduling
    const timeSpent = Date.now() - questionStartTime
    const reviewInfo = await trackAnswer(
      questionId,
      selectedAnswer,
      isCorrect,
      timeSpent,
      sessionId
    )

    if (reviewInfo) {
      setNextReviewInfo({
        nextReview: reviewInfo.nextReview,
        scheduledDays: reviewInfo.scheduledDays
      })
    }
  }, [selectedAnswer, question, questionId, questionStartTime, trackAnswer, sessionId])

  const handleNext = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      performance.mark('next-question')

      try {
        performance.measure('feedback-to-next', 'feedback-shown', 'next-question')
        const measure = performance.getEntriesByName('feedback-to-next')[0]
        // eslint-disable-next-line no-console
        console.log(`[ReviewFlow] Time on feedback: ${measure.duration.toFixed(2)}ms`)
      } catch {
        // Ignore if marks don't exist
      }

      try {
        performance.measure('full-answer-cycle', 'answer-selected', 'next-question')
        const measure = performance.getEntriesByName('full-answer-cycle')[0]
        // eslint-disable-next-line no-console
        console.log(`[ReviewFlow] Full answer cycle: ${measure.duration.toFixed(2)}ms`)
      } catch {
        // Ignore if marks don't exist
      }
    }

    // Tell the review flow we're done with this question
    handlers.onReviewComplete()

    // State will reset when new question arrives via useEffect
  }, [handlers])

  // Render based on phase
  if (phase === 'loading') {
    return (
      <div className="min-h-[400px] flex items-start justify-center">
        <QuizFlowSkeleton />
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="min-h-[400px] flex items-start justify-center">
        <ReviewEmptyState />
      </div>
    )
  }

  if (phase === 'reviewing' && question) {
    return (
      <div className="min-h-[400px] flex items-start justify-center">
        <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <article className="space-y-6">
            {/* Use memoized component for question display */}
            <ReviewQuestionDisplay
              question={question}
              questionId={questionId}
              selectedAnswer={selectedAnswer}
              showFeedback={showFeedback}
              onAnswerSelect={handleAnswerSelect}
            />

            <div className="space-y-3">

              {showFeedback && (question.explanation || interactions.length > 0 || nextReviewInfo?.nextReview) && (
                <div className="mt-4 space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50 animate-fadeIn">
                  {/* Explanation */}
                  {question.explanation && (
                    <p className="text-sm text-foreground/90">{question.explanation}</p>
                  )}

                  {/* Divider between explanation and other content */}
                  {question.explanation && (interactions.length > 0 || nextReviewInfo?.nextReview) && (
                    <hr className="border-border/30" />
                  )}

                  {/* Question History */}
                  {interactions.length > 0 && (
                    <QuestionHistory
                      interactions={interactions}
                      loading={false}
                    />
                  )}

                  {/* Next Review - inline and subtle */}
                  {nextReviewInfo && nextReviewInfo.nextReview && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        Next review: {nextReviewInfo.scheduledDays === 0
                          ? "Today"
                          : nextReviewInfo.scheduledDays === 1
                          ? "Tomorrow"
                          : `In ${nextReviewInfo.scheduledDays} days`}
                        {' at '}
                        {new Date(nextReviewInfo.nextReview).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end mt-6">
                {!showFeedback ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedAnswer}
                    size="lg"
                  >
                    Submit
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    size="lg"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </article>
        </div>
      </div>
    )
  }

  // Fallback for unexpected states
  return null
}