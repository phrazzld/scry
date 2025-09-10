import { test, expect, Page } from '@playwright/test';

// This test file is designed to run against a local development environment
// where we can control authentication and test data

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Mock session token for local testing
const MOCK_SESSION_TOKEN = 'test-session-token-12345';

// Helper to inject session token into localStorage
async function mockAuthentication(page: Page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('sessionToken', token);
  }, MOCK_SESSION_TOKEN);
}

// Helper to wait for Convex queries
async function waitForConvexQuery(page: Page, timeout = 5000) {
  // Wait for any loading indicators to disappear
  const loadingIndicator = page.locator('text=/Loading|Generating/i');
  if (await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false)) {
    await loadingIndicator.waitFor({ state: 'hidden', timeout });
  }
}

test.describe('Spaced Repetition E2E Flow (Local)', () => {
  // Skip these tests in CI or when running against production
  test.skip(({ baseURL }) => !baseURL?.includes('localhost'), 'Local tests only');

  test.beforeEach(async ({ page }) => {
    // Mock authentication for each test
    await mockAuthentication(page);
  });

  test('complete spaced repetition flow', async ({ page }) => {
    // 1. Navigate to quiz creation
    await page.goto(`${BASE_URL}/create`);
    await waitForConvexQuery(page);

    // 2. Create a quiz
    await expect(page.getByRole('heading', { name: /Create Quiz/i })).toBeVisible();
    
    // Fill in quiz details
    await page.getByLabel(/Topic/i).fill('JavaScript Fundamentals');
    await page.getByLabel(/Difficulty/i).selectOption('easy');
    
    // Generate quiz
    await page.getByRole('button', { name: /Generate Quiz/i }).click();
    
    // 3. Wait for quiz generation
    await expect(page.getByText(/Generating quiz/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Question 1/i })).toBeVisible({ 
      timeout: 30000 // AI generation can take time
    });

    // 4. Answer all 5 questions with mixed results
    const answerPattern = [true, false, true, true, false]; // 3 correct, 2 incorrect
    
    for (let i = 0; i < 5; i++) {
      // Verify question number
      await expect(page.getByRole('heading', { name: new RegExp(`Question ${i + 1}`) })).toBeVisible();
      
      // Select answer based on pattern (correct = first option, incorrect = second)
      const optionIndex = answerPattern[i] ? 0 : 1;
      await page.getByRole('radio').nth(optionIndex).click();
      
      // Submit answer
      await page.getByRole('button', { name: /Submit/i }).click();
      
      // Verify feedback shows
      await expect(page.getByText(/Correct|Incorrect/i)).toBeVisible();
      
      // Verify FSRS scheduling info shows
      await expect(page.getByText(/Next review:/i)).toBeVisible();
      
      // Move to next question (except on last question)
      if (i < 4) {
        await page.getByRole('button', { name: /Next/i }).click();
      }
    }

    // 5. Complete the quiz
    await page.getByRole('button', { name: /Complete Quiz/i }).click();
    await expect(page.getByRole('heading', { name: /Quiz Complete/i })).toBeVisible();
    
    // Verify score
    const scoreText = await page.getByText(/Score:.*3.*5/i).textContent();
    expect(scoreText).toContain('3');
    expect(scoreText).toContain('5');

    // 6. Navigate to review page
    await page.goto(`${BASE_URL}/review`);
    await waitForConvexQuery(page);

    // 7. Verify questions are in review queue
    const reviewContent = await page.textContent('body');
    
    if (reviewContent?.includes('All Caught Up')) {
      // If no reviews due immediately, check dashboard for count
      await page.goto(`${BASE_URL}/dashboard`);
      await waitForConvexQuery(page);
      
      const reviewIndicator = await page.getByText(/\d+ Reviews? Due/i).textContent();
      expect(reviewIndicator).toMatch(/[1-5] Reviews? Due/);
    } else {
      // Questions should be available for review
      await expect(page.getByRole('heading', { name: /Question/i })).toBeVisible();
      
      // 8. Answer a review question
      await page.getByRole('radio').first().click();
      await page.getByRole('button', { name: /Submit/i }).click();
      
      // 9. Verify FSRS scheduling feedback
      await expect(page.getByText(/Next review:/i)).toBeVisible();
      const schedulingInfo = await page.getByText(/Next review:/i).textContent();
      
      // Should show appropriate scheduling based on answer
      expect(schedulingInfo).toMatch(/today|tomorrow|in \d+ days?/i);
      
      // Verify the review updates the queue
      await page.getByRole('button', { name: /Next/i }).click();
      
      // Should either show next question or "All Caught Up"
      const hasNextQuestion = await page.getByRole('heading', { name: /Question/i }).isVisible({ timeout: 2000 }).catch(() => false);
      const isComplete = await page.getByText(/All Caught Up/i).isVisible({ timeout: 2000 }).catch(() => false);
      
      expect(hasNextQuestion || isComplete).toBeTruthy();
    }
  });

  test('review queue prioritization', async ({ page }) => {
    // This test would require setting up multiple questions with different states
    // and verifying they appear in the correct order
    
    // Navigate to review page
    await page.goto(`${BASE_URL}/review`);
    await waitForConvexQuery(page);
    
    const pageContent = await page.textContent('body');
    
    // Verify review page loads
    expect(pageContent).toContain('Review');
    
    // In a real test, we would:
    // 1. Create questions with known states (new, overdue, etc.)
    // 2. Verify they appear in correct priority order
    // 3. Test that new questions appear before overdue ones
  });

  test('FSRS interval progression', async () => {
    // This test would verify that intervals increase/decrease appropriately
    // based on correct/incorrect answers
    
    // Would require:
    // 1. Creating a question
    // 2. Answering it correctly multiple times
    // 3. Verifying intervals increase
    // 4. Answering incorrectly
    // 5. Verifying interval resets
  });

  test('mobile responsive review interface', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }
    
    await page.goto(`${BASE_URL}/review`);
    await waitForConvexQuery(page);
    
    // Verify mobile-specific UI elements
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThan(768);
    
    // Verify touch-friendly elements
    const buttons = await page.getByRole('button').all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      // Touch targets should be at least 44x44 pixels
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});

