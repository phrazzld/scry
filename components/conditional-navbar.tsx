'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Navbar } from './navbar'
import { MinimalHeader } from './minimal-header'

export function ConditionalNavbar() {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  
  // Hide navbar on homepage for unauthenticated users
  if (pathname === '/' && !user && !isLoading) {
    return null
  }
  
  // Show minimal header on homepage for authenticated users
  if (pathname === '/') {
    return <MinimalHeader />
  }
  
  // Show full navbar on all other pages (including /auth/verify)
  return <Navbar />
}