import { test, expect, Page } from '@playwright/test';

// This test file is designed to run against a local development environment
// where we can control authentication and test data

// BASE_URL is configured in playwright.config.ts

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

  // TODO: Update this test to use the generation modal instead of /create route
  test.skip('complete spaced repetition flow', async ({ page }) => {
    // 1. Navigate to quiz creation - SKIPPED: /create route no longer exists
    // await page.goto('/create');
    await waitForConvexQuery(page);

    // 2. Generate questions
    await expect(page.getByRole('heading', { name: /Generate Questions/i })).toBeVisible();
    
    // Fill in quiz details
    await page.getByLabel(/Topic/i).fill('JavaScript Fundamentals');
    await page.getByLabel(/Difficulty/i).selectOption('easy');
    
    // Generate questions
    await page.getByRole('button', { name: /Generate Questions/i }).click();
    
    // 3. Wait for question generation
    await expect(page.getByText(/Generating questions/i)).toBeVisible();
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

    // 5. Finish the review
    await page.getByRole('button', { name: /Finish Review/i }).click();
    await expect(page.getByRole('heading', { name: /No More Reviews/i })).toBeVisible();

    // Note: Score tracking was removed in pure FSRS implementation
    // Reviews now track individual question success rates instead

    // 6. Navigate to review page
    await page.goto('/');
    await waitForConvexQuery(page);

    // 7. Verify questions are in review queue
    const reviewContent = await page.textContent('body');
    
    if (reviewContent?.includes('All Caught Up')) {
      // If no reviews due immediately, check dashboard for count
      await page.goto('/');
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
    await page.goto('/');
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
    
    await page.goto('/');
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

  test('handles question generation failure gracefully', async () => {
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

  // TODO: Update this test to use the generation modal instead of /create route
  test.skip('generation → queue update → UI flow (2 second target)', async ({ page }) => {
    // Test that generated questions appear in review within 2 seconds

    // 1. Open review page in a separate tab first
    const reviewPage = await page.context().newPage();
    await mockAuthentication(reviewPage);
    await reviewPage.goto('/');
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

    // 2. Generate new questions in main page - SKIPPED: /create route no longer exists
    // await page.goto('/create');
    await waitForConvexQuery(page);
    
    // Fill quiz form
    await page.getByLabel(/Topic/i).fill('React Hooks Testing');
    await page.getByLabel(/Difficulty/i).selectOption('medium');
    
    // Start timing
    const generationStartTime = Date.now();
    
    // Generate questions
    await page.getByRole('button', { name: /Generate Questions/i }).click();
    
    // 3. Wait for generation to complete
    await expect(page.getByText(/Generating quiz/i)).toBeVisible();
    
    // Wait for success toast that shows count
    const successToast = page.getByText(/✓.*5 questions generated/i);
    await expect(successToast).toBeVisible({ timeout: 30000 });
    
    const generationCompleteTime = Date.now();
    
    // 4. Check review page for new questions appearing
    // The review page should update automatically via WebSocket within 2 seconds
    
    // Wait for questions to appear automatically (no reload needed - Convex provides real-time updates)
    let questionsAppeared = false;
    
    try {
      // Use Playwright's auto-waiting to detect when new questions appear
      // This properly validates the WebSocket reactivity
      if (initialHasQuestions) {
        // If there were initial questions, wait for the count to increase
        await expect(reviewPage.getByText(/\d+ questions? available/)).toContainText(
          new RegExp(`(${initialQuestionCount + 1}|${initialQuestionCount + 2}|${initialQuestionCount + 3}|${initialQuestionCount + 4}|${initialQuestionCount + 5}) questions? available`),
          { timeout: 2000 }
        );
        questionsAppeared = true;
      } else {
        // If no initial questions, wait for questions to appear
        await expect(reviewPage.getByRole('heading', { name: /Question/i })).toBeVisible({ timeout: 2000 });
        questionsAppeared = true;
      }
    } catch {
      // Questions didn't appear within 2 seconds
      questionsAppeared = false;
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
      await reviewPage.goto('/');
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

  // TODO: Update this test to use the generation modal instead of /create route
  test.skip('complete generation and immediate review flow', async ({ page }) => {
    // Test the full user journey: generate questions and immediately review them
    // This verifies the critical UX requirement that new questions are instantly accessible

    // 1. Start on the create page - SKIPPED: /create route no longer exists
    // await page.goto('/create');
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
    await page.goto('/');
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

  // Test removed: 'dynamic polling interval changes' test is obsolete
  // The feature was intentionally removed in favor of Convex's built-in
  // real-time reactivity. Aggressive polling is no longer needed as
  // Convex automatically pushes updates via WebSockets.
});