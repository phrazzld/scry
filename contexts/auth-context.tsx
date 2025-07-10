'use client'

import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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

  // Get current user from Convex
  const user = useQuery(api.auth.getCurrentUser, { sessionToken: sessionToken || undefined })
  
  // Mutations
  const sendMagicLinkMutation = useMutation(api.auth.sendMagicLink)
  const verifyMagicLinkMutation = useMutation(api.auth.verifyMagicLink)
  const signOutMutation = useMutation(api.auth.signOut)
  // TODO: Enable when these mutations are added to Convex
  // const updateProfileMutation = useMutation(api.auth.updateProfile)
  // const deleteAccountMutation = useMutation(api.auth.deleteAccount)

  // Load session token from storage on mount
  useEffect(() => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (token) {
      setSessionToken(token)
    }
    setIsLoading(false)
  }, [])

  // Send magic link
  const sendMagicLink = useCallback(async (email: string) => {
    try {
      const result = await sendMagicLinkMutation({ email })
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
  }, [sendMagicLinkMutation])

  // Verify magic link and sign in
  const verifyMagicLink = useCallback(async (token: string) => {
    try {
      const result = await verifyMagicLinkMutation({ token })
      if (result.success && result.sessionToken) {
        // Store session token
        localStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken)
        setSessionToken(result.sessionToken)
        
        toast.success('Successfully signed in!')
        router.push('/dashboard')
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
      
      // Clear session
      localStorage.removeItem(SESSION_TOKEN_KEY)
      setSessionToken(null)
      
      toast.success('Signed out successfully')
      router.push('/')
    } catch (error) {
      console.error('Failed to sign out:', error)
      toast.error('Failed to sign out')
    }
  }, [sessionToken, signOutMutation, router])

  // Update profile
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateProfile = useCallback(async (_data: { name: string; email: string; image?: string | null }) => {
    // TODO: Implement when updateProfile mutation is added to Convex
    console.warn('Profile update not yet implemented')
    toast.error('Profile update not yet implemented')
    return { 
      success: false, 
      error: new Error('Profile update not yet implemented') 
    }
  }, [])

  // Delete account
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const deleteAccount = useCallback(async (_confirmationEmail: string) => {
    // TODO: Implement when deleteAccount mutation is added to Convex
    console.warn('Account deletion not yet implemented')
    toast.error('Account deletion not yet implemented')
    return { 
      success: false, 
      error: new Error('Account deletion not yet implemented') 
    }
  }, [])

  const value: AuthContextType = {
    user: user as User | null,
    isLoading,
    isAuthenticated: !!user,
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