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

// Debug environment for Convex
if (vercelEnv) {
  console.log('🔍 Convex Environment Debug:');
  console.log(`  CONVEX_DEPLOY_KEY exists: ${!!process.env.CONVEX_DEPLOY_KEY}`);
  console.log(`  CONVEX_DEPLOY_KEY length: ${process.env.CONVEX_DEPLOY_KEY ? process.env.CONVEX_DEPLOY_KEY.length : 0}`);
  console.log(`  CONVEX_DEPLOY_KEY prefix: ${process.env.CONVEX_DEPLOY_KEY ? process.env.CONVEX_DEPLOY_KEY.substring(0, 5) + '...' : 'N/A'}`);
  console.log(`  NEXT_PUBLIC_CONVEX_URL: ${process.env.NEXT_PUBLIC_CONVEX_URL || 'Not set'}`);
  console.log('');
}

// Check if types already exist (they should be committed to the repo)
const fs = require('fs');
const path = require('path');
const typesExist = fs.existsSync(path.join(__dirname, '..', 'convex', '_generated'));

if (!isProduction && vercelEnv && typesExist) {
  console.log('ℹ️  Preview environment detected - using pre-generated Convex types');
  console.log('   (Types are committed to the repository for preview deployments)');
  console.log('   No CONVEX_DEPLOY_KEY needed for preview environments');
  console.log('✅ Convex types already exist\n');
} else {
  try {
    // For production or local development, generate types
    if (isProduction && hasDeployKey) {
      console.log('   Running production codegen...');
      execSync('npx convex codegen --prod', { stdio: 'inherit' });
    } else if (!vercelEnv) {
      // Local development
      execSync('npx convex codegen', { stdio: 'inherit' });
    } else {
      // Preview without types - this is a problem
      throw new Error('Preview deployment missing Convex types - ensure convex/_generated is committed');
    }
    console.log('✅ Convex types generated successfully\n');
  } catch (error) {
    console.error('❌ Failed to generate Convex types');
    console.error('   Error details:', error.message);
    process.exit(1);
  }
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