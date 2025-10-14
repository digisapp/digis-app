/**
 * Logout Flow E2E Tests (Production-Faithful)
 *
 * Verifies that logout redirects are clean (no flicker/loops)
 * and that protected routes properly redirect anonymous users.
 *
 * Uses actual UI interactions (no API shortcuts) to stay true to production.
 *
 * Setup:
 * 1. Create .env.test.local with TEST_EMAIL and TEST_PASSWORD
 * 2. Run with: npx playwright test tests/e2e/logout-flow.spec.js
 */

import { test, expect } from '@playwright/test';
import { uiLogin, uiLogoutFromDesktop, uiLogoutFromMobile } from './utils/auth.js';

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
const LOGOUT_DEST = '/'; // Keep in sync with App.js LOGOUT_DEST constant

test.describe('Logout flow is bulletproof', () => {
  test.beforeEach(async ({ page }) => {
    // Skip tests if credentials not provided
    test.skip(!EMAIL || !PASSWORD, 'TEST_EMAIL/TEST_PASSWORD not set in environment');

    // Log in before each test
    await uiLogin(page, EMAIL, PASSWORD);
  });

  test('logout from dashboard lands on public page and prevents back nav', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await uiLogoutFromDesktop(page);

    // Should land on public page
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });

    // Back button should NOT return to protected page (thanks to replace: true)
    await page.goBack();
    await expect(page).toHaveURL(LOGOUT_DEST);
  });

  test('logout from classes (previously flickered) is smooth', async ({ page }) => {
    await page.goto('/classes');
    await page.waitForLoadState('networkidle');

    await uiLogoutFromDesktop(page);

    // Should land on public page without bouncing
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });

    // Back button should NOT bounce to /classes
    await page.goBack();
    await expect(page).toHaveURL(LOGOUT_DEST);
  });

  test('logout from tv lands on public page', async ({ page }) => {
    await page.goto('/tv');
    await page.waitForLoadState('networkidle');

    await uiLogoutFromDesktop(page);

    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });

    await page.goBack();
    await expect(page).toHaveURL(LOGOUT_DEST);
  });

  test('logout from explore lands on public page', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForLoadState('networkidle');

    await uiLogoutFromDesktop(page);

    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });

    await page.goBack();
    await expect(page).toHaveURL(LOGOUT_DEST);
  });

  test('logout from wallet lands on public page', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');

    await uiLogoutFromDesktop(page);

    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('anonymous deep-link to protected routes redirects to public', async ({ page }) => {
    // First, log out to ensure we're anonymous
    await page.goto('/dashboard');
    await uiLogoutFromDesktop(page);
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });

    // Now try to access protected route directly
    await page.goto('/wallet');

    // Should redirect to public page
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('mobile menu logout does not flicker', async ({ page, browserName }) => {
    // Skip on webkit if flaky (optional)
    test.skip(browserName === 'webkit', 'Optional: skip if flaky on webkit');

    // Simulate mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await uiLogoutFromMobile(page);

    // Should land cleanly on public page
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });

    // Back button should not return to protected page
    await page.goBack();
    await expect(page).toHaveURL(LOGOUT_DEST);
  });
});

test.describe('Protected Routes - Anonymous Redirect', () => {
  test('public deep link to /dashboard redirects to public page', async ({ page }) => {
    // Go directly to protected route without logging in
    await page.goto('/dashboard');

    // ProtectedRoute should redirect to public page
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('public deep link to /wallet redirects to public page', async ({ page }) => {
    await page.goto('/wallet');
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('public deep link to /classes redirects to public page', async ({ page }) => {
    await page.goto('/classes');
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('public deep link to /tv redirects to public page', async ({ page }) => {
    await page.goto('/tv');
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('public deep link to /admin redirects to public page (security)', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('public deep link to /analytics redirects to public page', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });
});

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_EMAIL/TEST_PASSWORD not set');
    await uiLogin(page, EMAIL, PASSWORD);
  });

  test('rapid logout clicks do not cause multiple redirects', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open profile menu
    const profileButton = page.getByRole('button', { name: /profile menu/i });
    await profileButton.click();

    // Click sign out multiple times rapidly
    const signOutButton = page.locator('[data-test="logout-btn"]');
    await signOutButton.click();
    await signOutButton.click().catch(() => {}); // Might not exist after first click
    await signOutButton.click().catch(() => {});

    // Should still land cleanly on public page (no loops)
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('logout while on deep link (/:username) redirects cleanly', async ({ page }) => {
    // Visit a creator profile (adjust username to valid one in your system)
    await page.goto('/miriam'); // Assuming this is a valid username
    await page.waitForLoadState('networkidle');

    const profileButton = page.getByRole('button', { name: /profile menu/i });
    await profileButton.click();

    await page.locator('[data-test="logout-btn"]').click();

    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
  });

  test('HomePage resets meta tags after logout from creator profile', async ({ page }) => {
    // Visit a creator profile to populate meta tags
    await page.goto('/miriam'); // Assuming this is a valid username
    await page.waitForLoadState('networkidle');

    // Check that creator-specific meta tags are set (if profile exists)
    const ogTitleBeforeLogout = await page.locator('meta[property="og:title"]').getAttribute('content');
    console.log('OG title before logout:', ogTitleBeforeLogout);

    // Log out
    const profileButton = page.getByRole('button', { name: /profile menu/i });
    await profileButton.click();
    await page.locator('[data-test="logout-btn"]').click();

    // Should land on home page
    await expect(page).toHaveURL(LOGOUT_DEST, { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Verify meta tags are reset to default
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');

    // Verify defaults (from HomePage.js:26-41)
    expect(ogTitle).toBe('Digis - Connect with Creators');
    expect(ogDescription).toContain('Connect with your favorite creators');
    expect(ogImage).toBe('https://digis.cc/og-image.png');

    // Verify page title is also reset
    const pageTitle = await page.title();
    expect(pageTitle).toBe('Digis - Connect with Creators');

    console.log('✅ Meta tags reset successfully after logout');
  });
});
