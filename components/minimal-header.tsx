'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { GenerationModal } from '@/components/generation-modal'
import { Button } from '@/components/ui/button'
import { ChevronDown, Settings, LogOut, User, Sparkles } from 'lucide-react'
import type { Doc } from '@/convex/_generated/dataModel'

export function MinimalHeader() {
  const [generateOpen, setGenerateOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<Doc<"questions"> | undefined>(undefined)
  const [reviewQuestion, setReviewQuestion] = useState<Doc<"questions"> | undefined>(undefined)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { user, isLoading, signOut } = useAuth()
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
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
      if (user) {
        const customEvent = event as CustomEvent
        setCurrentQuestion(customEvent.detail?.currentQuestion || reviewQuestion)
        setGenerateOpen(true)
      }
    }
    
    window.addEventListener('open-generation-modal', handleOpenGenerationModal)
    return () => window.removeEventListener('open-generation-modal', handleOpenGenerationModal)
  }, [user, reviewQuestion])
  
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
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentQuestion(reviewQuestion)
                  setGenerateOpen(true)
                }}
                className="relative"
                title="Generate questions (G)"
              >
                <Sparkles className="h-4 w-4" />
                <span className="sr-only">Generate questions</span>
              </Button>
            )}
            
            {isLoading ? (
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  aria-label="User menu"
                >
                  <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                  <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg border border-gray-100 py-1">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.name || 'User'}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    
                    <button
                      onClick={() => {
                        setDropdownOpen(false)
                        signOut()
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : null}
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