'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import { Navbar } from './navbar';

export function ConditionalNavbar() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();

  // Hide navbar on homepage for unauthenticated users
  if (pathname === '/' && !isSignedIn && isLoaded) {
    return null;
  }

  // Show unified navbar on all pages
  return <Navbar />;
}
