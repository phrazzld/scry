'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import type { SimpleQuiz } from '@/types/quiz'
import { useQuizInteractions } from '@/hooks/use-quiz-interactions'

interface QuizSessionManagerProps {
  quiz: SimpleQuiz
  onComplete: (score: number, answers: Array<{ userAnswer: string; isCorrect: boolean }>, sessionId: string) => void
}

export function QuizSessionManager({ quiz, onComplete }: QuizSessionManagerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState<Array<{ userAnswer: string; isCorrect: boolean }>>([])
  
  const { trackAnswer } = useQuizInteractions()
  const [sessionId] = useState(() => Math.random().toString(36).substring(7))
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  
  const currentQuestion = quiz.questions[currentIndex]
  const isLastQuestion = currentIndex === quiz.questions.length - 1
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer
  const progress = ((currentIndex) / quiz.questions.length) * 100

  const handleAnswerSelect = (answer: string) => {
    if (showFeedback) return
    setSelectedAnswer(answer)
  }

  const handleSubmit = async () => {
    if (!selectedAnswer) return
    
    setShowFeedback(true)
    const newAnswer = {
      userAnswer: selectedAnswer,
      isCorrect: isCorrect
    }
    setAnswers([...answers, newAnswer])
    
    if (isCorrect) {
      setScore(score + 1)
    }

    // Track interaction if we have question IDs
    if (quiz.questionIds && quiz.questionIds[currentIndex]) {
      const timeSpent = Date.now() - questionStartTime
      await trackAnswer(
        quiz.questionIds[currentIndex],
        selectedAnswer,
        isCorrect,
        timeSpent,
        sessionId
      )
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      // Include the current answer in the final answers array
      const finalAnswers = [...answers]
      onComplete(score, finalAnswers, sessionId)
    } else {
      setCurrentIndex(currentIndex + 1)
      setSelectedAnswer('')
      setShowFeedback(false)
      setQuestionStartTime(Date.now()) // Reset timer for next question
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
              Score: {score}/{currentIndex}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{currentQuestion.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentQuestion.type === 'true-false' ? (
              // True/False specific layout
              <div className="grid grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(option)}
                    className={`p-6 rounded-lg border-2 transition-all font-medium ${
                      selectedAnswer === option
                        ? showFeedback
                          ? option === currentQuestion.correctAnswer
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    } ${showFeedback && option === currentQuestion.correctAnswer ? 'border-green-500 bg-green-50' : ''}`}
                    disabled={showFeedback}
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="text-lg">{option}</span>
                      {showFeedback && option === currentQuestion.correctAnswer && (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      )}
                      {showFeedback && selectedAnswer === option && option !== currentQuestion.correctAnswer && (
                        <XCircle className="h-6 w-6 text-red-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              // Multiple choice layout
              currentQuestion.options.map((option, index) => (
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
              ))
            )}

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