/**
 * Client-side environment detection utilities
 * Used in browser context where process.env is not available
 */

/**
 * Detects the current deployment environment from the browser
 * Used to pass environment context to API calls
 */
export function getClientEnvironment(): string {
  // Check if we're in development
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }

    // Vercel preview deployments
    if (hostname.includes('.vercel.app') && !hostname.includes('production')) {
      // Extract branch name if possible from the URL
      const match = hostname.match(/^(.+?)-[^-]+-[^.]+\.vercel\.app$/);
      if (match && match[1]) {
        return `preview-${match[1]}`;
      }
      return 'preview';
    }

    // Production domain
    return 'production';
  }

  return 'development';
}
