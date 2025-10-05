#!/usr/bin/env bash

# Vercel Build Script
# Conditionally deploys Convex based on environment
#
# - Production: Deploys Convex functions first, then Next.js
# - Preview: Only builds Next.js (uses already-deployed Convex)

set -euo pipefail

echo "🔍 Detected Vercel environment: ${VERCEL_ENV:-unknown}"

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "🚀 Production deployment: deploying Convex functions first..."
  npx convex deploy --cmd 'pnpm build'
else
  echo "📦 Preview deployment: building Next.js only (using deployed Convex)..."
  pnpm build
fi
