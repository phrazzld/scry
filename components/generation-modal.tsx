'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
// Clerk authentication handled via middleware
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Doc } from '@/convex/_generated/dataModel'

interface GenerationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentQuestion?: Doc<"questions">
}

/**
 * Modal component for generating new quiz questions using AI
 * 
 * Features:
 * - AI-powered question generation from custom prompts
 * - Context-aware generation based on current question
 * - Success toast with question count and topic
 * - Event dispatch for real-time UI updates
 * 
 * @param open - Whether the modal is open
 * @param onOpenChange - Callback to handle modal open/close state changes
 * @param currentQuestion - Optional current question for context-aware generation
 */
export function GenerationModal({ 
  open, 
  onOpenChange, 
  currentQuestion 
}: GenerationModalProps) {
  const [prompt, setPrompt] = React.useState('')
  const [useCurrentContext, setUseCurrentContext] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Reset state when modal closes, or set smart defaults when opening with context
  React.useEffect(() => {
    if (!open) {
      // Clear prompt when modal closes
      setPrompt('')
      setUseCurrentContext(false)
    } else {
      // If we have a current question context, set smart defaults
      if (currentQuestion) {
        setUseCurrentContext(true)
        setPrompt('Generate 5 similar questions')
      }
      
      // Auto-focus on open
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 0)
    }
  }, [open, currentQuestion])

  // Auto-resize textarea as content grows
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px` // Max ~10 rows
    }
  }, [prompt])

  // Helper to truncate text
  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setIsGenerating(true)

    try {
      // Construct the final prompt
      let finalPrompt = prompt
      if (useCurrentContext && currentQuestion) {
        finalPrompt = `Based on: ${currentQuestion.question}. ${prompt}`
      }

      // Calculate user performance metrics (placeholder for now)
      // TODO: Fetch actual metrics from recent interactions
      const userContext = {
        successRate: 0.75, // Placeholder: 75% success rate
        avgTime: 30000, // Placeholder: 30 seconds average
        recentTopics: [], // Could include recent topics
      }

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: finalPrompt,
          difficulty: 'medium',
          userContext, // Include performance metrics
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to generate questions')
      }

      const result = await response.json()
      const count = result.savedCount || result.questions?.length || 0
      const topic = result.topic || finalPrompt
      
      // Enhanced toast with count and topic
      toast.success(`✓ ${count} questions generated`, {
        description: topic,
        duration: 4000,
      })
      
      // No need for custom events - Convex handles real-time updates automatically!
      
      onOpenChange(false) // Close modal on success
    } catch (error) {
      console.error('Generation error:', error)
      toast.error('Failed to generate questions. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Generate Questions</DialogTitle>
          <DialogDescription>
            Create new questions to expand your learning material
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'React hooks', 'Similar but harder', 'Python decorators explained'"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minHeight: '72px' }} // Min ~3 rows
              disabled={isGenerating}
            />
          </div>
          
          {currentQuestion && (
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCurrentContext}
                  onChange={(e) => setUseCurrentContext(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  disabled={isGenerating}
                />
                <span className="text-sm font-medium">Start from current question</span>
              </label>
              
              {useCurrentContext && (
                <div className="ml-6 p-2 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Current question:</p>
                  <p className="text-sm mt-1">{truncate(currentQuestion.question, 50)}</p>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!prompt.trim() || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Questions'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}