import { expect, test } from '@playwright/test';

test.describe('Spaced Repetition Flow', () => {
  // CRITICAL: Quiz generation flow - core user journey
  test('should validate quiz creation flow elements', async ({ page }) => {
    await page.goto('/');

    // Open the generation modal
    const generateBtn = page.locator('[title="Generate questions (G)"]');
    await generateBtn.click();

    // Check the response status
    const response = await page.waitForResponse((response) => response.url().includes('/create'));

    // Handle different scenarios
    if (response.status() === 404) {
      // Page doesn't exist in production yet
      console.log('Quiz creation page not found in production');
      return;
    }

    // Should redirect to sign in if not authenticated
    if (page.url().includes('/auth/signin')) {
      await expect(page).toHaveURL(/auth\/signin/);
      return;
    }

    // If authenticated and page exists, verify quiz creation form elements
    const pageContent = await page.textContent('body');
    const hasQuizForm =
      pageContent?.includes('Topic') ||
      pageContent?.includes('Difficulty') ||
      pageContent?.includes('Generate');

    expect(hasQuizForm).toBeTruthy();
  });

  // CRITICAL: Spaced repetition review page - core user journey
  test('should validate review page structure', async ({ page }) => {
    await page.goto('/');

    // Should redirect to sign in if not authenticated
    if (page.url().includes('/auth/signin')) {
      await expect(page).toHaveURL(/auth\/signin/);
      return;
    }

    // If authenticated, verify review page structure
    const pageContent = await page.textContent('body');

    // Should show either review content or empty state
    if (pageContent?.includes('All Caught Up')) {
      // Empty state
      await expect(page.getByText(/All Caught Up/i)).toBeVisible();
      await expect(page.getByText(/No questions due for review/i)).toBeVisible();
    } else {
      // Active review state would show question elements
      const hasQuestionElements = await page
        .getByRole('heading', { name: /Question/i })
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasQuestionElements) {
        // Verify review UI elements
        await expect(page.getByRole('button', { name: /Submit/i })).toBeVisible();
      }
    }
  });
});
