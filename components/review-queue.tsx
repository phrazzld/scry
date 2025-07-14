'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2, Brain, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type ReviewRating = "Again" | "Hard" | "Good" | "Easy"

export function ReviewQueue() {
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('scry_session_token') : null
  
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [isReviewing, setIsReviewing] = useState(false)
  
  // Fetch review queue
  const reviewQueue = useQuery(api.spacedRepetition.getReviewQueue, {
    sessionToken: sessionToken || undefined,
    limit: 20
  })
  
  // Review card mutation
  const reviewCardMutation = useMutation(api.spacedRepetition.reviewCard)
  
  const currentCard = reviewQueue?.cards[currentCardIndex]
  const progress = reviewQueue ? ((currentCardIndex + 1) / reviewQueue.cards.length) * 100 : 0
  
  const handleAnswerSelect = (answer: string) => {
    if (showAnswer) return
    setSelectedAnswer(answer)
  }
  
  const handleCheckAnswer = () => {
    if (!selectedAnswer) return
    setShowAnswer(true)
  }
  
  const handleReview = async (rating: ReviewRating) => {
    if (!currentCard || !sessionToken || isReviewing) return
    
    setIsReviewing(true)
    try {
      const result = await reviewCardMutation({
        sessionToken,
        cardId: currentCard.cardId,
        rating
      })
      
      toast.success(`Card reviewed! Next review: ${new Date(result.nextDue).toLocaleDateString()}`)
      
      // Move to next card
      if (currentCardIndex < reviewQueue.cards.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1)
        setShowAnswer(false)
        setSelectedAnswer('')
      } else {
        // All cards reviewed
        toast.success('All cards reviewed for today! 🎉')
      }
    } catch (error) {
      toast.error('Failed to save review')
      console.error('Review error:', error)
    } finally {
      setIsReviewing(false)
    }
  }
  
  // Loading state
  if (reviewQueue === undefined) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-4">Loading review queue...</p>
        </CardContent>
      </Card>
    )
  }
  
  // Empty queue
  if (!reviewQueue || reviewQueue.cards.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                All caught up!
              </h3>
              <p className="text-gray-500">
                You have no cards due for review right now. Check back later!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // All cards reviewed
  if (currentCardIndex >= reviewQueue.cards.length) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Session Complete!
              </h3>
              <p className="text-gray-500 mb-4">
                You reviewed {reviewQueue.cards.length} cards. Great job!
              </p>
              <Button onClick={() => window.location.reload()}>
                Check for More Cards
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  const isCorrect = selectedAnswer === currentCard.correctAnswer
  
  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Progress</span>
          <span>{currentCardIndex + 1} of {reviewQueue.cards.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      {/* Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{currentCard.topic}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Brain className="h-4 w-4" />
              <span>Reviews: {currentCard.reps}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question */}
          <div>
            <h3 className="text-lg font-medium mb-4">{currentCard.question}</h3>
            
            {/* Options */}
            <div className="space-y-3">
              {currentCard.options.map((option: string, index: number) => {
                const isSelected = selectedAnswer === option
                const isCorrectOption = option === currentCard.correctAnswer
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={showAnswer}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      showAnswer
                        ? isCorrectOption
                          ? 'bg-green-50 border-green-500 text-green-900'
                          : isSelected
                          ? 'bg-red-50 border-red-500 text-red-900'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                        : isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {showAnswer && (
                        <span>
                          {isCorrectOption ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : isSelected ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : null}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Action Buttons */}
          {!showAnswer ? (
            <Button 
              onClick={handleCheckAnswer}
              disabled={!selectedAnswer}
              className="w-full"
            >
              Check Answer
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Feedback */}
              <div className={`p-4 rounded-lg ${
                isCorrect 
                  ? 'bg-green-50 text-green-900' 
                  : 'bg-amber-50 text-amber-900'
              }`}>
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Correct!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Not quite right</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Rating Buttons */}
              <div>
                <p className="text-sm text-gray-600 mb-3">How well did you know this?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleReview("Again")}
                    disabled={isReviewing}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReview("Hard")}
                    disabled={isReviewing}
                    className="text-orange-600 hover:bg-orange-50"
                  >
                    Hard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReview("Good")}
                    disabled={isReviewing}
                    className="text-blue-600 hover:bg-blue-50"
                  >
                    Good
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReview("Easy")}
                    disabled={isReviewing}
                    className="text-green-600 hover:bg-green-50"
                  >
                    Easy
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}