import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { QuizHistoryViews } from '@/components/quiz-history-views'
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination'
import { BookOpen } from 'lucide-react'

async function getUserQuizzes(userId: string, page: number = 1, limit: number = 12) {
  const offset = (page - 1) * limit
  
  const [quizzes, totalCount] = await Promise.all([
    prisma.quizResult.findMany({
      where: {
        userId,
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.quizResult.count({
      where: {
        userId,
      },
    }),
  ])
  
  return {
    quizzes,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit),
  }
}

async function getUserQuizStats(userId: string) {
  const result = await prisma.quizResult.aggregate({
    where: {
      userId,
    },
    _avg: {
      score: true,
    },
    _sum: {
      score: true,
      totalQuestions: true,
    },
    _count: {
      id: true,
    },
  })
  
  const uniqueTopics = await prisma.quizResult.findMany({
    where: {
      userId,
    },
    distinct: ['topic'],
    select: {
      topic: true,
    },
  })
  
  return {
    totalQuizzes: result._count.id,
    totalQuestions: result._sum.totalQuestions || 0,
    totalScore: result._sum.score || 0,
    averageScore: result._avg.score || 0,
    uniqueTopics: uniqueTopics.length,
  }
}


export default async function QuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }
  
  const params = await searchParams
  const page = Number(params.page) || 1
  const [{ quizzes, totalCount, currentPage, totalPages }, stats] = await Promise.all([
    getUserQuizzes(session.user.id, page),
    getUserQuizStats(session.user.id),
  ])
  
  if (totalCount === 0) {
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
            You&apos;ve completed {totalCount} quiz{totalCount !== 1 ? 'es' : ''}
            {totalPages > 1 && (
              <span className="ml-2 text-sm">
                (Page {currentPage} of {totalPages})
              </span>
            )}
          </p>
        </div>
        
        {/* Quiz History Views */}
        <QuizHistoryViews quizzes={quizzes} />
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <Pagination>
              <PaginationContent>
                {currentPage > 1 && (
                  <PaginationItem>
                    <PaginationPrevious href={`/quizzes?page=${currentPage - 1}`} />
                  </PaginationItem>
                )}
                
                {/* Show first page */}
                {currentPage > 3 && (
                  <>
                    <PaginationItem>
                      <PaginationLink href="/quizzes?page=1">1</PaginationLink>
                    </PaginationItem>
                    {currentPage > 4 && <span className="px-2">...</span>}
                  </>
                )}
                
                {/* Show pages around current page */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
                  return startPage + i
                }).filter(pageNum => pageNum <= totalPages).map((pageNum) => (
                  <PaginationItem key={pageNum}>
                    <PaginationLink 
                      href={`/quizzes?page=${pageNum}`}
                      isActive={pageNum === currentPage}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                {/* Show last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2">...</span>}
                    <PaginationItem>
                      <PaginationLink href={`/quizzes?page=${totalPages}`}>{totalPages}</PaginationLink>
                    </PaginationItem>
                  </>
                )}
                
                {currentPage < totalPages && (
                  <PaginationItem>
                    <PaginationNext href={`/quizzes?page=${currentPage + 1}`} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          </div>
        )}
        
        {/* Summary Stats */}
        {totalCount > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Quiz Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.totalQuizzes}
                  </div>
                  <div className="text-sm text-gray-600">Total Quizzes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.totalQuestions > 0 
                      ? Math.round((stats.totalScore / stats.totalQuestions) * 100)
                      : 0}%
                  </div>
                  <div className="text-sm text-gray-600">Average Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.totalQuestions}
                  </div>
                  <div className="text-sm text-gray-600">Questions Answered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.uniqueTopics}
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