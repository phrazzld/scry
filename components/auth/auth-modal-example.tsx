'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AuthModal } from './auth-modal'

// Example usage of AuthModal - to be integrated into navbar
export function AuthModalExample() {
  const [open, setOpen] = useState(false)
  
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        Sign In
      </Button>
      <AuthModal open={open} onOpenChange={setOpen} />
    </>
  )
}