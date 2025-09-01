'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { AuthModal } from '@/components/auth/auth-modal'
import { Button } from '@/components/ui/button'
import { getNavbarClassName } from '@/lib/layout-mode'
import { Settings, LogOut } from 'lucide-react'

export function Navbar() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  
  const { user, isLoading, signOut } = useAuth()
  
  // Hide navbar completely when unauthenticated
  if (!user && !isLoading) return null
  
  return (
    <>
      <nav className={`${getNavbarClassName()} bg-white/80 backdrop-blur-sm border-b border-gray-100`}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-semibold tracking-tight text-gray-700 hover:text-black border-b-0 transition-colors">
            Scry.
          </Link>
          
          <div className="flex items-center gap-4">
            {isLoading ? null : user ? (
              <>
                <Link 
                  href="/settings" 
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Link>
                <button 
                  onClick={() => signOut()}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setAuthModalOpen(true)}
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </nav>
      
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen} 
      />
    </>
  )
}