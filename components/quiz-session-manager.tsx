'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import type { SimpleQuiz } from '@/types/quiz'

interface QuizSessionManagerProps {
  quiz: SimpleQuiz
  onComplete: (score: number) => void
}

export function QuizSessionManager({ quiz, onComplete }: QuizSessionManagerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [score, setScore] = useState(0)
  
  const currentQuestion = quiz.questions[currentIndex]
  const isLastQuestion = currentIndex === quiz.questions.length - 1
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer
  const progress = ((currentIndex) / quiz.questions.length) * 100

  const handleAnswerSelect = (answer: string) => {
    if (showFeedback) return
    setSelectedAnswer(answer)
  }

  const handleSubmit = () => {
    if (!selectedAnswer) return
    
    setShowFeedback(true)
    if (isCorrect) {
      setScore(score + 1)
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      onComplete(isCorrect ? score + 1 : score)
    } else {
      setCurrentIndex(currentIndex + 1)
      setSelectedAnswer('')
      setShowFeedback(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              Question {currentIndex + 1} of {quiz.questions.length}
            </span>
            <span className="text-sm text-gray-600">
              Score: {score}/{quiz.questions.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{currentQuestion.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedAnswer === option
                    ? showFeedback
                      ? option === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                      : 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                } ${showFeedback && option === currentQuestion.correctAnswer ? 'border-green-500 bg-green-50' : ''}`}
                disabled={showFeedback}
              >
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {showFeedback && option === currentQuestion.correctAnswer && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {showFeedback && selectedAnswer === option && option !== currentQuestion.correctAnswer && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </button>
            ))}

            {showFeedback && currentQuestion.explanation && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">{currentQuestion.explanation}</p>
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
                  {isLastQuestion ? 'Finish' : 'Next'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}