/* eslint-disable react-hooks/rules-of-hooks */
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { test as base, Page } from '@playwright/test';

/**
 * Extended Playwright test with Clerk authentication helpers
 */
export const test = base.extend({
  // Automatically inject testing token for each test
  page: async ({ page }, use) => {
    await setupClerkTestingToken({ page });
    await use(page);
  },
});

/**
 * Get a testing token for manual use
 * Requires CLERK_SECRET_KEY to be set in environment
 */
export async function getTestAuthToken(): Promise<string | null> {
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn('CLERK_SECRET_KEY not set, cannot generate test token');
    return null;
  }

  // Testing token is automatically handled by setupClerkTestingToken
  // This is a placeholder for manual token generation if needed
  return 'test-token-placeholder';
}

/**
 * Authenticate a test page with Clerk test mode
 * This bypasses real authentication flow for E2E tests
 */
export async function authenticateTest(page: Page): Promise<void> {
  // Setup testing token to bypass bot detection
  await setupClerkTestingToken({ page });

  // Navigate to the app - should auto-authenticate in test mode
  await page.goto('/');

  // Wait for any auth redirects to complete
  await page.waitForLoadState('networkidle');
}

/**
 * Sign out from test authentication
 */
export async function signOutTest(page: Page): Promise<void> {
  // Clear Clerk cookies to sign out
  await page.context().clearCookies();
  await page.reload();
}

/**
 * Check if the current page is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check for presence of user menu button (only visible when authenticated)
  const userButton = page.getByRole('button', { name: /User/i });
  return await userButton.isVisible({ timeout: 1000 }).catch(() => false);
}

// Re-export expect from Playwright for convenience
export { expect } from '@playwright/test';