'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft } from 'lucide-react'
import { ReviewSession } from '@/components/review-session'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import type { SimpleQuiz } from '@/types/quiz'

type QuizFlowState = 'generating' | 'ready' | 'quiz' | 'complete'

interface QuizFlowProps {
  topic: string
  questionCount?: number
}

export function QuizFlow({ topic }: QuizFlowProps) {
  const router = useRouter()
  const { user, isSignedIn } = useUser()
  const [flowState, setFlowState] = useState<QuizFlowState>('generating')
  const [quiz, setQuiz] = useState<SimpleQuiz | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    generateQuiz()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generateQuiz = async () => {
    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic, 
          difficulty: 'medium',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate quiz')
      }

      const data = await response.json()
      
      const simpleQuiz: SimpleQuiz = {
        topic,
        questions: data.questions,
        questionIds: data.questionIds, // Add this
        currentIndex: 0,
        score: 0
      }
      
      setQuiz(simpleQuiz)
      setFlowState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz')
    }
  }

  const handleStartQuiz = () => {
    setFlowState('quiz')
  }

  const handleQuizComplete = async (finalScore: number, answers: Array<{ userAnswer: string; isCorrect: boolean }>, sessionId: string) => {
    if (quiz) {
      setQuiz({ ...quiz, score: finalScore })
      
      // Save quiz results if user is authenticated
      if (user && isSignedIn) {
        try {
          const response = await fetch('/api/quiz/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic,
                difficulty: 'medium',
                score: finalScore,
                totalQuestions: quiz.questions.length,
                sessionId, // Add sessionId to the request
                answers: answers.map((answer, index) => ({
                  questionId: quiz.questionIds?.[index] || `q${index}`,
                  question: quiz.questions[index].question,
                  type: quiz.questions[index].type,
                  userAnswer: answer.userAnswer,
                  correctAnswer: quiz.questions[index].correctAnswer,
                  isCorrect: answer.isCorrect,
                  options: quiz.questions[index].options
                }))
              }),
            })
            
            if (response.ok) {
              toast.success('Quiz results saved!')
            } else {
              console.error('Failed to save quiz results')
            }
        } catch (error) {
          console.error('Error saving quiz results:', error)
        }
      }
    }
    setFlowState('complete')
  }

  const handleRetry = () => {
    setFlowState('generating')
    setQuiz(null)
    setError(null)
    generateQuiz()
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">{error}</p>
          <div className="space-x-4">
            <Button variant="outline" onClick={() => router.push('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleRetry}>Try Again</Button>
          </div>
        </div>
      </div>
    )
  }

  if (flowState === 'generating') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Generating your quiz...</p>
        </div>
      </div>
    )
  }

  if (flowState === 'ready' && quiz) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <h2 className="text-3xl font-bold mb-2">Quiz Ready</h2>
          <p className="text-lg text-muted-foreground mb-8">
            {quiz.questions.length} questions about {topic}
          </p>
          
          <Button 
            size="lg" 
            className="w-full"
            onClick={handleStartQuiz}
          >
            Start Quiz
          </Button>
          
          <Button 
            variant="ghost" 
            className="mt-4"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
    )
  }

  if (flowState === 'quiz' && quiz) {
    return (
      <ReviewSession 
        quiz={quiz}
        onComplete={handleQuizComplete}
      />
    )
  }

  if (flowState === 'complete' && quiz) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-5xl font-bold text-primary mb-4">
            {quiz.score}/{quiz.questions.length}
          </p>
          <p className="text-lg text-muted-foreground mb-8">
            {Math.round((quiz.score / quiz.questions.length) * 100)}% correct
          </p>
          
          <div className="space-y-3">
            <Button 
              size="lg" 
              className="w-full"
              onClick={handleRetry}
            >
              Try Again
            </Button>
            
            <Button 
              variant="outline"
              size="lg" 
              className="w-full"
              onClick={() => router.push('/')}
            >
              New Topic
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}