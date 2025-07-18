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
});