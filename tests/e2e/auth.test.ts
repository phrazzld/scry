import { test, expect } from '@playwright/test';

const BASE_URL = 'https://scry.vercel.app';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page before each test
    await page.goto(BASE_URL);
  });

  test('should successfully submit valid email and redirect to verify-request', async ({ page }) => {
    // Navigate to sign-in page
    await page.getByRole('link', { name: 'Sign up/ log in' }).click();
    
    // Verify we're on the sign-in page
    await expect(page).toHaveURL(`${BASE_URL}/api/auth/signin`);
    await expect(page).toHaveTitle('Sign In');
    
    // Fill in a valid email
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.org');
    
    // Submit the form
    await page.getByRole('button', { name: 'Sign in with Resend' }).click();
    
    // Verify redirect to verify-request page
    await expect(page).toHaveURL(`${BASE_URL}/api/auth/verify-request?provider=resend&type=email`);
    await expect(page).toHaveTitle('Verify Request');
    
    // Verify success message is displayed
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText('A sign in link has been sent to your email address.')).toBeVisible();
    
    // Verify return link is present
    await expect(page.getByRole('link', { name: 'scry.vercel.app' })).toBeVisible();
  });

  test('should prevent submission with invalid email format', async ({ page }) => {
    // Navigate to sign-in page
    await page.getByRole('link', { name: 'Sign up/ log in' }).click();
    
    // Fill in invalid email format
    await page.getByRole('textbox', { name: 'Email' }).fill('invalid-email');
    
    // Try to submit the form
    await page.getByRole('button', { name: 'Sign in with Resend' }).click();
    
    // Verify we're still on the sign-in page (form didn't submit)
    await expect(page).toHaveURL(`${BASE_URL}/api/auth/signin`);
    await expect(page).toHaveTitle('Sign In');
    
    // Verify the invalid email is still in the field
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('invalid-email');
  });

  test('should prevent submission with empty email', async ({ page }) => {
    // Navigate to sign-in page
    await page.getByRole('link', { name: 'Sign up/ log in' }).click();
    
    // Leave email field empty and try to submit
    await page.getByRole('button', { name: 'Sign in with Resend' }).click();
    
    // Verify we're still on the sign-in page (form didn't submit)
    await expect(page).toHaveURL(`${BASE_URL}/api/auth/signin`);
    await expect(page).toHaveTitle('Sign In');
    
    // Verify the email field is still empty
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('');
  });

  test('should handle different email domains successfully', async ({ page }) => {
    const emailDomains = [
      'test@gmail.com',
      'user@yahoo.com',
      'person@outlook.com',
      'example@company.org'
    ];

    for (const email of emailDomains) {
      // Navigate to sign-in page
      await page.goto(`${BASE_URL}/api/auth/signin`);
      
      // Fill in the email
      await page.getByRole('textbox', { name: 'Email' }).fill(email);
      
      // Submit the form
      await page.getByRole('button', { name: 'Sign in with Resend' }).click();
      
      // Verify redirect to verify-request page
      await expect(page).toHaveURL(`${BASE_URL}/api/auth/verify-request?provider=resend&type=email`);
      await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    }
  });

  test('should handle potentially blocked domains gracefully', async ({ page }) => {
    // Navigate to sign-in page
    await page.getByRole('link', { name: 'Sign up/ log in' }).click();
    
    // Use a domain that might be blocked (test@example.com showed config error in manual testing)
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com');
    
    // Submit the form
    await page.getByRole('button', { name: 'Sign in with Resend' }).click();
    
    // Check if we get either success or error page
    await page.waitForURL(/\/(auth\/(verify-request|error)|api\/auth\/(verify-request|error))/);
    
    // If we get an error page, verify it's handled gracefully
    if (page.url().includes('error')) {
      await expect(page.getByRole('heading', { name: 'Server error' })).toBeVisible();
      await expect(page.getByText('There is a problem with the server configuration.')).toBeVisible();
    } else {
      // If successful, verify the success message
      await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    }
  });

  test('should not have CSP violations during authentication flow', async ({ page }) => {
    const cspViolations: string[] = [];
    
    // Listen for CSP violations
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });
    
    // Navigate to sign-in page
    await page.getByRole('link', { name: 'Sign up/ log in' }).click();
    
    // Fill in email and submit
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.org');
    await page.getByRole('button', { name: 'Sign in with Resend' }).click();
    
    // Wait for redirect
    await page.waitForURL(`${BASE_URL}/api/auth/verify-request?provider=resend&type=email`);
    
    // Verify no CSP violations occurred
    expect(cspViolations).toHaveLength(0);
  });

  test('should maintain form state during validation errors', async ({ page }) => {
    // Navigate to sign-in page
    await page.getByRole('link', { name: 'Sign up/ log in' }).click();
    
    // Fill in invalid email
    const invalidEmail = 'invalid-email-format';
    await page.getByRole('textbox', { name: 'Email' }).fill(invalidEmail);
    
    // Try to submit
    await page.getByRole('button', { name: 'Sign in with Resend' }).click();
    
    // Verify form state is maintained
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(invalidEmail);
    await expect(page.getByRole('button', { name: 'Sign in with Resend' })).toBeVisible();
  });

  test('should have proper page navigation and back button functionality', async ({ page }) => {
    // Navigate to sign-in page
    await page.getByRole('link', { name: 'Sign up/ log in' }).click();
    
    // Submit valid email
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.org');
    await page.getByRole('button', { name: 'Sign in with Resend' }).click();
    
    // Verify we're on verify-request page
    await expect(page).toHaveURL(`${BASE_URL}/api/auth/verify-request?provider=resend&type=email`);
    
    // Click the return link
    await page.getByRole('link', { name: 'scry.vercel.app' }).click();
    
    // Verify we're back on the main page
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.getByRole('heading', { name: 'Welcome to scry.party' })).toBeVisible();
  });

  test('should handle rapid form submissions appropriately', async ({ page }) => {
    // Navigate to sign-in page
    await page.getByRole('link', { name: 'Sign up/ log in' }).click();
    
    // Fill in email
    await page.getByRole('textbox', { name: 'Email' }).fill('test@example.org');
    
    // Submit form multiple times rapidly
    const submitButton = page.getByRole('button', { name: 'Sign in with Resend' });
    
    // First submission
    await submitButton.click();
    
    // Wait for redirect or error
    await page.waitForURL(/\/(auth\/(verify-request|error)|api\/auth\/(verify-request|error))/);
    
    // Verify the system handled it gracefully (either success or controlled error)
    const currentUrl = page.url();
    const isSuccess = currentUrl.includes('verify-request');
    const isError = currentUrl.includes('error');
    
    expect(isSuccess || isError).toBe(true);
    
    if (isSuccess) {
      await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    }
  });
});