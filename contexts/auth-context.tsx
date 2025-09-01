'use client'

import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setClientSessionCookie, removeClientSessionCookie, getSessionCookie } from '@/lib/auth-cookies'
import { getClientEnvironment } from '@/lib/environment-client'
import { safeStorage } from '@/lib/storage'

const SESSION_TOKEN_KEY = 'scry_session_token'

interface User {
  id: string
  email: string
  name?: string
  image?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  sessionToken: string | null
  sendMagicLink: (email: string) => Promise<{ success: boolean; error?: Error }>
  verifyMagicLink: (token: string) => Promise<{ success: boolean; error?: Error }>
  signOut: () => Promise<void>
  updateProfile: (data: { name: string; email: string; image?: string | null }) => Promise<{ success: boolean; error?: Error }>
  deleteAccount: (confirmationEmail: string) => Promise<{ success: boolean; error?: Error }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Get current user from Convex with environment context
  const environment = getClientEnvironment()
  const user = useQuery(api.auth.getCurrentUser, { 
    sessionToken: sessionToken || undefined,
    environment 
  })
  
  // Mutations
  const verifyMagicLinkMutation = useMutation(api.auth.verifyMagicLink)
  const signOutMutation = useMutation(api.auth.signOut)
  const updateProfileMutation = useMutation(api.auth.updateProfile)
  const deleteAccountMutation = useMutation(api.auth.deleteAccount)

  // Load session token from storage on mount
  useEffect(() => {
    // Try to get token from localStorage first, then cookies
    const localToken = safeStorage.getItem(SESSION_TOKEN_KEY)
    const cookieToken = getSessionCookie()
    const token = localToken || cookieToken
    
    if (token) {
      setSessionToken(token)
      // Ensure both storage methods have the token
      if (!localToken && cookieToken) {
        safeStorage.setItem(SESSION_TOKEN_KEY, cookieToken)
      }
      if (!cookieToken && localToken) {
        setClientSessionCookie(localToken)
      }
    }
    setIsLoading(false)
  }, [])

  // Send magic link
  const sendMagicLink = useCallback(async (email: string) => {
    try {
      // Use API endpoint instead of direct Convex mutation to handle deployment URLs
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send magic link')
      }

      const result = await response.json()
      if (result.success) {
        toast.success('Check your email for the magic link!')
        return { success: true }
      }
      return { success: false }
    } catch (error) {
      console.error('Failed to send magic link:', error)
      toast.error('Failed to send magic link. Please try again.')
      return { success: false, error: error instanceof Error ? error : new Error('Unknown error') }
    }
  }, [])

  // Verify magic link and sign in
  const verifyMagicLink = useCallback(async (token: string) => {
    try {
      const result = await verifyMagicLinkMutation({ token })
      if (result.success && result.sessionToken) {
        // Store session token in both localStorage and cookies
        safeStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken)
        setClientSessionCookie(result.sessionToken)
        setSessionToken(result.sessionToken)
        
        toast.success('Successfully signed in!')
        
        // Check if there's a redirect URL
        const urlParams = new URLSearchParams(window.location.search)
        const fromPath = urlParams.get('from')
        
        if (fromPath) {
          router.push(fromPath)
        } else {
          router.push('/')
        }
        return { success: true }
      }
      return { success: false }
    } catch (error) {
      console.error('Failed to verify magic link:', error)
      toast.error('Invalid or expired magic link')
      return { success: false, error: error instanceof Error ? error : new Error('Unknown error') }
    }
  }, [verifyMagicLinkMutation, router])

  // Sign out
  const signOut = useCallback(async () => {
    if (!sessionToken) return

    try {
      await signOutMutation({ sessionToken })
      
      // Clear session from both localStorage and cookies
      safeStorage.removeItem(SESSION_TOKEN_KEY)
      removeClientSessionCookie()
      setSessionToken(null)
      
      toast.success('Signed out successfully')
      router.push('/')
    } catch (error) {
      console.error('Failed to sign out:', error)
      toast.error('Failed to sign out')
    }
  }, [sessionToken, signOutMutation, router])

  // Update profile
  const updateProfile = useCallback(async (data: { name: string; email: string; image?: string | null }) => {
    if (!sessionToken) {
      toast.error('You must be signed in to update your profile')
      return { success: false, error: new Error('Not authenticated') }
    }

    try {
      const result = await updateProfileMutation({
        sessionToken,
        name: data.name,
        email: data.email,
        image: data.image
      })
      
      if (result.success) {
        toast.success('Profile updated successfully')
        return { success: true }
      }
      
      return { success: false }
    } catch (error) {
      console.error('Failed to update profile:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
      toast.error(errorMessage)
      return { success: false, error: error instanceof Error ? error : new Error(errorMessage) }
    }
  }, [sessionToken, updateProfileMutation])

  // Delete account
  const deleteAccount = useCallback(async (confirmationEmail: string) => {
    if (!sessionToken) {
      toast.error('You must be signed in to delete your account')
      return { success: false, error: new Error('Not authenticated') }
    }

    try {
      const result = await deleteAccountMutation({
        sessionToken,
        confirmationEmail
      })
      
      if (result.success) {
        // Clear session from both localStorage and cookies
        safeStorage.removeItem(SESSION_TOKEN_KEY)
        removeClientSessionCookie()
        setSessionToken(null)
        
        toast.success('Account deleted successfully')
        router.push('/')
        return { success: true }
      }
      
      return { success: false }
    } catch (error) {
      console.error('Failed to delete account:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete account'
      toast.error(errorMessage)
      return { success: false, error: error instanceof Error ? error : new Error(errorMessage) }
    }
  }, [sessionToken, deleteAccountMutation, router])

  // Combine loading states: initial load and query loading
  const isActuallyLoading = isLoading || (sessionToken !== null && user === undefined)
  
  const value: AuthContextType = {
    user: user as User | null,
    isLoading: isActuallyLoading,
    isAuthenticated: !!user,
    sessionToken,
    sendMagicLink,
    verifyMagicLink,
    signOut,
    updateProfile,
    deleteAccount,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}