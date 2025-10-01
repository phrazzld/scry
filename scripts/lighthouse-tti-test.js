#!/usr/bin/env node

/**
 * Lighthouse TTI (Time to Interactive) Testing Script
 *
 * This script measures TTI and other performance metrics for the quiz application
 * before and after Card component removal to quantify performance improvements.
 *
 * Usage:
 *   npm install -g lighthouse
 *   node scripts/lighthouse-tti-test.js
 *
 * Or with pnpm:
 *   pnpm dlx lighthouse http://localhost:3000/quiz-mode --view
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_URLS = [
  { name: 'Homepage', url: 'http://localhost:3000' },
  { name: 'Quiz Mode', url: 'http://localhost:3000/quiz-mode' },
  { name: 'Review Mode', url: 'http://localhost:3000/review-mode' },
  { name: 'Create Quiz', url: 'http://localhost:3000/create' },
  { name: 'Test Profiling', url: 'http://localhost:3000/test-profiling' },
];

async function runLighthouse(url, name) {
  console.log(`\n📊 Testing ${name}: ${url}`);
  console.log('─'.repeat(50));

  try {
    // Create results directory if it doesn't exist
    const resultsDir = join(process.cwd(), 'lighthouse-results');
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeFileName = name.toLowerCase().replace(/\s+/g, '-');
    const outputPath = join(resultsDir, `${safeFileName}-${timestamp}`);

    // Run Lighthouse
    const command = `lighthouse ${url} \
      --output=html,json \
      --output-path="${outputPath}" \
      --quiet \
      --chrome-flags="--headless" \
      --preset=desktop`;

    console.log('Running Lighthouse...');
    execSync(command, { encoding: 'utf-8' });

    // Parse JSON results
    const jsonPath = `${outputPath}.report.json`;
    const jsonResults = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    // Extract key metrics
    const metrics = {
      'TTI (Time to Interactive)': jsonResults.audits['interactive'].numericValue,
      'FCP (First Contentful Paint)': jsonResults.audits['first-contentful-paint'].numericValue,
      'LCP (Largest Contentful Paint)': jsonResults.audits['largest-contentful-paint'].numericValue,
      'TBT (Total Blocking Time)': jsonResults.audits['total-blocking-time'].numericValue,
      'CLS (Cumulative Layout Shift)': jsonResults.audits['cumulative-layout-shift'].numericValue,
      'Speed Index': jsonResults.audits['speed-index'].numericValue,
      'Performance Score': jsonResults.categories.performance.score * 100,
    };

    // Display results
    console.log('\n📈 Results:');
    Object.entries(metrics).forEach(([key, value]) => {
      if (key.includes('Score')) {
        console.log(`  ${key}: ${value.toFixed(0)}/100`);
      } else if (key.includes('CLS')) {
        console.log(`  ${key}: ${value.toFixed(3)}`);
      } else {
        console.log(`  ${key}: ${(value / 1000).toFixed(2)}s`);
      }
    });

    // Save summary
    const summaryPath = join(resultsDir, 'summary.json');
    let summary = {};

    if (existsSync(summaryPath)) {
      summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    }

    if (!summary[name]) {
      summary[name] = [];
    }

    summary[name].push({
      timestamp: new Date().toISOString(),
      metrics,
      url,
    });

    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n✅ Full report saved: ${outputPath}.report.html`);

    return metrics;
  } catch (err) {
    console.error(`❌ Error testing ${name}:`, err.message);
    return null;
  }
}

async function compareMetrics() {
  const summaryPath = join(process.cwd(), 'lighthouse-results', 'summary.json');

  if (!existsSync(summaryPath)) {
    console.log('⚠️  No previous results to compare. Run the test twice to see improvements.');
    return;
  }

  const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));

  console.log('\n\n📊 PERFORMANCE COMPARISON');
  console.log('═'.repeat(60));

  Object.entries(summary).forEach(([pageName, runs]) => {
    if (runs.length < 2) return;

    const latest = runs[runs.length - 1];
    const previous = runs[runs.length - 2];

    console.log(`\n${pageName}:`);
    console.log('─'.repeat(40));

    const ttiLatest = latest.metrics['TTI (Time to Interactive)'];
    const ttiPrevious = previous.metrics['TTI (Time to Interactive)'];
    const ttiImprovement = (((ttiPrevious - ttiLatest) / ttiPrevious) * 100).toFixed(1);

    console.log(`  TTI Improvement: ${ttiImprovement}%`);
    console.log(`    Previous: ${(ttiPrevious / 1000).toFixed(2)}s`);
    console.log(`    Current:  ${(ttiLatest / 1000).toFixed(2)}s`);

    const scoreLatest = latest.metrics['Performance Score'];
    const scorePrevious = previous.metrics['Performance Score'];
    const scoreChange = (scoreLatest - scorePrevious).toFixed(0);

    console.log(`  Performance Score: ${scoreChange > 0 ? '+' : ''}${scoreChange} points`);
    console.log(`    Previous: ${scorePrevious.toFixed(0)}/100`);
    console.log(`    Current:  ${scoreLatest.toFixed(0)}/100`);
  });
}

async function main() {
  console.log('🚀 Lighthouse TTI Testing Script');
  console.log('═'.repeat(60));
  console.log('This script measures Time to Interactive and other metrics');
  console.log('to quantify performance improvements from Card removal.\n');

  // Check if dev server is running
  try {
    execSync('curl -f http://localhost:3000', { encoding: 'utf-8' });
  } catch {
    console.error('❌ Error: Dev server is not running on http://localhost:3000');
    console.error('   Please run: pnpm dev');
    process.exit(1);
  }

  // Run tests for each URL
  const results = [];
  for (const { name, url } of TEST_URLS) {
    const metrics = await runLighthouse(url, name);
    if (metrics) {
      results.push({ name, url, metrics });
    }
  }

  // Compare with previous runs
  await compareMetrics();

  console.log('\n\n✨ Testing complete!');
  console.log('View detailed reports in: ./lighthouse-results/');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runLighthouse, compareMetrics };
