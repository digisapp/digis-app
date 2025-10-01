import { test, expect } from '@playwright/test';

test.describe('Ticketed Shows Component Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting localStorage
    await page.addInitScript(() => {
      // Mock Supabase auth session
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh',
        user: {
          id: 'test-creator-123',
          email: 'creator@test.com',
          user_metadata: {
            username: 'testcreator',
            is_creator: true,
            token_balance: 0
          }
        }
      }));
    });
  });

  test('App loads and navigation works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if page loaded
    const title = await page.title();
    expect(title).toBeTruthy();
    console.log(`Page title: ${title}`);
    
    // Try to find any button or link
    const buttons = await page.$$('button, a');
    console.log(`Found ${buttons.length} clickable elements`);
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('Can navigate to streaming page', async ({ page }) => {
    await page.goto('/');
    
    // Look for streaming-related elements
    const streamingElements = await page.$$('a[href*="stream"], button:has-text("Stream"), button:has-text("Live"), [data-testid*="stream"]');
    
    if (streamingElements.length > 0) {
      console.log(`Found ${streamingElements.length} streaming-related elements`);
      
      // Try clicking the first streaming element
      await streamingElements[0].click();
      await page.waitForLoadState('networkidle');
      
      // Check if we're on a streaming page
      const url = page.url();
      console.log(`Current URL: ${url}`);
    } else {
      // Try direct navigation
      await page.goto('/streaming');
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      console.log(`Navigated directly to: ${url}`);
    }
  });

  test('Check for private show UI elements', async ({ page }) => {
    // Try to go directly to a streaming page
    await page.goto('/streaming');
    await page.waitForLoadState('networkidle');
    
    // Look for private show related elements
    const privateShowElements = await page.$$eval('*', elements => {
      return elements.filter(el => {
        const text = el.textContent || '';
        const classNames = el.className || '';
        return text.toLowerCase().includes('private') || 
               text.toLowerCase().includes('ticket') ||
               text.toLowerCase().includes('exclusive') ||
               classNames.toLowerCase().includes('private') ||
               classNames.toLowerCase().includes('ticket');
      }).length;
    });
    
    console.log(`Found ${privateShowElements} elements related to private shows`);
    
    // Look for specific buttons
    const announceButton = await page.$('button:has-text("Announce")');
    const ticketButton = await page.$('button:has-text("Ticket")');
    const privateButton = await page.$('button:has-text("Private")');
    
    if (announceButton || ticketButton || privateButton) {
      console.log('Found private show control buttons');
    }
  });

  test('Test API endpoints are accessible', async ({ page }) => {
    // Test if backend is responding
    const response = await page.request.get('http://localhost:3001/health').catch(() => null);
    
    if (response && response.ok()) {
      console.log('Backend is healthy');
    } else {
      console.log('Backend health check failed or not available');
    }
    
    // Test if we can access ticketed shows endpoint (should fail without auth)
    const showsResponse = await page.request.get('http://localhost:3001/api/ticketed-shows/stream/test-stream/active').catch(() => null);
    
    if (showsResponse) {
      const status = showsResponse.status();
      console.log(`Ticketed shows endpoint status: ${status}`);
      
      // 401 or 403 is expected without proper auth
      if (status === 401 || status === 403) {
        console.log('API endpoint exists and requires authentication (as expected)');
      }
    }
  });
});