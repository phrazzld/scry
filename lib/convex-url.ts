export function getConvexUrl() {
  // Vercel deployments use production Convex
  if (process.env.VERCEL_ENV) {
    return process.env.NEXT_PUBLIC_CONVEX_URL_PROD || 
           'https://uncommon-axolotl-639.convex.cloud'
  }
  // Local development uses dev Convex
  return process.env.NEXT_PUBLIC_CONVEX_URL_DEV || 
         process.env.NEXT_PUBLIC_CONVEX_URL ||
         'https://amicable-lobster-935.convex.cloud'
}