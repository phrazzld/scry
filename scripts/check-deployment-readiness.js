#!/usr/bin/env node

/**
 * Deployment Readiness Check for Scry
 * 
 * Comprehensive check to ensure the application is ready for production deployment.
 * This script validates environment variables, database connectivity, email service,
 * and other critical components required for a successful deployment.
 * 
 * Usage: node scripts/check-deployment-readiness.js [--env=production|preview]
 */

import { ENV_VARIABLES } from './validate-env.js'
import { spawn } from 'child_process'

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

class DeploymentChecker {
  constructor() {
    this.checks = []
    this.errors = []
    this.warnings = []
    this.environment = this.detectEnvironment()
  }

  detectEnvironment() {
    const args = process.argv.slice(2)
    const envArg = args.find(arg => arg.startsWith('--env='))
    return envArg ? envArg.split('=')[1] : 'production'
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`)
  }

  logSection(title) {
    this.log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}`)
  }

  async runCommand(command, args = [], timeout = 10000) {
    return new Promise((resolve) => {
      const process = spawn(command, args, { stdio: 'pipe' })
      let stdout = ''
      let stderr = ''
      
      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      const timer = setTimeout(() => {
        process.kill()
        resolve({ success: false, error: 'Command timeout', stdout, stderr })
      }, timeout)
      
      process.on('close', (code) => {
        clearTimeout(timer)
        resolve({
          success: code === 0,
          code,
          stdout,
          stderr
        })
      })
    })
  }

  addCheck(name, status, message = '', details = null) {
    this.checks.push({ name, status, message, details })
    
    const icon = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌'
    const color = status === 'pass' ? 'green' : status === 'warn' ? 'yellow' : 'red'
    
    this.log(`  ${icon} ${name}`, color)
    if (message) {
      this.log(`     ${message}`, 'yellow')
    }
    
    if (status === 'fail') {
      this.errors.push(`${name}: ${message}`)
    } else if (status === 'warn') {
      this.warnings.push(`${name}: ${message}`)
    }
  }

  async checkEnvironmentVariables() {
    this.logSection('Environment Variables')
    
    try {
      // Validate environment variables
      let envValid = true
      
      // Check required variables
      const requiredVars = Object.keys(ENV_VARIABLES.required)
      const missingRequired = requiredVars.filter(name => !process.env[name])
      
      if (missingRequired.length > 0) {
        this.addCheck(
          'Required Environment Variables',
          'fail',
          `Missing: ${missingRequired.join(', ')}`
        )
        envValid = false
      } else {
        this.addCheck('Required Environment Variables', 'pass', 'All required variables present')
      }
      
      // Validate variable formats
      for (const [name, config] of Object.entries(ENV_VARIABLES.required)) {
        const value = process.env[name]
        if (value && config.validation && !config.validation(value)) {
          this.addCheck(
            `${name} Format`,
            'fail',
            config.errorMessage || 'Invalid format'
          )
          envValid = false
        }
      }
      
      if (envValid && missingRequired.length === 0) {
        this.addCheck('Environment Variable Validation', 'pass')
      }
      
    } catch (err) {
      this.addCheck('Environment Variables', 'fail', `Validation error: ${err.message}`)
    }
  }

  async checkDatabaseConnectivity() {
    this.logSection('Database Connectivity')
    
    if (!process.env.DATABASE_URL) {
      this.addCheck('Database Connection', 'fail', 'DATABASE_URL not configured')
      return
    }

    try {
      // Test Prisma database connection
      const result = await this.runCommand('npx', ['prisma', 'db', 'execute', '--stdin'], 5000)
      
      if (result.success || result.stderr.includes('connected')) {
        this.addCheck('Database Connection', 'pass', 'Database is reachable')
      } else {
        this.addCheck('Database Connection', 'fail', 'Cannot connect to database')
      }
    } catch {
      this.addCheck('Database Connection', 'warn', 'Could not test database connection')
    }
  }

  async checkEmailService() {
    this.logSection('Email Service Configuration')
    
    const emailVars = ['RESEND_API_KEY', 'EMAIL_FROM']
    const missingEmail = emailVars.filter(name => !process.env[name])
    
    if (missingEmail.length > 0) {
      this.addCheck('Email Configuration', 'fail', `Missing: ${missingEmail.join(', ')}`)
      return
    }

    // Validate email format
    const emailFrom = process.env.EMAIL_FROM
    if (emailFrom && !emailFrom.includes('@')) {
      this.addCheck('Email From Address', 'fail', 'Invalid email format')
    } else {
      this.addCheck('Email Configuration', 'pass', 'Email service configured')
    }

    // Check RESEND API key format
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && !resendKey.startsWith('re_')) {
      this.addCheck('Resend API Key', 'fail', 'Invalid Resend API key format')
    } else {
      this.addCheck('Resend API Key', 'pass', 'Valid API key format')
    }
  }

  async checkBuildProcess() {
    this.logSection('Build Process')
    
    try {
      this.log('  🔄 Running production build...', 'cyan')
      const result = await this.runCommand('npm', ['run', 'build'], 120000) // 2 minute timeout
      
      if (result.success) {
        this.addCheck('Production Build', 'pass', 'Build completed successfully')
      } else {
        this.addCheck('Production Build', 'fail', 'Build failed')
        console.log('Build output:', result.stdout)
        console.log('Build errors:', result.stderr)
      }
    } catch (err) {
      this.addCheck('Production Build', 'fail', `Build error: ${err.message}`)
    }
  }

  async checkSecurityConfiguration() {
    this.logSection('Security Configuration')
    
    // Check NEXTAUTH_SECRET
    const authSecret = process.env.NEXTAUTH_SECRET
    if (!authSecret) {
      this.addCheck('NextAuth Secret', 'fail', 'NEXTAUTH_SECRET not configured')
    } else if (authSecret.length < 32) {
      this.addCheck('NextAuth Secret', 'fail', 'NEXTAUTH_SECRET too short (minimum 32 characters)')
    } else {
      this.addCheck('NextAuth Secret', 'pass', 'NextAuth secret properly configured')
    }

    // Check for common insecure values
    const insecureValues = ['test', 'development', 'secret', 'password', '123']
    if (authSecret && insecureValues.some(val => authSecret.toLowerCase().includes(val))) {
      this.addCheck('NextAuth Secret Strength', 'warn', 'Secret may be too predictable')
    }

    // Check NEXTAUTH_URL for production
    if (this.environment === 'production') {
      const authUrl = process.env.NEXTAUTH_URL
      if (!authUrl) {
        this.addCheck('NextAuth URL', 'warn', 'NEXTAUTH_URL not set for production')
      } else if (!authUrl.startsWith('https://')) {
        this.addCheck('NextAuth URL', 'fail', 'NEXTAUTH_URL must use HTTPS in production')
      } else {
        this.addCheck('NextAuth URL', 'pass', 'NextAuth URL properly configured')
      }
    }
  }

  async checkOptionalServices() {
    this.logSection('Optional Services')
    
    // Check Vercel KV (rate limiting)
    const kvVars = ['KV_URL', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']
    const kvPresent = kvVars.filter(name => process.env[name]).length
    
    if (kvPresent === 0) {
      this.addCheck('Vercel KV (Rate Limiting)', 'warn', 'Not configured - rate limiting disabled')
    } else if (kvPresent === kvVars.length) {
      this.addCheck('Vercel KV (Rate Limiting)', 'pass', 'Fully configured')
    } else {
      this.addCheck('Vercel KV (Rate Limiting)', 'fail', 'Partially configured - all or none required')
    }
  }

  generateDeploymentReport() {
    this.logSection('Deployment Report')
    
    const passed = this.checks.filter(c => c.status === 'pass').length
    const warned = this.checks.filter(c => c.status === 'warn').length
    const failed = this.checks.filter(c => c.status === 'fail').length
    const total = this.checks.length
    
    this.log(`\n📊 Summary: ${passed}/${total} checks passed`)
    this.log(`   ✅ Passed: ${passed}`, 'green')
    this.log(`   ⚠️  Warnings: ${warned}`, 'yellow')
    this.log(`   ❌ Failed: ${failed}`, 'red')

    if (failed === 0 && warned === 0) {
      this.log('\n🎉 All checks passed! Application is ready for deployment.', 'green')
      return true
    } else if (failed === 0) {
      this.log('\n⚠️  Application can be deployed but has warnings to address.', 'yellow')
      return true
    } else {
      this.log('\n❌ Application is NOT ready for deployment. Critical issues must be resolved.', 'red')
      
      this.log('\n🔧 Required Actions:', 'cyan')
      this.errors.forEach(error => this.log(`  • ${error}`, 'red'))
      
      if (this.warnings.length > 0) {
        this.log('\n⚠️  Recommended Actions:', 'yellow')
        this.warnings.forEach(warning => this.log(`  • ${warning}`, 'yellow'))
      }
      
      return false
    }
  }

  async run() {
    this.log(`${colors.bright}${colors.magenta}🚀 Scry Deployment Readiness Check${colors.reset}`)
    this.log(`Environment: ${this.environment.toUpperCase()}`)
    this.log(`Timestamp: ${new Date().toISOString()}`)
    
    await this.checkEnvironmentVariables()
    await this.checkDatabaseConnectivity()
    await this.checkEmailService()
    await this.checkSecurityConfiguration()
    await this.checkOptionalServices()
    
    // Only run build check if basic requirements are met
    const criticalFailures = this.errors.length
    if (criticalFailures === 0) {
      await this.checkBuildProcess()
    } else {
      this.log('\n⏭️  Skipping build check due to critical configuration errors', 'yellow')
    }
    
    const isReady = this.generateDeploymentReport()
    process.exit(isReady ? 0 : 1)
  }
}

// Run the deployment checker
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const checker = new DeploymentChecker()
  checker.run().catch(err => {
    console.error('Deployment check failed:', err)
    process.exit(1)
  })
}

export { DeploymentChecker }