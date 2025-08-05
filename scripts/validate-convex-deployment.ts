#!/usr/bin/env tsx

/**
 * Validate Convex Deployment Script
 * 
 * This script checks if your local Convex schema and functions match
 * what's deployed to your Convex backend.
 * 
 * Usage:
 *   pnpm tsx scripts/validate-convex-deployment.ts
 *   
 * Options:
 *   --prod    Check production deployment (default: development)
 *   --fix     Provide commands to fix issues
 */

import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'
import * as fs from 'fs'
import * as path from 'path'

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

interface ValidationResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: string[]
  fix?: string
}

async function validateConvexDeployment() {
  const results: ValidationResult[] = []
  const isProd = process.argv.includes('--prod')
  const showFixes = process.argv.includes('--fix')
  
  console.log(`${colors.bold}Convex Deployment Validation${colors.reset}`)
  console.log(`Environment: ${isProd ? 'Production' : 'Development'}`)
  console.log('-------------------------------------------\n')
  
  // Check environment variables
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    results.push({
      name: 'Environment Setup',
      status: 'fail',
      message: 'NEXT_PUBLIC_CONVEX_URL not configured',
      fix: 'Set NEXT_PUBLIC_CONVEX_URL in your .env.local file'
    })
    printResults(results, showFixes)
    return
  }
  
  results.push({
    name: 'Environment Setup',
    status: 'pass',
    message: `Using Convex URL: ${convexUrl}`
  })
  
  const client = new ConvexHttpClient(convexUrl)
  
  // Test basic connectivity
  console.log(`${icons.check} Testing Convex connection...`)
  try {
    await client.query(api.auth.getCurrentUser, { sessionToken: undefined })
    results.push({
      name: 'Convex Connection',
      status: 'pass',
      message: 'Successfully connected to Convex backend'
    })
  } catch (error) {
    results.push({
      name: 'Convex Connection',
      status: 'fail',
      message: 'Failed to connect to Convex backend',
      details: [error instanceof Error ? error.message : String(error)],
      fix: 'Ensure Convex backend is running: npx convex dev'
    })
    printResults(results, showFixes)
    return
  }
  
  // Check schema features
  console.log(`${icons.check} Validating schema compatibility...`)
  
  // Test environment parameter support
  try {
    await client.query(api.auth.getCurrentUser, { 
      sessionToken: undefined,
      environment: 'test'
    })
    results.push({
      name: 'Auth Environment Support',
      status: 'pass',
      message: 'getCurrentUser supports environment parameter'
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('environment') || errorMsg.includes('Validator')) {
      results.push({
        name: 'Auth Environment Support',
        status: 'fail',
        message: 'getCurrentUser does not accept environment parameter',
        details: ['This indicates the deployed Convex functions are outdated'],
        fix: isProd 
          ? 'Deploy to production: npx convex deploy --prod'
          : 'Deploy to development: npx convex deploy'
      })
    } else {
      results.push({
        name: 'Auth Environment Support',
        status: 'warning',
        message: 'Could not verify environment parameter support',
        details: [errorMsg]
      })
    }
  }
  
  // Test spaced repetition features
  try {
    await client.query(api.spacedRepetition.getDueCount, { 
      sessionToken: 'test-token'
    })
    results.push({
      name: 'Spaced Repetition Features',
      status: 'pass',
      message: 'Spaced repetition queries are available'
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('Authentication required') || errorMsg.includes('Invalid or expired session')) {
      results.push({
        name: 'Spaced Repetition Features',
        status: 'pass',
        message: 'Spaced repetition queries are available'
      })
    } else if (errorMsg.includes('spacedRepetition') || errorMsg.includes('not found')) {
      results.push({
        name: 'Spaced Repetition Features',
        status: 'fail',
        message: 'Spaced repetition features not deployed',
        details: ['The spacedRepetition module is missing from the backend'],
        fix: isProd 
          ? 'Deploy to production: npx convex deploy --prod'
          : 'Deploy to development: npx convex deploy'
      })
    } else {
      results.push({
        name: 'Spaced Repetition Features',
        status: 'warning',
        message: 'Could not verify spaced repetition features',
        details: [errorMsg]
      })
    }
  }
  
  // Check local files
  console.log(`${icons.check} Checking local Convex files...`)
  
  const convexDir = path.join(process.cwd(), 'convex')
  const generatedDir = path.join(convexDir, '_generated')
  
  if (!fs.existsSync(generatedDir)) {
    results.push({
      name: 'Generated Types',
      status: 'fail',
      message: 'Convex generated types not found',
      fix: 'Generate types: npx convex codegen'
    })
  } else {
    const files = fs.readdirSync(generatedDir)
    if (files.length < 4) {
      results.push({
        name: 'Generated Types',
        status: 'warning',
        message: 'Generated types may be incomplete',
        details: [`Found ${files.length} files, expected at least 4`],
        fix: 'Regenerate types: npx convex codegen'
      })
    } else {
      results.push({
        name: 'Generated Types',
        status: 'pass',
        message: 'Convex generated types are present'
      })
    }
  }
  
  // Check for schema.ts
  const schemaPath = path.join(convexDir, 'schema.ts')
  if (!fs.existsSync(schemaPath)) {
    results.push({
      name: 'Schema Definition',
      status: 'fail',
      message: 'convex/schema.ts not found',
      fix: 'Create a schema.ts file in the convex directory'
    })
  } else {
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8')
    
    // Check for FSRS fields
    if (schemaContent.includes('nextReview') && schemaContent.includes('stability')) {
      results.push({
        name: 'FSRS Schema Fields',
        status: 'pass',
        message: 'Schema includes FSRS spaced repetition fields'
      })
    } else {
      results.push({
        name: 'FSRS Schema Fields',
        status: 'warning',
        message: 'Schema might be missing FSRS fields',
        details: ['Could not find nextReview or stability fields'],
        fix: 'Ensure your schema includes all FSRS fields for spaced repetition'
      })
    }
  }
  
  printResults(results, showFixes)
}

function printResults(results: ValidationResult[], showFixes: boolean) {
  console.log('\n' + '='.repeat(50))
  console.log(`${colors.bold}Validation Results${colors.reset}`)
  console.log('='.repeat(50) + '\n')
  
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const warnings = results.filter(r => r.status === 'warning').length
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? icons.success : 
                 result.status === 'fail' ? icons.error : icons.warning
    const color = result.status === 'pass' ? colors.green : 
                  result.status === 'fail' ? colors.red : colors.yellow
    
    console.log(`${icon} ${color}${result.name}${colors.reset}`)
    console.log(`   ${result.message}`)
    
    if (result.details && result.details.length > 0) {
      result.details.forEach(detail => {
        console.log(`   ${colors.gray}→ ${detail}${colors.reset}`)
      })
    }
    
    if (showFixes && result.fix && result.status !== 'pass') {
      console.log(`   ${colors.blue}Fix: ${result.fix}${colors.reset}`)
    }
    
    console.log()
  })
  
  // Summary
  console.log('='.repeat(50))
  console.log(`${colors.bold}Summary:${colors.reset}`)
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`)
  console.log(`  ${colors.yellow}Warnings: ${warnings}${colors.reset}`)
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`)
  console.log('='.repeat(50))
  
  if (failed > 0) {
    console.log(`\n${colors.red}${colors.bold}Action Required:${colors.reset}`)
    console.log('Your local Convex code does not match the deployed backend.')
    console.log('This will cause errors in your application.\n')
    
    if (!showFixes) {
      console.log('Run with --fix flag to see how to resolve these issues:')
      console.log(`  ${colors.blue}pnpm tsx scripts/validate-convex-deployment.ts --fix${colors.reset}`)
    }
    
    process.exit(1)
  } else if (warnings > 0) {
    console.log(`\n${colors.yellow}Some issues detected but application should work.${colors.reset}`)
  } else {
    console.log(`\n${colors.green}All checks passed! Your Convex deployment is in sync.${colors.reset}`)
  }
}

// Run the validation
validateConvexDeployment().catch(error => {
  console.error(`${colors.red}Validation failed with error:${colors.reset}`, error)
  process.exit(1)
})