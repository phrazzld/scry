'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import { getNavbarClassName } from '@/lib/layout-mode'
import { GenerationModal } from '@/components/generation-modal'
import { Button } from '@/components/ui/button'
import { Settings, Sparkles } from 'lucide-react'
import type { Doc } from '@/convex/_generated/dataModel'

export function Navbar() {
  const { isLoaded, isSignedIn } = useUser()
  const pathname = usePathname()
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

  const isHomepage = pathname === '/'

  // Hide navbar completely when unauthenticated
  if (!isSignedIn && isLoaded) return null

  return (
    <>
      <nav className={`${getNavbarClassName()} h-16 bg-white/80 backdrop-blur-sm border-b border-gray-100`}>
        <div className="h-full max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-semibold tracking-tight text-gray-700 hover:text-black border-b-0 transition-colors">
            Scry.
          </Link>

          <div className="flex items-center gap-4">
            {isSignedIn && (
              <>
                {isHomepage ? (
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
                ) : (
                  <Link
                    href="/settings"
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                )}
                <UserButton afterSignOutUrl="/" />
              </>
            )}
          </div>
        </div>
      </nav>

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