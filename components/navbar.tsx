'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import { getNavbarClassName } from '@/lib/layout-mode'
import { GenerationModal } from '@/components/generation-modal'
import { Button } from '@/components/ui/button'
import { Plus, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Doc } from '@/convex/_generated/dataModel'
import { useClerkAppearance } from '@/hooks/use-clerk-appearance'

export function Navbar() {
  const { isLoaded, isSignedIn } = useUser()
  const clerkAppearance = useClerkAppearance()
  const pathname = usePathname()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<Doc<"questions"> | undefined>(undefined)
  const [reviewQuestion, setReviewQuestion] = useState<Doc<"questions"> | undefined>(undefined)

  // Listen for current question changes using universal event
  useEffect(() => {
    const handleCurrentQuestionChanged = (event: Event) => {
      const customEvent = event as CustomEvent
      setReviewQuestion(customEvent.detail?.question || undefined)
    }

    window.addEventListener('current-question-changed', handleCurrentQuestionChanged)
    return () => window.removeEventListener('current-question-changed', handleCurrentQuestionChanged)
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
      <nav className={`${getNavbarClassName()} h-16 bg-background/80 backdrop-blur-sm border-b border-border`}>
        <div className="h-full max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-semibold tracking-tight text-foreground/80 hover:text-foreground border-b-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
            Scry.
          </Link>

          <div className="flex items-center gap-4">
            {isSignedIn && (
              <>
                {isHomepage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative size-9 rounded-full bg-accent/50 text-muted-foreground transition-all duration-200 hover:bg-accent/70 hover:text-foreground hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                    onClick={() => {
                      setCurrentQuestion(reviewQuestion)
                      setGenerateOpen(true)
                    }}
                    title="Generate questions (G)"
                  >
                    <Plus className="relative h-4 w-4" />
                    <span className="sr-only">Generate questions</span>
                  </Button>
                ) : (
                  <Link
                    href="/settings"
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                )}
                <ThemeToggle />
                <UserButton afterSignOutUrl="/" appearance={clerkAppearance} />
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
        onGenerationSuccess={() => {
          // Dispatch event to trigger review if on homepage
          if (pathname === '/') {
            window.dispatchEvent(new CustomEvent('start-review-after-generation'));
          }
        }}
      />
    </>
  )
}
