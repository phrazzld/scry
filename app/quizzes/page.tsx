import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Trophy, Target, BookOpen } from 'lucide-react'

async function getUserQuizzes(userId: string) {
  const quizzes = await prisma.quizResult.findMany({
    where: {
      userId,
    },
    orderBy: {
      completedAt: 'desc',
    },
  })
  
  return quizzes
}

function getDifficultyColor(difficulty: string) {
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default async function QuizzesPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }
  
  const quizzes = await getUserQuizzes(session.user.id)
  
  if (quizzes.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">My Quiz History</h1>
          
          {/* Empty State */}
          <Card className="text-center py-12">
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No quizzes yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Start your learning journey by creating your first quiz!
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create Your First Quiz
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Quiz History</h1>
          <p className="text-gray-600">
            You&apos;ve completed {quizzes.length} quiz{quizzes.length !== 1 ? 'es' : ''}
          </p>
        </div>
        
        {/* Quiz Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2 line-clamp-2">
                      {quiz.topic}
                    </CardTitle>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getDifficultyColor(quiz.difficulty)}>
                        {quiz.difficulty}
                      </Badge>
                    </div>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  {formatDate(quiz.completedAt)}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {/* Score Display */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium">Score</span>
                    </div>
                    <div className="text-lg font-bold">
                      {quiz.score}/{quiz.totalQuestions}
                      <span className="text-sm text-gray-500 ml-1">
                        ({Math.round((quiz.score / quiz.totalQuestions) * 100)}%)
                      </span>
                    </div>
                  </div>
                  
                  {/* Quiz Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {quiz.totalQuestions} questions
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Summary Stats */}
        {quizzes.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Quiz Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {quizzes.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Quizzes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(
                      quizzes.reduce((acc, quiz) => acc + (quiz.score / quiz.totalQuestions), 0) / quizzes.length * 100
                    )}%
                  </div>
                  <div className="text-sm text-gray-600">Average Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {quizzes.reduce((acc, quiz) => acc + quiz.totalQuestions, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Questions Answered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {new Set(quizzes.map(quiz => quiz.topic)).size}
                  </div>
                  <div className="text-sm text-gray-600">Unique Topics</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}