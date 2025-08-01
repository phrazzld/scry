#!/usr/bin/env node

/**
 * Log Deployment to Convex
 * 
 * This script logs deployment events to Convex for tracking and observability.
 * It can be called from CI/CD pipelines or build scripts.
 * 
 * Usage:
 *   node scripts/log-deployment.js [options]
 *   
 * Options:
 *   --environment <env>    Deployment environment (development|production|preview)
 *   --status <status>      Deployment status (started|success|failed)
 *   --deployment-id <id>   Update existing deployment (for status updates)
 */

import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { execSync } from 'child_process'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    environment: process.env.VERCEL_ENV || 'development',
    status: 'started',
    deploymentId: null,
    error: null
  }
  
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]
    const value = args[i + 1]
    
    switch (flag) {
      case '--environment':
        options.environment = value
        break
      case '--status':
        options.status = value
        break
      case '--deployment-id':
        options.deploymentId = value
        break
      case '--error':
        options.error = value
        break
    }
  }
  
  return options
}

// Get Git information
function getGitInfo() {
  try {
    const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
    const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    const author = execSync('git log -1 --pretty=%ae', { encoding: 'utf-8' }).trim()
    
    return { commitSha, commitMessage, branch, author }
  } catch (error) {
    console.warn('Could not get Git information:', error.message)
    return {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE,
      branch: process.env.VERCEL_GIT_COMMIT_REF,
      author: process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN
    }
  }
}

// Get Convex function count
async function getFunctionCount() {
  try {
    const files = execSync('find convex -name "*.ts" -not -path "convex/_generated/*" | wc -l', { 
      encoding: 'utf-8',
      shell: true 
    }).trim()
    return parseInt(files)
  } catch {
    return null
  }
}

// Determine deployment type
function getDeploymentType() {
  if (process.env.CI || process.env.VERCEL) {
    return 'ci'
  }
  return 'manual'
}

// Get environment metadata
function getMetadata() {
  return {
    buildId: process.env.VERCEL_DEPLOYMENT_ID,
    vercelDeploymentId: process.env.VERCEL_URL,
    convexVersion: process.env.npm_package_dependencies_convex,
    nodeVersion: process.version
  }
}

// Determine Convex URL based on environment
function getConvexUrl() {
  const environment = process.env.VERCEL_ENV || 'development'
  
  if (environment === 'production' || environment === 'preview') {
    return process.env.NEXT_PUBLIC_CONVEX_URL_PROD || 
           'https://uncommon-axolotl-639.convex.cloud'
  }
  
  return process.env.NEXT_PUBLIC_CONVEX_URL_DEV || 
         process.env.NEXT_PUBLIC_CONVEX_URL ||
         'https://amicable-lobster-935.convex.cloud'
}

async function main() {
  const options = parseArgs()
  const gitInfo = getGitInfo()
  const startTime = Date.now()
  
  try {
    // Create Convex client
    const convexUrl = getConvexUrl()
    const client = new ConvexHttpClient(convexUrl)
    
    console.log(`Logging deployment to Convex (${convexUrl})...`)
    
    if (options.deploymentId && options.status !== 'started') {
      // Update existing deployment
      const duration = Date.now() - startTime
      await client.mutation(api.deployments.updateDeploymentStatus, {
        deploymentId: options.deploymentId,
        status: options.status,
        duration,
        error: options.error
      })
      
      console.log(`✅ Deployment ${options.deploymentId} updated: ${options.status}`)
    } else {
      // Create new deployment log
      const functionCount = await getFunctionCount()
      
      const deploymentId = await client.mutation(api.deployments.logDeployment, {
        environment: options.environment,
        deployedBy: gitInfo.author || process.env.USER || 'system',
        commitSha: gitInfo.commitSha,
        commitMessage: gitInfo.commitMessage,
        branch: gitInfo.branch,
        deploymentType: getDeploymentType(),
        status: options.status,
        functionCount,
        metadata: getMetadata()
      })
      
      console.log(`✅ Deployment logged: ${deploymentId}`)
      
      // Output deployment ID for subsequent status updates
      if (options.status === 'started') {
        console.log(`::set-output name=deployment_id::${deploymentId}`)
      }
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to log deployment:', error.message)
    // Don't fail the build if telemetry fails
    process.exit(0)
  }
}

// Run the script
main()