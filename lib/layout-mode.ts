/**
 * Layout mode feature flag
 * 
 * Controls whether to use the new CSS Grid layout system or the legacy layout.
 * Set NEXT_PUBLIC_USE_LEGACY_LAYOUT=true to enable the old layout system.
 * 
 * Default: false (use new CSS Grid layout)
 */

/**
 * Check if legacy layout mode is enabled
 * 
 * @returns true if legacy layout should be used, false for CSS Grid layout
 */
export function isLegacyLayoutEnabled(): boolean {
  // Check environment variable - defaults to false (new layout)
  // Using NEXT_PUBLIC_ prefix to make it available client-side
  const legacyMode = process.env.NEXT_PUBLIC_USE_LEGACY_LAYOUT === 'true';
  return legacyMode;
}

/**
 * Get the appropriate layout class name based on feature flag
 * 
 * @returns CSS class name for the layout container
 */
export function getLayoutClassName(): string {
  return isLegacyLayoutEnabled() ? 'layout-legacy' : 'layout-grid';
}

/**
 * Get navbar positioning class based on layout mode
 * 
 * @returns CSS classes for navbar positioning
 */
export function getNavbarClassName(): string {
  return isLegacyLayoutEnabled() 
    ? 'fixed top-0 left-0 right-0 z-50' 
    : 'sticky top-0 z-40';
}

/**
 * Check if spacer is needed (only in legacy mode)
 * 
 * @returns true if navbar spacer should be rendered
 */
export function needsNavbarSpacer(): boolean {
  return isLegacyLayoutEnabled();
}