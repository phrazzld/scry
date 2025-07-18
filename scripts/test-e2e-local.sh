#!/bin/bash

# Script to run E2E tests against local development environment

echo "🧪 Running E2E tests for Spaced Repetition Flow..."
echo ""

# Check if local server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Local development server is not running!"
    echo "Please run 'pnpm dev' in one terminal and 'npx convex dev' in another."
    exit 1
fi

# Set environment variable for local testing
export PLAYWRIGHT_BASE_URL="http://localhost:3000"

# Run only the local E2E tests
echo "Running local E2E tests..."
npx playwright test spaced-repetition.local.test.ts --reporter=list

# Run production E2E tests if requested
if [ "$1" == "--all" ]; then
    echo ""
    echo "Running production E2E tests..."
    npx playwright test spaced-repetition.test.ts --reporter=list
fi

echo ""
echo "✅ E2E test run complete!"
echo ""
echo "To view the HTML report, run: npx playwright show-report"