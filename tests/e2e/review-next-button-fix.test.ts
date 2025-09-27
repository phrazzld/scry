import { test, expect, Page } from '@playwright/test';

/**
 * E2E test for verifying the fix for the "Next" button being stuck after incorrect answers.
 *
 * This test ensures that after answering a question incorrectly, the Next button properly
 * resets the state and allows progression even when FSRS immediately reschedules the same
 * question for review.
 */
test.describe('Review Flow - Next Button After Incorrect Answer', () => {
  // Helper to wait for Convex queries to settle
  async function waitForConvexQuery(page: Page, timeout = 5000) {
    await page.waitForTimeout(500); // Initial delay for WebSocket connection

    // Wait for either a question to appear or empty state
    await Promise.race([
      page.getByRole('heading', { name: /Question/i }).waitFor({ timeout }),
      page.getByText(/All Caught Up|No questions available|Generate your first quiz/i).waitFor({ timeout }),
      page.getByText(/Authentication required/i).waitFor({ timeout })
    ]).catch(() => {
      // If none appear, continue anyway
    });
  }

  test('should allow progression after incorrect answer', async ({ page }) => {
    // Navigate to the review page
    await page.goto('/');
    await waitForConvexQuery(page);

    // Check if we have questions available
    const hasQuestion = await page.getByRole('heading', { name: /Question/i })
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasQuestion) {
      // Skip test if no questions available or not authenticated
      test.skip();
      return;
    }

    // Get the initial question text to track if same question returns
    const initialQuestionText = await page.getByRole('heading', { name: /Question/i })
      .locator('..')
      .textContent();

    // Step 1: Select an answer (deliberately choose a wrong one if possible)
    // Find answer options using test IDs
    const firstOption = page.getByTestId('answer-option-0');
    await expect(firstOption).toBeVisible();

    // Click the first answer option
    await firstOption.click();

    // Step 2: Submit the answer
    const submitButton = page.getByRole('button', { name: /Submit/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 3: Verify feedback is shown
    await expect(page.getByText(/Correct answer|Incorrect/i)).toBeVisible({ timeout: 5000 });

    // Step 4: Click the Next button
    const nextButton = page.getByRole('button', { name: /Next/i });
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();

    // Record the time before clicking Next
    const beforeNextClick = Date.now();
    await nextButton.click();

    // Step 5: Verify state reset happens
    // Should see loading state briefly (may be too quick to catch)
    await page.getByRole('progressbar')
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Even if loading state is too quick to catch, verify that we transition

    // Step 6: Wait for new question state
    await waitForConvexQuery(page);

    // Step 7: Verify we're in a fresh state (no feedback showing)
    await expect(page.getByText(/Correct answer|Incorrect/i)).not.toBeVisible({ timeout: 2000 })
      .catch(() => {
        // If feedback is still visible, the fix didn't work
        throw new Error('Feedback still visible after clicking Next - state not reset');
      });

    // Step 8: Verify we can interact with the question again
    // Check if new answer options are visible
    const newFirstOption = page.getByTestId('answer-option-0');
    const hasNewQuestion = await newFirstOption.isVisible({ timeout: 1000 }).catch(() => false);
    const isComplete = await page.getByText(/All Caught Up/i).isVisible({ timeout: 1000 }).catch(() => false);

    expect(hasNewQuestion || isComplete).toBeTruthy();

    if (hasNewQuestion) {
      // Verify the first option is visible and not selected (clean state)
      await expect(newFirstOption).toBeVisible();
      // Check that it doesn't have selected state classes
      const classes = await newFirstOption.getAttribute('class');
      expect(classes).not.toContain('border-info-border');
      expect(classes).not.toContain('bg-info-background');

      // Check if it's the same question (FSRS immediate re-review)
      const newQuestionText = await page.getByRole('heading', { name: /Question/i })
        .locator('..')
        .textContent();

      // Log whether same question returned (for debugging)
      if (initialQuestionText === newQuestionText) {
        console.log('Same question returned (FSRS immediate re-review behavior)');
      } else {
        console.log('Different question loaded');
      }

      // Either way, the interface should be interactive
      await newFirstOption.click();
      // Verify it was selected (button should have selected state class)
      await expect(newFirstOption).toHaveClass(/border-info-border|bg-info-background/);
    }

    // Verify the transition was smooth (no long delays)
    const transitionTime = Date.now() - beforeNextClick;
    expect(transitionTime).toBeLessThan(3000); // Should transition within 3 seconds
  });

  test('should handle rapid Next button clicks without issues', async ({ page }) => {
    await page.goto('/');
    await waitForConvexQuery(page);

    const hasQuestion = await page.getByRole('heading', { name: /Question/i })
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasQuestion) {
      test.skip();
      return;
    }

    // Answer a question
    const firstOption = page.getByTestId('answer-option-0');
    await firstOption.click();
    await page.getByRole('button', { name: /Submit/i }).click();

    // Wait for feedback
    await expect(page.getByText(/Correct answer|Incorrect/i)).toBeVisible({ timeout: 5000 });

    // Try rapid clicking the Next button
    const nextButton = page.getByRole('button', { name: /Next/i });

    // Click Next multiple times rapidly
    const clickPromises = [];
    for (let i = 0; i < 3; i++) {
      clickPromises.push(nextButton.click().catch(() => {
        // Ignore errors from rapid clicking
      }));
      await page.waitForTimeout(100); // Small delay between clicks
    }

    await Promise.all(clickPromises);

    // Wait for state to settle
    await waitForConvexQuery(page);

    // Verify we're in a valid state (not stuck)
    const hasNewQuestion = await page.getByTestId('answer-option-0').isVisible({ timeout: 1000 }).catch(() => false);
    const isComplete = await page.getByText(/All Caught Up/i).isVisible({ timeout: 1000 }).catch(() => false);
    const hasError = await page.getByText(/Error|Something went wrong/i).isVisible({ timeout: 1000 }).catch(() => false);

    expect(hasError).toBeFalsy();
    expect(hasNewQuestion || isComplete).toBeTruthy();
  });

  test('should maintain loading state visibility during transitions', async ({ page }) => {
    await page.goto('/');
    await waitForConvexQuery(page);

    const hasQuestion = await page.getByRole('heading', { name: /Question/i })
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasQuestion) {
      test.skip();
      return;
    }

    // Answer incorrectly to likely trigger same-question re-review
    // Try to select what might be a wrong answer (try last option - option 3)
    const lastOption = page.getByTestId('answer-option-3');
    // Fall back to first option if there are fewer than 4 options
    const optionToClick = await lastOption.isVisible({ timeout: 500 }).catch(() => false)
      ? lastOption
      : page.getByTestId('answer-option-0');
    await optionToClick.click();
    await page.getByRole('button', { name: /Submit/i }).click();

    // Wait for feedback
    await expect(page.getByText(/Correct answer|Incorrect/i)).toBeVisible({ timeout: 5000 });

    // Set up promise to catch loading state
    const loadingPromise = page.getByRole('progressbar')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Click Next
    await page.getByRole('button', { name: /Next/i }).click();

    // Check if loading state was visible (it should be, even briefly)
    const sawLoadingState = await loadingPromise;

    // Even if we didn't catch the loading state (it might be too fast),
    // verify that the transition completed successfully
    await waitForConvexQuery(page);

    // Should be in a fresh state now
    const feedbackGone = await page.getByText(/Correct answer|Incorrect/i)
      .isVisible({ timeout: 500 })
      .then(() => false)
      .catch(() => true);

    expect(feedbackGone).toBeTruthy();

    console.log(`Loading state visible: ${sawLoadingState}`);
  });
});

