'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { formatDistanceToNow } from 'date-fns'
import { 
  Search, 
  Calendar, 
  TrendingUp,
  LayoutGrid,
  List,
  Trophy,
  Brain,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QuizStatsRealtime } from '@/components/shared/quiz-stats-realtime'

type SortOption = 'date-desc' | 'date-asc' | 'score-desc' | 'score-asc' | 'topic-asc' | 'topic-desc'
type TimeFilter = 'all' | 'today' | 'week' | 'month' | '3months'

export function QuizHistoryPageClient() {
  const { isAuthenticated, isLoading, sessionToken } = useAuth()
  const router = useRouter()
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [scoreFilter, setScoreFilter] = useState<'all' | 'excellent' | 'good' | 'needs-practice'>('all')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [loadedCount, setLoadedCount] = useState(30)
  
  // Fetch quiz history from Convex
  const quizHistory = useQuery(api.quiz.getQuizHistory, {
    sessionToken: sessionToken || undefined,
    limit: loadedCount
  })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  // Filter and sort quiz data
  const filteredAndSortedQuizzes = useMemo(() => {
    if (!quizHistory?.quizzes) return []
    
    let filtered = [...quizHistory.quizzes]
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(quiz =>
        quiz.topic.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Apply time filter
    const now = new Date()
    if (timeFilter !== 'all') {
      filtered = filtered.filter(quiz => {
        const quizDate = new Date(quiz.completedAt)
        const daysDiff = (now.getTime() - quizDate.getTime()) / (1000 * 60 * 60 * 24)
        
        switch (timeFilter) {
          case 'today':
            return daysDiff < 1
          case 'week':
            return daysDiff < 7
          case 'month':
            return daysDiff < 30
          case '3months':
            return daysDiff < 90
          default:
            return true
        }
      })
    }
    
    // Apply score filter
    if (scoreFilter !== 'all') {
      filtered = filtered.filter(quiz => {
        switch (scoreFilter) {
          case 'excellent':
            return quiz.percentage >= 80
          case 'good':
            return quiz.percentage >= 60 && quiz.percentage < 80
          case 'needs-practice':
            return quiz.percentage < 60
          default:
            return true
        }
      })
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        case 'date-asc':
          return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
        case 'score-desc':
          return b.percentage - a.percentage
        case 'score-asc':
          return a.percentage - b.percentage
        case 'topic-asc':
          return a.topic.localeCompare(b.topic)
        case 'topic-desc':
          return b.topic.localeCompare(a.topic)
        default:
          return 0
      }
    })
    
    return filtered
  }, [quizHistory, searchQuery, sortBy, timeFilter, scoreFilter])

  const handleLoadMore = () => {
    setLoadedCount(prev => prev + 30)
  }

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadgeVariant = (percentage: number) => {
    if (percentage >= 80) return 'default' as const
    if (percentage >= 60) return 'secondary' as const
    return 'destructive' as const
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Quiz History</h1>
          <p className="text-muted-foreground">
            Track your learning progress and quiz performance over time
          </p>
        </div>
        
        {/* Stats Overview */}
        <div className="mb-6">
          <QuizStatsRealtime />
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Search Input */}
          <div className="relative flex-1">
            <label htmlFor="quiz-history-search" className="sr-only">
              Search quizzes by topic
            </label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
            <Input
              id="quiz-history-search"
              type="text"
              placeholder="Search quizzes by topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search quizzes by topic"
            />
          </div>
          
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
            {/* Time Filter */}
            <Select value={timeFilter} onValueChange={(value: string) => setTimeFilter(value as TimeFilter)}>
              <SelectTrigger className="w-full sm:w-[140px] min-w-[120px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Past Week</SelectItem>
                <SelectItem value="month">Past Month</SelectItem>
                <SelectItem value="3months">Past 3 Months</SelectItem>
              </SelectContent>
            </Select>

            {/* Score Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[140px] min-w-[120px]">
                  <Trophy className="h-4 w-4 mr-2" />
                  Score Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Filter by Score</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={scoreFilter} onValueChange={(value) => setScoreFilter(value as typeof scoreFilter)}>
                  <DropdownMenuRadioItem value="all">All Scores</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="excellent">Excellent (80%+)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="good">Good (60-79%)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="needs-practice">Needs Practice (&lt;60%)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[140px] min-w-[120px]">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Sort By
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <DropdownMenuRadioItem value="date-desc">Date (Newest)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="date-asc">Date (Oldest)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="score-desc">Score (High to Low)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="score-asc">Score (Low to High)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="topic-asc">Topic (A-Z)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="topic-desc">Topic (Z-A)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* View Toggle and Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredAndSortedQuizzes.length} of {quizHistory?.quizzes.length || 0} quizzes
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
          
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'cards' | 'table')} className="w-auto">
            <TabsList className="grid w-32 grid-cols-2">
              <TabsTrigger value="cards" className="text-xs">
                <LayoutGrid className="h-3 w-3" />
              </TabsTrigger>
              <TabsTrigger value="table" className="text-xs">
                <List className="h-3 w-3" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Loading State */}
        {quizHistory === undefined ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredAndSortedQuizzes.length === 0 ? (
          /* Empty State */
          <Card className="text-center py-12">
            <CardContent>
              {searchQuery || timeFilter !== 'all' || scoreFilter !== 'all' ? (
                <>
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No quizzes found</h3>
                  <p className="text-gray-600 mb-4">
                    Try adjusting your filters or search terms
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchQuery('')
                      setTimeFilter('all')
                      setScoreFilter('all')
                    }}
                  >
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
                  <p className="text-gray-600">
                    Start taking quizzes to track your progress here.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Quiz Results Display */}
            {viewMode === 'cards' ? (
              /* Card View */
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedQuizzes.map((quiz) => (
                  <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-2">
                            {quiz.topic}
                          </CardTitle>
                          <CardDescription>
                            {formatDistanceToNow(new Date(quiz.completedAt), { addSuffix: true })}
                          </CardDescription>
                        </div>
                        <Badge variant={getScoreBadgeVariant(quiz.percentage)}>
                          {quiz.percentage}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {quiz.score}
                          </div>
                          <div className="text-xs text-muted-foreground">Correct</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-600">
                            {quiz.totalQuestions}
                          </div>
                          <div className="text-xs text-muted-foreground">Questions</div>
                        </div>
                        <div>
                          <div className={`text-2xl font-bold ${getScoreColor(quiz.percentage)}`}>
                            {quiz.percentage}%
                          </div>
                          <div className="text-xs text-muted-foreground">Score</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Difficulty</span>
                          <Badge variant="outline" className="capitalize">
                            {quiz.difficulty || 'medium'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Table View */
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Questions</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-center">Percentage</TableHead>
                      <TableHead>Difficulty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedQuizzes.map((quiz) => (
                      <TableRow key={quiz.id}>
                        <TableCell className="font-medium">{quiz.topic}</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(quiz.completedAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-center">{quiz.totalQuestions}</TableCell>
                        <TableCell className="text-center">
                          {quiz.score}/{quiz.totalQuestions}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${getScoreColor(quiz.percentage)}`}>
                            {quiz.percentage}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {quiz.difficulty || 'medium'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* Load More Button */}
            {!searchQuery && quizHistory?.hasMore && filteredAndSortedQuizzes.length >= loadedCount && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={handleLoadMore}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Load More Quizzes
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}