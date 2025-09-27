'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { Doc } from '@/convex/_generated/dataModel'

interface CurrentQuestionContextType {
  currentQuestion: Doc<"questions"> | undefined
  setCurrentQuestion: (question: Doc<"questions"> | undefined) => void
  clearCurrentQuestion: () => void
}

const CurrentQuestionContext = createContext<CurrentQuestionContextType | undefined>(undefined)

interface CurrentQuestionProviderProps {
  children: ReactNode
}

/**
 * Provider component for managing the current question context
 * Replaces DOM events with React Context for better performance and type safety
 */
export function CurrentQuestionProvider({ children }: CurrentQuestionProviderProps) {
  const [currentQuestion, setCurrentQuestionState] = useState<Doc<"questions"> | undefined>(undefined)

  const setCurrentQuestion = useCallback((question: Doc<"questions"> | undefined) => {
    setCurrentQuestionState(question)
  }, [])

  const clearCurrentQuestion = useCallback(() => {
    setCurrentQuestionState(undefined)
  }, [])

  return (
    <CurrentQuestionContext.Provider
      value={{
        currentQuestion,
        setCurrentQuestion,
        clearCurrentQuestion
      }}
    >
      {children}
    </CurrentQuestionContext.Provider>
  )
}

/**
 * Hook to access the current question context
 * Throws an error if used outside of CurrentQuestionProvider
 */
export function useCurrentQuestion() {
  const context = useContext(CurrentQuestionContext)
  if (context === undefined) {
    throw new Error('useCurrentQuestion must be used within a CurrentQuestionProvider')
  }
  return context
}