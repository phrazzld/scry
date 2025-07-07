'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Trophy, Target, LayoutGrid, List } from 'lucide-react'

type QuizResult = {
  id: string
  userId: string
  topic: string
  difficulty: string
  score: number
  totalQuestions: number
  answers: unknown
  completedAt: Date
}

type QuizHistoryViewsProps = {
  quizzes: QuizResult[]
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

function QuizCardSkeleton() {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuizCardsLoadingSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <QuizCardSkeleton key={i} />
      ))}
    </div>
  )
}

function QuizTableLoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Questions</TableHead>
            <TableHead>Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="h-4 w-8" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function QuizCardsView({ quizzes }: { quizzes: QuizResult[] }) {
  return (
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
  )
}

function QuizTableView({ quizzes }: { quizzes: QuizResult[] }) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Questions</TableHead>
            <TableHead>Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quizzes.map((quiz) => (
            <TableRow key={quiz.id}>
              <TableCell className="font-medium max-w-xs">
                <div className="truncate" title={quiz.topic}>
                  {quiz.topic}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getDifficultyColor(quiz.difficulty)}>
                  {quiz.difficulty}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {quiz.score}/{quiz.totalQuestions}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({Math.round((quiz.score / quiz.totalQuestions) * 100)}%)
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Target className="w-4 h-4" />
                  {quiz.totalQuestions}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  {formatDate(quiz.completedAt)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function QuizHistoryViews({ quizzes }: QuizHistoryViewsProps) {
  return (
    <Tabs defaultValue="cards" className="w-full">
      <div className="flex items-center justify-between mb-6">
        <TabsList className="grid w-40 grid-cols-2">
          <TabsTrigger value="cards" className="flex items-center gap-1">
            <LayoutGrid className="w-4 h-4" />
            Cards
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center gap-1">
            <List className="w-4 h-4" />
            Table
          </TabsTrigger>
        </TabsList>
      </div>
      
      <TabsContent value="cards" className="mt-0">
        <QuizCardsView quizzes={quizzes} />
      </TabsContent>
      
      <TabsContent value="table" className="mt-0">
        <QuizTableView quizzes={quizzes} />
      </TabsContent>
    </Tabs>
  )
}

// Export skeleton components for reuse
export { QuizCardsLoadingSkeleton, QuizTableLoadingSkeleton }