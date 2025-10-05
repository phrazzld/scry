#!/usr/bin/env bash

# Vercel Build Script
# Conditionally deploys Convex based on environment
#
# - Production: Deploys Convex functions first, then Next.js
# - Preview: Only builds Next.js (uses already-deployed Convex)

set -euo pipefail

echo "🔍 Detected Vercel environment: ${VERCEL_ENV:-unknown}"

if [ "${VERCEL_ENV:-}" = "production" ]; then
  # Validate CONVEX_DEPLOY_KEY is set for production deployments
  if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
    echo "❌ ERROR: CONVEX_DEPLOY_KEY not set for production deployment"
    echo ""
    echo "This environment variable is required to deploy Convex functions."
    echo "Set it in Vercel dashboard: Settings → Environment Variables → Production"
    echo ""
    echo "To get your deploy key:"
    echo "  1. Visit https://dashboard.convex.dev"
    echo "  2. Navigate to Settings → Deploy Keys"
    echo "  3. Generate/copy production deploy key (starts with 'prod:')"
    exit 1
  fi

  echo "🚀 Production deployment: deploying Convex functions first..."
  npx convex deploy --cmd 'pnpm build'
else
  echo "📦 Preview deployment: building Next.js only (using deployed Convex)..."
  pnpm build
fi
