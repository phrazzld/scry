"use client"

import { useState, useEffect, ReactNode } from 'react'

interface DelayedSkeletonProps {
  isLoading: boolean
  delay?: number
  skeleton: ReactNode
  children: ReactNode
}

/**
 * A wrapper component that prevents flash of skeleton on fast loads.
 * Only shows skeleton if loading takes longer than the delay threshold.
 */
export function DelayedSkeleton({
  isLoading,
  delay = 300,
  skeleton,
  children
}: DelayedSkeletonProps) {
  const [showSkeleton, setShowSkeleton] = useState(false)

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowSkeleton(true)
      }, delay)

      return () => clearTimeout(timer)
    } else {
      setShowSkeleton(false)
    }
  }, [isLoading, delay])

  if (isLoading && showSkeleton) {
    return <>{skeleton}</>
  }

  return <>{children}</>
}