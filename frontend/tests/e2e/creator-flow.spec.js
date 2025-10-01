import { test, expect } from '@playwright/test';

test.describe('Creator Discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display creator cards on homepage', async ({ page }) => {
    // Wait for creators to load
    await page.waitForTimeout(2000);

    // Check for creator cards or directory
    const creatorElements = page.locator('[data-testid*="creator"], .creator-card, [class*="CreatorCard"]');
    const count = await creatorElements.count();

    // Should have at least one creator visible
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to creator profile', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find and click first creator card
    const firstCreator = page.locator('[data-testid*="creator"], .creator-card, [class*="CreatorCard"]').first();

    if (await firstCreator.isVisible()) {
      await firstCreator.click();
      await page.waitForTimeout(1500);

      // Should navigate to creator profile
      const currentURL = page.url();
      expect(currentURL).toMatch(/\/creator\/|\/[a-zA-Z0-9_-]+$/);
    }
  });

  test('should display creator profile information', async ({ page }) => {
    // Navigate to explore page
    await page.goto('/explore');
    await page.waitForTimeout(2000);

    // Find first creator
    const firstCreator = page.locator('[data-testid*="creator"], .creator-card, [class*="CreatorCard"]').first();

    if (await firstCreator.isVisible()) {
      await firstCreator.click();
      await page.waitForTimeout(1500);

      // Check for profile elements
      const hasAvatar = await page.locator('img[alt*="avatar"], img[alt*="profile"], [data-testid="creator-avatar"]').isVisible();
      const hasName = await page.locator('[data-testid="creator-name"], h1, h2').first().isVisible();

      expect(hasAvatar || hasName).toBeTruthy();
    }
  });
});

test.describe('Creator Application', () => {
  test('should navigate to creator application page', async ({ page }) => {
    await page.goto('/apply');

    // Check for application form
    const applicationForm = page.locator('form, [data-testid="application-form"]');
    const hasForm = await applicationForm.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasForm).toBeTruthy();
  });

  test('should show validation for empty application', async ({ page }) => {
    await page.goto('/apply');
    await page.waitForTimeout(1000);

    // Try to submit empty form
    const submitButton = page.locator('button:has-text("Submit"), button:has-text("Apply")').first();

    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(500);

      // Check for validation errors
      const errorMessage = page.locator('text=/required|fill|complete/i').first();
      const hasError = await errorMessage.isVisible().catch(() => false);

      expect(hasError).toBeTruthy();
    }
  });
});

test.describe('Creator Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if no test creator credentials
    if (!process.env.TEST_CREATOR_EMAIL || !process.env.TEST_CREATOR_PASSWORD) {
      test.skip();
    }

    // Login as creator
    await page.goto('/');
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    await page.fill('input[type="email"]', process.env.TEST_CREATOR_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_CREATOR_PASSWORD);
    await page.click('button:has-text("Sign In"), button:has-text("Login")');

    await page.waitForTimeout(3000);
  });

  test('should access creator dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    // Check for creator-specific dashboard elements
    const hasDashboard = await page.locator('[data-testid="creator-dashboard"], text=/analytics|earnings|subscribers/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasDashboard).toBeTruthy();
  });

  test('should access go live setup', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);

    // Look for "Go Live" button
    const goLiveButton = page.locator('button:has-text("Go Live"), a:has-text("Go Live")').first();

    if (await goLiveButton.isVisible()) {
      await goLiveButton.click();
      await page.waitForTimeout(1000);

      // Check for streaming setup interface
      const hasStreamingSetup = await page.locator('[data-testid="streaming-setup"], text=/title|description|start stream/i').first().isVisible();
      expect(hasStreamingSetup).toBeTruthy();
    }
  });

  test('should view earnings page', async ({ page }) => {
    await page.goto('/earnings');
    await page.waitForTimeout(2000);

    // Check for earnings dashboard
    const hasEarnings = await page.locator('[data-testid="earnings-dashboard"], text=/total earnings|payouts|balance/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasEarnings).toBeTruthy();
  });

  test('should access content management', async ({ page }) => {
    await page.goto('/content');
    await page.waitForTimeout(2000);

    // Check for content management interface
    const hasContent = await page.locator('[data-testid="content-management"], button:has-text("Upload"), button:has-text("Add Content")').first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasContent).toBeTruthy();
  });
});

test.describe('Creator Follow System', () => {
  test('should allow following a creator (when logged in)', async ({ page }) => {
    // Skip if no test user credentials
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }

    // Login first
    await page.goto('/');
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('button:has-text("Sign In"), button:has-text("Login")');
    await page.waitForTimeout(3000);

    // Navigate to a creator profile
    await page.goto('/explore');
    await page.waitForTimeout(2000);

    const firstCreator = page.locator('[data-testid*="creator"], .creator-card').first();

    if (await firstCreator.isVisible()) {
      await firstCreator.click();
      await page.waitForTimeout(1500);

      // Look for follow button
      const followButton = page.locator('button:has-text("Follow"), button[data-testid="follow-button"]').first();

      if (await followButton.isVisible()) {
        const buttonText = await followButton.textContent();

        await followButton.click();
        await page.waitForTimeout(1000);

        // Check that button text changed or success message appeared
        const newButtonText = await followButton.textContent();
        const hasSuccessMessage = await page.locator('text=/following|success/i').isVisible().catch(() => false);

        expect(buttonText !== newButtonText || hasSuccessMessage).toBeTruthy();
      }
    }
  });
});