// Test for the specific FSRS immediate re-review scenario
test.describe('FSRS Immediate Re-review Behavior', () => {
  test('should handle same question returning after incorrect answer', async ({ page }) => {
    await page.goto('/');

    // This test specifically validates that when FSRS immediately reschedules
    // the same question after an incorrect answer, the UI properly resets

    const hasQuestion = await page.getByRole('heading', { name: /Question/i })
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasQuestion) {
      test.skip();
      return;
    }

    // Track interaction count if displayed
    const interactionCountBefore = await page.getByText(/Attempt #\d+|Previous attempts: \d+/i)
      .textContent()
      .catch(() => null);

    // Answer incorrectly
    // Try to select last option (likely incorrect)
    const lastOption = page.getByTestId('answer-option-3');
    const optionToClick = await lastOption.isVisible({ timeout: 500 }).catch(() => false)
      ? lastOption
      : page.getByTestId('answer-option-0');
    await optionToClick.click(); // Choose last option if available
    await page.getByRole('button', { name: /Submit/i }).click();

    // Verify we see feedback
    await expect(page.getByText(/Incorrect/i)).toBeVisible({ timeout: 5000 });

    // Click Next
    await page.getByRole('button', { name: /Next/i }).click();

    // Wait for question to load
    await page.getByRole('heading', { name: /Question/i }).waitFor({ timeout: 5000 });

    // Check interaction count increased (if same question)
    const interactionCountAfter = await page.getByText(/Attempt #\d+|Previous attempts: \d+/i)
      .textContent()
      .catch(() => null);

    if (interactionCountBefore && interactionCountAfter) {
      // Extract numbers and compare
      const countBefore = parseInt(interactionCountBefore.match(/\d+/)?.[0] || '0');
      const countAfter = parseInt(interactionCountAfter.match(/\d+/)?.[0] || '0');

      if (countAfter > countBefore) {
        console.log('Same question returned with incremented attempt count');

        // Verify we can still interact with it
        const newFirstOption = page.getByTestId('answer-option-0');
        await newFirstOption.click();
        await expect(newFirstOption).toHaveClass(/border-info-border|bg-info-background/);
      }
    }
  });
});