/**
 * E2E tests for authentication flows
 * @module e2e/auth
 */

import { test, expect, Page } from '@playwright/test';

const TEST_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:3000';

// Test user credentials
const TEST_USER = {
  email: 'test.user@example.com',
  password: 'TestPassword123!',
  username: 'testuser',
  name: 'Test User'
};

const TEST_CREATOR = {
  email: 'test.creator@example.com',
  password: 'CreatorPassword123!',
  username: 'testcreator',
  name: 'Test Creator'
};

// Helper functions
async function fillSignInForm(page: Page, email: string, password: string) {
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="signin-button"]');
}

async function fillSignUpForm(page: Page, user: typeof TEST_USER, isCreator = false) {
  await page.fill('[data-testid="name-input"]', user.name);
  await page.fill('[data-testid="username-input"]', user.username);
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.fill('[data-testid="confirm-password-input"]', user.password);
  
  if (isCreator) {
    await page.check('[data-testid="is-creator-checkbox"]');
    await page.selectOption('[data-testid="creator-type-select"]', 'Influencer');
  }
  
  await page.check('[data-testid="terms-checkbox"]');
  await page.click('[data-testid="signup-button"]');
}

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
  });

  test.describe('Sign In', () => {
    test('should sign in with valid credentials', async ({ page }) => {
      await page.click('[data-testid="signin-link"]');
      await fillSignInForm(page, TEST_USER.email, TEST_USER.password);
      
      // Wait for navigation
      await page.waitForURL('**/dashboard');
      
      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-name"]')).toContainText(TEST_USER.name);
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.click('[data-testid="signin-link"]');
      await fillSignInForm(page, TEST_USER.email, 'wrongpassword');
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    });

    test('should validate required fields', async ({ page }) => {
      await page.click('[data-testid="signin-link"]');
      await page.click('[data-testid="signin-button"]');
      
      // Check validation messages
      await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
      await expect(page.locator('[data-testid="password-error"]')).toContainText('Password is required');
    });

    test('should navigate creators to creator dashboard', async ({ page }) => {
      await page.click('[data-testid="signin-link"]');
      await fillSignInForm(page, TEST_CREATOR.email, TEST_CREATOR.password);
      
      // Wait for navigation to creator dashboard
      await page.waitForURL('**/creator/dashboard');
      
      // Verify creator dashboard elements
      await expect(page.locator('[data-testid="creator-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="earnings-widget"]')).toBeVisible();
    });
  });

  test.describe('Sign Up', () => {
    test('should sign up new user', async ({ page }) => {
      const uniqueUser = {
        ...TEST_USER,
        email: `test.${Date.now()}@example.com`,
        username: `user${Date.now()}`
      };

      await page.click('[data-testid="signup-link"]');
      await fillSignUpForm(page, uniqueUser);
      
      // Wait for email verification page
      await page.waitForURL('**/auth/verify-email');
      
      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Please check your email');
    });

    test('should sign up new creator', async ({ page }) => {
      const uniqueCreator = {
        ...TEST_CREATOR,
        email: `creator.${Date.now()}@example.com`,
        username: `creator${Date.now()}`
      };

      await page.click('[data-testid="signup-link"]');
      await fillSignUpForm(page, uniqueCreator, true);
      
      // Wait for email verification page
      await page.waitForURL('**/auth/verify-email');
      
      // Verify creator-specific message
      await expect(page.locator('[data-testid="creator-welcome-message"]')).toBeVisible();
    });

    test('should validate username availability', async ({ page }) => {
      await page.click('[data-testid="signup-link"]');
      
      // Try existing username
      await page.fill('[data-testid="username-input"]', 'testuser');
      await page.blur('[data-testid="username-input"]');
      
      // Wait for validation
      await page.waitForTimeout(500);
      
      // Check error message
      await expect(page.locator('[data-testid="username-error"]')).toContainText('Username is taken');
    });

    test('should validate password requirements', async ({ page }) => {
      await page.click('[data-testid="signup-link"]');
      
      // Weak password
      await page.fill('[data-testid="password-input"]', '123');
      await page.blur('[data-testid="password-input"]');
      
      // Check validation message
      await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must be at least 8 characters');
    });

    test('should validate password confirmation', async ({ page }) => {
      await page.click('[data-testid="signup-link"]');
      
      await page.fill('[data-testid="password-input"]', 'Password123!');
      await page.fill('[data-testid="confirm-password-input"]', 'Password456!');
      await page.blur('[data-testid="confirm-password-input"]');
      
      // Check validation message
      await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText('Passwords do not match');
    });
  });

  test.describe('Sign Out', () => {
    test('should sign out successfully', async ({ page }) => {
      // First sign in
      await page.click('[data-testid="signin-link"]');
      await fillSignInForm(page, TEST_USER.email, TEST_USER.password);
      await page.waitForURL('**/dashboard');
      
      // Sign out
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="signout-button"]');
      
      // Verify redirected to home
      await page.waitForURL(TEST_URL);
      await expect(page.locator('[data-testid="signin-link"]')).toBeVisible();
    });
  });

  test.describe('Password Reset', () => {
    test('should request password reset', async ({ page }) => {
      await page.click('[data-testid="signin-link"]');
      await page.click('[data-testid="forgot-password-link"]');
      
      // Fill reset form
      await page.fill('[data-testid="reset-email-input"]', TEST_USER.email);
      await page.click('[data-testid="reset-button"]');
      
      // Verify success message
      await expect(page.locator('[data-testid="reset-success"]')).toContainText('Check your email');
    });

    test('should validate email for password reset', async ({ page }) => {
      await page.click('[data-testid="signin-link"]');
      await page.click('[data-testid="forgot-password-link"]');
      
      // Submit empty form
      await page.click('[data-testid="reset-button"]');
      
      // Check validation
      await expect(page.locator('[data-testid="reset-email-error"]')).toContainText('Email is required');
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to signin for protected routes', async ({ page }) => {
      // Try to access dashboard without auth
      await page.goto(`${TEST_URL}/dashboard`);
      
      // Should redirect to home or signin
      await expect(page).toHaveURL(/\/(signin|$)/);
    });

    test('should redirect to signin when accessing creator routes', async ({ page }) => {
      // Try to access creator dashboard without auth
      await page.goto(`${TEST_URL}/creator/dashboard`);
      
      // Should redirect to home or signin
      await expect(page).toHaveURL(/\/(signin|$)/);
    });
  });

  test.describe('Session Persistence', () => {
    test('should persist session on page reload', async ({ page, context }) => {
      // Sign in
      await page.click('[data-testid="signin-link"]');
      await fillSignInForm(page, TEST_USER.email, TEST_USER.password);
      await page.waitForURL('**/dashboard');
      
      // Reload page
      await page.reload();
      
      // Should still be logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle expired session', async ({ page }) => {
      // Sign in
      await page.click('[data-testid="signin-link"]');
      await fillSignInForm(page, TEST_USER.email, TEST_USER.password);
      await page.waitForURL('**/dashboard');
      
      // Simulate expired session by clearing storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      
      // Try to access protected content
      await page.reload();
      
      // Should redirect to signin
      await expect(page).toHaveURL(/\/(signin|$)/);
    });
  });
});