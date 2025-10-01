const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Digis API',
      version: '1.0.0',
      description: 'Digis platform API - Connecting fans with creators through paid interactions using a token-based economy',
      contact: {
        name: 'Digis Team',
        email: 'dev@digis.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development server'
      },
      {
        url: 'https://api.digis.app/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authorization token from Supabase Auth'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            supabase_id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            display_name: { type: 'string' },
            bio: { type: 'string' },
            profile_pic_url: { type: 'string', format: 'uri' },
            is_creator: { type: 'boolean' },
            is_admin: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        TokenBalance: {
          type: 'object',
          properties: {
            balance: { type: 'number', format: 'decimal' },
            total_purchased: { type: 'number', format: 'decimal' },
            total_spent: { type: 'number', format: 'decimal' },
            total_earned: { type: 'number', format: 'decimal' }
          }
        },
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            channel: { type: 'string' },
            creator_id: { type: 'string' },
            fan_id: { type: 'string' },
            session_type: { type: 'string', enum: ['video', 'voice'] },
            status: { type: 'string', enum: ['active', 'ended', 'cancelled'] },
            duration_minutes: { type: 'integer' },
            tokens_cost: { type: 'number', format: 'decimal' },
            start_time: { type: 'string', format: 'date-time' },
            end_time: { type: 'string', format: 'date-time' }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            stripe_payment_intent_id: { type: 'string' },
            amount: { type: 'number', format: 'decimal' },
            currency: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
            tokens_purchased: { type: 'number', format: 'decimal' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and account management'
      },
      {
        name: 'Users',
        description: 'User profile and creator management'
      },
      {
        name: 'Tokens',
        description: 'Token economy and balance management'
      },
      {
        name: 'Payments',
        description: 'Payment processing with Stripe'
      },
      {
        name: 'Agora',
        description: 'Video/voice call token generation and chat'
      },
      {
        name: 'Creators',
        description: 'Creator discovery and interactions'
      }
    ]
  },
  apis: [path.join(__dirname, '../routes/*.js')], // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = specs;