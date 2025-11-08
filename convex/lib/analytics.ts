/**
 * Convex-safe analytics wrapper
 *
 * This file provides a no-op implementation of analytics functions for Convex.
 * Convex functions can't import Next.js/browser-specific code, so we provide
 * stub implementations that safely do nothing.
 *
 * In the future, we could implement server-side analytics tracking here using
 * Convex HTTP actions or other mechanisms, but for now we just no-op.
 */

import type { AnalyticsEventDefinitions, AnalyticsEventName, AnalyticsEventProperties } from '../../lib/analytics';

/**
 * Track an analytics event (no-op in Convex)
 *
 * Convex environment doesn't have access to Vercel Analytics or Sentry,
 * so this is a safe no-op. Events from Convex functions are not tracked.
 */
export function trackEvent<Name extends AnalyticsEventName>(
  _name: Name,
  _properties?: AnalyticsEventProperties<Name>
): void {
  // No-op: Analytics not available in Convex environment
  return;
}

/**
 * Report an error (no-op in Convex)
 *
 * Convex has its own error handling and logging system.
 * Use Convex's built-in logging instead of this function.
 */
export function reportError(_error: Error, _context?: Record<string, unknown>): void {
  // No-op: Use Convex's built-in error logging instead
  return;
}

/**
 * Set user context (no-op in Convex)
 */
export function setUserContext(_userId: string, _metadata?: Record<string, string>): void {
  // No-op: User context not tracked in Convex environment
  return;
}

/**
 * Clear user context (no-op in Convex)
 */
export function clearUserContext(): void {
  // No-op: User context not tracked in Convex environment
  return;
}

// Re-export types for convenience
export type { AnalyticsEventName, AnalyticsEventProperties, AnalyticsEventDefinitions };
