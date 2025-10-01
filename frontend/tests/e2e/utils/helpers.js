/**
 * Test helper utilities for Playwright E2E tests
 */

/**
 * Login helper function
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function login(page, email, password) {
  await page.goto('/');
  
  // Click on login button if not on auth page
  const authButton = page.getByTestId('auth-button');
  if (await authButton.isVisible()) {
    await authButton.click();
  }
  
  // Fill in credentials
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  
  // Submit login form
  await page.getByRole('button', { name: /sign in/i }).click();
  
  // Wait for navigation to complete
  await page.waitForURL(/\/(dashboard|explore|connect)/);
  
  // Verify logged in state
  await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
}

/**
 * Create and start a stream as creator
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} Stream ID
 */
export async function setupStream(page) {
  // Navigate to streaming page
  await page.goto('/streaming');
  
  // Start stream
  await page.getByRole('button', { name: /go live/i }).click();
  
  // Wait for stream to start
  await page.waitForSelector('[data-testid="stream-active"]', { timeout: 15000 });
  
  // Extract stream ID from URL or data attribute
  const streamId = await page.getAttribute('[data-testid="stream-container"]', 'data-stream-id');
  
  return streamId;
}

/**
 * Purchase tokens for testing
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} amount - Number of tokens to purchase
 */
export async function purchaseTokens(page, amount) {
  await page.goto('/wallet');
  
  // Select token package
  const packageButton = page.getByRole('button', { name: new RegExp(`${amount} Tokens`) });
  await packageButton.click();
  
  // Use test card for Stripe
  await page.frameLocator('iframe[title="Secure card payment input frame"]').getByPlaceholder('Card number').fill('4242424242424242');
  await page.frameLocator('iframe[title="Secure card payment input frame"]').getByPlaceholder('MM / YY').fill('12/30');
  await page.frameLocator('iframe[title="Secure card payment input frame"]').getByPlaceholder('CVC').fill('123');
  
  // Complete purchase
  await page.getByRole('button', { name: /purchase/i }).click();
  
  // Wait for success
  await page.waitForSelector('[data-testid="purchase-success"]', { timeout: 10000 });
}

/**
 * Join a stream as viewer
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} streamId - Stream ID to join
 */
export async function joinStream(page, streamId) {
  await page.goto(`/stream/${streamId}`);
  
  // Wait for stream to load
  await page.waitForSelector('[data-testid="stream-player"]', { timeout: 10000 });
  
  // Verify chat is visible
  await page.waitForSelector('[data-testid="stream-chat"]', { timeout: 5000 });
}

/**
 * Send a chat message in stream
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} message - Message to send
 */
export async function sendChatMessage(page, message) {
  const chatInput = page.getByPlaceholder(/type a message/i);
  await chatInput.fill(message);
  await chatInput.press('Enter');
  
  // Verify message was sent
  await page.waitForSelector(`[data-testid="chat-message"]:has-text("${message}")`, { timeout: 5000 });
}

/**
 * Wait for WebSocket connection
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function waitForSocketConnection(page) {
  await page.waitForFunction(
    () => window.__socket && window.__socket.connected,
    { timeout: 10000 }
  );
}

/**
 * Mock Supabase authentication
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} user - User object to mock
 */
export async function mockSupabaseAuth(page, user) {
  await page.addInitScript((mockUser) => {
    window.localStorage.setItem('supabase.auth.token', JSON.stringify({
      access_token: 'mock-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh',
      user: mockUser
    }));
  }, user);
}

/**
 * Mock WebSocket events
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function mockSocketEvents(page) {
  await page.addInitScript(() => {
    window.__SOCKET_MOCK__ = {
      events: {},
      on: function(event, callback) {
        this.events[event] = callback;
      },
      emit: function(event, data) {
        if (this.events[event]) {
          this.events[event](data);
        }
      },
      trigger: function(event, data) {
        if (this.events[event]) {
          this.events[event](data);
        }
      }
    };
  });
}

/**
 * Wait for toast notification
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} text - Text to wait for in toast
 */
export async function waitForToast(page, text) {
  await page.waitForSelector(`[data-testid="toast"]:has-text("${text}")`, { timeout: 5000 });
}

/**
 * Clean up test data
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function cleanupTestData(page) {
  // Clear local storage
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  
  // Clear cookies
  await page.context().clearCookies();
}