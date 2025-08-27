'use client'

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, CheckCircle, Target, Trophy, Brain, Clock, Calendar, Search, Edit2, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { QuestionEditModal } from "./question-edit-modal"
import { toast } from "sonner"
import type { Question } from "@/types/quiz"
import { Id } from "@/convex/_generated/dataModel"

export function QuizQuestionsGrid() {
  const { user, sessionToken } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [loadedCount, setLoadedCount] = useState(30)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const softDeleteQuestion = useMutation(api.questions.softDeleteQuestion)

  // Fetch all user's questions
  const questions = useQuery(api.questions.getUserQuestions, {
    sessionToken: sessionToken || '',
    limit: loadedCount
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
          <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
          <p className="text-gray-600">
            Generate some quizzes to see your questions here.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Helper function to format relative time
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }


  // Filter questions based on search query
  const filteredQuestions = searchQuery
    ? questions.filter((q: Question) => 
        q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.topic.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : questions

  const handleLoadMore = () => {
    setLoadedCount(prev => prev + 30)
  }

  const handleDeleteQuestion = async () => {
    if (!deletingQuestion || !sessionToken) return
    
    setIsDeleting(true)
    try {
      await softDeleteQuestion({
        sessionToken,
        questionId: deletingQuestion._id as Id<'questions'>,
      })
      toast.success('Question deleted successfully')
      setDeletingQuestion(null)
    } catch (error) {
      console.error('Failed to delete question:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete question'
      
      if (errorMessage.includes('unauthorized')) {
        toast.error('You are not authorized to delete this question')
      } else if (errorMessage.includes('already deleted')) {
        toast.error('This question has already been deleted')
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search questions by text or topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Questions Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredQuestions.map((question: Question) => {
          const accuracy = question.attemptCount > 0 
            ? Math.round((question.correctCount / question.attemptCount) * 100)
            : null

          return (
            <Card key={question._id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-base mb-2 leading-relaxed">
                      {question.question}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="font-medium">{question.topic}</span>
                      <span className="text-gray-400">•</span>
                      <span>{question.type === 'true-false' ? 'True/False' : 'Multiple Choice'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {question.attemptCount > 0 && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {/* Only show action buttons for questions owned by current user */}
                    {user && question.userId === (user.id as Id<"users">) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingQuestion(question)}
                          className="h-8 w-8 p-0"
                          title="Edit question"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingQuestion(question)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Delete question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {/* Accuracy */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                      <Trophy className="h-4 w-4" />
                      <span>Accuracy</span>
                    </div>
                    <div className="font-medium text-gray-900">
                      {question.attemptCount > 0 ? `${accuracy}%` : '—'}
                    </div>
                  </div>

                  {/* Attempts */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                      <Target className="h-4 w-4" />
                      <span>Reviews</span>
                    </div>
                    <div className="font-medium text-gray-900">
                      {question.attemptCount || 0}
                    </div>
                  </div>

                  {/* Last Review */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                      <Calendar className="h-4 w-4" />
                      <span>Last Review</span>
                    </div>
                    <div className="font-medium text-gray-900">
                      {question.lastAttemptedAt ? formatRelativeTime(question.lastAttemptedAt) : 'Never'}
                    </div>
                  </div>

                  {/* Generated */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                      <Clock className="h-4 w-4" />
                      <span>Created</span>
                    </div>
                    <div className="font-medium text-gray-900">
                      {formatRelativeTime(question.generatedAt)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Load More Button */}
      {questions.length >= loadedCount && !searchQuery && (
        <div className="flex justify-center mt-8">
          <Button
            onClick={handleLoadMore}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Load More Questions
          </Button>
        </div>
      )}

      {/* Results count */}
      {searchQuery && (
        <div className="text-center text-sm text-gray-600">
          Showing {filteredQuestions.length} of {questions.length} questions
        </div>
      )}

      {/* Edit Modal */}
      {editingQuestion && (
        <QuestionEditModal
          open={!!editingQuestion}
          onOpenChange={(open) => !open && setEditingQuestion(null)}
          question={editingQuestion}
          onSuccess={() => {
            setEditingQuestion(null)
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingQuestion} onOpenChange={(open) => !open && setDeletingQuestion(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone, and all learning history for this question will be preserved but the question will no longer appear in reviews.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deletingQuestion && (
            <div className="my-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm font-medium text-gray-900 mb-2">Question:</p>
              <p className="text-sm text-gray-600">{deletingQuestion.question}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Question'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}