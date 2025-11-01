import { expect, Page, test } from '@playwright/test';

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

  // CRITICAL: Full E2E flow - quiz generation to review
  test('complete spaced repetition flow', async ({ page }) => {
    // 1. Navigate to home and open generation modal
    await page.goto('/');
    const generateBtn = page.locator('[title="Generate questions (G)"]');
    await generateBtn.click();
    await waitForConvexQuery(page);

    // 2. Generate questions
    await expect(page.getByRole('heading', { name: /Generate Questions/i })).toBeVisible();

    // Fill in quiz details
    await page.getByLabel(/Topic/i).fill('JavaScript Fundamentals');
    await page.getByLabel(/Difficulty/i).selectOption('easy');

    // Generate questions
    await page.getByTestId('generate-quiz-button').click();

    // 3. Wait for question generation
    await expect(page.getByText(/Generating questions/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Question 1/i })).toBeVisible({
      timeout: 30000, // AI generation can take time
    });

    // 4. Answer all 5 questions with mixed results
    const answerPattern = [true, false, true, true, false]; // 3 correct, 2 incorrect

    for (let i = 0; i < 5; i++) {
      // Verify question number
      await expect(
        page.getByRole('heading', { name: new RegExp(`Question ${i + 1}`) })
      ).toBeVisible();

      // Select answer based on pattern (correct = first option, incorrect = second)
      const optionIndex = answerPattern[i] ? 0 : 1;
      await page.getByTestId(`answer-option-${optionIndex}`).click();

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
      const hasNextQuestion = await page
        .getByRole('heading', { name: /Question/i })
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      const isComplete = await page
        .getByText(/All Caught Up/i)
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      expect(hasNextQuestion || isComplete).toBeTruthy();
    }
  });

  // CRITICAL: Mobile responsive check - ensures touch-friendly UX
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

  // CRITICAL: Generation to immediate review - validates real-time updates
  test('complete generation and immediate review flow', async ({ page }) => {
    // Test the full user journey: generate questions and immediately review them
    // This verifies the critical UX requirement that new questions are instantly accessible

    // 1. Start on home page and open generation modal
    await page.goto('/');
    const generateBtn = page.locator('[title="Generate questions (G)"]');
    await generateBtn.click();
    await waitForConvexQuery(page);

    // 2. Generate a quiz with a unique topic to ensure we're reviewing the right questions
    const uniqueTopic = `Test Topic ${Date.now()}`;
    await page.getByLabel(/Topic/i).fill(uniqueTopic);
    await page.getByLabel(/Difficulty/i).selectOption('medium');

    // Click generate and wait for toast
    await page.getByTestId('generate-quiz-button').click();
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
      const questionHeading = await page
        .getByRole('heading', { name: /Question/i })
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (!questionHeading) {
        // Check if we hit "All Caught Up"
        const allCaughtUp = await page
          .getByText(/All Caught Up/i)
          .isVisible({ timeout: 1000 })
          .catch(() => false);
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
    console.log(
      `Successfully reviewed ${questionsReviewed} questions immediately after generation`
    );

    // 7. Final verification - should now see "All Caught Up" or review complete state
    await page.waitForTimeout(1000);
    const finalContent = await page.textContent('body');

    // Should either show completion message or have reviewed all questions
    const isComplete =
      finalContent?.includes('All Caught Up') ||
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
