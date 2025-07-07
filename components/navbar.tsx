'use client'

import Link from 'next/link'
import { useState } from 'react'
// import { useSession } from 'next-auth/react' // TODO: Uncomment once SessionProvider is set up
import { AuthModal } from '@/components/auth/auth-modal'
import { Button } from '@/components/ui/button'
// TODO: Uncomment these imports once SessionProvider is set up
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu'
// import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
// import { User, BookOpen, Settings, LogOut } from 'lucide-react'
// import { signOut } from 'next-auth/react'

export function Navbar() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  
  // TODO: Enable this once SessionProvider is set up in layout.tsx
  // const { data: session, status } = useSession()
  
  // For now, we'll just show the sign in button
  // This will be updated to use session once SessionProvider is configured
  
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="px-8 md:px-16 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold font-mono text-black hover:text-black border-b-0 transition-none">
            scry
          </Link>
          
          <div className="flex items-center gap-4">
            {/* TODO: Enable this once SessionProvider is configured
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
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      {session.user?.name && (
                        <p className="font-medium">{session.user.name}</p>
                      )}
                      {session.user?.email && (
                        <p className="w-[200px] truncate text-sm text-muted-foreground">
                          {session.user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/quizzes" className="flex items-center">
                      <BookOpen className="mr-2 h-4 w-4" />
                      <span>My Quizzes</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => signOut()}
                    className="flex items-center text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : ( */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setAuthModalOpen(true)}
              >
                Sign in
              </Button>
            {/* )} */}
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