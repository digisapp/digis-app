const request = require('supertest');
const app = require('../../api/index');
const { pool } = require('../../utils/db');
const { 
  generateTestToken, 
  createTestUser, 
  cleanupTestUser,
  mockStripeCustomer,
  mockStripePaymentMethod 
} = require('../helpers/testUtils');

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn(() => ({
    customers: {
      create: jest.fn().mockResolvedValue(mockStripeCustomer),
      retrieve: jest.fn().mockResolvedValue(mockStripeCustomer)
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        client_secret: 'pi_test123_secret'
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        amount: 5000,
        metadata: {
          userId: 'test-user-id',
          tokens: '100'
        }
      })
    },
    paymentMethods: {
      attach: jest.fn().mockResolvedValue(mockStripePaymentMethod),
      list: jest.fn().mockResolvedValue({ data: [mockStripePaymentMethod] })
    },
    prices: {
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'price_100tokens',
            unit_amount: 500,
            currency: 'usd',
            metadata: { tokens: '100' }
          },
          {
            id: 'price_500tokens',
            unit_amount: 2500,
            currency: 'usd',
            metadata: { tokens: '500' }
          }
        ]
      })
    },
    webhookEndpoints: {
      create: jest.fn().mockResolvedValue({ id: 'we_test123' })
    }
  }));
});

describe('Payments API Integration Tests', () => {
  let server;
  let testUser;
  let authToken;
  
  beforeAll(async () => {
    server = app.listen(0);
    
    // Create test user
    testUser = await createTestUser(pool, {
      email: 'payment-test@example.com',
      initialBalance: 50
    });
    
    authToken = generateTestToken({
      supabase_id: testUser.supabase_id,
      email: testUser.email,
      username: testUser.username
    });
  });
  
  afterAll(async () => {
    await cleanupTestUser(pool, testUser.supabase_id);
    await pool.end();
    await new Promise(resolve => server.close(resolve));
  });
  
  describe('POST /api/payments/create-payment-intent', () => {
    it('should create payment intent for token purchase', async () => {
      const response = await request(server)
        .post('/api/payments/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000, // $50
          tokens: 1000
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        clientSecret: expect.stringContaining('_secret'),
        paymentIntentId: expect.stringContaining('pi_')
      });
    });
    
    it('should reject invalid amounts', async () => {
      const response = await request(server)
        .post('/api/payments/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -100,
          tokens: -10
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
    
    it('should enforce minimum purchase amount', async () => {
      const response = await request(server)
        .post('/api/payments/create-payment-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50, // $0.50 - below minimum
          tokens: 10
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Minimum');
    });
  });
  
  describe('GET /api/payments/prices', () => {
    it('should return available token packages', async () => {
      const response = await request(server)
        .get('/api/payments/prices')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        prices: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining('price_'),
            tokens: expect.any(String),
            amount: expect.any(Number),
            currency: 'usd'
          })
        ])
      });
    });
  });
  
  describe('POST /api/payments/confirm-payment', () => {
    it('should confirm payment and add tokens to balance', async () => {
      const response = await request(server)
        .post('/api/payments/confirm-payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_test123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        newBalance: expect.any(String)
      });
      
      // Verify tokens were added
      const balanceResult = await pool.query(
        'SELECT balance FROM token_balances WHERE supabase_user_id = $1',
        [testUser.supabase_id]
      );
      expect(Number(balanceResult.rows[0].balance)).toBeGreaterThan(50);
      
      // Verify payment record was created
      const paymentResult = await pool.query(
        'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
        ['pi_test123']
      );
      expect(paymentResult.rows).toHaveLength(1);
      expect(paymentResult.rows[0].status).toBe('completed');
    });
    
    it('should prevent duplicate payment confirmations', async () => {
      const response = await request(server)
        .post('/api/payments/confirm-payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_test123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already processed');
    });
  });
  
  describe('GET /api/payments/history', () => {
    it('should return user payment history', async () => {
      const response = await request(server)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        payments: expect.arrayContaining([
          expect.objectContaining({
            stripe_payment_intent_id: 'pi_test123',
            amount: expect.any(String),
            tokens_purchased: expect.any(String),
            status: 'completed'
          })
        ]),
        total: expect.any(Number)
      });
    });
    
    it('should support pagination', async () => {
      const response = await request(server)
        .get('/api/payments/history?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.payments).toHaveLength(1);
    });
  });
  
  describe('POST /api/payments/add-payment-method', () => {
    it('should add payment method to customer', async () => {
      const response = await request(server)
        .post('/api/payments/add-payment-method')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethodId: 'pm_test456'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Payment method added successfully'
      });
    });
  });
  
  describe('GET /api/payments/payment-methods', () => {
    it('should return user payment methods', async () => {
      const response = await request(server)
        .get('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        paymentMethods: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining('pm_'),
            type: 'card',
            card: expect.objectContaining({
              brand: expect.any(String),
              last4: expect.any(String)
            })
          })
        ])
      });
    });
  });
  
  describe('POST /api/tokens/purchase', () => {
    it('should create token purchase with payment intent', async () => {
      const response = await request(server)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 10000, // $100
          tokens: 2000,
          paymentMethodId: 'pm_test123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        paymentIntent: expect.objectContaining({
          id: expect.stringContaining('pi_'),
          amount: 10000,
          currency: 'usd'
        })
      });
    });
    
    it('should validate token-to-dollar ratio', async () => {
      const response = await request(server)
        .post('/api/tokens/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 1000, // $10
          tokens: 10000 // Way too many tokens for $10
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });
  });
  
  describe('Webhook handling', () => {
    it('should handle payment_intent.succeeded webhook', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_webhook123',
            amount: 2500,
            metadata: {
              userId: testUser.supabase_id,
              tokens: '500'
            }
          }
        }
      };
      
      const response = await request(server)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload);
      
      expect(response.status).toBe(200);
      
      // Verify tokens were added
      const balanceResult = await pool.query(
        'SELECT balance FROM token_balances WHERE supabase_user_id = $1',
        [testUser.supabase_id]
      );
      const previousBalance = 150; // 50 initial + 100 from previous test
      expect(Number(balanceResult.rows[0].balance)).toBe(previousBalance + 500);
    });
  });
});