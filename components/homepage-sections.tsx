'use client'

// Client component for homepage sections that need dynamic imports
import dynamic from 'next/dynamic'
import { TechnicalDiagramSkeleton } from '@/components/ui/loading-skeletons'

// Dynamic import for technical diagram (client-side only)
const SpacedRepetitionDiagram = dynamic(() => import('@/components/technical-diagram').then(mod => ({ default: mod.SpacedRepetitionDiagram })), {
  loading: () => <TechnicalDiagramSkeleton />,
  ssr: false // Visual diagram doesn't need SSR
})

export function TechnicalDiagramSection() {
  return (
    <section className="mb-16">
      <SpacedRepetitionDiagram />
      <p className="text-center mt-6 text-sm text-muted-foreground font-mono">
        FIG 1.1 - THE FORGETTING CURVE WITH SPACED REPETITION
      </p>
    </section>
  )
}