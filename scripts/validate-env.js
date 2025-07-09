#!/usr/bin/env node

/**
 * Environment Variable Validation Script for Scry
 * 
 * Validates that all required environment variables are present and properly configured
 * across different environments (development, preview, production).
 * 
 * Usage: node scripts/validate-env.js [--env=production|preview|development]
 */

import fs from 'fs'

// ANSI color codes for terminal output
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

// Define all environment variables used in the application
const ENV_VARIABLES = {
  // Core required variables
  required: {
    'GOOGLE_AI_API_KEY': {
      description: 'Google AI API key for quiz generation',
      example: 'AIzaSy...',
      validation: (value) => value && value.startsWith('AIzaSy') && value.length > 20,
      errorMessage: 'Must start with "AIzaSy" and be at least 20 characters long'
    },
    'DATABASE_URL': {
      description: 'PostgreSQL database connection string',
      example: 'postgresql://user:pass@host:port/dbname',
      validation: (value) => value && (value.startsWith('postgresql://') || value.startsWith('postgres://') || value.startsWith('prisma+')),
      errorMessage: 'Must be a valid PostgreSQL connection string'
    },
    'NEXTAUTH_SECRET': {
      description: 'NextAuth.js secret for JWT signing',
      example: 'generated-secret-string',
      validation: (value) => value && value.length >= 32,
      errorMessage: 'Must be at least 32 characters long. Generate with: openssl rand -base64 32'
    },
    'RESEND_API_KEY': {
      description: 'Resend API key for email sending',
      example: 're_...',
      validation: (value) => value && value.startsWith('re_'),
      errorMessage: 'Must start with "re_"'
    },
    'EMAIL_FROM': {
      description: 'From email address for authentication emails',
      example: 'Scry <noreply@yourdomain.com>',
      validation: (value) => value && value.includes('@'),
      errorMessage: 'Must be a valid email address'
    }
  },
  
  // Optional but commonly used variables
  optional: {
    'NEXTAUTH_URL': {
      description: 'NextAuth.js base URL',
      example: 'https://yourdomain.com',
      validation: (value) => !value || value.startsWith('http'),
      errorMessage: 'Must be a valid URL starting with http:// or https://'
    },
    'EMAIL_SERVER_HOST': {
      description: 'SMTP server hostname',
      example: 'smtp.resend.com',
      default: 'smtp.resend.com'
    },
    'EMAIL_SERVER_PORT': {
      description: 'SMTP server port',
      example: '587',
      default: '587',
      validation: (value) => !value || (!isNaN(parseInt(value)) && parseInt(value) > 0),
      errorMessage: 'Must be a valid port number'
    },
    'EMAIL_SERVER_USER': {
      description: 'SMTP server username',
      example: 'resend',
      default: 'resend'
    },
    'DATABASE_URL_UNPOOLED': {
      description: 'Unpooled database connection (for migrations)',
      example: 'postgresql://user:pass@host:port/dbname'
    }
  },
  
  // KV-related variables (optional, for rate limiting)
  kv: {
    'KV_URL': {
      description: 'Vercel KV connection URL',
      example: 'redis://...'
    },
    'KV_REST_API_URL': {
      description: 'Vercel KV REST API URL',
      example: 'https://...'
    },
    'KV_REST_API_TOKEN': {
      description: 'Vercel KV REST API token',
      example: 'token...'
    }
  },
  
  // System variables (auto-populated)
  system: {
    'NODE_ENV': {
      description: 'Node.js environment',
      example: 'development|production|test'
    },
    'CI': {
      description: 'Continuous Integration flag',
      example: 'true'
    }
  }
}

class EnvValidator {
  constructor() {
    this.errors = []
    this.warnings = []
    this.info = []
    this.environment = this.detectEnvironment()
  }

