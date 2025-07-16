'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { verifyMagicLink } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(true)

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setError('Invalid magic link. Please request a new one.')
      setIsVerifying(false)
      return
    }

    const verify = async () => {
      try {
        const result = await verifyMagicLink(token)
        if (!result.success) {
          setError('Invalid or expired magic link. Please request a new one.')
          setIsVerifying(false)
        }
        // Success case is handled by AuthContext which redirects to dashboard
      } catch {
        setError('Something went wrong. Please try again.')
        setIsVerifying(false)
      }
    }

    verify()
  }, [searchParams, verifyMagicLink])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-4">
        {isVerifying ? (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Verifying your magic link...</h1>
            <p className="text-gray-600">Please wait while we sign you in.</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="text-center">
              <button
                onClick={() => router.push('/')}
                className="text-blue-600 hover:underline"
              >
                Return to home
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}