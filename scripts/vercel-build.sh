#!/usr/bin/env bash

# Vercel Build Script
# Conditionally deploys Convex based on environment
#
# - Production: Deploys Convex functions first, then Next.js
# - Preview: Only builds Next.js (uses already-deployed Convex)

set -euo pipefail

echo "🔍 Detected Vercel environment: ${VERCEL_ENV:-unknown}"

# Validation function for Convex environment variables
validate_convex_env() {
  local missing_vars=()
  local required_vars=(
    "GOOGLE_AI_API_KEY"
    "NEXT_PUBLIC_APP_URL"
  )

  for var in "${required_vars[@]}"; do
    # Try to check if variable exists in Convex
    # Note: This only validates during deployment, not before
    if ! npx convex env get "$var" --prod &>/dev/null; then
      missing_vars+=("$var")
    fi
  done

  if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ ERROR: Missing required Convex environment variables:"
    for var in "${missing_vars[@]}"; do
      echo "   - $var"
    done
    echo ""
    echo "These variables must be set in Convex production environment."
    echo ""
    echo "To fix, run for each missing variable:"
    echo "  npx convex env set VAR_NAME \"value\" --prod"
    echo ""
    echo "Or use Convex dashboard:"
    echo "  https://dashboard.convex.dev → Settings → Environment Variables"
    echo ""
    echo "⚠️  IMPORTANT: Preview deployments use PRODUCTION Convex backend (free tier)."
    echo "   Missing variables will cause failures in BOTH preview AND production!"
    return 1
  fi

  echo "✅ All required Convex environment variables are set"
  return 0
}

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

  # Validate Convex environment variables before deploying
  echo ""
  echo "🔐 Validating Convex environment variables..."
  if ! validate_convex_env; then
    exit 1
  fi
  echo ""

  npx convex deploy --cmd 'pnpm build'
else
  echo "📦 Preview deployment: building Next.js only (using deployed Convex)..."
  echo ""
  echo "⚠️  Preview deployments use the PRODUCTION Convex backend (free tier limitation)"
  echo "   Ensure GOOGLE_AI_API_KEY and other Convex envs are set in production!"
  echo ""

  # Optional: Validate Convex env vars for preview too (best effort)
  # This helps catch configuration issues early
  echo "🔐 Validating Convex environment variables (preview sanity check)..."
  if validate_convex_env; then
    echo "✅ Convex environment validation passed"
  else
    echo "⚠️  WARNING: Convex environment validation failed"
    echo "   Preview deployment may not work correctly!"
    echo "   Fix the missing variables before testing preview."
    echo ""
    echo "   Continuing with build anyway..."
  fi
  echo ""

  pnpm build
fi
