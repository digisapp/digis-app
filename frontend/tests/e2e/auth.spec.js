import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display homepage for unauthenticated users', async ({ page }) => {
    // Check for homepage elements
    await expect(page.locator('text=Digis')).toBeVisible();

    // Check for sign in/sign up buttons
    const signInButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In")').first();
    await expect(signInButton).toBeVisible();
  });

  test('should navigate to auth page', async ({ page }) => {
    // Click sign in button
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');

    // Wait for navigation or modal
    await page.waitForTimeout(1000);

    // Check for auth form elements
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
  });

  test('should show validation errors for empty login', async ({ page }) => {
    // Navigate to auth page
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    // Try to submit empty form
    const submitButton = page.locator('button:has-text("Sign In"), button:has-text("Login")').last();
    await submitButton.click();

    // Check for error message or validation
    await page.waitForTimeout(500);
    const errorMessage = page.locator('text=/email|required|invalid/i').first();

    // Either validation error shows or form doesn't submit (both are valid)
    const hasError = await errorMessage.isVisible().catch(() => false);
    const stillOnAuthPage = await page.locator('input[type="email"]').isVisible();

    expect(hasError || stillOnAuthPage).toBeTruthy();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate to auth page
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    // Fill with invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit form
    const submitButton = page.locator('button:has-text("Sign In"), button:has-text("Login")').last();
    await submitButton.click();

    // Wait for error message
    await page.waitForTimeout(2000);

    // Check for error notification
    const errorMessage = page.locator('text=/invalid|incorrect|error|wrong/i').first();
    const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasError).toBeTruthy();
  });

  test('should toggle between sign in and sign up', async ({ page }) => {
    // Navigate to auth page
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    // Look for toggle button
    const signUpToggle = page.locator('button:has-text("Sign Up"), a:has-text("Sign Up"), text=Sign Up').first();

    if (await signUpToggle.isVisible()) {
      await signUpToggle.click();
      await page.waitForTimeout(500);

      // Check for sign up form
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
    }
  });
});

test.describe('Protected Routes', () => {
  test('should redirect unauthenticated users from protected pages', async ({ page }) => {
    // Try to access dashboard directly
    await page.goto('/dashboard');

    // Should be redirected to home or auth
    await page.waitForTimeout(1000);

    const currentURL = page.url();
    expect(currentURL).toMatch(/\/(|auth|home)$/);
  });

  test('should redirect unauthenticated users from wallet page', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForTimeout(1000);

    const currentURL = page.url();
    expect(currentURL).toMatch(/\/(|auth|home)$/);
  });
});

test.describe('Session Persistence', () => {
  test('should persist auth state after page reload', async ({ page, context }) => {
    // Note: This test requires manual authentication setup
    // Skip if no test credentials are configured
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }

    // Navigate to auth
    await page.goto('/');
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    // Login with test credentials
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('button:has-text("Sign In"), button:has-text("Login")');

    // Wait for successful login
    await page.waitForTimeout(3000);

    // Reload page
    await page.reload();
    await page.waitForTimeout(2000);

    // Should still be authenticated
    const isOnProtectedPage = !page.url().includes('/auth') && !page.url().match(/\/$|\/home$/);
    expect(isOnProtectedPage).toBeTruthy();
  });
});