  detectEnvironment() {
    const args = process.argv.slice(2)
    const envArg = args.find(arg => arg.startsWith('--env='))
    
    if (envArg) {
      return envArg.split('=')[1]
    }
    
    return process.env.NODE_ENV || 'development'
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`)
  }

  logSection(title) {
    this.log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}`)
  }

  validateVariable(name, config, value) {
    const result = {
      name,
      value: value || null,
      status: 'missing',
      message: ''
    }

    if (!value) {
      result.status = 'missing'
      result.message = `Missing required variable: ${config.description}`
      return result
    }

    if (config.validation && !config.validation(value)) {
      result.status = 'invalid'
      result.message = config.errorMessage || 'Invalid value format'
      return result
    }

    // Check for placeholder values
    if (value.includes('your-') || value.includes('example') || value === config.example) {
      result.status = 'placeholder'
      result.message = 'Contains placeholder value - needs real configuration'
      return result
    }

    result.status = 'valid'
    result.message = 'Valid'
    return result
  }

  checkEnvironmentFiles() {
    this.logSection('Environment Files Check')
    
    const files = [
      { path: '.env', description: 'Development environment (should be gitignored!)' },
      { path: '.env.local', description: 'Local environment overrides' },
      { path: '.env.example', description: 'Environment template' },
      { path: '.env.local.example', description: 'Local environment template' }
    ]

    files.forEach(file => {
      const exists = fs.existsSync(file.path)
      const status = exists ? '✓' : '✗'
      const color = exists ? 'green' : 'yellow'
      
      this.log(`  ${status} ${file.path} - ${file.description}`, color)
      
      if (file.path === '.env' && exists) {
        this.errors.push('SECURITY: .env file exists in repository! This should be gitignored.')
      }
      
      if (file.path === '.env.example' && !exists) {
        this.errors.push('Missing .env.example template file')
      }
    })
  }

  validateCurrentEnvironment() {
    this.logSection(`Validating ${this.environment.toUpperCase()} Environment`)
    
    // Load environment variables from process.env
    const env = process.env

    // Validate required variables
    this.log('\nRequired Variables:', 'bright')
    Object.entries(ENV_VARIABLES.required).forEach(([name, config]) => {
      const result = this.validateVariable(name, config, env[name])
      this.logValidationResult(result)
      
      if (result.status === 'missing' || result.status === 'invalid') {
        this.errors.push(`${name}: ${result.message}`)
      } else if (result.status === 'placeholder') {
        this.warnings.push(`${name}: ${result.message}`)
      }
    })

    // Check optional variables
    this.log('\nOptional Variables:', 'bright')
    Object.entries(ENV_VARIABLES.optional).forEach(([name, config]) => {
      const result = this.validateVariable(name, config, env[name])
      this.logValidationResult(result, true)
      
      if (result.status === 'missing' && this.environment === 'production') {
        this.warnings.push(`${name}: Recommended for production environments`)
      }
    })

    // Check KV variables (all or none)
    this.log('\nVercel KV Variables (for rate limiting):', 'bright')
    const kvVars = Object.keys(ENV_VARIABLES.kv)
    const kvPresent = kvVars.filter(name => env[name]).length
    
    if (kvPresent > 0 && kvPresent < kvVars.length) {
      this.warnings.push('Partial KV configuration detected - ensure all KV variables are set together')
    }
    
    kvVars.forEach(name => {
      const config = ENV_VARIABLES.kv[name]
      const result = this.validateVariable(name, config, env[name])
      this.logValidationResult(result, true)
    })
  }

  logValidationResult(result, optional = false) {
    const prefix = optional ? '  [OPT]' : '  [REQ]'
    let icon, color
    
    switch (result.status) {
      case 'valid':
        icon = '✓'
        color = 'green'
        break
      case 'missing':
        icon = optional ? '○' : '✗'
        color = optional ? 'yellow' : 'red'
        break
      case 'invalid':
        icon = '✗'
        color = 'red'
        break
      case 'placeholder':
        icon = '⚠'
        color = 'yellow'
        break
    }
    
    this.log(`${prefix} ${icon} ${result.name}`, color)
    if (result.status !== 'valid') {
      this.log(`      ${result.message}`, 'yellow')
    }
  }

  generateEnvExample() {
    this.logSection('Generating Updated .env.example')
    
    const lines = [
      '# Environment Variables for Scry',
      '# Copy this file to .env.local and fill in your actual values',
      '# Never commit real API keys or secrets to the repository!',
      '',
      '# =============================================================================',
      '# REQUIRED VARIABLES',
      '# =============================================================================',
      ''
    ]

    Object.entries(ENV_VARIABLES.required).forEach(([name, config]) => {
      lines.push(`# ${config.description}`)
      if (config.errorMessage) {
        lines.push(`# ${config.errorMessage}`)
      }
      lines.push(`${name}=${config.example || 'your-value-here'}`)
      lines.push('')
    })

    lines.push('# =============================================================================')
    lines.push('# OPTIONAL VARIABLES')
    lines.push('# =============================================================================')
    lines.push('')

    Object.entries(ENV_VARIABLES.optional).forEach(([name, config]) => {
      lines.push(`# ${config.description}`)
      if (config.default) {
        lines.push(`# Default: ${config.default}`)
      }
      lines.push(`# ${name}=${config.example || config.default || 'your-value-here'}`)
      lines.push('')
    })

    lines.push('# =============================================================================')
    lines.push('# VERCEL KV (for rate limiting) - All or none required')
    lines.push('# =============================================================================')
    lines.push('')

    Object.entries(ENV_VARIABLES.kv).forEach(([name, config]) => {
      lines.push(`# ${config.description}`)
      lines.push(`# ${name}=${config.example || 'your-value-here'}`)
      lines.push('')
    })

    const content = lines.join('\n')
    
    // Show what would be generated
    this.log('\nGenerated .env.example content:')
    this.log('─'.repeat(50), 'cyan')
    console.log(content)
    this.log('─'.repeat(50), 'cyan')
    
    return content
  }

  printSummary() {
    this.logSection('Validation Summary')
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('✅ All environment variables are properly configured!', 'green')
      return true
    }

    if (this.errors.length > 0) {
      this.log(`\n❌ ${this.errors.length} Error(s):`, 'red')
      this.errors.forEach(error => this.log(`  • ${error}`, 'red'))
    }

    if (this.warnings.length > 0) {
      this.log(`\n⚠️  ${this.warnings.length} Warning(s):`, 'yellow')
      this.warnings.forEach(warning => this.log(`  • ${warning}`, 'yellow'))
    }

    this.log('\n📋 Remediation Steps:', 'cyan')
    this.log('  1. Copy .env.example to .env.local', 'cyan')
    this.log('  2. Fill in all required values in .env.local', 'cyan')
    this.log('  3. Ensure .env.local is in your .gitignore', 'cyan')
    this.log('  4. Remove any .env files from the repository', 'cyan')
    this.log('  5. Re-run this script to verify configuration', 'cyan')

    return false
  }

  run() {
    this.log(`${colors.bright}${colors.magenta}🔍 Scry Environment Variable Validator${colors.reset}`)
    this.log(`Environment: ${this.environment}`)
    
    this.checkEnvironmentFiles()
    this.validateCurrentEnvironment()
    
    const isValid = this.printSummary()
    
    // Generate updated .env.example if needed
    if (process.argv.includes('--generate-example')) {
      const content = this.generateEnvExample()
      fs.writeFileSync('.env.example', content)
      this.log('\n✅ Updated .env.example file generated!', 'green')
    }
    
    process.exit(isValid ? 0 : 1)
  }
}

// Run the validator
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const validator = new EnvValidator()
  validator.run()
}

export { EnvValidator, ENV_VARIABLES }