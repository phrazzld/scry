#!/usr/bin/env node

/**
 * Deployment Setup Verification Script
 * 
 * This script helps verify that all required environment variables
 * are properly configured for Vercel + Convex deployments.
 */

const { execSync } = require('child_process');

console.log('🔍 Verifying Deployment Setup...\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function success(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function error(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function warning(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

// Required environment variables for Vercel deployment
const requiredVarcel = [
  'CONVEX_DEPLOY_KEY',
  'NEXT_PUBLIC_CONVEX_URL', 
  'GOOGLE_AI_API_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM'
];

// Required GitHub secrets for CI/CD
const requiredGitHub = [
  'VERCEL_TOKEN',
  'VERCEL_ORG_ID', 
  'VERCEL_PROJECT_ID',
  'CONVEX_DEPLOY_KEY'
];

let hasErrors = false;

// Check Vercel CLI availability
console.log('📦 Checking Vercel CLI...');
try {
  execSync('vercel --version', { stdio: 'pipe' });
  success('Vercel CLI is installed');
} catch (e) {
  error('Vercel CLI not found. Install with: npm i -g vercel');
  hasErrors = true;
}

// Check Vercel environment variables
console.log('\n🔐 Checking Vercel Environment Variables...');
try {
  const envOutput = execSync('vercel env ls', { encoding: 'utf8' });
  
  requiredVarcel.forEach(varName => {
    if (envOutput.includes(varName)) {
      success(`${varName} is configured in Vercel`);
    } else {
      error(`${varName} is missing from Vercel environment variables`);
      hasErrors = true;
    }
  });
  
  // Check if CONVEX_DEPLOY_KEY is set for both production and preview
  if (envOutput.includes('CONVEX_DEPLOY_KEY')) {
    const prodMatch = envOutput.match(/CONVEX_DEPLOY_KEY.*Production/);
    const previewMatch = envOutput.match(/CONVEX_DEPLOY_KEY.*Preview/);
    
    if (prodMatch) {
      success('CONVEX_DEPLOY_KEY configured for Production');
    } else {
      warning('CONVEX_DEPLOY_KEY missing for Production environment');
    }
    
    if (previewMatch) {
      success('CONVEX_DEPLOY_KEY configured for Preview');
    } else {
      warning('CONVEX_DEPLOY_KEY missing for Preview environment');
    }
  }
  
} catch (e) {
  error('Failed to check Vercel environment variables. Run: vercel login');
  hasErrors = true;
}

// Check local environment
console.log('\n🏠 Checking Local Environment (.env.local)...');
try {
  const fs = require('fs');
  const envLocal = fs.readFileSync('.env.local', 'utf8');
  
  requiredVarcel.forEach(varName => {
    if (envLocal.includes(`${varName}=`) && !envLocal.includes(`${varName}=...`)) {
      success(`${varName} is set locally`);
    } else {
      warning(`${varName} not configured in .env.local`);
    }
  });
} catch (e) {
  warning('.env.local file not found (this is normal for CI/CD)');
}

// Check Convex CLI
console.log('\n⚡ Checking Convex CLI...');
try {
  execSync('npx convex --version', { stdio: 'pipe' });
  success('Convex CLI is available');
  
  // Try to check if connected to a deployment
  try {
    const convexStatus = execSync('npx convex env get CONVEX_URL', { encoding: 'utf8', stdio: 'pipe' });
    if (convexStatus.trim()) {
      success('Connected to Convex deployment');
    }
  } catch (e) {
    warning('Not connected to Convex deployment (run: npx convex dev)');
  }
} catch (e) {
  error('Convex CLI not available');
  hasErrors = true;
}

// Check vercel.json configuration
console.log('\n⚙️ Checking Build Configuration...');
try {
  const fs = require('fs');
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  
  if (vercelConfig.buildCommand && vercelConfig.buildCommand.includes('npx convex deploy')) {
    success('vercel.json includes Convex deployment in build command');
  } else {
    error('vercel.json build command does not include Convex deployment');
    hasErrors = true;
  }
} catch (e) {
  error('Failed to read vercel.json configuration');
  hasErrors = true;
}

// Summary
console.log('\n📋 Summary');
if (hasErrors) {
  error('Some issues found. Please resolve them before deploying.');
  console.log('\n📚 For help, see: docs/convex-deployment-fix.md');
} else {
  success('All checks passed! Deployment should work correctly.');
}

console.log('\n🚀 Next Steps:');
info('1. Fix any issues shown above');
info('2. Test with: vercel (for preview deployment)');
info('3. Deploy to production: vercel --prod');

process.exit(hasErrors ? 1 : 0);