#!/usr/bin/env bash

# Deployment Health Check Script
# Validates that Convex backend functions are deployed and accessible
# Also validates that all required environment variables are present
#
# Usage:
#   ./scripts/check-deployment-health.sh
#
# Notes:
#   - Checks the Convex deployment configured in .convex/config (dev or prod)
#   - NEXT_PUBLIC_CONVEX_URL env var is validated but deployment check uses .convex/config
#   - To check production: Ensure you've run `npx convex deploy` to set prod config
#   - To check dev: Ensure you've run `npx convex dev` to set dev config
#
# Exit codes: 0 = healthy, 1 = unhealthy

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Critical functions that must exist for the app to work
CRITICAL_FUNCTIONS=(
  "generationJobs:getRecentJobs"
  "generationJobs:createJob"
  "generationJobs:cancelJob"
  "aiGeneration:processJob"
  "questions:saveBatch"
  "spacedRepetition:getNextReview"
  "spacedRepetition:scheduleReview"
  "health:check"
)

echo "🏥 Convex Deployment Health Check"
echo "=================================="
echo ""

# Check 1: Verify NEXT_PUBLIC_CONVEX_URL is set
if [ -z "${NEXT_PUBLIC_CONVEX_URL:-}" ]; then
  echo -e "${RED}❌ FAILED: NEXT_PUBLIC_CONVEX_URL environment variable not set${NC}"
  echo "   Set this to your Convex deployment URL"
  exit 1
fi

echo -e "${GREEN}✓${NC} Environment variable NEXT_PUBLIC_CONVEX_URL is set"
echo "   URL: $NEXT_PUBLIC_CONVEX_URL"
echo ""

# Check 2: Verify Convex deployment is accessible
echo "📋 Checking Convex deployment connectivity..."

# Try to list tables as a simple connectivity check
TABLES_OUTPUT=$(npx convex data 2>&1 || true)

if echo "$TABLES_OUTPUT" | grep -q "Error\|error\|ECONNREFUSED"; then
  echo -e "${RED}❌ FAILED: Unable to connect to Convex deployment${NC}"
  echo "   Error output:"
  echo "$TABLES_OUTPUT" | head -10
  exit 1
fi

echo -e "${GREEN}✓${NC} Successfully connected to Convex deployment"
echo ""

# Check 3: Verify deployment health via health check query
# This validates both that functions are deployed AND env vars are present
echo "🔐 Checking environment variables..."
echo ""

# Call the health:check query to validate env vars
HEALTH_CHECK_OUTPUT=$(npx convex run health:check 2>&1 || echo "ERROR")

if echo "$HEALTH_CHECK_OUTPUT" | grep -q "ERROR\|Error\|error"; then
  echo -e "${RED}❌ FAILED: Unable to run health check query${NC}"
  echo "   Error output:"
  echo "$HEALTH_CHECK_OUTPUT" | head -10
  exit 1
fi

# Parse the health check output (JSON)
# Look for "healthy": true/false and "missing": [...]
if echo "$HEALTH_CHECK_OUTPUT" | grep -q '"healthy":\s*true'; then
  echo -e "${GREEN}✓${NC} All required environment variables are present"
  echo ""
  echo -e "${GREEN}✅ Deployment is fully healthy!${NC} 🎉"
  echo ""
  exit 0
else
  echo -e "${RED}✗${NC} Some required environment variables are missing"
  echo ""

  # Extract missing variables from JSON output
  MISSING_VARS=$(echo "$HEALTH_CHECK_OUTPUT" | grep -o '"missing":\s*\[[^]]*\]' | sed 's/"missing":\s*\[\(.*\)\]/\1/' | tr -d '"' | tr ',' '\n')

  if [ -n "$MISSING_VARS" ]; then
    echo -e "${RED}❌ FAILED: Missing environment variables:${NC}"
    echo "$MISSING_VARS" | while read -r var; do
      [ -n "$var" ] && echo "  - $var"
    done
    echo ""
    echo -e "${YELLOW}💡 Fix: Set missing variables in Convex dashboard${NC}"
    echo "   Visit: https://dashboard.convex.dev → Settings → Environment Variables"
    echo ""
    echo "   Or use CLI:"
    echo "   npx convex env set VAR_NAME \"value\" --prod"
    echo ""
  else
    echo -e "${RED}❌ FAILED: Health check reported unhealthy but couldn't parse missing vars${NC}"
    echo "   Full output:"
    echo "$HEALTH_CHECK_OUTPUT"
    echo ""
  fi

  exit 1
fi
