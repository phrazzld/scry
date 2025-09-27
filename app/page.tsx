import { ReviewFlow } from '@/components/review-flow'
import { ReviewErrorBoundary } from '@/components/review/review-error-boundary'

export default function Home() {
  return (
    <ReviewErrorBoundary
      fallbackMessage="Unable to load the review session. Please refresh to try again."
      onReset={() => {
        // Optional: Clear any cached state or perform cleanup
        if (typeof window !== 'undefined') {
          window.location.href = '/'
        }
      }}
    >
      <ReviewFlow />
    </ReviewErrorBoundary>
  )
}