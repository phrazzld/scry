#!/bin/bash

echo "🚀 Setting up Convex environment variables for Vercel"
echo ""
echo "Step 1: Getting your Convex deployment URL..."
echo "Running: npx convex dashboard"
echo ""
echo "When the dashboard opens:"
echo "1. Copy your deployment URL (https://[something].convex.cloud)"
echo "2. Go to Settings → Deploy Keys"
echo "3. Click 'Generate Production Deploy Key'"
echo "4. Copy the key (starts with prod:)"
echo ""
read -p "Press Enter when you have both values ready..."

echo ""
read -p "Enter your Convex URL (e.g., https://quick-flamingo-123.convex.cloud): " CONVEX_URL
read -p "Enter your Convex Deploy Key (starts with prod:): " DEPLOY_KEY

echo ""
echo "Adding to Vercel..."

# Add NEXT_PUBLIC_CONVEX_URL for all environments
echo "Adding NEXT_PUBLIC_CONVEX_URL..."
echo "$CONVEX_URL" | vercel env add NEXT_PUBLIC_CONVEX_URL production
echo "$CONVEX_URL" | vercel env add NEXT_PUBLIC_CONVEX_URL preview
echo "$CONVEX_URL" | vercel env add NEXT_PUBLIC_CONVEX_URL development

# Add CONVEX_DEPLOY_KEY for production only
echo "Adding CONVEX_DEPLOY_KEY..."
echo "$DEPLOY_KEY" | vercel env add CONVEX_DEPLOY_KEY production

echo ""
echo "✅ Environment variables added!"
echo ""
echo "Next steps:"
echo "1. Go to https://vercel.com/phrazzld/scry"
echo "2. Click on your latest deployment"
echo "3. Click the '...' menu → Redeploy"
echo "4. Choose 'Redeploy with existing Build Cache'"
echo ""
echo "Your deployment should now work! 🎉"