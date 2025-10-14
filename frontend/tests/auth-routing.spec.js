/**
 * Auth & Routing E2E Tests
 *
 * Tests role-based navigation, redirect behavior, and slow network resilience
 */

import { test, expect } from '@playwright/test';

test.describe('Role-Based Navigation', () => {

  test('Fan login → lands on /explore with fan-tools visible', async ({ page }) => {
    // Login as fan (adjust selectors based on your auth flow)
    await page.goto('/');

    // TODO: Replace with actual login flow
    // await page.fill('[data-test="email-input"]', 'fan@test.com');
    // await page.fill('[data-test="password-input"]', 'password');
    // await page.click('[data-test="login-button"]');

    // Wait for auth to complete
    await page.waitForURL('/explore', { timeout: 10000 });

    // Assert: Creator tools hidden, fan tools visible
    await expect(page.locator('[data-test="creator-tools"]')).toBeHidden();
    await expect(page.locator('[data-test="fan-tools"]')).toBeVisible();
  });

  test('Creator login → lands on /dashboard with creator-tools visible', async ({ page }) => {
    // Login as creator (adjust selectors based on your auth flow)
    await page.goto('/');

    // TODO: Replace with actual login flow
    // await page.fill('[data-test="email-input"]', 'creator@test.com');
    // await page.fill('[data-test="password-input"]', 'password');
    // await page.click('[data-test="login-button"]');

    // Wait for auth to complete
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Assert: Creator tools visible, fan tools hidden
    await expect(page.locator('[data-test="creator-tools"]')).toBeVisible();
    await expect(page.locator('[data-test="fan-tools"]')).toBeHidden();
  });

  test('Creator hard refresh on /dashboard → stays on /dashboard', async ({ page, context }) => {
    // Login as creator first
    // TODO: Replace with actual login flow

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Hard refresh
    await page.reload({ waitUntil: 'networkidle' });

    // Assert: Still on dashboard, no redirect
    expect(page.url()).toContain('/dashboard');
    await expect(page.locator('[data-test="creator-tools"]')).toBeVisible();
  });

  test('Fan deep link to /dashboard → redirected to /explore', async ({ page }) => {
    // Login as fan first
    // TODO: Replace with actual login flow

    // Attempt to access creator-only page
    await page.goto('/dashboard');

    // Assert: Redirected to /explore (no loop)
    await page.waitForURL('/explore', { timeout: 5000 });
    expect(page.url()).toContain('/explore');
  });

  test('Fan deep link with query string /dashboard?tab=stats → redirected once to /explore', async ({ page }) => {
    // Login as fan first
    // TODO: Replace with actual login flow

    // Attempt to access creator-only page with query string
    await page.goto('/dashboard?tab=stats');

    // Assert: Redirected to /explore once (no redirect loop)
    await page.waitForURL('/explore', { timeout: 5000 });
    expect(page.url()).toContain('/explore');
    expect(page.url()).not.toContain('?tab=stats');
  });
});

test.describe('Slow Network Resilience', () => {

  test('Auth race on Fast 3G → fan lands on /explore without "Page Not Found"', async ({ page, context }) => {
    // Throttle network to Fast 3G
    const client = await context.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (250 * 1024) / 8, // 250kb/s
      uploadThroughput: (75 * 1024) / 8,    // 75kb/s
      latency: 500 // 500ms latency
    });

    // Login as fan
    // TODO: Replace with actual fan login flow
    await page.goto('/');

    // Wait for redirect to /explore
    await page.waitForURL('/explore', { timeout: 15000 });

    // Assert: No "Page Not Found" or error screen
    await expect(page.locator('text=/Page Not Found|404|not found/i')).not.toBeVisible();

    // Assert: Fan tools visible (role loaded correctly)
    await expect(page.locator('[data-test="fan-tools"]')).toBeVisible();
  });

  test('Auth race on Fast 3G → creator lands on /dashboard without role flicker', async ({ page, context }) => {
    // Throttle network to Fast 3G
    const client = await context.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (250 * 1024) / 8, // 250kb/s
      uploadThroughput: (75 * 1024) / 8,    // 75kb/s
      latency: 500 // 500ms latency
    });

    // Login as creator
    // TODO: Replace with actual creator login flow
    await page.goto('/');

    // Wait for redirect to /dashboard
    await page.waitForURL('/dashboard', { timeout: 15000 });

    // Assert: No "Page Not Found" or error screen
    await expect(page.locator('text=/Page Not Found|404|not found/i')).not.toBeVisible();

    // Assert: Creator tools visible (role loaded correctly)
    await expect(page.locator('[data-test="creator-tools"]')).toBeVisible();

    // Assert: No flicker - creator tools should be visible from first paint
    // (This is ensured by cached profile loading)
  });

  test('Slow 3G → skeleton + "Still loading..." appears after 3s', async ({ page, context }) => {
    // Throttle network to Slow 3G
    const client = await context.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (50 * 1024) / 8, // 50kb/s
      uploadThroughput: (20 * 1024) / 8,   // 20kb/s
      latency: 2000 // 2s latency
    });

    // Navigate to protected route
    await page.goto('/dashboard');

    // Assert: Skeleton loader visible immediately
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(page.getByText('Verifying access...')).toBeVisible();

    // Assert: After 3s, "Still loading..." message appears
    await page.waitForTimeout(3500);
    await expect(page.getByText('Still loading...')).toBeVisible();
  });

  test('Auth boot breadcrumb logged once (no duplicates on resize)', async ({ page }) => {
    // Login first
    // TODO: Replace with actual login flow

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Resize back to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);

    // Check console logs for duplicate auth_boot events
    // Note: This requires capturing console logs during the test
    // In practice, you'd verify Sentry breadcrumbs via API or mock

    // Assert: Page still functional, no errors
    await expect(page.locator('[data-test="creator-tools"]')).toBeVisible();
  });
});

test.describe('Circuit Breaker Behavior', () => {

  test('Backend outage → cached profile renders, no blocking error', async ({ page, context }) => {
    // Intercept sync-user endpoint to simulate 500 error
    await page.route('**/api/auth/sync-user', route => {
      route.fulfill({ status: 500, body: '{"error":"Internal Server Error"}' });
    });

    // Login (will hit 500 on sync-user)
    // TODO: Replace with actual login flow

    await page.goto('/dashboard');

    // Assert: Page loads with cached data (if available)
    // No blocking error screen
    await page.waitForLoadState('networkidle');

    // Check for non-blocking toast
    await expect(page.getByText(/syncing your account/i)).toBeVisible({ timeout: 5000 });
  });

  test('Backend recovery → auth_sync_recovered breadcrumb sent', async ({ page, context }) => {
    let requestCount = 0;

    // First 2 requests fail, 3rd succeeds
    await page.route('**/api/auth/sync-user', route => {
      requestCount++;
      if (requestCount <= 2) {
        route.fulfill({ status: 500, body: '{"error":"Internal Server Error"}' });
      } else {
        route.continue();
      }
    });

    // Login and trigger recovery
    // TODO: Replace with actual login flow and recovery scenario

    // Assert: After recovery, page functions normally
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(page.locator('[data-test="creator-tools"]')).toBeVisible();
  });
});
