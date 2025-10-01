import { test, expect } from '@playwright/test';

test.describe('Basic App Test', () => {
  test('App loads successfully', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    // Check that the page has loaded
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Look for common app elements
    const body = await page.$('body');
    expect(body).toBeTruthy();
    
    console.log('App loaded successfully');
  });
  
  test('Auth component is visible', async ({ page }) => {
    await page.goto('/');
    
    // Look for auth-related elements
    const authElements = await page.$$('[data-testid*="auth"], button:has-text("Sign In"), button:has-text("Login"), input[type="email"]');
    
    // At least one auth element should be present
    expect(authElements.length).toBeGreaterThan(0);
    
    console.log(`Found ${authElements.length} auth-related elements`);
  });
});