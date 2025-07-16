"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// Quiz Generation Flow Skeletons
export function QuizGenerationSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
            <CardHeader className="space-y-2">
              <Skeleton className="h-2 w-20" />
              <Skeleton className="h-6 w-full" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Review Stats Skeleton
export function ReviewStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true" aria-busy="true">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Homepage Stats Skeleton
export function HomepageStatsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Answer Submission Skeleton (inline)
export function AnswerFeedbackSkeleton() {
  return (
    <div className="space-y-3 p-4 border rounded-lg" aria-hidden="true" aria-busy="true">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

// Progress Update Skeleton (inline)
export function ProgressUpdateSkeleton() {
  return (
    <div className="inline-flex items-center gap-2" aria-hidden="true" aria-busy="true">
      <Skeleton className="h-4 w-4 rounded-full animate-pulse" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

// Recent Topics Skeleton
export function RecentTopicsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true" aria-busy="true">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-2 rounded-md">
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

// Quiz Question Skeleton
export function QuizQuestionSkeleton() {
  return (
    <Card aria-hidden="true" aria-busy="true">
      <CardHeader>
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-6 w-full mt-2" />
        <Skeleton className="h-6 w-4/5" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

// Service Worker Update Skeleton
export function ServiceWorkerUpdateSkeleton() {
  return (
    <div className="fixed bottom-4 right-4 p-4 bg-background border rounded-lg shadow-lg" aria-hidden="true" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-4 rounded-full animate-spin" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}

// Quiz Session Skeleton
export function QuizSessionSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true" aria-busy="true">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-2 w-full" />
          <QuizQuestionSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}

// Technical Diagram Skeleton
export function TechnicalDiagramSkeleton() {
  return (
    <div className="flex items-center justify-center p-8" aria-hidden="true" aria-busy="true">
      <div className="relative">
        <Skeleton className="h-64 w-96 rounded-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-8 w-8 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  )
}

// Quiz Flow Skeleton (for the entire quiz creation flow page)
export function QuizFlowSkeleton() {
  return (
    <div className="min-h-screen bg-paper" aria-hidden="true" aria-busy="true">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-24" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <QuizGenerationSkeleton />
        </div>
      </div>
    </div>
  )
}

// Add shimmer animation styles
export const shimmerStyles = `
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  
  @media (prefers-reduced-motion: reduce) {
    .animate-shimmer {
      animation: none;
    }
  }
`