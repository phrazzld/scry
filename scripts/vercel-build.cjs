#!/usr/bin/env node

/**
 * Vercel Build Script
 * 
 * This script conditionally deploys Convex based on the deployment environment.
 * - Production: Deploys Convex if CONVEX_DEPLOY_KEY is set
 * - Preview: Skips Convex deployment, uses production Convex instance
 * 
 * This allows preview deployments without requiring Convex Pro subscription.
 */

const { execSync } = require('child_process');

// Detect environment
const vercelEnv = process.env.VERCEL_ENV;
const isProduction = vercelEnv === 'production';
const hasDeployKey = !!process.env.CONVEX_DEPLOY_KEY;

// Log build context
console.log('🔍 Build Configuration:');
console.log(`  Environment: ${vercelEnv || 'local'}`);
console.log(`  Branch: ${process.env.VERCEL_GIT_COMMIT_REF || 'unknown'}`);
console.log(`  Convex Deploy Key: ${hasDeployKey ? '✅ Present' : '❌ Not set'}`);
console.log('');

// Handle Convex deployment
if (isProduction && hasDeployKey) {
  console.log('🚀 Deploying Convex functions for production...');
  try {
    execSync('npx convex deploy --prod', { stdio: 'inherit' });
    console.log('✅ Convex deployment successful\n');
  } catch (error) {
    console.error('❌ Convex deployment failed');
    process.exit(1);
  }
} else if (isProduction && !hasDeployKey) {
  // Fail production builds without deploy key
  console.error('❌ ERROR: Production deployment requires CONVEX_DEPLOY_KEY');
  console.error('  Please add CONVEX_DEPLOY_KEY to Vercel environment variables');
  console.error('  See: docs/convex-deployment-fix.md for instructions');
  process.exit(1);
} else {
  // Skip Convex deployment for preview environments
  console.log('⏭️  Skipping Convex deployment for preview environment');
  console.log('ℹ️  Preview will use production Convex backend');
  console.log('   (via NEXT_PUBLIC_CONVEX_URL environment variable)\n');
}

// Generate Convex types (required for TypeScript compilation)
console.log('📝 Generating Convex types...');

// Check if we're in a problematic environment (Vercel preview without deploy key)
if (!isProduction && !hasDeployKey && vercelEnv) {
  console.log('⚠️  Detected Vercel preview environment without CONVEX_DEPLOY_KEY');
  console.log('   The Convex CLI requires a deploy key even for type generation in Vercel');
  console.log('');
  console.log('   Quick fix: Add a dummy CONVEX_DEPLOY_KEY to Vercel preview environment:');
  console.log('   Key: CONVEX_DEPLOY_KEY');
  console.log('   Value: preview:dummy_key_for_type_generation_only');
  console.log('   Environment: Preview only');
  console.log('');
  console.log('   See: docs/vercel-preview-workaround.md for details');
  console.log('');
}

try {
  execSync('npx convex codegen', { stdio: 'inherit' });
  console.log('✅ Convex types generated successfully\n');
} catch (error) {
  console.error('❌ Failed to generate Convex types');
  if (!isProduction && !hasDeployKey && vercelEnv) {
    console.error('\n   This is expected in Vercel preview without CONVEX_DEPLOY_KEY');
    console.error('   Please follow the instructions above to fix this issue');
  }
  process.exit(1);
}

// Always run Next.js build
console.log('🔨 Building Next.js application...');
try {
  execSync('pnpm build', { stdio: 'inherit' });
  console.log('\n✅ Next.js build successful');
} catch (error) {
  console.error('\n❌ Next.js build failed');
  process.exit(1);
}

// Success message
if (isProduction) {
  console.log('\n🎉 Production build completed successfully!');
} else {
  console.log('\n🎉 Preview build completed successfully!');
  console.log('   Note: Using production Convex backend for data');
}