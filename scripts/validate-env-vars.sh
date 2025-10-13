#!/usr/bin/env bash

# Environment Variable Validation Script
# Validates that all required environment variables are set in both Vercel and Convex
#
# Usage:
#   ./scripts/validate-env-vars.sh [--env production|preview|development]
#
# Exit codes: 0 = all vars present, 1 = vars missing

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
ENVIRONMENT="${1:-production}"
if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "preview" ] && [ "$ENVIRONMENT" != "development" ]; then
  echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
  echo "Usage: $0 [production|preview|development]"
  exit 1
fi

echo ""
echo "========================================="
echo "🔍 Environment Variable Validation"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo ""

# Define required variables by system
# Format: "VAR_NAME:vercel,convex" (comma-separated list of systems that need this var)

# Variables needed in CONVEX (backend functions)
CONVEX_REQUIRED_VARS=(
  "GOOGLE_AI_API_KEY"
  "RESEND_API_KEY"
  "EMAIL_FROM"
  "NEXT_PUBLIC_APP_URL"
)

# Variables needed in VERCEL (Next.js frontend/API routes)
VERCEL_REQUIRED_VARS=(
  "NEXT_PUBLIC_CONVEX_URL"
  "CONVEX_DEPLOY_KEY"
  "CLERK_SECRET_KEY"
  "CLERK_WEBHOOK_SECRET"
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
)

# Variables needed in BOTH (though uncommon)
SHARED_VARS=()

# Track overall validation status
VALIDATION_FAILED=0

# ============================================================================
# CONVEX VALIDATION
# ============================================================================

echo "📦 Checking Convex environment variables..."
echo ""

# Determine Convex environment flag
CONVEX_ENV_FLAG=""
if [ "$ENVIRONMENT" = "production" ]; then
  CONVEX_ENV_FLAG="--prod"
elif [ "$ENVIRONMENT" = "development" ]; then
  CONVEX_ENV_FLAG="" # Default is dev
else
  echo -e "${YELLOW}⚠️  Skipping Convex check for preview environment${NC}"
  echo "   Preview deployments use existing Convex deployment"
  echo ""
fi

# Check Convex variables (if applicable)
if [ -n "$CONVEX_ENV_FLAG" ] || [ "$ENVIRONMENT" = "development" ]; then
  CONVEX_MISSING=()

  for var in "${CONVEX_REQUIRED_VARS[@]}"; do
    # Use npx convex env get to check if variable exists
    if npx convex env get "$var" $CONVEX_ENV_FLAG &>/dev/null; then
      echo -e "${GREEN}✓${NC} Convex: $var"
    else
      echo -e "${RED}✗${NC} Convex: $var ${RED}(MISSING)${NC}"
      CONVEX_MISSING+=("$var")
      VALIDATION_FAILED=1
    fi
  done

  echo ""

  if [ ${#CONVEX_MISSING[@]} -gt 0 ]; then
    echo -e "${RED}❌ Convex Missing Variables (${#CONVEX_MISSING[@]}):${NC}"
    for var in "${CONVEX_MISSING[@]}"; do
      echo "   - $var"
    done
    echo ""
    echo "To fix, run:"
    echo "   npx convex env set VAR_NAME \"value\" $CONVEX_ENV_FLAG"
    echo ""
    echo "Or use Convex dashboard:"
    echo "   https://dashboard.convex.dev → Settings → Environment Variables"
    echo ""
  else
    echo -e "${GREEN}✅ All required Convex variables present${NC}"
    echo ""
  fi
fi

# ============================================================================
# VERCEL VALIDATION
# ============================================================================

echo "🔷 Checking Vercel environment variables..."
echo ""

# Get Vercel env vars for the specified environment
VERCEL_ENV_LIST=$(vercel env ls "$ENVIRONMENT" 2>&1 || echo "ERROR")

if echo "$VERCEL_ENV_LIST" | grep -q "Error\|error"; then
  echo -e "${RED}❌ Failed to fetch Vercel environment variables${NC}"
  echo "   Make sure you're authenticated: vercel login"
  echo "   Make sure project is linked: vercel link"
  echo ""
  VALIDATION_FAILED=1
else
  VERCEL_MISSING=()

  for var in "${VERCEL_REQUIRED_VARS[@]}"; do
    # Check if variable appears in the Vercel env list
    if echo "$VERCEL_ENV_LIST" | grep -q "^[[:space:]]*$var"; then
      echo -e "${GREEN}✓${NC} Vercel: $var"
    else
      echo -e "${RED}✗${NC} Vercel: $var ${RED}(MISSING)${NC}"
      VERCEL_MISSING+=("$var")
      VALIDATION_FAILED=1
    fi
  done

  echo ""

  if [ ${#VERCEL_MISSING[@]} -gt 0 ]; then
    echo -e "${RED}❌ Vercel Missing Variables (${#VERCEL_MISSING[@]}):${NC}"
    for var in "${VERCEL_MISSING[@]}"; do
      echo "   - $var"
    done
    echo ""
    echo "To fix, run:"
    echo "   vercel env add VAR_NAME $ENVIRONMENT"
    echo ""
    echo "Or use Vercel dashboard:"
    echo "   https://vercel.com/[your-team]/scry/settings/environment-variables"
    echo ""
  else
    echo -e "${GREEN}✅ All required Vercel variables present${NC}"
    echo ""
  fi
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo "========================================="
if [ $VALIDATION_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Environment validation passed!${NC}"
  echo "All required variables are present."
else
  echo -e "${RED}❌ Environment validation failed!${NC}"
  echo "Some required variables are missing."
  echo ""
  echo "🔑 Critical Distinction:"
  echo "   Vercel env vars  → Used by Next.js (frontend/API routes)"
  echo "   Convex env vars  → Used by Convex functions (backend)"
  echo ""
  echo "These are SEPARATE systems. Setting a var in one"
  echo "does NOT automatically set it in the other."
fi
echo "========================================="
echo ""

exit $VALIDATION_FAILED
