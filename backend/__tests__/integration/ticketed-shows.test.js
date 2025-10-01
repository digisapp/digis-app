const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../../api/index');
const { query } = require('../../utils/db');

// Mock Supabase
jest.mock('@supabase/supabase-js');
jest.mock('../../utils/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }))
}));

describe('Ticketed Shows API', () => {
  let creatorToken, viewer1Token, viewer2Token;
  let creatorId, viewer1Id, viewer2Id;
  let streamId, showId;
  
  beforeAll(async () => {
    // Setup test database
    await query('BEGIN');
    
    // Create test users
    const creatorResult = await query(
      'INSERT INTO users (supabase_id, email, username, is_creator, token_balance) VALUES ($1, $2, $3, $4, $5) RETURNING supabase_id',
      ['creator-test-id', 'creator@test.com', 'testcreator', true, 0]
    );
    creatorId = creatorResult.rows[0].supabase_id;
    
    const viewer1Result = await query(
      'INSERT INTO users (supabase_id, email, username, is_creator, token_balance) VALUES ($1, $2, $3, $4, $5) RETURNING supabase_id',
      ['viewer1-test-id', 'viewer1@test.com', 'viewer1', false, 2000]
    );
    viewer1Id = viewer1Result.rows[0].supabase_id;
    
    const viewer2Result = await query(
      'INSERT INTO users (supabase_id, email, username, is_creator, token_balance) VALUES ($1, $2, $3, $4, $5) RETURNING supabase_id',
      ['viewer2-test-id', 'viewer2@test.com', 'viewer2', false, 100]
    );
    viewer2Id = viewer2Result.rows[0].supabase_id;
    
    // Create test stream
    const streamResult = await query(
      'INSERT INTO streams (creator_id, status, title) VALUES ($1, $2, $3) RETURNING id',
      [creatorId, 'live', 'Test Stream']
    );
    streamId = streamResult.rows[0].id;
    
    // Mock tokens
    creatorToken = 'mock-creator-token';
    viewer1Token = 'mock-viewer1-token';
    viewer2Token = 'mock-viewer2-token';
    
    // Mock Supabase auth
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn((token) => {
          if (token === creatorToken) {
            return { data: { user: { id: creatorId } }, error: null };
          } else if (token === viewer1Token) {
            return { data: { user: { id: viewer1Id } }, error: null };
          } else if (token === viewer2Token) {
            return { data: { user: { id: viewer2Id } }, error: null };
          }
          return { data: null, error: new Error('Invalid token') };
        })
      }
    });
  });
  
  afterAll(async () => {
    // Cleanup test data
    await query('ROLLBACK');
  });
  
  describe('POST /api/ticketed-shows/announce', () => {
    test('Creator can announce a ticketed show', async () => {
      const response = await request(app)
        .post('/api/ticketed-shows/announce')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          streamId,
          title: 'Exclusive Q&A',
          description: 'Personal Q&A session',
          tokenPrice: 500,
          maxTickets: 50,
          earlyBirdPrice: 400,
          earlyBirdDeadline: new Date(Date.now() + 3600000).toISOString()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.show).toMatchObject({
        stream_id: streamId,
        creator_id: creatorId,
        title: 'Exclusive Q&A',
        token_price: 500,
        early_bird_price: 400,
        max_tickets: 50,
        status: 'announced'
      });
      
      showId = response.body.show.id;
    });
    
    test('Non-creator cannot announce show', async () => {
      const response = await request(app)
        .post('/api/ticketed-shows/announce')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({
          streamId,
          title: 'Fake Show',
          tokenPrice: 100
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Only the stream creator');
    });
    
    test('Cannot announce with invalid price', async () => {
      const response = await request(app)
        .post('/api/ticketed-shows/announce')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          streamId,
          title: 'Invalid Show',
          tokenPrice: -100
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid token price');
    });
  });
  
  describe('POST /api/ticketed-shows/buy-ticket', () => {
    beforeEach(async () => {
      // Create a fresh show for each test
      const showResult = await query(
        `INSERT INTO ticketed_shows (stream_id, creator_id, title, token_price, status, max_tickets) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [streamId, creatorId, 'Test Show', 500, 'announced', 10]
      );
      showId = showResult.rows[0].id;
    });
    
    test('Viewer with sufficient tokens can buy ticket', async () => {
      const response = await request(app)
        .post('/api/ticketed-shows/buy-ticket')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({ showId });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ticket).toMatchObject({
        show_id: showId,
        viewer_id: viewer1Id,
        tokens_paid: 500
      });
      
      // Verify token balance updated
      const balanceResult = await query(
        'SELECT token_balance FROM users WHERE supabase_id = $1',
        [viewer1Id]
      );
      expect(balanceResult.rows[0].token_balance).toBe(1500);
      
      // Verify creator received tokens
      const creatorBalanceResult = await query(
        'SELECT token_balance FROM users WHERE supabase_id = $1',
        [creatorId]
      );
      expect(creatorBalanceResult.rows[0].token_balance).toBe(500);
    });
    
    test('Cannot buy ticket with insufficient tokens', async () => {
      const response = await request(app)
        .post('/api/ticketed-shows/buy-ticket')
        .set('Authorization', `Bearer ${viewer2Token}`)
        .send({ showId });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient tokens');
    });
    
    test('Cannot buy duplicate ticket', async () => {
      // First purchase
      await request(app)
        .post('/api/ticketed-shows/buy-ticket')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({ showId });
      
      // Try to buy again
      const response = await request(app)
        .post('/api/ticketed-shows/buy-ticket')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({ showId });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already have a ticket');
    });
    
    test('Cannot buy ticket when sold out', async () => {
      // Update show to have only 1 ticket available
      await query(
        'UPDATE ticketed_shows SET max_tickets = 1 WHERE id = $1',
        [showId]
      );
      
      // First viewer buys the last ticket
      await request(app)
        .post('/api/ticketed-shows/buy-ticket')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({ showId });
      
      // Give viewer2 enough tokens
      await query(
        'UPDATE users SET token_balance = 1000 WHERE supabase_id = $1',
        [viewer2Id]
      );
      
      // Second viewer tries to buy
      const response = await request(app)
        .post('/api/ticketed-shows/buy-ticket')
        .set('Authorization', `Bearer ${viewer2Token}`)
        .send({ showId });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('sold out');
    });
  });
  
  describe('POST /api/ticketed-shows/start', () => {
    beforeEach(async () => {
      // Create show with tickets
      const showResult = await query(
        `INSERT INTO ticketed_shows (stream_id, creator_id, title, token_price, status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [streamId, creatorId, 'Start Test Show', 500, 'announced']
      );
      showId = showResult.rows[0].id;
      
      // Add some ticket holders
      await query(
        'INSERT INTO show_tickets (show_id, viewer_id, tokens_paid) VALUES ($1, $2, $3)',
        [showId, viewer1Id, 500]
      );
    });
    
    test('Creator can start private show', async () => {
      const response = await request(app)
        .post('/api/ticketed-shows/start')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ showId });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ticketHolders).toBe(1);
      
      // Verify show status updated
      const showResult = await query(
        'SELECT status, private_mode FROM ticketed_shows WHERE id = $1',
        [showId]
      );
      expect(showResult.rows[0].status).toBe('started');
      expect(showResult.rows[0].private_mode).toBe(true);
    });
    
    test('Non-creator cannot start show', async () => {
      const response = await request(app)
        .post('/api/ticketed-shows/start')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({ showId });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Only the creator');
    });
    
    test('Cannot start already started show', async () => {
      // Start the show
      await request(app)
        .post('/api/ticketed-shows/start')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ showId });
      
      // Try to start again
      const response = await request(app)
        .post('/api/ticketed-shows/start')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ showId });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already started');
    });
  });
  
  describe('POST /api/ticketed-shows/end', () => {
    beforeEach(async () => {
      // Create and start a show
      const showResult = await query(
        `INSERT INTO ticketed_shows (stream_id, creator_id, title, token_price, status, private_mode, started_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [streamId, creatorId, 'End Test Show', 500, 'started', true, new Date()]
      );
      showId = showResult.rows[0].id;
    });
    
    test('Creator can end private show', async () => {
      const response = await request(app)
        .post('/api/ticketed-shows/end')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ showId });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify show ended
      const showResult = await query(
        'SELECT status, private_mode, ended_at FROM ticketed_shows WHERE id = $1',
        [showId]
      );
      expect(showResult.rows[0].status).toBe('ended');
      expect(showResult.rows[0].private_mode).toBe(false);
      expect(showResult.rows[0].ended_at).not.toBeNull();
    });
  });
  
  describe('GET /api/ticketed-shows/:showId/details', () => {
    beforeEach(async () => {
      // Create show with tickets
      const showResult = await query(
        `INSERT INTO ticketed_shows (stream_id, creator_id, title, token_price, status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [streamId, creatorId, 'Details Test Show', 500, 'announced']
      );
      showId = showResult.rows[0].id;
      
      // Add ticket for viewer1
      await query(
        'INSERT INTO show_tickets (show_id, viewer_id, tokens_paid) VALUES ($1, $2, $3)',
        [showId, viewer1Id, 500]
      );
    });
    
    test('Viewer with ticket sees full details', async () => {
      const response = await request(app)
        .get(`/api/ticketed-shows/${showId}/details`)
        .set('Authorization', `Bearer ${viewer1Token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.hasTicket).toBe(true);
      expect(response.body.show.title).toBe('Details Test Show');
      expect(response.body.ticketsSold).toBe(1);
    });
    
    test('Viewer without ticket sees limited details', async () => {
      const response = await request(app)
        .get(`/api/ticketed-shows/${showId}/details`)
        .set('Authorization', `Bearer ${viewer2Token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.hasTicket).toBe(false);
      expect(response.body.show.title).toBe('Details Test Show');
    });
  });
  
  describe('GET /api/ticketed-shows/:showId/analytics', () => {
    beforeEach(async () => {
      // Create show with analytics
      const showResult = await query(
        `INSERT INTO ticketed_shows (stream_id, creator_id, title, token_price, status, total_revenue, tickets_sold) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [streamId, creatorId, 'Analytics Test Show', 500, 'ended', 2500, 5]
      );
      showId = showResult.rows[0].id;
      
      // Add analytics data
      await query(
        `INSERT INTO show_analytics (show_id, tickets_sold, revenue_generated, peak_viewers, avg_watch_time_seconds) 
         VALUES ($1, $2, $3, $4, $5)`,
        [showId, 5, 2500, 8, 1800]
      );
    });
    
    test('Creator can view analytics', async () => {
      const response = await request(app)
        .get(`/api/ticketed-shows/${showId}/analytics`)
        .set('Authorization', `Bearer ${creatorToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toMatchObject({
        tickets_sold: 5,
        revenue_generated: 2500,
        peak_viewers: 8,
        avg_watch_time_seconds: 1800
      });
    });
    
    test('Non-creator cannot view analytics', async () => {
      const response = await request(app)
        .get(`/api/ticketed-shows/${showId}/analytics`)
        .set('Authorization', `Bearer ${viewer1Token}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Only the creator');
    });
  });
  
  describe('Token transaction atomicity', () => {
    test('Failed ticket purchase rolls back token deduction', async () => {
      // Create a show
      const showResult = await query(
        `INSERT INTO ticketed_shows (stream_id, creator_id, title, token_price, status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [streamId, creatorId, 'Transaction Test', 500, 'announced']
      );
      const testShowId = showResult.rows[0].id;
      
      // Give viewer1 exactly 500 tokens
      await query(
        'UPDATE users SET token_balance = 500 WHERE supabase_id = $1',
        [viewer1Id]
      );
      
      // Mock a database error during ticket creation
      const originalQuery = query;
      jest.spyOn(require('../../utils/db'), 'query').mockImplementation(async (text, params) => {
        if (text.includes('INSERT INTO show_tickets')) {
          throw new Error('Database error');
        }
        return originalQuery(text, params);
      });
      
      // Attempt purchase
      const response = await request(app)
        .post('/api/ticketed-shows/buy-ticket')
        .set('Authorization', `Bearer ${viewer1Token}`)
        .send({ showId: testShowId });
      
      expect(response.status).toBe(500);
      
      // Verify tokens were NOT deducted
      const balanceResult = await originalQuery(
        'SELECT token_balance FROM users WHERE supabase_id = $1',
        [viewer1Id]
      );
      expect(balanceResult.rows[0].token_balance).toBe(500);
      
      // Restore original query function
      jest.restoreAllMocks();
    });
  });
});