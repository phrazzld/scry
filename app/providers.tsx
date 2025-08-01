'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { AuthProvider } from '@/contexts/auth-context'
import { ConvexErrorBoundary } from '@/components/convex-error-boundary'
import { getConvexUrl } from '@/lib/convex-url'

const convex = new ConvexReactClient(getConvexUrl())

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexErrorBoundary>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ConvexErrorBoundary>
    </ConvexProvider>
  )
}