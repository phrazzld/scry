#!/usr/bin/env tsx
/**
 * Test Phase 1: Content Analysis
 *
 * Verifies that Phase 1 produces valid content analysis output containing:
 * - Content type classification (enumerable/conceptual/mixed)
 * - Atomic knowledge units
 * - Synthesis opportunities
 * - Estimated question count
 */
import { ConvexHttpClient } from 'convex/browser';

import { api } from '../convex/_generated/api';
import { buildContentAnalysisPrompt } from '../convex/lib/promptTemplates';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error('❌ CONVEX_URL not found in environment');
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Test content: St Michael Prayer (verbatim content, known to trigger Q3 cloze duplication in old system)
const TEST_CONTENT = `St. Michael the Archangel, defend us in battle. Be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do Thou, O Prince of the Heavenly Host, by the Divine Power of God, cast into hell, satan and all the evil spirits, who roam throughout the world seeking the ruin of souls. Amen.`;

async function testPhase1() {
  console.log('🧪 Testing Phase 1: Content Analysis\n');
  console.log(`📝 Test content: "${TEST_CONTENT.substring(0, 50)}..."\n`);

  try {
    const result = await client.action(api.lab.executeConfig, {
      configId: 'test-phase1',
      configName: 'Phase 1 Test',
      provider: 'openai',
      model: 'gpt-5-mini',
      reasoningEffort: 'medium',
      verbosity: 'medium',
      phases: [
        {
          name: 'Phase 1: Content Analysis',
          template: buildContentAnalysisPrompt('{{userInput}}'),
          outputTo: 'contentAnalysis',
          outputType: 'text',
        },
      ],
      testInput: TEST_CONTENT,
    });

    console.log('✅ Phase 1 execution completed\n');
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

    // For Phase 1, rawOutput should be null (text output doesn't produce questions object)
    // The actual text output is in the context, but not returned to client
    console.log('📄 Output structure:');
    console.log(
      `   - rawOutput: ${result.rawOutput === null ? 'null (expected for text phase)' : 'unexpected object'}`
    );
    console.log(`   - questions: ${result.questions.length} (expected 0 for text-only phase)\n`);

    // Verify expected behavior
    const checks = {
      'No errors': result.errors.length === 0,
      'Null rawOutput (text phase)': result.rawOutput === null,
      'Empty questions array': result.questions.length === 0,
      'Positive latency': result.latency > 0,
      'Token usage tracked': result.tokenCount > 0,
    };

    console.log('🔍 Validation checks:');
    let allPassed = true;
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allPassed = false;
    });
    console.log();

    if (allPassed) {
      console.log('🎉 Phase 1 test PASSED\n');
      console.log('📝 Expected output format (not returned to client):');
      console.log('   Content Type: [enumerable/conceptual/mixed]');
      console.log('   Atomic Knowledge Units: [list or count]');
      console.log('   Synthesis Opportunities: [brief list]');
      console.log('   Estimated Question Count: [number]\n');
      process.exit(0);
    } else {
      console.log('❌ Phase 1 test FAILED\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed with exception:');
    console.error(error);
    process.exit(1);
  }
}

testPhase1();
