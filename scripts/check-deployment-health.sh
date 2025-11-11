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

# Check 3: Verify critical functions exist
echo "📋 Checking for critical functions..."
echo ""

# Get list of all deployed functions using function-spec
FUNCTIONS_LIST=$(npx convex function-spec 2>&1 || echo "ERROR")

if echo "$FUNCTIONS_LIST" | grep -q "Error\|error\|ECONNREFUSED"; then
  echo -e "${RED}❌ FAILED: Unable to list Convex functions${NC}"
  echo "   Error output:"
  echo "$FUNCTIONS_LIST" | head -10
  exit 1
fi

MISSING_FUNCTIONS=()
for func in "${CRITICAL_FUNCTIONS[@]}"; do
  # Check if function appears in the function spec output
  # Function names in spec are formatted as "moduleName:functionName"
  if echo "$FUNCTIONS_LIST" | grep -qF "$func"; then
    echo -e "${GREEN}✓${NC} $func"
  else
    echo -e "${RED}✗${NC} $func (not found)"
    MISSING_FUNCTIONS+=("$func")
  fi
done

echo ""

# Check if any functions are missing before proceeding
if [ ${#MISSING_FUNCTIONS[@]} -gt 0 ]; then
  echo -e "${RED}❌ FAILED: ${#MISSING_FUNCTIONS[@]} critical function(s) missing${NC}"
  for func in "${MISSING_FUNCTIONS[@]}"; do
    echo "  - $func"
  done
  echo ""
  echo -e "${YELLOW}💡 Fix: Ensure Convex deployment completed successfully${NC}"
  echo "   Run: npx convex deploy"
  echo "   Check dashboard: https://dashboard.convex.dev"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ All critical functions are deployed${NC}"
echo ""

# Check 4: Verify userStats table exists and compound indexes are deployed
echo "📋 Checking database schema (userStats table and indexes)..."
echo ""

# Check if userStats table exists by trying to query it
USERSTATS_CHECK=$(npx convex run spacedRepetition:getUserCardStats 2>&1 || echo "ERROR")

if echo "$USERSTATS_CHECK" | grep -q "Table.*userStats.*does not exist\|not found"; then
  echo -e "${RED}❌ FAILED: userStats table not found in schema${NC}"
  echo "   This table is required for bandwidth optimization"
  echo ""
  echo -e "${YELLOW}💡 Fix: Ensure schema changes are deployed${NC}"
  echo "   The userStats table should be defined in convex/schema.ts"
  echo "   Run: npx convex deploy"
  echo ""
  exit 1
fi

echo -e "${GREEN}✓${NC} userStats table exists"

# Verify compound indexes by checking if queries use them
# We can't directly check index existence, but we can verify the schema defines them
SCHEMA_CHECK=$(cat convex/schema.ts 2>/dev/null || echo "")

if echo "$SCHEMA_CHECK" | grep -q "by_user_active"; then
  echo -e "${GREEN}✓${NC} by_user_active compound index defined in schema"
else
  echo -e "${YELLOW}⚠${NC}  by_user_active index not found in schema (may not be deployed)"
fi

if echo "$SCHEMA_CHECK" | grep -q "by_user_state"; then
  echo -e "${GREEN}✓${NC} by_user_state compound index defined in schema"
else
  echo -e "${YELLOW}⚠${NC}  by_user_state index not found in schema (may not be deployed)"
fi

echo ""

# Check if questionEmbeddings table exists (bandwidth optimization - embeddings separation)
echo "📋 Checking questionEmbeddings table (embeddings separation)..."
echo ""

if echo "$SCHEMA_CHECK" | grep -q "questionEmbeddings:"; then
  echo -e "${GREEN}✓${NC} questionEmbeddings table defined in schema"
else
  echo -e "${YELLOW}⚠${NC}  questionEmbeddings table not found in schema"
  echo "   Note: Required for embeddings separation (bandwidth optimization)"
fi

# Check for questionEmbeddings indexes
# Extract only the questionEmbeddings table definition to avoid false positives
# (interactions table also has a by_question index, questions table has deprecated by_embedding)
# Pattern: From 'questionEmbeddings:' to the closing vector index line '    }),'
EMBEDDINGS_TABLE=$(echo "$SCHEMA_CHECK" | sed -n '/questionEmbeddings: defineTable/,/^    }),$/p')

if echo "$EMBEDDINGS_TABLE" | grep -q "by_question"; then
  echo -e "${GREEN}✓${NC} by_question index defined in questionEmbeddings"
else
  echo -e "${YELLOW}⚠${NC}  by_question index not found in questionEmbeddings"
fi

if echo "$EMBEDDINGS_TABLE" | grep -q "vectorIndex('by_embedding'"; then
  echo -e "${GREEN}✓${NC} by_embedding vector index defined in questionEmbeddings"
else
  echo -e "${YELLOW}⚠${NC}  by_embedding vector index not found in questionEmbeddings"
fi

echo ""

# Check 5: Verify deployment health via health check query
# This validates that env vars are present and functions are callable
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
# Use jq if available for robust parsing, fall back to grep if not
if command -v jq &>/dev/null; then
  # Use jq for reliable JSON parsing
  IS_HEALTHY=$(echo "$HEALTH_CHECK_OUTPUT" | jq -r '.healthy' 2>/dev/null || echo "false")
  MISSING_VARS=$(echo "$HEALTH_CHECK_OUTPUT" | jq -r '.missing[]' 2>/dev/null || echo "")
else
  # Fall back to grep with relaxed pattern (handles various whitespace)
  if echo "$HEALTH_CHECK_OUTPUT" | grep -q '"healthy"\s*:\s*true'; then
    IS_HEALTHY="true"
  else
    IS_HEALTHY="false"
  fi

  # Extract missing variables with grep/sed
  MISSING_VARS=$(echo "$HEALTH_CHECK_OUTPUT" | grep -o '"missing":\s*\[[^]]*\]' | sed 's/"missing":\s*\[\(.*\)\]/\1/' | tr -d '"' | tr ',' '\n')
fi

if [ "$IS_HEALTHY" = "true" ]; then
  echo -e "${GREEN}✓${NC} All required environment variables are present"
  echo ""
  echo -e "${GREEN}✅ Deployment is fully healthy!${NC} 🎉"
  echo ""
  exit 0
else
  echo -e "${RED}✗${NC} Some required environment variables are missing"
  echo ""

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
