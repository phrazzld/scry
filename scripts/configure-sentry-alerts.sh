#!/bin/bash
# Configure Sentry Alert Rules via REST API
# Requires: SENTRY_API_TOKEN environment variable
# Usage: ./scripts/configure-sentry-alerts.sh

set -e

# Configuration
SENTRY_ORG="misty-step"
SENTRY_PROJECT="scry"
SENTRY_API_BASE="https://sentry.io/api/0"

# Load API token from .env.local if not in environment
if [ -z "$SENTRY_API_TOKEN" ]; then
  if [ -f .env.local ]; then
    export SENTRY_API_TOKEN=$(grep "^SENTRY_API_TOKEN=" .env.local | cut -d= -f2 | tr -d '"')
  fi
fi

if [ -z "$SENTRY_API_TOKEN" ]; then
  echo "❌ Error: SENTRY_API_TOKEN not found"
  echo ""
  echo "Create a token at: https://sentry.io/settings/account/api/auth-tokens/"
  echo "Required scopes: project:write, alerts:write"
  echo ""
  echo "Then add to .env.local:"
  echo "  SENTRY_API_TOKEN=sntrys_xxx"
  exit 1
fi

echo "🔧 Configuring Sentry Alerts for ${SENTRY_ORG}/${SENTRY_PROJECT}"
echo ""

# Function to create or update alert rule
create_alert() {
  local name="$1"
  local payload="$2"

  echo "📋 Creating alert: $name"

  response=$(curl -s -w "\n%{http_code}" -X POST \
    "${SENTRY_API_BASE}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/rules/" \
    -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
    rule_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "✅ Created: $name (ID: $rule_id)"
  elif [ "$http_code" -eq 400 ]; then
    echo "⚠️  Alert may already exist: $name"
    echo "   Response: $body"
  else
    echo "❌ Failed: $name (HTTP $http_code)"
    echo "   Response: $body"
  fi
  echo ""
}

# Alert #1: New Error Types (All Environments)
# Note: We'll start without environment filter since "production" doesn't exist yet
# After first production deploy, you can update to filter by environment
create_alert "New Error Type (All Environments)" '{
  "name": "New Error Type (All Environments)",
  "actionMatch": "any",
  "filterMatch": "all",
  "frequency": 30,
  "conditions": [
    {
      "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
    }
  ],
  "filters": [],
  "actions": [
    {
      "id": "sentry.mail.actions.NotifyEmailAction",
      "targetType": "IssueOwners",
      "fallthroughType": "ActiveMembers"
    }
  ]
}'

# Alert #2: High Error Rate (Metric Alert)
echo "📋 Creating metric alert: Production: High Error Rate"
echo "⚠️  Note: Metric alerts require different API endpoint"
echo "   Manual configuration recommended via Sentry UI for now"
echo "   Navigate to: Alerts → Create Alert → Number of Errors"
echo "   Threshold: > 10 events in 1 hour"
echo ""

# Alert #3: Release Health Degradation (Metric Alert)
echo "📋 Creating metric alert: Production: Release Health Degradation"
echo "⚠️  Note: Release health alerts require Sentry Performance tier"
echo "   Manual configuration recommended via Sentry UI"
echo "   Navigate to: Alerts → Create Alert → Crash Free Sessions"
echo "   Threshold: < 98% in 1 hour"
echo ""

# List all configured rules
echo "📊 Listing all alert rules:"
curl -s -X GET \
  "${SENTRY_API_BASE}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/rules/" \
  -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
  | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read name; do
    echo "   • $name"
  done

echo ""
echo "✅ Alert configuration complete!"
echo ""
echo "Next steps:"
echo "  1. Configure metric alerts manually (see notes above)"
echo "  2. Test alerts: push branch → visit /test-error"
echo "  3. Verify email notifications arrive"
