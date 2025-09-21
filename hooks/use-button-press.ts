"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Hook for managing button press animations with consistent timing
 * @param duration - Duration in milliseconds for the press animation (default: 220ms)
 * @returns Object with isPressing state and handlePressStart handler
 */
export function useButtonPress(duration = 220) {
  const [isPressing, setIsPressing] = useState(false)

  useEffect(() => {
    if (!isPressing) return

    const timeout = window.setTimeout(() => setIsPressing(false), duration)
    return () => window.clearTimeout(timeout)
  }, [isPressing, duration])

  const handlePressStart = useCallback(() => {
    setIsPressing(true)
  }, [])

  return {
    isPressing,
    handlePressStart,
  }
}