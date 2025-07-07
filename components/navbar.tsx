'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { AuthModal } from '@/components/auth/auth-modal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, BookOpen, Settings, LogOut } from 'lucide-react'

export function Navbar() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  
  const { data: session, status } = useSession()
  
  // Handle OAuth success/error detection (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const urlParams = new URLSearchParams(window.location.search)
    const hasOAuthCallback = urlParams.get('code') || 
                            urlParams.get('state') || 
                            window.location.href.includes('/api/auth/callback/')
    
    // Handle OAuth errors (when user is redirected back with error parameter)
    const oauthError = urlParams.get('error')
    if (oauthError && sessionStorage.getItem('auth-flow') === 'oauth') {
      sessionStorage.removeItem('auth-flow')
      
      let errorMessage = 'Authentication failed'
      let errorDescription = 'Please try again or use another method.'
      
      switch (oauthError) {
        case 'access_denied':
          errorMessage = 'Access denied'
          errorDescription = 'You cancelled the authentication process.'
          break
        case 'oauth_error':
          errorMessage = 'OAuth error'
          errorDescription = 'There was an issue with the OAuth provider.'
          break
        case 'configuration_error':
          errorMessage = 'Configuration error'
          errorDescription = 'OAuth provider is not configured correctly.'
          break
        default:
          errorDescription = `Error: ${oauthError}. Please try again.`
      }
      
      toast.error(errorMessage, {
        description: errorDescription
      })
      
      // Clean up error parameter from URL
      if (window.history.replaceState) {
        const url = new URL(window.location.href)
        url.searchParams.delete('error')
        url.searchParams.delete('error_description')
        window.history.replaceState({}, '', url.toString())
      }
      return
    }
    
    // Handle OAuth success
    if (status === 'authenticated' && session) {
      const justSignedIn = sessionStorage.getItem('auth-flow') === 'oauth'
      
      if (hasOAuthCallback || justSignedIn) {
        toast.success('Welcome back!', {
          description: `Successfully signed in as ${session.user?.name || session.user?.email}`
        })
        
        // Clean up session storage flag
        sessionStorage.removeItem('auth-flow')
        
        // Clean up URL parameters if they exist
        if (hasOAuthCallback && window.history.replaceState) {
          const url = new URL(window.location.href)
          url.searchParams.delete('code')
          url.searchParams.delete('state')
          url.searchParams.delete('session_state')
          window.history.replaceState({}, '', url.toString())
        }
      }
    }
  }, [status, session])
  
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="px-8 md:px-16 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold font-mono text-black hover:text-black border-b-0 transition-none">
            scry
          </Link>
          
          <div className="flex items-center gap-4">
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user?.image || undefined} alt={session.user?.name || 'User'} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" forceMount loop>
                  <div className="flex items-center justify-start gap-3 p-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={session.user?.image || undefined} alt={session.user?.name || 'User'} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1 leading-none min-w-0 flex-1">
                      {session.user?.name && (
                        <p className="font-medium text-sm truncate">{session.user.name}</p>
                      )}
                      {session.user?.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {session.user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 px-3 py-2">
                      <User className="h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/quizzes" className="flex items-center gap-2 px-3 py-2">
                      <BookOpen className="h-4 w-4" />
                      <span>My Quizzes</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2 px-3 py-2">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 focus:text-red-600 focus:bg-red-50 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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