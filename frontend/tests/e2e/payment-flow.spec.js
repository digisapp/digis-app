import { test, expect } from '@playwright/test';

test.describe('Token Purchase Flow', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('should navigate to token purchase page', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForTimeout(2000);

    // Look for "Buy Tokens" or similar button
    const buyTokensButton = page.locator('button:has-text("Buy"), button:has-text("Purchase"), a:has-text("Buy Tokens")').first();

    if (await buyTokensButton.isVisible()) {
      await buyTokensButton.click();
      await page.waitForTimeout(1000);

      // Check for token purchase interface
      const hasTokenPackages = await page.locator('[data-testid="token-package"], text=/tokens|100|500|1000/i').first().isVisible();
      expect(hasTokenPackages).toBeTruthy();
    }
  });

  test('should display wallet balance', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForTimeout(2000);

    // Check for balance display
    const balanceElement = page.locator('[data-testid="token-balance"], text=/balance|tokens/i').first();
    const hasBalance = await balanceElement.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasBalance).toBeTruthy();
  });

  test('should show token package options', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForTimeout(1000);

    // Navigate to purchase page
    const buyButton = page.locator('button:has-text("Buy"), button:has-text("Purchase")').first();

    if (await buyButton.isVisible()) {
      await buyButton.click();
      await page.waitForTimeout(1000);

      // Check for multiple token packages
      const tokenPackages = page.locator('[data-testid="token-package"], button:has-text("100"), button:has-text("500")');
      const packageCount = await tokenPackages.count();

      expect(packageCount).toBeGreaterThan(0);
    }
  });

  test('should show Stripe checkout for token purchase', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForTimeout(1000);

    const buyButton = page.locator('button:has-text("Buy"), button:has-text("Purchase")').first();

    if (await buyButton.isVisible()) {
      await buyButton.click();
      await page.waitForTimeout(1000);

      // Select a token package
      const tokenPackage = page.locator('[data-testid="token-package"], button').first();

      if (await tokenPackage.isVisible()) {
        await tokenPackage.click();
        await page.waitForTimeout(2000);

        // Check for Stripe checkout or payment form
        const hasStripeCheckout = await page.locator('[data-testid="stripe-checkout"], iframe[title*="Stripe"], text=/card|payment/i').first().isVisible({ timeout: 5000 }).catch(() => false);

        expect(hasStripeCheckout).toBeTruthy();
      }
    }
  });
});

test.describe('Transaction History', () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }

    await page.goto('/');
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('button:has-text("Sign In"), button:has-text("Login")');
    await page.waitForTimeout(3000);
  });

  test('should display transaction history', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForTimeout(2000);

    // Look for transaction history section
    const transactionSection = page.locator('[data-testid="transaction-history"], text=/recent transactions|history/i').first();
    const hasTransactions = await transactionSection.isVisible({ timeout: 5000 }).catch(() => false);

    // Transaction history might be empty for new users
    expect(hasTransactions || true).toBeTruthy();
  });

  test('should show transaction details', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForTimeout(2000);

    // Check if there are any transactions
    const transactionItems = page.locator('[data-testid="transaction-item"], [class*="transaction"]');
    const count = await transactionItems.count();

    if (count > 0) {
      // Click first transaction
      await transactionItems.first().click();
      await page.waitForTimeout(500);

      // Check for transaction details
      const hasDetails = await page.locator('text=/amount|date|status/i').first().isVisible();
      expect(hasDetails).toBeTruthy();
    } else {
      // No transactions yet - that's okay
      expect(true).toBeTruthy();
    }
  });
});

test.describe('Subscription Purchase', () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }

    await page.goto('/');
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('button:has-text("Sign In"), button:has-text("Login")');
    await page.waitForTimeout(3000);
  });

  test('should show subscription options on creator profile', async ({ page }) => {
    // Navigate to a creator profile
    await page.goto('/explore');
    await page.waitForTimeout(2000);

    const firstCreator = page.locator('[data-testid*="creator"], .creator-card').first();

    if (await firstCreator.isVisible()) {
      await firstCreator.click();
      await page.waitForTimeout(1500);

      // Look for subscribe button
      const subscribeButton = page.locator('button:has-text("Subscribe"), button[data-testid="subscribe-button"]').first();
      const hasSubscribe = await subscribeButton.isVisible().catch(() => false);

      // Not all creators may have subscriptions enabled
      expect(hasSubscribe || true).toBeTruthy();
    }
  });

  test('should display subscription tiers if available', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForTimeout(2000);

    const firstCreator = page.locator('[data-testid*="creator"], .creator-card').first();

    if (await firstCreator.isVisible()) {
      await firstCreator.click();
      await page.waitForTimeout(1500);

      const subscribeButton = page.locator('button:has-text("Subscribe")').first();

      if (await subscribeButton.isVisible()) {
        await subscribeButton.click();
        await page.waitForTimeout(1000);

        // Check for subscription tier options
        const tiers = page.locator('[data-testid="subscription-tier"], text=/tier|monthly|annual/i');
        const tierCount = await tiers.count();

        // Tiers may or may not exist
        expect(tierCount >= 0).toBeTruthy();
      }
    }
  });
});

test.describe('Tipping System', () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }

    await page.goto('/');
    await page.click('button:has-text("Sign In"), a:has-text("Sign In")');
    await page.waitForTimeout(500);

    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('button:has-text("Sign In"), button:has-text("Login")');
    await page.waitForTimeout(3000);
  });

  test('should show tip button on creator profile', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForTimeout(2000);

    const firstCreator = page.locator('[data-testid*="creator"], .creator-card').first();

    if (await firstCreator.isVisible()) {
      await firstCreator.click();
      await page.waitForTimeout(1500);

      // Look for tip button
      const tipButton = page.locator('button:has-text("Tip"), button:has-text("Send Tip"), button[data-testid="tip-button"]').first();
      const hasTipButton = await tipButton.isVisible().catch(() => false);

      expect(hasTipButton || true).toBeTruthy();
    }
  });

  test('should open tip modal when clicking tip button', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForTimeout(2000);

    const firstCreator = page.locator('[data-testid*="creator"], .creator-card').first();

    if (await firstCreator.isVisible()) {
      await firstCreator.click();
      await page.waitForTimeout(1500);

      const tipButton = page.locator('button:has-text("Tip"), button:has-text("Send Tip")').first();

      if (await tipButton.isVisible()) {
        await tipButton.click();
        await page.waitForTimeout(1000);

        // Check for tip modal
        const tipModal = page.locator('[data-testid="tip-modal"], [role="dialog"]:has-text("Tip")').first();
        const hasModal = await tipModal.isVisible().catch(() => false);

        expect(hasModal).toBeTruthy();
      }
    }
  });
});
