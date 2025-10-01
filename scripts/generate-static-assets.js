#!/usr/bin/env node

// CLI script to generate static quiz assets
// Usage: node scripts/generate-static-assets.js [options]
import { execSync } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we're in the right directory
if (!existsSync('package.json')) {
  console.error('Error: This script must be run from the project root directory');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  priority: null,
  outputDir: 'public/quiz-assets',
  verbose: false,
  dryRun: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  switch (arg) {
    case '--priority':
      options.priority = args[++i];
      if (!['high', 'medium', 'low'].includes(options.priority)) {
        console.error('Error: --priority must be one of: high, medium, low');
        process.exit(1);
      }
      break;

    case '--output-dir':
      options.outputDir = args[++i];
      break;

    case '--verbose':
      options.verbose = true;
      break;

    case '--dry-run':
      options.dryRun = true;
      break;

    case '--help':
      console.log(`
Generate static quiz assets for CDN delivery

Usage: node scripts/generate-static-assets.js [options]

Options:
  --priority <level>    Generate only assets with specific priority (high, medium, low)
  --output-dir <path>   Output directory (default: public/quiz-assets)
  --verbose             Show detailed progress information
  --dry-run             Show what would be generated without actually generating
  --help                Show this help message

Examples:
  node scripts/generate-static-assets.js
  node scripts/generate-static-assets.js --priority high
  node scripts/generate-static-assets.js --priority medium --verbose
  node scripts/generate-static-assets.js --dry-run
`);
      process.exit(0);

    default:
      console.error(`Error: Unknown option: ${arg}`);
      console.error('Use --help for usage information');
      process.exit(1);
  }
}

console.log('🚀 Static Quiz Asset Generator');
console.log('===============================');

if (options.dryRun) {
  console.log('🔍 DRY RUN MODE - No files will be generated');
}

console.log(`Priority filter: ${options.priority || 'all'}`);
console.log(`Output directory: ${options.outputDir}`);
console.log('');

// Create a temporary TypeScript runner script
const runnerScript = `
import { generateAllPopularAssets, createAssetIndex, POPULAR_TOPICS } from './lib/static-assets/generator.js'

async function main() {
  const options = ${JSON.stringify(options)}
  
  if (options.dryRun) {
    const filteredTopics = options.priority 
      ? POPULAR_TOPICS.filter(config => config.priority === options.priority)
      : POPULAR_TOPICS
    
    console.log('📋 Topics that would be generated:')
    
    let totalAssets = 0
    for (const config of filteredTopics) {
      const assetCount = config.difficulties.length * config.questionCounts.length
      totalAssets += assetCount
      
      console.log(\`  📚 \${config.topic} (\${config.priority} priority)\`)
      console.log(\`     - Difficulties: \${config.difficulties.join(', ')}\`)
      console.log(\`     - Question counts: \${config.questionCounts.join(', ')}\`)
      console.log(\`     - Assets: \${assetCount}\`)
      console.log('')
    }
    
    console.log(\`📊 Total assets to generate: \${totalAssets}\`)
    console.log(\`⏱️  Estimated time: ~\${Math.ceil(totalAssets * 2 / 60)} minutes\`)
    
    return
  }
  
  console.log('⚡ Generating static quiz assets...')
  console.log('')
  
  const startTime = Date.now()
  
  try {
    const assetFiles = await generateAllPopularAssets(
      options.outputDir,
      options.priority
    )
    
    console.log('')
    console.log('📚 Creating asset index...')
    createAssetIndex(assetFiles, options.outputDir)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log('')
    console.log('✅ Generation complete!')
    console.log(\`📊 Generated \${assetFiles.length} static quiz assets\`)
    console.log(\`⏱️  Total time: \${duration} seconds\`)
    console.log(\`📁 Output: \${options.outputDir}\`)
    
    if (assetFiles.length > 0) {
      console.log('')
      console.log('🔗 Next steps:')
      console.log('1. Deploy to CDN or static hosting')
      console.log('2. Update quiz generation API to use static assets')
      console.log('3. Monitor performance improvements')
    }
    
  } catch (error) {
    console.error('')
    console.error('❌ Generation failed:', error.message)
    
    if (options.verbose) {
      console.error('')
      console.error('Stack trace:')
      console.error(error.stack)
    }
    
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message)
  process.exit(1)
})
`;

// Write the runner script to a temporary file
const runnerPath = path.join(__dirname, '..', 'temp-asset-generator.mjs');
writeFileSync(runnerPath, runnerScript);

try {
  // Check if environment variables are set
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('⚠️  Warning: OPENROUTER_API_KEY environment variable not set');
    console.warn('   Asset generation may fail without API access');
    console.log('');
  }

  // Run the generator
  execSync(`node ${runnerPath}`, {
    stdio: 'inherit',
    env: { ...process.env },
  });
} catch (error) {
  console.error('\n❌ Script execution failed');

  if (error.code === 'ENOENT') {
    console.error('Error: Node.js not found in PATH');
  } else {
    console.error('Error details:', error.message);
  }

  process.exit(1);
} finally {
  // Clean up temporary file
  try {
    unlinkSync(runnerPath);
  } catch {
    // Ignore cleanup errors
  }
}
