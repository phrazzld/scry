'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { QuizFlowSkeleton } from '@/components/ui/loading-skeletons'

// Dynamic import for QuizFlow to reduce initial bundle size
const QuizFlow = dynamic(() => import('@/components/quiz-flow').then(mod => ({ default: mod.QuizFlow })), {
  loading: () => <QuizFlowSkeleton />,
  ssr: false // Quiz flow is interactive and doesn't need SSR
})

export default function CreateQuizPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const topic = searchParams.get('topic')
  const difficulty = searchParams.get('difficulty') as 'easy' | 'medium' | 'hard' | null

  useEffect(() => {
    if (!topic) {
      router.push('/')
    }
  }, [topic, router])

  if (!topic) {
    return null
  }

  return (
    <QuizFlow 
      topic={topic}
      questionCount={10}
      difficulty={difficulty || 'medium'}
    />
  )
}