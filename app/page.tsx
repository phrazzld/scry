'use client'

import { Suspense, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { TopicInput } from '@/components/topic-input'
import { AuthModal } from '@/components/auth/auth-modal'
import { Button } from '@/components/ui/button'
import { User, LayoutDashboard, LogOut } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function HomeContent() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const { isAuthenticated, isLoading, user, signOut } = useAuth()
  const searchParams = useSearchParams()

  // Check if auth is required from URL params
  const fromPath = searchParams.get('from')
  
  useEffect(() => {
    if (searchParams.get('auth') === 'required' && !isAuthenticated && !isLoading) {
      setAuthModalOpen(true)
    }
  }, [searchParams, isAuthenticated, isLoading])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header with auth options */}
      <header className="absolute top-0 right-0 p-4 sm:p-8 md:p-16">
        {!isLoading && (
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated && user ? (
              <>
                <div className="hidden sm:block text-sm text-gray-600 mr-2">
                  Welcome, <span className="font-medium text-gray-900">{user.name || user.email.split('@')[0]}</span>
                </div>
                <Link href="/dashboard">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-gray-700 hover:text-gray-900"
                  >
                    <LayoutDashboard className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => signOut()}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
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
          </div>
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
            {isAuthenticated && !isLoading && (
              <div className="mt-8 text-sm text-gray-600">
                <p>
                  Continue learning or{' '}
                  <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 hover:opacity-80 transition-opacity">
                    view your progress
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen}
        redirectTo={fromPath}
      />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  )
}