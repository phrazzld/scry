'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './navbar'
import { MinimalHeader } from './minimal-header'

export function ConditionalNavbar() {
  const pathname = usePathname()
  
  // Show minimal header on homepage, full navbar elsewhere
  if (pathname === '/') {
    return <MinimalHeader />
  }
  
  return <Navbar />
}