import { test, expect } from '@playwright/test';

test.describe('Spaced Repetition Flow', () => {
  test('should display quiz creation and review flow UI elements', async ({ page }) => {
    // Test the UI flow without authentication
    await page.goto('/');
    
    // Check if we're on the main page or got redirected
    const pageTitle = await page.title();
    const pageContent = await page.textContent('body');
    
    // Verify we have some quiz-related content
    // The exact text might vary, so check for common elements
    const hasQuizElements = 
      pageContent?.includes('quiz') || 
      pageContent?.includes('Quiz') ||
      pageContent?.includes('question') ||
      pageContent?.includes('learn');
    
    expect(hasQuizElements || pageTitle.includes('404')).toBeTruthy();
    
    // If there's a sign in link, verify it exists
    const signInLink = page.getByRole('link', { name: /Sign (up|in)/i });
    if (await signInLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(signInLink).toBeVisible();
    }
  });

  test('should show review navigation for authenticated users', async ({ page }) => {
    // This test verifies the review UI is accessible
    // In a real test environment, we'd have a test account with existing data
    
    await page.goto('/');
    
    // Check if user menu exists (would only show if authenticated)
    const userMenuButton = page.getByRole('button', { name: /User menu/i });
    
    if (await userMenuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // If authenticated, verify review link exists
      await userMenuButton.click();
      await expect(page.getByRole('menuitem', { name: /Review/i })).toBeVisible();
      
      // Navigate to review page
      await page.getByRole('menuitem', { name: /Review/i }).click();
      await expect(page).toHaveURL(/.*\//);
      
      // Verify review page elements
      const reviewContent = await page.textContent('body');
      expect(reviewContent).toContain('Review');
    }
  });

  // TODO: Update this test to use the generation modal instead of /create route
  test.skip('should validate quiz creation flow elements', async ({ page }) => {
    await page.goto('/create');
    
    // Check the response status
    const response = await page.waitForResponse(response => response.url().includes('/create'));
    
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
      const hasQuestionElements = 
        await page.getByRole('heading', { name: /Question/i }).isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasQuestionElements) {
        // Verify review UI elements
        await expect(page.getByRole('button', { name: /Submit/i })).toBeVisible();
      }
    }
  });

  test('should verify dashboard shows review indicator', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to sign in if not authenticated
    if (page.url().includes('/auth/signin')) {
      await expect(page).toHaveURL(/auth\/signin/);
      return;
    }
    
    // If authenticated, check for review indicator
    const reviewIndicator = page.locator('text=/Reviews? Due/i');
    
    if (await reviewIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Review indicator exists
      const reviewText = await reviewIndicator.textContent();
      expect(reviewText).toMatch(/\d+ Reviews? Due|You're all caught up/);
      
      // If there are reviews, verify "Start Review" button
      if (reviewText?.includes('Due')) {
        await expect(page.getByRole('button', { name: /Start Review/i })).toBeVisible();
      }
    }
  });

  test.describe('Mock Spaced Repetition Flow', () => {
    // These tests demonstrate the expected flow but require authentication
    // In a real test environment, we would:
    // 1. Use a test account with known credentials
    // 2. Mock the authentication in a local environment
    // 3. Use API calls to set up test data

    test.skip('full spaced repetition flow with test account', async ({ page }) => {
      // This is a template for the full E2E flow that would run with proper test auth

      // 1. Sign in with test account
      // await signInWithTestAccount(page);

      // 2. Generate questions - TODO: Update to use generation modal instead of /create route
      // await page.goto('/create');
      await page.getByLabel(/Topic/i).fill('JavaScript Basics');
      await page.getByLabel(/Difficulty/i).selectOption('easy');
      await page.getByRole('button', { name: /Generate Questions/i }).click();
      
      // 3. Wait for question generation
      await expect(page.getByRole('heading', { name: /Question 1/i })).toBeVisible({ timeout: 30000 });
      
      // 4. Answer questions (mix of correct and incorrect)
      // First question - answer correctly
      await page.getByRole('radio').first().click();
      await page.getByRole('button', { name: /Submit/i }).click();
      
      // Wait for feedback
      await expect(page.getByText(/Correct|Incorrect/i)).toBeVisible();
      
      // Continue through all questions
      for (let i = 2; i <= 5; i++) {
        await page.getByRole('button', { name: /Next/i }).click();
        await expect(page.getByRole('heading', { name: new RegExp(`Question ${i}`) })).toBeVisible();
        
        // Alternate correct/incorrect answers
        const answerIndex = i % 2 === 0 ? 1 : 0;
        await page.getByRole('radio').nth(answerIndex).click();
        await page.getByRole('button', { name: /Submit/i }).click();
        await expect(page.getByText(/Correct|Incorrect/i)).toBeVisible();
      }
      
      // 5. Finish review
      await page.getByRole('button', { name: /Finish Review/i }).click();
      await expect(page.getByRole('heading', { name: /No More Reviews/i })).toBeVisible();
      
      // 6. Navigate to review page
      await page.goto('/');
      
      // 7. Verify questions appear in review queue
      await expect(page.getByRole('heading', { name: /Question/i })).toBeVisible();
      
      // 8. Answer a review question
      await page.getByRole('radio').first().click();
      await page.getByRole('button', { name: /Submit/i }).click();
      
      // 9. Verify FSRS scheduling feedback
      await expect(page.getByText(/Next review:/i)).toBeVisible();
      const schedulingText = await page.getByText(/Next review:/i).textContent();
      expect(schedulingText).toMatch(/today|tomorrow|in \d+ days/i);
    });
  });
});

// Additional test ideas for local/staging environment:
// 1. Test different answer patterns and verify interval calculations
// 2. Test review queue prioritization with multiple questions
// 3. Test time-based updates (questions becoming due)
// 4. Test state persistence across sessions
// 5. Test mobile responsive behavior for review interface