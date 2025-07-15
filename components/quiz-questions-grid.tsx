'use client'

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, CheckCircle, Circle, Target, Trophy, Brain, Clock } from "lucide-react"
import type { Question } from "@/types/quiz"

export function QuizQuestionsGrid() {
  const [filter, setFilter] = useState<'all' | 'unattempted'>('all')
  const { user } = useAuth()
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('scry_session_token') : null

  // Fetch user's questions based on filter
  const questions = useQuery(api.questions.getUserQuestions, {
    sessionToken: sessionToken || '',
    onlyUnattempted: filter === 'unattempted',
    limit: 100
  })

  if (!user) {
    return null
  }

  // Loading state
  if (questions === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  // Empty state
  if (!questions || questions.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {filter === 'unattempted' ? 'No unattempted questions' : 'No questions yet'}
          </h3>
          <p className="text-gray-600">
            {filter === 'unattempted' 
              ? "You've attempted all your questions! Great job!" 
              : 'Generate some quizzes to see your questions here.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Helper function to get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Helper function to format date
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(timestamp))
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as 'all' | 'unattempted')}>
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            All Questions
          </TabsTrigger>
          <TabsTrigger value="unattempted" className="flex items-center gap-2">
            <Circle className="h-4 w-4" />
            Unattempted
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Questions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {questions.map((question: Question) => {
          const accuracy = question.attemptCount > 0 
            ? Math.round((question.correctCount / question.attemptCount) * 100)
            : null

          return (
            <Card key={question._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base line-clamp-2 flex-1">
                    {question.question}
                  </CardTitle>
                  {question.attemptCount > 0 && (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                </div>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Badge className={getDifficultyColor(question.difficulty)}>
                    {question.difficulty}
                  </Badge>
                  <span className="text-xs text-gray-500">{question.topic}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Question type */}
                  <div className="text-sm text-gray-600">
                    Type: {question.type === 'true-false' ? 'True/False' : 'Multiple Choice'}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      {question.attemptCount > 0 ? (
                        <>
                          <div className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-gray-400" />
                            <span>{accuracy}% accuracy</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="h-4 w-4 text-gray-400" />
                            <span>{question.attemptCount} attempts</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-500">Not attempted</span>
                      )}
                    </div>
                  </div>

                  {/* Generated date */}
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Generated {formatDate(question.generatedAt)}
                  </div>

                  {/* Last attempted date */}
                  {question.lastAttemptedAt && (
                    <div className="text-xs text-gray-500">
                      Last attempted {formatDate(question.lastAttemptedAt)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}