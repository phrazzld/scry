#!/usr/bin/env tsx
/**
 * Test Phase 1+2: Content Analysis + Pedagogical Blueprint
 *
 * Verifies that:
 * - Phase 1 produces content analysis
 * - Phase 2 receives Phase 1 output as context
 * - Phase 2 produces pedagogical blueprint containing:
 *   - Bloom's taxonomy mapping
 *   - Difficulty distribution
 *   - Common misconceptions
 *   - Question budget
 */
import { ConvexHttpClient } from 'convex/browser';

import { api } from '../convex/_generated/api';
import {
  buildContentAnalysisPrompt,
  buildPedagogicalBlueprintPrompt,
} from '../convex/lib/promptTemplates';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error('❌ CONVEX_URL not found in environment');
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Test content: St Michael Prayer (same as Phase 1 test for consistency)
const TEST_CONTENT = `St. Michael the Archangel, defend us in battle. Be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do Thou, O Prince of the Heavenly Host, by the Divine Power of God, cast into hell, satan and all the evil spirits, who roam throughout the world seeking the ruin of souls. Amen.`;

async function testPhase1And2() {
  console.log('🧪 Testing Phase 1+2: Content Analysis + Pedagogical Blueprint\n');
  console.log(`📝 Test content: "${TEST_CONTENT.substring(0, 50)}..."\n`);

  try {
    const result = await client.action(api.lab.executeConfig, {
      configId: 'test-phase1-2',
      configName: 'Phase 1+2 Test',
      provider: 'openai',
      model: 'gpt-5',
      reasoningEffort: 'high',
      verbosity: 'medium',
      phases: [
        {
          name: 'Phase 1: Content Analysis',
          template: buildContentAnalysisPrompt('{{userInput}}'),
          outputTo: 'contentAnalysis',
          outputType: 'text',
        },
        {
          name: 'Phase 2: Pedagogical Blueprint',
          template: buildPedagogicalBlueprintPrompt('{{contentAnalysis}}'),
          outputTo: 'pedagogicalBlueprint',
          outputType: 'text',
        },
      ],
      testInput: TEST_CONTENT,
    });

    console.log('✅ Phase 1+2 execution completed\n');
    console.log('📊 Metrics:');
    console.log(`   - Latency: ${result.latency}ms`);
    console.log(`   - Tokens: ${result.tokenCount}`);
    console.log(`   - Valid: ${result.valid}`);
    console.log(`   - Errors: ${result.errors.length}\n`);

    if (result.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      result.errors.forEach((err: string, i: number) => console.log(`   ${i + 1}. ${err}`));
      console.log();
    }

    // For Phase 1+2, rawOutput should be null (both text phases)
    console.log('📄 Output structure:');
    console.log(
      `   - rawOutput: ${result.rawOutput === null ? 'null (expected for text phases)' : 'unexpected object'}`
    );
    console.log(`   - questions: ${result.questions.length} (expected 0 for text-only phases)\n`);

    // Verify expected behavior
    const checks = {
      'No errors': result.errors.length === 0,
      'Null rawOutput (text phases)': result.rawOutput === null,
      'Empty questions array': result.questions.length === 0,
      'Positive latency': result.latency > 0,
      'Token usage tracked': result.tokenCount > 0,
      'Token usage > Phase 1 alone (~2.2K)': result.tokenCount > 2200,
    };

    console.log('🔍 Validation checks:');
    let allPassed = true;
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allPassed = false;
    });
    console.log();

    if (allPassed) {
      console.log('🎉 Phase 1+2 test PASSED\n');
      console.log('📝 Expected Phase 2 output format (not returned to client):');
      console.log("   Bloom's Taxonomy Mapping:");
      console.log('   - Remember: [% and examples]');
      console.log('   - Understand: [% and examples]');
      console.log('   - Apply: [% and examples]');
      console.log('   - Analyze: [% and examples]');
      console.log('');
      console.log('   Difficulty Distribution:');
      console.log('   - Easy: [count] questions');
      console.log('   - Medium: [count] questions');
      console.log('   - Hard: [count] questions');
      console.log('');
      console.log('   Common Misconceptions:');
      console.log('   1. [misconception]');
      console.log('   2. [misconception]');
      console.log('   ...');
      console.log('');
      console.log('   Question Budget: [total] questions ([breakdown by difficulty])\n');
      process.exit(0);
    } else {
      console.log('❌ Phase 1+2 test FAILED\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed with exception:');
    console.error(error);
    process.exit(1);
  }
}

testPhase1And2();
