/**
 * Haptic Feedback Utility
 *
 * Provides subtle haptic feedback for user interactions on supported devices.
 * Falls back gracefully when Vibration API is not available.
 */

/**
 * Trigger a subtle haptic pulse for user feedback
 *
 * @param duration - Duration of vibration in milliseconds (default: 10ms)
 * @returns Boolean indicating if vibration was triggered
 */
export function triggerHaptic(duration: number = 10): boolean {
  // Check if Vibration API is available
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      // Trigger vibration and return success status
      return navigator.vibrate(duration);
    } catch (error) {
      // Silently fail if vibration is not permitted or fails
      console.debug('Haptic feedback failed:', error);
      return false;
    }
  }

  // Return false if API is not available
  return false;
}

/**
 * Trigger haptic feedback for correct answers
 * Uses a double pulse pattern for positive feedback
 */
export function triggerSuccessHaptic(): boolean {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      // Double pulse: vibrate 10ms, pause 50ms, vibrate 10ms
      return navigator.vibrate([10, 50, 10]);
    } catch (error) {
      console.debug('Success haptic failed:', error);
      return false;
    }
  }
  return false;
}

/**
 * Trigger haptic feedback for incorrect answers
 * Uses a single longer pulse for negative feedback
 */
export function triggerErrorHaptic(): boolean {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      // Single longer pulse: 20ms
      return navigator.vibrate(20);
    } catch (error) {
      console.debug('Error haptic failed:', error);
      return false;
    }
  }
  return false;
}