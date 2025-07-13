#!/usr/bin/env node

/**
 * Script to check if Vercel environment variables are properly configured
 * Run this after setting up your environment variables
 */

import { execSync } from 'child_process';

console.log('🔍 Checking Vercel Environment Variables...\n');

try {
  // Check if Vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'ignore' });
  } catch {
    console.error('❌ Vercel CLI not installed. Run: npm i -g vercel');
    process.exit(1);
  }

  // Get environment variables from Vercel
  console.log('📋 Fetching environment variables from Vercel...\n');
  const output = execSync('vercel env ls', { encoding: 'utf-8' });
  
  // Required variables
  const required = [
    'CONVEX_DEPLOY_KEY',
    'NEXT_PUBLIC_CONVEX_URL', 
    'GOOGLE_AI_API_KEY'
  ];
  
  const found = [];
  const missing = [];
  
  required.forEach(varName => {
    if (output.includes(varName)) {
      found.push(varName);
    } else {
      missing.push(varName);
    }
  });
  
  // Display results
  if (found.length > 0) {
    console.log('✅ Found environment variables:');
    found.forEach(v => console.log(`   - ${v}`));
    console.log('');
  }
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:');
    missing.forEach(v => console.log(`   - ${v}`));
    console.log('');
    
    if (missing.includes('CONVEX_DEPLOY_KEY')) {
      console.log('📝 To fix CONVEX_DEPLOY_KEY:');
      console.log('   1. Run: npx convex dashboard');
      console.log('   2. Go to Settings → Deploy Keys');
      console.log('   3. Click "Generate Production Deploy Key"');
      console.log('   4. Copy the key');
      console.log('   5. Run: vercel env add CONVEX_DEPLOY_KEY');
      console.log('   6. Paste the key and select "Production" environment\n');
    }
  } else {
    console.log('🎉 All required environment variables are configured!');
    console.log('\n📦 Next step: Redeploy your project');
    console.log('   Run: vercel --prod\n');
  }
  
} catch (error) {
  console.error('❌ Error checking environment variables:', error.message);
  console.log('\n💡 Make sure you are in the project directory and logged into Vercel');
  console.log('   Run: vercel login');
}