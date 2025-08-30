'use client'

import * as React from 'react'

interface LiveRegionProps {
  children: React.ReactNode
  /**
   * The politeness level of the live region
   * - 'polite': Announcements are made when the user is idle (default)
   * - 'assertive': Announcements interrupt whatever the user is doing
   * - 'off': Turns off the live region
   */
  politeness?: 'polite' | 'assertive' | 'off'
  /**
   * Whether this is an atomic live region
   * When true, screen readers will announce the entire content when any part changes
   */
  atomic?: boolean
  className?: string
}

/**
 * Live region component for making dynamic content accessible to screen readers
 * Follows WCAG 2.1 SC 4.1.3 (Status Messages) guidelines
 */
export function LiveRegion({ 
  children, 
  politeness = 'polite', 
  atomic = false,
  className 
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className={`sr-only ${className || ''}`}
    >
      {children}
    </div>
  )
}

/**
 * Hook for managing live region announcements
 * Provides a simple way to announce messages to screen readers
 */
export function useLiveRegion() {
  const [message, setMessage] = React.useState<string>('')
  const [politeness, setPoliteness] = React.useState<'polite' | 'assertive'>('polite')

  const announce = React.useCallback((
    text: string, 
    level: 'polite' | 'assertive' = 'polite'
  ) => {
    // Clear the message first to ensure it's announced even if it's the same
    setMessage('')
    setPoliteness(level)
    
    // Use setTimeout to ensure the message is announced
    setTimeout(() => {
      setMessage(text)
    }, 100)

    // Clear the message after a delay to keep the live region clean
    setTimeout(() => {
      setMessage('')
    }, 5000)
  }, [])

  const LiveRegionComponent = React.useMemo(() => (
    <LiveRegion politeness={politeness}>
      {message}
    </LiveRegion>
  ), [message, politeness])

  return {
    announce,
    LiveRegionComponent
  }
}