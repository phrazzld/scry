'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { systemLogger } from '@/lib/logger'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    systemLogger.error({
      event: 'app.unhandled-error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    }, `Unhandled application error: ${error.message}`)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-error mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">
          We encountered an error while processing your request.
        </p>
        <div className="space-x-4">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}