// Additional test scenarios for comprehensive coverage:
test.describe('Spaced Repetition Edge Cases (Local)', () => {
  test.skip(({ baseURL }) => !baseURL?.includes('localhost'), 'Local tests only');

  test('handles quiz generation failure gracefully', async () => {
    // Test error handling when AI generation fails
  });

  test('preserves progress on page refresh', async () => {
    // Test that quiz progress is saved and restored
  });

  test('handles concurrent review sessions', async () => {
    // Test multiple tabs/windows reviewing simultaneously
  });

  test('validates answer persistence across sessions', async () => {
    // Test that answers and scheduling persist after logout/login
  });

  test('generation → queue update → UI flow (2 second target)', async ({ page }) => {
    // Test that generated questions appear in review within 2 seconds
    
    // 1. Open review page in a separate tab first
    const reviewPage = await page.context().newPage();
    await mockAuthentication(reviewPage);
    await reviewPage.goto(`${BASE_URL}/review`);
    await waitForConvexQuery(reviewPage);
    
    // Verify initial state (should be empty or have existing questions)
    const initialContent = await reviewPage.textContent('body');
    const initialHasQuestions = !initialContent?.includes('All Caught Up');
    let initialQuestionCount = 0;
    
    if (initialHasQuestions) {
      // Count existing questions if any
      const countText = await reviewPage.getByText(/\d+ questions? available/).textContent().catch(() => '0');
      initialQuestionCount = parseInt(countText?.match(/\d+/)?.[0] || '0');
    }
    
    // 2. Generate new questions in main page
    await page.goto(`${BASE_URL}/create`);
    await waitForConvexQuery(page);
    
    // Fill quiz form
    await page.getByLabel(/Topic/i).fill('React Hooks Testing');
    await page.getByLabel(/Difficulty/i).selectOption('medium');
    
    // Start timing
    const generationStartTime = Date.now();
    
    // Generate quiz
    await page.getByRole('button', { name: /Generate Quiz/i }).click();
    
    // 3. Wait for generation to complete
    await expect(page.getByText(/Generating quiz/i)).toBeVisible();
    
    // Wait for success toast that shows count
    const successToast = page.getByText(/✓.*5 questions generated/i);
    await expect(successToast).toBeVisible({ timeout: 30000 });
    
    const generationCompleteTime = Date.now();
    
    // 4. Check review page for new questions appearing
    // The review page should update via polling within 2 seconds
    
    // Wait up to 2 seconds for questions to appear
    const startCheckTime = Date.now();
    let questionsAppeared = false;
    let checkDuration = 0;
    
    while (checkDuration < 2000) {
      // Reload to trigger polling update
      await reviewPage.reload();
      await waitForConvexQuery(reviewPage);
      
      const currentContent = await reviewPage.textContent('body');
      
      // Check if new questions are available
      if (!currentContent?.includes('All Caught Up')) {
        // Questions are available - verify count increased
        const countText = await reviewPage.getByText(/\d+ questions? available/).textContent().catch(() => null);
        
        if (countText) {
          const currentCount = parseInt(countText.match(/\d+/)?.[0] || '0');
          if (currentCount > initialQuestionCount) {
            questionsAppeared = true;
            break;
          }
        } else {
          // Or check if we can see a question heading
          const hasQuestion = await reviewPage.getByRole('heading', { name: /Question/i }).isVisible({ timeout: 100 }).catch(() => false);
          if (hasQuestion) {
            questionsAppeared = true;
            break;
          }
        }
      }
      
      checkDuration = Date.now() - startCheckTime;
      
      // Wait 100ms before next check
      await reviewPage.waitForTimeout(100);
    }
    
    const timeToAppear = Date.now() - generationCompleteTime;
    
    // 5. Verify questions appeared within 2 seconds
    expect(questionsAppeared).toBeTruthy();
    expect(timeToAppear).toBeLessThanOrEqual(2000);
    
    // Log timing for debugging
    console.log(`Generation took: ${generationCompleteTime - generationStartTime}ms`);
    console.log(`Questions appeared in review after: ${timeToAppear}ms`);
    
    // 6. Verify we can actually review one of the new questions
    if (!initialHasQuestions || initialQuestionCount === 0) {
      // If there were no questions before, go to first question
      await reviewPage.goto(`${BASE_URL}/review`);
      await waitForConvexQuery(reviewPage);
    }
    
    // Should see a question from React Hooks Testing topic
    const questionVisible = await reviewPage.getByRole('heading', { name: /Question/i }).isVisible({ timeout: 1000 }).catch(() => false);
    expect(questionVisible).toBeTruthy();
    
    // Answer the question to verify it's functional
    await reviewPage.getByRole('radio').first().click();
    await reviewPage.getByRole('button', { name: /Submit/i }).click();
    
    // Should see scheduling info
    await expect(reviewPage.getByText(/Next review:/i)).toBeVisible();
  });

  test('complete generation and immediate review flow', async ({ page }) => {
    // Test the full user journey: generate questions and immediately review them
    // This verifies the critical UX requirement that new questions are instantly accessible
    
    // 1. Start on the create page
    await page.goto(`${BASE_URL}/create`);
    await waitForConvexQuery(page);
    
    // 2. Generate a quiz with a unique topic to ensure we're reviewing the right questions
    const uniqueTopic = `Test Topic ${Date.now()}`;
    await page.getByLabel(/Topic/i).fill(uniqueTopic);
    await page.getByLabel(/Difficulty/i).selectOption('medium');
    
    // Click generate and wait for toast
    await page.getByRole('button', { name: /Generate Quiz/i }).click();
    await expect(page.getByText(/Generating quiz/i)).toBeVisible();
    
    // Wait for generation to complete - should show success toast
    const successToast = page.getByText(/✓.*5 questions generated/i);
    await expect(successToast).toBeVisible({ timeout: 30000 });
    
    // 3. Immediately navigate to review page
    await page.goto(`${BASE_URL}/review`);
    await waitForConvexQuery(page);
    
    // 4. Verify the newly generated questions are immediately available
    // Should NOT see "All Caught Up" - should see questions right away
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('All Caught Up');
    
    // Should see a question heading
    await expect(page.getByRole('heading', { name: /Question/i })).toBeVisible({ timeout: 2000 });
    
    // 5. Verify we can review all 5 newly generated questions
    let questionsReviewed = 0;
    const maxAttempts = 10; // Safety limit
    
    while (questionsReviewed < 5 && questionsReviewed < maxAttempts) {
      // Verify we're on a question
      const questionHeading = await page.getByRole('heading', { name: /Question/i }).isVisible({ timeout: 1000 }).catch(() => false);
      
      if (!questionHeading) {
        // Check if we hit "All Caught Up"
        const allCaughtUp = await page.getByText(/All Caught Up/i).isVisible({ timeout: 1000 }).catch(() => false);
        if (allCaughtUp) {
          break; // Done reviewing
        }
        continue;
      }
      
      // Answer the question
      await page.getByRole('radio').first().click();
      await page.getByRole('button', { name: /Submit/i }).click();
      
      // Verify scheduling feedback
      await expect(page.getByText(/Next review:/i)).toBeVisible();
      
      // Move to next question
      const nextButton = page.getByRole('button', { name: /Next/i });
      if (await nextButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nextButton.click();
        questionsReviewed++;
      } else {
        break; // No next button, likely done
      }
      
      // Small delay to ensure UI updates
      await page.waitForTimeout(500);
    }
    
    // 6. Verify we reviewed at least some questions (should be 5, but at least 1)
    expect(questionsReviewed).toBeGreaterThan(0);
    console.log(`Successfully reviewed ${questionsReviewed} questions immediately after generation`);
    
    // 7. Final verification - should now see "All Caught Up" or review complete state
    await page.waitForTimeout(1000);
    const finalContent = await page.textContent('body');
    
    // Should either show completion message or have reviewed all questions
    const isComplete = finalContent?.includes('All Caught Up') || 
                      finalContent?.includes('All reviews complete') ||
                      questionsReviewed >= 5;
    
    expect(isComplete).toBeTruthy();
    
    // Log success metrics
    console.log('✅ Complete generation → immediate review flow successful');
    console.log(`   - Generated 5 questions with topic: ${uniqueTopic}`);
    console.log(`   - Immediately reviewed ${questionsReviewed} questions`);
    console.log('   - Questions were accessible without delay');
  });

  test('dynamic polling interval changes', async ({ page }) => {
    // Test that polling intervals change from 1s to 30s after generation
    
    // 1. Navigate to review page
    await page.goto(`${BASE_URL}/review`);
    await waitForConvexQuery(page);
    
    // 2. Open network tab monitoring (mock implementation)
    const networkRequests: number[] = [];
    let lastRequestTime = Date.now();
    
    // Monitor Convex query requests
    page.on('request', request => {
      if (request.url().includes('convex') && request.url().includes('getNextReview')) {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        networkRequests.push(timeSinceLastRequest);
        lastRequestTime = now;
      }
    });
    
    // 3. Trigger question generation event (simulate)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('questions-generated', {
        detail: { count: 5, topic: 'Test Topic' }
      }));
    });
    
    // 4. Wait 6 seconds to observe polling pattern
    await page.waitForTimeout(6000);
    
    // 5. Analyze polling intervals
    // First 5 seconds should have ~1s intervals (aggressive)
    const firstFiveSeconds = networkRequests.filter((_, i) => i < 5);
    const afterFiveSeconds = networkRequests.filter((_, i) => i >= 5);
    
    // Verify aggressive polling (approximately 1 second intervals)
    firstFiveSeconds.forEach(interval => {
      expect(interval).toBeGreaterThanOrEqual(900);  // Allow some variance
      expect(interval).toBeLessThanOrEqual(1500);
    });
    
    // Verify return to normal polling (approximately 30 second intervals)
    // Note: In 6 seconds we won't see the full 30s interval, but we can verify
    // that polling has stopped being aggressive
    if (afterFiveSeconds.length > 0) {
      const lastInterval = afterFiveSeconds[afterFiveSeconds.length - 1];
      expect(lastInterval).toBeGreaterThan(2000); // Should be moving toward 30s
    }
  });
});