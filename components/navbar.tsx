'use client'

import Link from 'next/link'
import { useUser, UserButton } from '@clerk/nextjs'
import { getNavbarClassName } from '@/lib/layout-mode'
import { Settings } from 'lucide-react'

export function Navbar() {
  const { isLoaded, isSignedIn } = useUser()
  
  // Hide navbar completely when unauthenticated
  if (!isSignedIn && isLoaded) return null
  
  return (
    <nav className={`${getNavbarClassName()} bg-white/80 backdrop-blur-sm border-b border-gray-100`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 flex items-center justify-between">
        <Link href="/" className="text-xl md:text-2xl font-semibold tracking-tight text-gray-700 hover:text-black border-b-0 transition-colors">
          Scry.
        </Link>
        
        <div className="flex items-center gap-4">
          {isSignedIn && (
            <>
              <Link 
                href="/settings" 
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <UserButton afterSignOutUrl="/" />
            </>
          )}
        </div>
      </div>
    </nav>
  )
}