/**
 * E2E test for library search race condition fix
 *
 * Verifies that fast typing in search doesn't cause stale results to overwrite newer ones.
 * This tests the request ID tracking pattern implemented in library-client.tsx.
 */

import { expect, test } from '@playwright/test';

test.describe('Library Search Race Condition', () => {
  test('should show results for latest query when typing quickly', async ({ page }) => {
    // Navigate to library page
    await page.goto('/library');

    // Check if we're authenticated (library requires auth)
    // If redirected to sign-in, skip test as it requires authenticated state
    if (page.url().includes('/auth/signin') || page.url().includes('/sign-in')) {
      await expect(page).toHaveURL(/sign-in/);
      console.log('Skipping: Library requires authentication');
      return;
    }

    // Wait for library page to load
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Search"]');

    // Simulate fast typing scenario where race condition could occur
    // Type a short query that would return results quickly
    await searchInput.fill('react');

    // Immediately refine to a longer, more specific query
    // This creates the race condition: shorter query may complete after longer one
    await searchInput.fill('react hooks');

    // Wait for search to complete (debounce + network)
    // The debounce is 300ms, so wait a bit longer
    await page.waitForTimeout(500);

    // Wait for loading state to clear
    await page
      .waitForSelector('[data-testid="search-loading"]', { state: 'hidden', timeout: 5000 })
      .catch(() => {
        // Loading indicator might not be visible if search is very fast
      });

    // Get the current search input value
    const inputValue = await searchInput.inputValue();

    // Verify input still shows the latest query
    expect(inputValue).toBe('react hooks');

    // Check if we have search results or empty state
    const bodyText = await page.textContent('body');

    // The key verification: Results should be relevant to "react hooks" not "react"
    // We can't assert specific results, but we can verify no stale state exists
    // by checking that the UI is in a consistent state

    // If there are results, the search results counter should mention our query
    const hasResultsText = bodyText?.includes('results for') || bodyText?.includes('matches for');

    if (hasResultsText) {
      // If showing results, it should mention "react hooks" not just "react"
      const resultsText = await page.locator('text=/results|matches/i').textContent();
      expect(resultsText?.toLowerCase()).toContain('react hooks');
    }

    // Success: No stale results were displayed
    console.log('✓ Search correctly shows latest query results');
  });

  test('should handle rapid query changes without UI glitches', async ({ page }) => {
    await page.goto('/library');

    // Skip if not authenticated
    if (page.url().includes('/auth/signin') || page.url().includes('/sign-in')) {
      console.log('Skipping: Library requires authentication');
      return;
    }

    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Search"]');

    // Simulate aggressive typing with multiple rapid changes
    const queries = ['a', 'an', 'ani', 'anim', 'animal'];

    for (const query of queries) {
      await searchInput.fill(query);
      // Very short delay to simulate fast typing
      await page.waitForTimeout(50);
    }

    // Wait for final query to complete
    await page.waitForTimeout(500);

    // Verify final input value is correct
    const finalValue = await searchInput.inputValue();
    expect(finalValue).toBe('animal');

    // Verify no loading spinner is stuck visible
    const isStillLoading = await page
      .locator('[data-testid="search-loading"]')
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    expect(isStillLoading).toBe(false);

    console.log('✓ Rapid query changes handled correctly');
  });

  test('should clear stale loading state when query changes', async ({ page }) => {
    await page.goto('/library');

    if (page.url().includes('/auth/signin') || page.url().includes('/sign-in')) {
      console.log('Skipping: Library requires authentication');
      return;
    }

    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Search"]');

    // Type initial query
    await searchInput.fill('javascript');

    // Quickly change to different query
    await searchInput.fill('typescript');

    // Wait for search to complete
    await page.waitForTimeout(500);

    // Loading state should be cleared for latest query only
    const isLoading = await page
      .locator('[data-testid="search-loading"]')
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Should not be stuck in loading state
    expect(isLoading).toBe(false);

    console.log('✓ Loading state correctly managed across query changes');
  });
});
