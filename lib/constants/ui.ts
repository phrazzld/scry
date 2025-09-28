/**
 * Centralized UI constants for the application
 * All size values are in pixels unless otherwise specified
 */

/**
 * Textarea sizing constraints
 */

// Minimum height for auto-resizing textareas
export const TEXTAREA_MIN_HEIGHT = 80; // pixels

// Maximum height for auto-resizing textareas before scrolling
export const TEXTAREA_MAX_HEIGHT = 200; // pixels

/**
 * Animation durations
 */

// Default transition duration for UI animations
export const TRANSITION_DURATION = 300; // milliseconds

/**
 * Quick action delay
 */

// Delay before auto-focusing elements
export const AUTO_FOCUS_DELAY = 50; // milliseconds

/**
 * Z-index layers
 */

// Debug panel should be above all other content
export const Z_INDEX_DEBUG_PANEL = 9999;

/**
 * Performance thresholds
 */

// Frame budget at 60fps - used for render performance warnings
export const FRAME_BUDGET_MS = 16; // milliseconds

/**
 * Optimization delays
 */

// Delay before clearing optimistic updates to prevent flash of old data
export const OPTIMISTIC_UPDATE_CLEAR_DELAY = 500; // milliseconds
