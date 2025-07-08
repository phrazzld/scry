'use client'

import { track } from '@vercel/analytics'
import { useEffect, useRef } from 'react'

export interface AuthStepDuration {
  modalOpen?: number
  formSubmission?: number
  providerRedirect?: number
  emailSent?: number
}

export interface AuthPerformanceMetrics {
  authMethod: 'email' | 'google' | 'github'
  startTime: number
  endTime?: number
  success: boolean
  error?: string
  stepDuration: AuthStepDuration
}

class AuthPerformanceTracker {
  private activeTracking = new Map<string, AuthPerformanceMetrics>()
  
  startAuthFlow(method: 'email' | 'google' | 'github', sessionId: string = 'default') {
    const startTime = performance.now()
    
    this.activeTracking.set(sessionId, {
      authMethod: method,
      startTime,
      success: false,
      stepDuration: {}
    })
    
    // Track auth flow initiation
    track('auth_flow_started', {
      method,
      timestamp: Date.now()
    })
  }
  
  markStep(step: keyof AuthStepDuration, sessionId: string = 'default') {
    const tracking = this.activeTracking.get(sessionId)
    if (!tracking) return
    
    const stepTime = performance.now() - tracking.startTime
    tracking.stepDuration[step] = stepTime
    
    // Track individual step performance
    track('auth_step_completed', {
      method: tracking.authMethod,
      step,
      duration: Math.round(stepTime),
      timestamp: Date.now()
    })
  }
  
  completeAuthFlow(success: boolean, error?: string, sessionId: string = 'default') {
    const tracking = this.activeTracking.get(sessionId)
    if (!tracking) return
    
    const endTime = performance.now()
    const totalDuration = endTime - tracking.startTime
    
    tracking.endTime = endTime
    tracking.success = success
    tracking.error = error
    
    // Track auth flow completion with performance data
    const completionData: Record<string, string | number | boolean> = {
      method: tracking.authMethod,
      success,
      duration: Math.round(totalDuration),
      timestamp: Date.now()
    }
    
    // Add step durations as individual properties
    Object.entries(tracking.stepDuration).forEach(([step, duration]) => {
      if (duration !== undefined) {
        completionData[`step_${step}`] = Math.round(duration)
      }
    })
    
    if (error) {
      completionData.error = error
    }
    
    track('auth_flow_completed', completionData)
    
    // Clean up
    this.activeTracking.delete(sessionId)
  }
  
  trackModalOpen() {
    track('auth_modal_opened', {
      timestamp: Date.now()
    })
  }
  
  trackModalClose(reason: 'user_action' | 'success' | 'error') {
    track('auth_modal_closed', {
      reason,
      timestamp: Date.now()
    })
  }
}

// Singleton instance
export const authTracker = new AuthPerformanceTracker()

// Hook for easy usage in components
export function useAuthPerformanceTracking() {
  const sessionRef = useRef<string | undefined>(undefined)
  
  useEffect(() => {
    // Generate unique session ID for this component instance
    sessionRef.current = `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])
  
  return {
    startTracking: (method: 'email' | 'google' | 'github') => {
      if (sessionRef.current) {
        authTracker.startAuthFlow(method, sessionRef.current)
      }
    },
    markStep: (step: keyof AuthPerformanceMetrics['stepDuration']) => {
      if (sessionRef.current) {
        authTracker.markStep(step, sessionRef.current)
      }
    },
    completeTracking: (success: boolean, error?: string) => {
      if (sessionRef.current) {
        authTracker.completeAuthFlow(success, error, sessionRef.current)
      }
    },
    trackModalOpen: authTracker.trackModalOpen,
    trackModalClose: authTracker.trackModalClose
  }
}

// Utility function for tracking auth-related page performance
export function trackAuthPagePerformance(pageName: string) {
  // Track Core Web Vitals specifically for auth pages
  if (typeof window !== 'undefined') {
    track('auth_page_loaded', {
      page: pageName,
      timestamp: Date.now(),
      // Add basic performance timing
      domContentLoaded: performance.timing?.domContentLoadedEventEnd - performance.timing?.navigationStart,
      loadComplete: performance.timing?.loadEventEnd - performance.timing?.navigationStart
    })
  }
}