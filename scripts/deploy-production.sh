#!/usr/bin/env bash

# Atomic Production Deployment Script
# Deploys Convex backend and Vercel frontend in correct order with validation
#
# Usage:
#   ./scripts/deploy-production.sh
#
# Prerequisites:
#   - CONVEX_DEPLOY_KEY environment variable set (production deploy key)
#   - Vercel CLI installed and authenticated
#   - .env.production file exists with production configuration
#
# Exit codes: 0 = success, 1 = failure at any step

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emojis for clear status
ROCKET="🚀"
PACKAGE="📦"
CHECK="✅"
CROSS="❌"
WARNING="⚠️"

echo ""
echo "========================================="
echo "$ROCKET Production Deployment Pipeline"
echo "========================================="
echo ""

# Step 1: Deploy Convex Backend
echo -e "${BLUE}Step 1/3:${NC} Deploying Convex backend functions..."
echo ""

if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
  echo -e "${CROSS} ${RED}FAILED: CONVEX_DEPLOY_KEY environment variable not set${NC}"
  echo ""
  echo "To fix:"
  echo "  1. Get production deploy key from Convex dashboard (Settings → Deploy Keys)"
  echo "  2. Export it: export CONVEX_DEPLOY_KEY=prod:..."
  echo "  3. Run this script again"
  echo ""
  exit 1
fi

if npx convex deploy --env-file .env.production; then
  echo ""
  echo -e "${CHECK} ${GREEN}Convex backend deployed successfully${NC}"
else
  echo ""
  echo -e "${CROSS} ${RED}FAILED: Convex deployment failed${NC}"
  echo ""
  echo "Check the error output above for details."
  echo "Common issues:"
  echo "  - Invalid CONVEX_DEPLOY_KEY"
  echo "  - Network connectivity problems"
  echo "  - Syntax errors in Convex functions"
  echo ""
  exit 1
fi

echo ""

# Step 2: Validate Deployment Health
echo -e "${BLUE}Step 2/3:${NC} Validating deployment health..."
echo ""

if ./scripts/check-deployment-health.sh; then
  echo ""
  echo -e "${CHECK} ${GREEN}Deployment health check passed${NC}"
else
  echo ""
  echo -e "${CROSS} ${RED}FAILED: Deployment health check failed${NC}"
  echo ""
  echo -e "${YELLOW}${WARNING} Convex deployed but critical functions are missing${NC}"
  echo ""
  echo "You may need to:"
  echo "  1. Check Convex dashboard for deployment errors"
  echo "  2. Review function exports in convex/ directory"
  echo "  3. Run 'npx convex deploy' again to retry"
  echo ""
  exit 1
fi

echo ""

# Step 3: Deploy Vercel Frontend
echo -e "${BLUE}Step 3/3:${NC} Deploying Vercel frontend..."
echo ""

if vercel --prod; then
  echo ""
  echo -e "${CHECK} ${GREEN}Vercel frontend deployed successfully${NC}"
else
  echo ""
  echo -e "${CROSS} ${RED}FAILED: Vercel deployment failed${NC}"
  echo ""
  echo "Note: Convex backend was deployed successfully."
  echo ""
  echo "To retry Vercel deployment:"
  echo "  vercel --prod"
  echo ""
  exit 1
fi

echo ""
echo "========================================="
echo -e "${CHECK} ${GREEN}Production deployment complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Visit production site and verify functionality"
echo "  2. Check browser console for errors"
echo "  3. Test critical user flows (auth, generation, reviews)"
echo ""
