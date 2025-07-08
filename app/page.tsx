'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { TopicInput } from '@/components/topic-input'
import { AuthModal } from '@/components/auth/auth-modal'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'
import { trackAuthPagePerformance } from '@/lib/auth-analytics'

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const { data: session, status } = useSession()

  // Track auth-related page performance
  useEffect(() => {
    trackAuthPagePerformance('homepage')
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Subtle header with sign-in option */}
      <header className="absolute top-0 right-0 p-8 md:p-16">
        {status !== "loading" && !session && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setAuthModalOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <User className="h-4 w-4 mr-2" />
            Sign in
          </Button>
        )}
      </header>

      <main className="flex-grow flex items-center">
        <div className="w-full max-w-7xl mx-auto px-8 md:px-16">
          <div className="max-w-xl">
            <h1 className="text-6xl md:text-7xl font-bold mb-4 tracking-tight">
              Scry.
            </h1>
            <p className="text-2xl md:text-3xl font-light mb-12 text-gray-700">
              Remember everything.
            </p>
            <TopicInput />
          </div>
        </div>
      </main>

      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen} 
      />
    </div>
  )
}