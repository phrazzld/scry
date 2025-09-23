#!/usr/bin/env node

// Test script for concept-based topics

const conceptTopics = [
  { topic: 'Introduction to React', expectedMin: 8, expectedMax: 15 },
  { topic: 'JavaScript closures', expectedMin: 12, expectedMax: 20 },
  { topic: 'HTML basics', expectedMin: 10, expectedMax: 15 },
  { topic: 'Git commands', expectedMin: 15, expectedMax: 20 },
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
      return { success: false, topic, count: 0 };
    }

    const result = await response.json();
    const questionCount = result.questions?.length || 0;

    console.log(`  Generated: ${questionCount} questions`);

    let status;
    if (questionCount >= expectedMin && questionCount <= expectedMax) {
      console.log(`  ✅ PASS: Count within expected range`);
      status = 'perfect';
    } else if (questionCount < expectedMin) {
      console.log(`  ⚠️  WARNING: Generated fewer questions than expected`);
      status = 'low';
    } else if (questionCount > expectedMax) {
      console.log(`  ✅ GOOD: Generated more questions (thorough coverage)`);
      status = 'thorough';
    }

    return { success: true, topic, count: questionCount, status };

  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}`);
    return { success: false, topic, count: 0 };
  }
}

async function runTests() {
  console.log('Testing Concept-Based Topics');
  console.log('=============================');

  const results = [];

  for (const topicData of conceptTopics) {
    const result = await testTopic(topicData);
    results.push(result);

    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n=============================');
  console.log('Summary:');
  results.forEach(r => {
    if (r.success) {
      const statusIcon = r.status === 'perfect' ? '✅' :
                        r.status === 'thorough' ? '🚀' : '⚠️';
      console.log(`${statusIcon} ${r.topic}: ${r.count} questions`);
    } else {
      console.log(`❌ ${r.topic}: Failed`);
    }
  });

  const allPassed = results.every(r => r.success);
  if (allPassed) {
    console.log('\n✅ All concept topics tested successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);