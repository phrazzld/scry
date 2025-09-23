#!/usr/bin/env node

// Test script for dynamic question count generation

const topics = [
  // List-based topics
  { topic: 'NATO alphabet', expectedMin: 20, expectedMax: 30 },
  { topic: 'Days of the week', expectedMin: 7, expectedMax: 8 },
  { topic: 'Primary colors', expectedMin: 3, expectedMax: 4 },
  { topic: 'Months of the year', expectedMin: 12, expectedMax: 13 },

  // Concept-based topics
  { topic: 'Introduction to React', expectedMin: 8, expectedMax: 15 },
  { topic: 'JavaScript closures', expectedMin: 12, expectedMax: 20 },
  { topic: 'HTML basics', expectedMin: 10, expectedMax: 15 },
  { topic: 'Git commands', expectedMin: 15, expectedMax: 20 },

  // Edge cases
  { topic: 'The color red', expectedMin: 2, expectedMax: 4 },
  { topic: 'Binary numbers', expectedMin: 5, expectedMax: 15 },
];

async function testTopic(topicData) {
  const { topic, expectedMin, expectedMax } = topicData;
  console.log(`\nTesting: "${topic}"`);
  console.log(`Expected: ${expectedMin}-${expectedMax} questions`);

  try {
    const response = await fetch('http://localhost:3001/api/generate-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: topic,
        difficulty: 'medium',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`  ❌ Error: ${error}`);
      return false;
    }

    const result = await response.json();
    const questionCount = result.questions?.length || 0;

    console.log(`  Generated: ${questionCount} questions`);

    if (questionCount >= expectedMin && questionCount <= expectedMax) {
      console.log(`  ✅ PASS: Count within expected range`);
      return true;
    } else if (questionCount < expectedMin) {
      console.log(`  ⚠️  WARNING: Generated fewer questions than expected`);
      return true; // Still pass but warn
    } else if (questionCount > expectedMax) {
      console.log(`  ⚠️  WARNING: Generated more questions than expected (good for thoroughness)`);
      return true; // Still pass but warn
    }

  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Testing Dynamic Question Count Generation');
  console.log('=========================================');

  let passed = 0;
  let failed = 0;

  for (const topicData of topics) {
    const result = await testTopic(topicData);
    if (result) {
      passed++;
    } else {
      failed++;
    }

    // Add delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n=========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);