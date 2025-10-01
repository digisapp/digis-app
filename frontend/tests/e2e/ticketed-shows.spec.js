import { test, expect } from '@playwright/test';
import { 
  login, 
  setupStream, 
  joinStream, 
  purchaseTokens, 
  sendChatMessage,
  waitForToast,
  mockSupabaseAuth,
  mockSocketEvents,
  cleanupTestData
} from './utils/helpers';

test.describe('Ticketed Private Shows', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Socket.IO events
    await mockSocketEvents(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await cleanupTestData(page);
  });

  test('Complete ticketed show flow - announce, buy, start, join mid-show', async ({ browser }) => {
    // Create three browser contexts for different users
    const creatorContext = await browser.newContext();
    const viewer1Context = await browser.newContext();
    const viewer2Context = await browser.newContext();

    const creatorPage = await creatorContext.newPage();
    const viewer1Page = await viewer1Context.newPage();
    const viewer2Page = await viewer2Context.newPage();

    try {
      // Step 1: Creator logs in and starts stream
      await test.step('Creator starts stream', async () => {
        await mockSupabaseAuth(creatorPage, {
          id: 'creator-123',
          email: 'creator@test.com',
          user_metadata: { username: 'testcreator', is_creator: true }
        });
        
        await login(creatorPage, 'creator@test.com', 'Test123!');
        const streamId = await setupStream(creatorPage);
        
        // Store stream ID for other users
        await creatorPage.evaluate((id) => {
          window.__testStreamId = id;
        }, streamId);
      });

      // Step 2: Viewer 1 joins stream and has tokens
      await test.step('Viewer 1 joins stream', async () => {
        await mockSupabaseAuth(viewer1Page, {
          id: 'viewer1-123',
          email: 'viewer1@test.com',
          user_metadata: { username: 'viewer1', token_balance: 2000 }
        });
        
        await login(viewer1Page, 'viewer1@test.com', 'Test123!');
        
        // Get stream ID from creator page
        const streamId = await creatorPage.evaluate(() => window.__testStreamId);
        await joinStream(viewer1Page, streamId);
        
        // Verify can see video and chat
        await expect(viewer1Page.getByTestId('stream-player')).toBeVisible();
        await expect(viewer1Page.getByTestId('stream-chat')).toBeVisible();
        
        // Send a chat message
        await sendChatMessage(viewer1Page, 'Excited for the show!');
      });

      // Step 3: Viewer 2 joins stream (will not buy ticket)
      await test.step('Viewer 2 joins stream', async () => {
        await mockSupabaseAuth(viewer2Page, {
          id: 'viewer2-123',
          email: 'viewer2@test.com',
          user_metadata: { username: 'viewer2', token_balance: 100 }
        });
        
        await login(viewer2Page, 'viewer2@test.com', 'Test123!');
        
        const streamId = await creatorPage.evaluate(() => window.__testStreamId);
        await joinStream(viewer2Page, streamId);
        
        // Verify can see video and chat initially
        await expect(viewer2Page.getByTestId('stream-player')).toBeVisible();
        await expect(viewer2Page.getByTestId('stream-chat')).toBeVisible();
      });

      // Step 4: Creator announces private show
      await test.step('Creator announces private show', async () => {
        // Open private show modal
        const announceButton = creatorPage.getByRole('button', { name: /announce private show/i });
        await expect(announceButton).toBeVisible();
        await announceButton.click();
        
        // Fill in show details
        await creatorPage.getByPlaceholder(/show title/i).fill('Exclusive Q&A Session');
        await creatorPage.getByPlaceholder(/tell viewers what to expect/i).fill('Personal Q&A and behind the scenes content!');
        await creatorPage.getByLabel(/ticket price/i).fill('500');
        
        // Optional: Set early bird pricing
        const advancedOptions = creatorPage.getByText(/advanced options/i);
        if (await advancedOptions.isVisible()) {
          await advancedOptions.click();
          await creatorPage.getByLabel(/early bird price/i).fill('400');
        }
        
        // Announce the show
        await creatorPage.getByRole('button', { name: /announce show/i }).click();
        
        // Verify announcement
        await waitForToast(creatorPage, 'Private show announced!');
        
        // Check show controls appear
        await expect(creatorPage.getByTestId('private-show-controls')).toBeVisible();
        await expect(creatorPage.getByText(/tickets sold: 0/i)).toBeVisible();
      });

      // Step 5: Viewers see announcement
      await test.step('Viewers see show announcement', async () => {
        // Viewer 1 sees announcement
        await expect(viewer1Page.getByText(/exclusive q&a session/i)).toBeVisible({ timeout: 10000 });
        await expect(viewer1Page.getByText(/500 tokens/i)).toBeVisible();
        const buyButton1 = viewer1Page.getByRole('button', { name: /buy ticket/i });
        await expect(buyButton1).toBeVisible();
        
        // Viewer 2 sees announcement
        await expect(viewer2Page.getByText(/exclusive q&a session/i)).toBeVisible({ timeout: 10000 });
        await expect(viewer2Page.getByText(/500 tokens/i)).toBeVisible();
        const buyButton2 = viewer2Page.getByRole('button', { name: /buy ticket/i });
        await expect(buyButton2).toBeVisible();
      });

      // Step 6: Viewer 1 buys ticket
      await test.step('Viewer 1 purchases ticket', async () => {
        // Check initial token balance
        await viewer1Page.goto('/wallet');
        await expect(viewer1Page.getByTestId('token-balance')).toContainText('2000');
        
        // Go back to stream
        const streamId = await creatorPage.evaluate(() => window.__testStreamId);
        await joinStream(viewer1Page, streamId);
        
        // Buy ticket
        await viewer1Page.getByRole('button', { name: /buy ticket/i }).click();
        
        // Confirm purchase in modal if it appears
        const confirmButton = viewer1Page.getByRole('button', { name: /confirm purchase/i });
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }
        
        // Verify purchase
        await waitForToast(viewer1Page, 'Ticket purchased!');
        await expect(viewer1Page.getByText(/you have a ticket/i)).toBeVisible();
        
        // Creator sees ticket sale
        await expect(creatorPage.getByText(/tickets sold: 1/i)).toBeVisible({ timeout: 5000 });
        await expect(creatorPage.getByText(/500.*tokens earned/i)).toBeVisible();
      });

      // Step 7: Creator starts private show
      await test.step('Creator starts private show', async () => {
        // Click start button
        const startButton = creatorPage.getByRole('button', { name: /start private show/i });
        await expect(startButton).toBeVisible();
        await startButton.click();
        
        // Confirm if needed
        const confirmStart = creatorPage.getByRole('button', { name: /confirm.*start/i });
        if (await confirmStart.isVisible({ timeout: 2000 })) {
          await confirmStart.click();
        }
        
        // Verify show started
        await waitForToast(creatorPage, 'Private show started!');
        await expect(creatorPage.getByText(/private.*live/i)).toBeVisible();
      });

      // Step 8: Verify viewer access
      await test.step('Verify viewer access during private show', async () => {
        // Viewer 1 (with ticket) - full access
        await expect(viewer1Page.getByTestId('stream-player')).toBeVisible();
        await expect(viewer1Page.getByTestId('stream-chat')).toBeVisible();
        await expect(viewer1Page.getByText(/private show.*live/i)).toBeVisible();
        
        // Can still send messages
        await sendChatMessage(viewer1Page, 'Great private content!');
        
        // Viewer 2 (without ticket) - chat only
        await expect(viewer2Page.getByTestId('stream-chat')).toBeVisible();
        
        // Video should be hidden with lock screen
        const videoPlayer = viewer2Page.getByTestId('stream-player');
        const lockScreen = viewer2Page.getByTestId('video-lock-screen');
        
        // Either video is hidden or lock screen is shown
        const videoHidden = await videoPlayer.isHidden().catch(() => true);
        const lockVisible = await lockScreen.isVisible().catch(() => false);
        
        expect(videoHidden || lockVisible).toBeTruthy();
        
        // Should see purchase prompt
        await expect(viewer2Page.getByText(/private show in progress/i)).toBeVisible();
        await expect(viewer2Page.getByRole('button', { name: /buy ticket.*join now/i })).toBeVisible();
        
        // Can still see and send chat
        await sendChatMessage(viewer2Page, 'Wish I could see the video!');
      });

      // Step 9: Viewer 2 buys ticket mid-show
      await test.step('Viewer 2 purchases ticket mid-show', async () => {
        // First, give viewer 2 more tokens
        await viewer2Page.goto('/wallet');
        await purchaseTokens(viewer2Page, 1000);
        
        // Go back to stream
        const streamId = await creatorPage.evaluate(() => window.__testStreamId);
        await joinStream(viewer2Page, streamId);
        
        // Buy ticket during show
        await viewer2Page.getByRole('button', { name: /buy ticket.*join now/i }).click();
        
        // Confirm if needed
        const confirmButton = viewer2Page.getByRole('button', { name: /confirm/i });
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }
        
        // Verify immediate access
        await waitForToast(viewer2Page, 'Joined private show!');
        
        // Video should now be visible
        await expect(viewer2Page.getByTestId('stream-player')).toBeVisible({ timeout: 10000 });
        await expect(viewer2Page.getByText(/you have a ticket/i)).toBeVisible();
        
        // Creator sees updated ticket count
        await expect(creatorPage.getByText(/tickets sold: 2/i)).toBeVisible({ timeout: 5000 });
        await expect(creatorPage.getByText(/1000.*tokens earned/i)).toBeVisible();
      });

      // Step 10: End private show
      await test.step('Creator ends private show', async () => {
        // Look for end button
        const endButton = creatorPage.getByRole('button', { name: /end private show/i });
        if (await endButton.isVisible({ timeout: 2000 })) {
          await endButton.click();
          
          // Confirm if needed
          const confirmEnd = creatorPage.getByRole('button', { name: /confirm.*end/i });
          if (await confirmEnd.isVisible({ timeout: 2000 })) {
            await confirmEnd.click();
          }
          
          // Verify show ended
          await waitForToast(creatorPage, 'Private show ended');
        }
        
        // All viewers should have normal access again
        await expect(viewer1Page.getByTestId('stream-player')).toBeVisible();
        await expect(viewer2Page.getByTestId('stream-player')).toBeVisible();
      });

    } finally {
      // Clean up contexts
      await creatorContext.close();
      await viewer1Context.close();
      await viewer2Context.close();
    }
  });

  test('Handle insufficient tokens gracefully', async ({ page }) => {
    await test.step('Setup user with low token balance', async () => {
      await mockSupabaseAuth(page, {
        id: 'poor-viewer',
        email: 'poor@test.com',
        user_metadata: { username: 'poorviewer', token_balance: 50 }
      });
      
      await login(page, 'poor@test.com', 'Test123!');
    });

    await test.step('Attempt to buy ticket without enough tokens', async () => {
      // Navigate to a stream with active private show
      await page.goto('/explore');
      
      // Find and join a stream with private show
      const streamCard = page.getByTestId('stream-card').first();
      await streamCard.click();
      
      // Try to buy ticket
      const buyButton = page.getByRole('button', { name: /buy ticket/i });
      if (await buyButton.isVisible({ timeout: 5000 })) {
        await buyButton.click();
        
        // Should see error message
        await waitForToast(page, 'Not enough tokens');
        
        // Should show option to purchase tokens
        const purchaseTokensLink = page.getByRole('link', { name: /purchase.*tokens/i });
        await expect(purchaseTokensLink).toBeVisible();
      }
    });
  });

  test('Sold out show handling', async ({ page }) => {
    await test.step('Join sold out show', async () => {
      await mockSupabaseAuth(page, {
        id: 'late-viewer',
        email: 'late@test.com',
        user_metadata: { username: 'lateviewer', token_balance: 1000 }
      });
      
      await login(page, 'late@test.com', 'Test123!');
      
      // Navigate to stream with sold out show
      await page.goto('/explore');
      const soldOutStream = page.getByText(/sold out/i).first();
      
      if (await soldOutStream.isVisible({ timeout: 5000 })) {
        await soldOutStream.click();
        
        // Verify sold out state
        await expect(page.getByText(/sold out/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /buy ticket/i })).toBeDisabled();
      }
    });
  });

  test('Analytics tracking for creator', async ({ page }) => {
    await test.step('View show analytics', async () => {
      await mockSupabaseAuth(page, {
        id: 'analytics-creator',
        email: 'analytics@test.com',
        user_metadata: { username: 'analyticscreator', is_creator: true }
      });
      
      await login(page, 'analytics@test.com', 'Test123!');
      
      // Navigate to creator dashboard
      await page.goto('/dashboard');
      
      // Look for analytics section
      const analyticsTab = page.getByRole('tab', { name: /analytics/i });
      if (await analyticsTab.isVisible({ timeout: 5000 })) {
        await analyticsTab.click();
        
        // Check for ticketed show metrics
        await expect(page.getByText(/ticketed shows/i)).toBeVisible();
        await expect(page.getByTestId('total-ticket-revenue')).toBeVisible();
        await expect(page.getByTestId('average-ticket-price')).toBeVisible();
        await expect(page.getByTestId('conversion-rate')).toBeVisible();
      }
    });
  });
});