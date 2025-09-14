'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { GenerationModal } from '@/components/generation-modal'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import type { Doc } from '@/convex/_generated/dataModel'

export function MinimalHeader() {
  const [generateOpen, setGenerateOpen] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<Doc<"questions"> | undefined>(undefined)
  const [reviewQuestion, setReviewQuestion] = useState<Doc<"questions"> | undefined>(undefined)
  
  
  // Listen for review question changes
  useEffect(() => {
    const handleReviewQuestionChanged = (event: Event) => {
      const customEvent = event as CustomEvent
      setReviewQuestion(customEvent.detail?.question || undefined)
    }
    
    window.addEventListener('review-question-changed', handleReviewQuestionChanged)
    return () => window.removeEventListener('review-question-changed', handleReviewQuestionChanged)
  }, [])
  
  // Listen for keyboard shortcut to open generation modal
  useEffect(() => {
    const handleOpenGenerationModal = (event: Event) => {
      const customEvent = event as CustomEvent
      setCurrentQuestion(customEvent.detail?.currentQuestion || reviewQuestion)
      setGenerateOpen(true)
    }
    
    window.addEventListener('open-generation-modal', handleOpenGenerationModal)
    return () => window.removeEventListener('open-generation-modal', handleOpenGenerationModal)
  }, [reviewQuestion])
  
  // Pulse animation could be triggered by watching dueCount changes via Convex
  // For now, removing the manual event system
  
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <Link 
            href="/" 
            className="text-xl font-semibold tracking-tight text-gray-700 hover:text-black transition-colors"
          >
            Scry
          </Link>
          
          <div className="flex items-center gap-2">
            <SignedIn>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentQuestion(reviewQuestion)
                  setGenerateOpen(true)
                }}
                title="Generate questions (G)"
              >
                <Sparkles className="h-4 w-4" />
                <span className="sr-only">Generate questions</span>
              </Button>
            </SignedIn>
            
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">Sign In</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>
      
      <GenerationModal
        open={generateOpen}
        onOpenChange={(open) => {
          setGenerateOpen(open)
          if (!open) {
            setCurrentQuestion(undefined) // Clear context when modal closes
          }
        }}
        currentQuestion={currentQuestion}
      />
    </>
  )
}