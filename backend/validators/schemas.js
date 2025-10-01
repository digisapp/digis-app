const { z } = require('zod');

// User registration schema
const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain uppercase, lowercase, number and special character'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens'),
  isCreator: z.boolean().optional().default(false),
});

// Session creation schema
const sessionCreationSchema = z.object({
  creatorId: z.number().positive('Invalid creator ID'),
  type: z.enum(['video', 'voice', 'stream'], {
    errorMap: () => ({ message: 'Session type must be video, voice, or stream' })
  }),
  scheduledTime: z.string().datetime().optional(),
  estimatedDuration: z.number().min(1).max(180).optional(), // max 3 hours
});

// Token purchase schema
const tokenPurchaseSchema = z.object({
  packageId: z.number().positive('Invalid package ID'),
  amount: z.number()
    .positive('Amount must be positive')
    .max(10000, 'Maximum purchase amount exceeded'),
  paymentMethodId: z.string().min(1, 'Payment method required'),
  saveCard: z.boolean().optional().default(false),
});

// Message schema with sanitization
const messageSchema = z.object({
  recipientId: z.number().positive('Invalid recipient ID'),
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message too long')
    .transform(val => val.trim()), // Remove leading/trailing whitespace
  sessionId: z.number().positive().optional(),
});

// Profile update schema
const profileUpdateSchema = z.object({
  bio: z.string().max(500, 'Bio too long').optional(),
  display_name: z.string().min(1).max(50, 'Display name too long').optional(),
  profile_pic_url: z.string().url('Invalid URL format').optional(),
  stream_price: z.number()
    .min(0, 'Price cannot be negative')
    .max(1000, 'Maximum price is $1000')
    .optional(),
  video_price: z.number()
    .min(0, 'Price cannot be negative')
    .max(1000, 'Maximum price is $1000')
    .optional(),
  voice_price: z.number()
    .min(0, 'Price cannot be negative')
    .max(1000, 'Maximum price is $1000')
    .optional(),
  message_price: z.number()
    .min(0, 'Price cannot be negative')
    .max(100, 'Maximum price is $100')
    .optional(),
  text_message_price: z.number().min(0).max(100).optional(),
  image_message_price: z.number().min(0).max(100).optional(),
  video_message_price: z.number().min(0).max(100).optional(),
  voice_memo_price: z.number().min(0).max(100).optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens')
    .optional(),
  creator_type: z.string().optional(),
  show_token_balance: z.boolean().optional(),
  gallery_photos: z.array(z.string().url()).optional(),
  stream_audience_control: z.boolean().optional(),
  is_creator: z.boolean().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  customGreeting: z.string().max(200).optional(),
  availabilityStatus: z.enum(['online', 'busy', 'offline']).optional(),
});

// Webhook validation schema (Stripe)
const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.string(),
  api_version: z.string(),
  created: z.number(),
  type: z.string(),
  data: z.object({
    object: z.record(z.any()),
  }),
});

// Agora token request schema
const agoraTokenSchema = z.object({
  channel: z.string()
    .min(1, 'Channel name required')
    .max(64, 'Channel name too long'),
  uid: z.union([z.string(), z.number()]).transform(val => String(val)),
  role: z.enum(['host', 'audience'], {
    errorMap: () => ({ message: 'Role must be either host or audience' })
  }),
  expireTime: z.number().min(3600).max(86400).optional().default(3600), // 1-24 hours
});

// Validation middleware
function validate(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedData = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

module.exports = {
  userRegistrationSchema,
  sessionCreationSchema,
  tokenPurchaseSchema,
  messageSchema,
  profileUpdateSchema,
  stripeWebhookSchema,
  agoraTokenSchema,
  validate,
};