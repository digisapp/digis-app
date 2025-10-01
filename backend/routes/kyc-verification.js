const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Start Stripe Identity verification session
 */
router.post('/start-verification', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    // Check if user is a creator
    const userResult = await pool.query(
      'SELECT is_creator, email, display_name, kyc_status FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    if (!user.is_creator) {
      return res.status(403).json({ error: 'KYC verification is only for creators' });
    }
    
    // Check if verification is already in progress or completed
    if (user.kyc_status === 'verified') {
      return res.status(400).json({ error: 'KYC verification already completed' });
    }
    
    if (user.kyc_status === 'pending') {
      // Get existing session
      const existingSession = await pool.query(
        'SELECT stripe_identity_verification_id FROM users WHERE supabase_id = $1',
        [userId]
      );
      
      if (existingSession.rows[0]?.stripe_identity_verification_id) {
        const session = await stripe.identity.verificationSessions.retrieve(
          existingSession.rows[0].stripe_identity_verification_id
        );
        
        if (session.status === 'requires_input') {
          return res.json({
            sessionId: session.id,
            clientSecret: session.client_secret,
            status: session.status
          });
        }
      }
    }
    
    // Create new Stripe Identity verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        user_id: userId,
        email: user.email,
        display_name: user.display_name
      },
      options: {
        document: {
          require_matching_selfie: true,
          allowed_types: ['driving_license', 'passport', 'id_card'],
          require_live_capture: true
        }
      },
      return_url: `${process.env.FRONTEND_URL}/creator-dashboard?kyc=complete`
    });
    
    // Update user's KYC status
    await pool.query(
      `UPDATE users 
       SET kyc_status = 'pending',
           stripe_identity_verification_id = $1,
           updated_at = NOW()
       WHERE supabase_id = $2`,
      [verificationSession.id, userId]
    );
    
    // Log verification attempt
    await pool.query(
      `INSERT INTO kyc_verifications (
        user_id, verification_type, status, stripe_verification_id, created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [userId, 'identity', 'pending', verificationSession.id]
    );
    
    res.json({
      sessionId: verificationSession.id,
      clientSecret: verificationSession.client_secret,
      status: verificationSession.status
    });
    
  } catch (error) {
    console.error('Error starting KYC verification:', error);
    res.status(500).json({ error: 'Failed to start verification process' });
  }
});

/**
 * Check KYC verification status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    
    const result = await pool.query(
      `SELECT 
        kyc_status,
        kyc_verified_at,
        identity_document_verified,
        tax_form_status,
        address_verified,
        payouts_enabled,
        payout_hold_reason
      FROM users 
      WHERE supabase_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const status = result.rows[0];
    
    // Get latest verification attempt details if needed
    let verificationDetails = null;
    if (status.kyc_status === 'failed') {
      const detailsResult = await pool.query(
        `SELECT failure_reason, created_at 
         FROM kyc_verifications 
         WHERE user_id = $1 AND status = 'failed'
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );
      
      if (detailsResult.rows.length > 0) {
        verificationDetails = detailsResult.rows[0];
      }
    }
    
    res.json({
      ...status,
      verificationDetails,
      requirements: {
        identity: status.identity_document_verified,
        tax: status.tax_form_status !== 'not_submitted',
        address: status.address_verified
      }
    });
    
  } catch (error) {
    console.error('Error checking KYC status:', error);
    res.status(500).json({ error: 'Failed to check verification status' });
  }
});

/**
 * Submit tax form information
 */
router.post('/tax-form', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const { formType, taxId, businessName, businessType } = req.body;
    
    // Validate form type
    if (!['W-9', 'W-8BEN', 'W-8BEN-E'].includes(formType)) {
      return res.status(400).json({ error: 'Invalid tax form type' });
    }
    
    // Check if user is a creator
    const userResult = await pool.query(
      'SELECT is_creator FROM users WHERE supabase_id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]?.is_creator) {
      return res.status(403).json({ error: 'Tax forms are only for creators' });
    }
    
    // Encrypt tax ID (in production, use proper encryption)
    const encryptedTaxId = Buffer.from(taxId).toString('base64');
    
    // Update user's tax information
    await pool.query(
      `UPDATE users 
       SET tax_form_status = $1,
           tax_id = $2,
           tax_form_submitted_at = NOW(),
           updated_at = NOW()
       WHERE supabase_id = $3`,
      [formType.toLowerCase().replace('-', '') + '_submitted', encryptedTaxId, userId]
    );
    
    // Create tax document record
    await pool.query(
      `INSERT INTO tax_documents (
        user_id, document_type, tax_year, form_data, status, submitted_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, document_type, tax_year) 
      DO UPDATE SET 
        form_data = $4,
        status = $5,
        submitted_at = NOW(),
        updated_at = NOW()`,
      [
        userId,
        formType,
        new Date().getFullYear(),
        JSON.stringify({ businessName, businessType }),
        'submitted'
      ]
    );
    
    res.json({
      success: true,
      message: 'Tax form submitted successfully'
    });
    
  } catch (error) {
    console.error('Error submitting tax form:', error);
    res.status(500).json({ error: 'Failed to submit tax form' });
  }
});

/**
 * Submit address verification
 */
router.post('/verify-address', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.supabase_id;
    const {
      line1,
      line2,
      city,
      state,
      postalCode,
      country
    } = req.body;
    
    // Validate required fields
    if (!line1 || !city || !postalCode || !country) {
      return res.status(400).json({ error: 'Missing required address fields' });
    }
    
    // Update user's address
    await pool.query(
      `UPDATE users 
       SET address_line1 = $1,
           address_line2 = $2,
           address_city = $3,
           address_state = $4,
           address_postal_code = $5,
           address_country = $6,
           address_verified = true,
           updated_at = NOW()
       WHERE supabase_id = $7`,
      [line1, line2, city, state, postalCode, country, userId]
    );
    
    // Log address verification
    await pool.query(
      `INSERT INTO kyc_verifications (
        user_id, verification_type, status, verification_data, verified_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [
        userId,
        'address',
        'verified',
        JSON.stringify({ line1, line2, city, state, postalCode, country })
      ]
    );
    
    res.json({
      success: true,
      message: 'Address verified successfully'
    });
    
  } catch (error) {
    console.error('Error verifying address:', error);
    res.status(500).json({ error: 'Failed to verify address' });
  }
});

