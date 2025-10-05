#!/usr/bin/env bash

# Deployment Health Check Script
# Validates that Convex backend functions are deployed and accessible
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

# Check 3: Verify critical functions exist by listing all functions
echo "📋 Checking for critical functions..."

# Get list of all deployed functions
# Format: "functionName" or "namespace:functionName"
FUNCTIONS_LIST=$(npx convex functions list 2>&1 || echo "")

if echo "$FUNCTIONS_LIST" | grep -q "Error\|error"; then
  echo -e "${RED}❌ FAILED: Unable to list Convex functions${NC}"
  echo "   Error output:"
  echo "$FUNCTIONS_LIST" | head -10
  exit 1
fi

MISSING_FUNCTIONS=()
for func in "${CRITICAL_FUNCTIONS[@]}"; do
  # Check if function appears in the list
  # Match the full function name (namespace:functionName)
  if echo "$FUNCTIONS_LIST" | grep -qF "$func"; then
    echo -e "${GREEN}✓${NC} $func"
  else
    echo -e "${RED}✗${NC} $func (not found)"
    MISSING_FUNCTIONS+=("$func")
  fi
done

echo ""

# Report results
if [ ${#MISSING_FUNCTIONS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ All critical functions are deployed and accessible${NC}"
  echo ""
  echo "Deployment is healthy! 🎉"
  exit 0
else
  echo -e "${RED}❌ FAILED: ${#MISSING_FUNCTIONS[@]} critical function(s) missing${NC}"
  echo ""
  echo "Missing functions:"
  for func in "${MISSING_FUNCTIONS[@]}"; do
    echo "  - $func"
  done
  echo ""
  echo -e "${YELLOW}💡 Fix: Run 'npx convex deploy' to deploy backend functions${NC}"
  exit 1
fi
