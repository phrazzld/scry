'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Navbar } from './navbar'
import { MinimalHeader } from './minimal-header'

export function ConditionalNavbar() {
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useUser()
  
  // Hide navbar on homepage for unauthenticated users
  if (pathname === '/' && !isSignedIn && isLoaded) {
    return null
  }
  
  // Show minimal header on homepage for authenticated users
  if (pathname === '/') {
    return <MinimalHeader />
  }
  
  // Show full navbar on all other pages
  return <Navbar />
}