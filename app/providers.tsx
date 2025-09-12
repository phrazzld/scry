'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { AuthProvider } from '@/contexts/auth-context'
import { ConvexErrorBoundary } from '@/components/convex-error-boundary'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

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