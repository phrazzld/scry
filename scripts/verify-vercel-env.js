#!/usr/bin/env node

/**
 * Verify Vercel Environment Variables
 * 
 * This script checks that Vercel environment variables are properly configured
 * for the dual Convex instance setup.
 * 
 * Prerequisites:
 *   - Vercel CLI installed: npm install -g vercel
 *   - Authenticated with Vercel: vercel login
 *   - Project linked: vercel link
 * 
 * Usage:
 *   node scripts/verify-vercel-env.js
 */

import { execSync } from 'child_process'
import { join } from 'path'
import fs from 'fs'

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

// Required environment variables and their expected values
const requiredEnvVars = {
  production: {
    NEXT_PUBLIC_CONVEX_URL: {
      expected: 'https://uncommon-axolotl-639.convex.cloud',
      description: 'Production Convex instance URL'
    },
    CONVEX_DEPLOY_KEY: {
      expected: /^prod:uncommon-axolotl-639\|/,
      description: 'Production deploy key for Convex',
      sensitive: true
    },
    GOOGLE_AI_API_KEY: {
      expected: /^AIzaSy/,
      description: 'Google AI API key',
      sensitive: true
    },
    RESEND_API_KEY: {
      expected: /^re_/,
      description: 'Resend API key for emails',
      sensitive: true
    },
    EMAIL_FROM: {
      expected: /.+@.+/,
      description: 'From email address'
    }
  },
  preview: {
    NEXT_PUBLIC_CONVEX_URL: {
      expected: 'https://uncommon-axolotl-639.convex.cloud',
      description: 'Preview should use production Convex'
    },
    GOOGLE_AI_API_KEY: {
      expected: /^AIzaSy/,
      description: 'Google AI API key',
      sensitive: true
    }
  }
}

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

function checkVercelCLI() {
  console.log(`${icons.check} Checking Vercel CLI installation...`)
  
  const version = runCommand('vercel --version')
  if (!version) {
    console.log(`${icons.error} ${colors.red}Vercel CLI not found${colors.reset}`)
    console.log(`   Please install: ${colors.blue}npm install -g vercel${colors.reset}`)
    return false
  }
  
  console.log(`${icons.success} Vercel CLI installed (${version})`)
  return true
}

function checkProjectLink() {
  console.log(`\n${icons.check} Checking project link...`)
  
  // Check if .vercel directory exists
  const vercelDir = join(process.cwd(), '.vercel')
  
  if (!fs.existsSync(vercelDir)) {
    console.log(`${icons.error} ${colors.red}Project not linked to Vercel${colors.reset}`)
    console.log(`   Please run: ${colors.blue}vercel link${colors.reset}`)
    return false
  }
  
  console.log(`${icons.success} Project is linked to Vercel`)
  return true
}

function parseEnvOutput(output) {
  const envVars = {}
  const lines = output.split('\n').filter(line => line.trim())
  
  for (const line of lines) {
    // Skip header and separator lines
    if (line.includes('Environment') || line.includes('─')) continue
    
    // Parse environment variable lines
    const match = line.match(/^(\S+)\s+(\S+)/)
    if (match) {
      const [, name, value] = match
      envVars[name] = value
    }
  }
  
  return envVars
}

async function checkEnvironment(environment) {
  console.log(`\n${colors.bold}=== Checking ${environment} Environment ===${colors.reset}`)
  
  // Get environment variables
  const output = runCommand(`vercel env ls ${environment}`)
  if (!output) {
    console.log(`${icons.error} ${colors.red}Failed to retrieve ${environment} environment variables${colors.reset}`)
    return false
  }
  
  const envVars = parseEnvOutput(output)
  const required = requiredEnvVars[environment] || {}
  let hasIssues = false
  
  // Check each required variable
  for (const [varName, config] of Object.entries(required)) {
    const actualValue = envVars[varName]
    
    if (!actualValue || actualValue === '(empty)') {
      console.log(`${icons.error} ${varName}: ${colors.red}Not set${colors.reset}`)
      console.log(`   ${colors.gray}${config.description}${colors.reset}`)
      hasIssues = true
      continue
    }
    
    // Check value matches expected pattern
    if (config.expected instanceof RegExp) {
      if (config.sensitive) {
        // For sensitive values, just check they exist and look valid
        console.log(`${icons.success} ${varName}: ${colors.green}Set (hidden)${colors.reset}`)
      } else if (!config.expected.test(actualValue)) {
        console.log(`${icons.warning} ${varName}: ${colors.yellow}Set but may be incorrect${colors.reset}`)
        console.log(`   Expected pattern: ${config.expected}`)
        hasIssues = true
      } else {
        console.log(`${icons.success} ${varName}: ${colors.green}✓${colors.reset}`)
      }
    } else {
      // For exact matches
      if (actualValue === config.expected) {
        console.log(`${icons.success} ${varName}: ${colors.green}${actualValue}${colors.reset}`)
      } else {
        console.log(`${icons.error} ${varName}: ${colors.red}${actualValue}${colors.reset}`)
        console.log(`   Expected: ${colors.green}${config.expected}${colors.reset}`)
        hasIssues = true
      }
    }
  }
  
  // Check for unexpected variables
  const devUrl = 'https://amicable-lobster-935.convex.cloud'
  if (envVars.NEXT_PUBLIC_CONVEX_URL === devUrl) {
    console.log(`\n${icons.warning} ${colors.yellow}WARNING: Using development Convex URL in ${environment}!${colors.reset}`)
    hasIssues = true
  }
  
  return !hasIssues
}

async function main() {
  console.log(`${colors.bold}Vercel Environment Variables Verification${colors.reset}`)
  console.log(`${colors.gray}Checking Vercel configuration for dual Convex instance setup...${colors.reset}`)
  
  // Check prerequisites
  if (!checkVercelCLI()) {
    process.exit(1)
  }
  
  if (!checkProjectLink()) {
    process.exit(1)
  }
  
  // Check each environment
  const productionOk = await checkEnvironment('production')
  const previewOk = await checkEnvironment('preview')
  
  // Summary
  console.log(`\n${colors.bold}=== Summary ===${colors.reset}`)
  
  if (productionOk && previewOk) {
    console.log(`${icons.success} ${colors.green}All environment variables are properly configured!${colors.reset}`)
    console.log(`\nYour Vercel environments are set up correctly for the dual Convex instance architecture.`)
    process.exit(0)
  } else {
    console.log(`${icons.error} ${colors.red}Some environment variables need attention${colors.reset}`)
    console.log(`\n${colors.yellow}Required Actions:${colors.reset}`)
    console.log(`1. Open Vercel Dashboard: ${colors.blue}https://vercel.com/dashboard${colors.reset}`)
    console.log(`2. Navigate to your project settings → Environment Variables`)
    console.log(`3. Update the variables marked with ${icons.error} or ${icons.warning} above`)
    console.log(`\nKey points:`)
    console.log(`- Production and Preview must use: ${colors.green}https://uncommon-axolotl-639.convex.cloud${colors.reset}`)
    console.log(`- Development can use: ${colors.green}https://amicable-lobster-935.convex.cloud${colors.reset}`)
    console.log(`- CONVEX_DEPLOY_KEY should only be set for Production`)
    console.log(`\nRun this script again after making changes to verify.`)
    process.exit(1)
  }
}

// Run the script
main().catch(error => {
  console.error(`${icons.error} ${colors.red}Script error: ${error.message}${colors.reset}`)
  
  if (error.message.includes('ENOENT')) {
    console.log(`\nMake sure you're running this from the project root directory.`)
  }
  
  process.exit(1)
})