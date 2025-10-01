const request = require('supertest');
const stripe = require('stripe');
const { pool } = require('../utils/db');
const app = require('../api/index');

// Mock dependencies
jest.mock('stripe');
jest.mock('../utils/db');
jest.mock('../utils/socket');
jest.mock('../utils/secureLogger');

const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    confirm: jest.fn(),
    retrieve: jest.fn()
  }
};

stripe.mockReturnValue(mockStripe);

const mockPool = {
  query: jest.fn(),
  connect: jest.fn()
};

pool.query = mockPool.query;
pool.connect = mockPool.connect;

describe('Token Routes', () => {
  let mockClient;
  let authToken;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    mockPool.connect.mockResolvedValue(mockClient);
    
    // Mock auth token
    authToken = 'Bearer valid-token';
  });

  describe('GET /api/tokens/balance', () => {
    it('should return user token balance', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ balance: 1000 }]
      });

      const res = await request(app)
        .get('/api/tokens/balance')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        balance: 1000,
        usdEstimate: 50.00, // 1000 * 0.05
        tokenValue: 0.05
      });
    });

    it('should return zero balance for new users', async () => {
      mockPool.query.mockResolvedValue({
        rows: []
      });

      const res = await request(app)
        .get('/api/tokens/balance')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(0);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/tokens/balance');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/tokens/purchase', () => {
    it('should create payment intent for valid purchase', async () => {
      // Mock user exists
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      // Mock payment intent
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        status: 'requires_action',
        client_secret: 'pi_123_secret'
      });

      // Mock transaction insert
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 'user-123',
          type: 'purchase',
          tokens: 1000,
          amount_usd: 10.33,
          status: 'requires_action'
        }]
      });

      const res = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', authToken)
        .send({
          tokenAmount: 1000,
          paymentMethodId: 'pm_card_visa'
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        paymentIntent: {
          id: 'pi_123',
          status: 'requires_action',
          client_secret: 'pi_123_secret'
        }
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1033, // $10.33 in cents
        currency: 'usd',
        payment_method: 'pm_card_visa',
        confirmation_method: 'manual',
        confirm: true,
        return_url: expect.any(String),
        description: 'Purchase of 1000 tokens',
        metadata: {
          userId: expect.any(String),
          tokenAmount: 1000,
          bonusTokens: 0
        }
      });
    });

    it('should apply bonus tokens for large purchases', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_456',
        status: 'succeeded',
        client_secret: 'pi_456_secret'
      });

      mockClient.query.mockResolvedValue({
        rows: [{ id: 1 }]
      });

      const res = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', authToken)
        .send({
          tokenAmount: 10000,
          paymentMethodId: 'pm_card_visa'
        });

      expect(res.status).toBe(200);
      
      // Check that bonus was calculated (5% of 10000 = 500)
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Purchase of 10000 tokens + 500 bonus',
          metadata: expect.objectContaining({
            bonusTokens: 500
          })
        })
      );
    });

    it('should reject invalid token amounts', async () => {
      const res = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', authToken)
        .send({
          tokenAmount: 999, // Not in TOKEN_PRICES
          paymentMethodId: 'pm_card_visa'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid token amount');
    });

    it('should handle Stripe card errors', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const cardError = new Error('Your card was declined');
      cardError.type = 'StripeCardError';
      cardError.decline_code = 'insufficient_funds';
      mockStripe.paymentIntents.create.mockRejectedValue(cardError);

      const res = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', authToken)
        .send({
          tokenAmount: 1000,
          paymentMethodId: 'pm_card_visa'
        });

      expect(res.status).toBe(402);
      expect(res.body).toMatchObject({
        error: 'Payment declined',
        details: 'Your card was declined',
        declineCode: 'insufficient_funds'
      });
    });

    it('should rollback on database errors', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockRejectedValueOnce(new Error('Database error')); // Transaction insert fails

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_789',
        status: 'succeeded'
      });

      const res = await request(app)
        .post('/api/tokens/purchase')
        .set('Authorization', authToken)
        .send({
          tokenAmount: 1000,
          paymentMethodId: 'pm_card_visa'
        });

      expect(res.status).toBe(500);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('POST /api/tokens/tip', () => {
    it('should process tip successfully', async () => {
      // Mock queries
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Creator exists
        .mockResolvedValueOnce({ rows: [{ balance: 1000 }] }) // User balance
        .mockResolvedValueOnce({ rows: [] }) // Balance update
        .mockResolvedValueOnce({ rows: [] }) // Creator balance update
        .mockResolvedValueOnce({ rows: [{ balance: 900 }] }) // New user balance
        .mockResolvedValueOnce({ rows: [{ balance: 100 }] }); // Creator balance

      const res = await request(app)
        .post('/api/tokens/tip')
        .set('Authorization', authToken)
        .send({
          creatorId: 'creator-123',
          tokenAmount: 100,
          channel: 'stream-456'
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        tipAmount: 100,
        senderBalance: 900,
        channel: 'stream-456'
      });
    });

    it('should reject tips with insufficient balance', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Creator exists
        .mockResolvedValueOnce({ rows: [{ balance: 50 }] }); // Insufficient balance

      const res = await request(app)
        .post('/api/tokens/tip')
        .set('Authorization', authToken)
        .send({
          creatorId: 'creator-123',
          tokenAmount: 100,
          channel: 'stream-456'
        });

      expect(res.status).toBe(402);
      expect(res.body).toMatchObject({
        error: 'Insufficient token balance',
        currentBalance: 50,
        requiredTokens: 100
      });
    });

    it('should validate channel format', async () => {
      const res = await request(app)
        .post('/api/tokens/tip')
        .set('Authorization', authToken)
        .send({
          creatorId: 'creator-123',
          tokenAmount: 100,
          channel: 'a'.repeat(101) // Too long
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid channel format');
    });

    it('should handle auto-refill when enabled', async () => {
      mockClient.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1, 
            auto_refill_enabled: true,
            auto_refill_package: 1000
          }] 
        }) // User with auto-refill
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Creator exists
        .mockResolvedValueOnce({ rows: [{ balance: 50 }] }); // Low balance

      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_auto',
        status: 'succeeded'
      });

      // Continue with successful tip after refill
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Token purchase insert
        .mockResolvedValueOnce({ rows: [] }) // Balance update
        .mockResolvedValueOnce({ rows: [] }) // Tip transaction
        .mockResolvedValueOnce({ rows: [] }) // Balance updates
        .mockResolvedValueOnce({ rows: [{ balance: 950 }] }) // New balance
        .mockResolvedValueOnce({ rows: [{ balance: 100 }] }); // Creator balance

      const res = await request(app)
        .post('/api/tokens/tip')
        .set('Authorization', authToken)
        .send({
          creatorId: 'creator-123',
          tokenAmount: 100,
          channel: 'stream-456'
        });

      expect(res.status).toBe(200);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalled();
    });
  });

  describe('GET /api/tokens/analytics/predict-refill', () => {
    it('should predict refill for active users', async () => {
      // Mock balance and spending data
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ balance: 500 }] }) // Current balance
        .mockResolvedValueOnce({ 
          rows: [
            { total_spent: 1000, days_ago: 1 },
            { total_spent: 800, days_ago: 2 },
            { total_spent: 600, days_ago: 3 }
          ] 
        }); // Spending history

      const res = await request(app)
        .get('/api/tokens/analytics/predict-refill')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        prediction: {
          daysUntilEmpty: expect.any(Number),
          recommendedRefill: expect.any(Number),
          confidence: expect.any(String),
          triggers: expect.any(Array),
          riskLevel: expect.any(String)
        },
        currentBalance: 500
      });
    });

    it('should handle new users with no spending data', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ balance: 100 }] }) // Low balance
        .mockResolvedValueOnce({ rows: [] }); // No spending history

      const res = await request(app)
        .get('/api/tokens/analytics/predict-refill')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        prediction: {
          daysUntilEmpty: null,
          recommendedRefill: 1000, // Default for low balance
          confidence: 'low',
          triggers: ['new_user'],
          riskLevel: 'high' // Low balance = high risk
        },
        currentBalance: 100
      });
    });
  });

  describe('POST /api/tokens/gift', () => {
    it('should process gift with platform fee', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1, display_name: 'Sender' }] }) // Sender
        .mockResolvedValueOnce({ rows: [{ id: 2, display_name: 'Recipient' }] }) // Recipient
        .mockResolvedValueOnce({ rows: [{ balance: 1000 }] }) // Sender balance
        .mockResolvedValue({ rows: [] }); // Various updates

      const res = await request(app)
        .post('/api/tokens/gift')
        .set('Authorization', authToken)
        .send({
          recipientId: 'recipient-123',
          tokenAmount: 100,
          message: 'Happy birthday!',
          giftType: 'birthday'
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        tokensGifted: 100,
        netTokensReceived: 98, // 100 - 2% fee
        platformFee: 2,
        message: 'Happy birthday!'
      });
    });

    it('should prevent self-gifting', async () => {
      const res = await request(app)
        .post('/api/tokens/gift')
        .set('Authorization', authToken)
        .send({
          recipientId: 'user-123', // Same as sender
          tokenAmount: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot gift tokens to yourself');
    });

    it('should enforce maximum gift amount', async () => {
      const res = await request(app)
        .post('/api/tokens/gift')
        .set('Authorization', authToken)
        .send({
          recipientId: 'recipient-123',
          tokenAmount: 10001 // Over limit
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Maximum gift amount is 10,000 tokens');
    });
  });
});