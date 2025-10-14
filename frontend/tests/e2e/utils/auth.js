/**
 * Playwright Auth Utilities
 *
 * Production-faithful login and logout helpers that use actual UI interactions
 * (no API shortcuts) to stay true to real user flows.
 */

import { expect } from '@playwright/test';

/**
 * Log in via UI (production-faithful)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function uiLogin(page, email, password) {
  // Go to homepage
  await page.goto('/');

  // Click "Log In" button (case-insensitive)
  await page.getByRole('button', { name: /log in/i }).click();

  // Fill in credentials (adjust selectors to match your Auth component)
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Click Sign In button
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for post-login redirect to known authenticated route
  await expect(page).toHaveURL(/\/(dashboard|explore|admin)/, { timeout: 10000 });
}

/**
 * Log out from desktop navigation (production-faithful)
 * Opens profile menu and clicks logout button
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function uiLogoutFromDesktop(page) {
  // Open profile dropdown (click profile button/avatar)
  // The ProfileDropdown uses a button with aria-label="Profile menu"
  const profileButton = page.getByRole('button', { name: /profile menu/i });
  await profileButton.click();

  // Click the logout button (uses data-test="logout-btn")
  await page.locator('[data-test="logout-btn"]').click();
}

/**
 * Log out from mobile navigation (production-faithful)
 * Opens mobile menu and clicks logout button
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function uiLogoutFromMobile(page) {
  // Open mobile menu (profile button in mobile nav)
  // The mobile nav profile button has class "profile-button"
  const mobileProfileButton = page.locator('.profile-button').first();
  await mobileProfileButton.click();

  // Click the mobile logout button (uses data-test="mobile-logout-btn")
  await page.locator('[data-test="mobile-logout-btn"]').click();
}
