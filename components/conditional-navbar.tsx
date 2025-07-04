'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './navbar'

export function ConditionalNavbar() {
  const pathname = usePathname()
  
  // Don't show navbar on homepage
  if (pathname === '/') {
    return null
  }
  
  return (
    <>
      <Navbar />
      {/* Add padding to account for fixed navbar height */}
      <div className="h-[57px]" />
    </>
  )
}