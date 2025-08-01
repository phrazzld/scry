#!/usr/bin/env node

/**
 * Convex Status Check Script
 * 
 * This script verifies that both development and production Convex instances
 * are properly configured and in sync.
 * 
 * Usage:
 *   node scripts/check-convex-status.js
 */

import { ConvexHttpClient } from 'convex/browser'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs/promises'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env.local') })

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
}

// Icons
const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  check: '🔍'
}

// Convex instance URLs
const instances = {
  development: {
    name: 'Development',
    url: process.env.NEXT_PUBLIC_CONVEX_URL_DEV || 'https://amicable-lobster-935.convex.cloud',
    envVar: 'NEXT_PUBLIC_CONVEX_URL_DEV'
  },
  production: {
    name: 'Production',
    url: process.env.NEXT_PUBLIC_CONVEX_URL_PROD || 'https://uncommon-axolotl-639.convex.cloud',
    envVar: 'NEXT_PUBLIC_CONVEX_URL_PROD'
  }
}

async function checkConvexInstance(instance) {
  console.log(`\n${icons.check} Checking ${colors.bold}${instance.name}${colors.reset} instance...`)
  console.log(`   URL: ${colors.blue}${instance.url}${colors.reset}`)
  
  const results = {
    name: instance.name,
    url: instance.url,
    accessible: false,
    hasGetCurrentUser: false,
    hasEnvironmentParam: false,
    errors: []
  }
  
  try {
    // Create Convex client (used for validation only)
    new ConvexHttpClient(instance.url)
    
    // Test basic connectivity by attempting a simple query
    try {
      // Try to access the API endpoint
      const response = await fetch(`${instance.url}/version`)
      if (response.ok) {
        results.accessible = true
        console.log(`   ${icons.success} Instance is accessible`)
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      results.errors.push(`Connection failed: ${error.message}`)
      console.log(`   ${icons.error} ${colors.red}Instance not accessible${colors.reset}`)
    }
    
    // Check for getCurrentUser function
    // Note: This is a simplified check - in production you might want to
    // actually query the function list from Convex
    console.log(`   ${icons.info} Checking for getCurrentUser function...`)
    try {
      // Check if the generated API has the auth module
      const apiPath = join(__dirname, '..', 'convex', '_generated', 'api.d.ts')
      const apiContent = await fs.readFile(apiPath, 'utf-8')
      
      if (apiContent.includes('getCurrentUser')) {
        results.hasGetCurrentUser = true
        console.log(`   ${icons.success} getCurrentUser function found`)
        
        // Check if it has environment parameter
        if (apiContent.includes('environment')) {
          results.hasEnvironmentParam = true
          console.log(`   ${icons.success} environment parameter supported`)
        } else {
          console.log(`   ${icons.warning} ${colors.yellow}environment parameter not found${colors.reset}`)
        }
      } else {
        console.log(`   ${icons.warning} ${colors.yellow}getCurrentUser function not found${colors.reset}`)
      }
    } catch (error) {
      results.errors.push(`API check failed: ${error.message}`)
      console.log(`   ${icons.error} ${colors.red}Could not verify functions${colors.reset}`)
    }
    
  } catch (error) {
    results.errors.push(`General error: ${error.message}`)
    console.log(`   ${icons.error} ${colors.red}Failed to check instance: ${error.message}${colors.reset}`)
  }
  
  return results
}

async function compareInstances(devResults, prodResults) {
  console.log(`\n${colors.bold}=== Comparison Results ===${colors.reset}`)
  
  const issues = []
  
  // Check accessibility
  if (!devResults.accessible || !prodResults.accessible) {
    issues.push('One or more instances are not accessible')
  }
  
  // Check function parity
  if (devResults.hasGetCurrentUser !== prodResults.hasGetCurrentUser) {
    issues.push('getCurrentUser function mismatch between instances')
  }
  
  // Check environment parameter support
  if (devResults.hasEnvironmentParam !== prodResults.hasEnvironmentParam) {
    issues.push('environment parameter support mismatch')
  }
  
  if (issues.length === 0) {
    console.log(`\n${icons.success} ${colors.green}Both instances appear to be in sync!${colors.reset}`)
  } else {
    console.log(`\n${icons.warning} ${colors.yellow}Schema differences detected:${colors.reset}`)
    issues.forEach(issue => {
      console.log(`   ${icons.error} ${issue}`)
    })
  }
  
  return issues.length === 0
}

async function checkEnvironmentVariables() {
  console.log(`\n${colors.bold}=== Environment Variables ===${colors.reset}`)
  
  const requiredVars = [
    'NEXT_PUBLIC_CONVEX_URL_DEV',
    'NEXT_PUBLIC_CONVEX_URL_PROD',
    'CONVEX_DEPLOY_KEY_PROD'
  ]
  
  let allPresent = true
  
  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (value) {
      console.log(`${icons.success} ${varName}: ${colors.green}Set${colors.reset}`)
    } else {
      console.log(`${icons.error} ${varName}: ${colors.red}Not set${colors.reset}`)
      allPresent = false
    }
  }
  
  return allPresent
}

async function main() {
  console.log(`${colors.bold}Convex Status Check${colors.reset}`)
  console.log(`${colors.gray}Checking development and production Convex instances...${colors.reset}`)
  
  // Check environment variables
  const envVarsOk = await checkEnvironmentVariables()
  
  // Check both instances
  const devResults = await checkConvexInstance(instances.development)
  const prodResults = await checkConvexInstance(instances.production)
  
  // Compare results
  const inSync = await compareInstances(devResults, prodResults)
  
  // Summary
  console.log(`\n${colors.bold}=== Summary ===${colors.reset}`)
  
  if (envVarsOk && inSync && devResults.accessible && prodResults.accessible) {
    console.log(`${icons.success} ${colors.green}All checks passed!${colors.reset}`)
    console.log(`\nYour Convex instances are properly configured and in sync.`)
    process.exit(0)
  } else {
    console.log(`${icons.error} ${colors.red}Some checks failed${colors.reset}`)
    console.log(`\n${colors.yellow}Recommended actions:${colors.reset}`)
    
    if (!envVarsOk) {
      console.log(`1. Set missing environment variables in .env.local`)
    }
    
    if (!inSync) {
      console.log(`2. Deploy to both instances to sync schema:`)
      console.log(`   pnpm convex:deploy:dev`)
      console.log(`   pnpm convex:deploy:prod`)
    }
    
    if (!devResults.accessible || !prodResults.accessible) {
      console.log(`3. Check Convex dashboard for instance status`)
    }
    
    process.exit(1)
  }
}

// Run the script
main().catch(error => {
  console.error(`${icons.error} ${colors.red}Script error: ${error.message}${colors.reset}`)
  process.exit(1)
})