/**
 * Webhook handler for Stripe Identity verification events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'identity.verification_session.verified':
      await handleVerificationSuccess(event.data.object);
      break;
      
    case 'identity.verification_session.requires_input':
      await handleVerificationPending(event.data.object);
      break;
      
    case 'identity.verification_session.canceled':
    case 'identity.verification_session.failed':
      await handleVerificationFailed(event.data.object);
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({ received: true });
});

// Helper functions for webhook handlers
async function handleVerificationSuccess(session) {
  const userId = session.metadata.user_id;
  
  await pool.query(
    `UPDATE users 
     SET kyc_status = 'verified',
         kyc_verified_at = NOW(),
         identity_document_verified = true,
         identity_document_type = $1,
         updated_at = NOW()
     WHERE supabase_id = $2`,
    [session.provided_details?.document?.type || 'unknown', userId]
  );
  
  await pool.query(
    `UPDATE kyc_verifications 
     SET status = 'verified',
         verified_at = NOW(),
         updated_at = NOW()
     WHERE stripe_verification_id = $1`,
    [session.id]
  );
}

async function handleVerificationPending(session) {
  const userId = session.metadata.user_id;
  
  await pool.query(
    `UPDATE users 
     SET kyc_status = 'pending',
         updated_at = NOW()
     WHERE supabase_id = $1`,
    [userId]
  );
}

async function handleVerificationFailed(session) {
  const userId = session.metadata.user_id;
  const failureReason = session.last_error?.reason || 'Verification failed';
  
  await pool.query(
    `UPDATE users 
     SET kyc_status = 'failed',
         updated_at = NOW()
     WHERE supabase_id = $1`,
    [userId]
  );
  
  await pool.query(
    `UPDATE kyc_verifications 
     SET status = 'failed',
         failure_reason = $1,
         updated_at = NOW()
     WHERE stripe_verification_id = $2`,
    [failureReason, session.id]
  );
}

module.exports = router;