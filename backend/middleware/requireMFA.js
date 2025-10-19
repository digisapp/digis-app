const { supabaseAdmin } = require('../utils/supabase-admin-v2');

/**
 * MFA Enforcement Middleware (2025 Best Practice)
 *
 * Requires all admin users to have MFA enrolled and verified.
 * Blocks access to admin routes if MFA is not set up.
 */
async function requireMFA(req, res, next) {
  try {
    // Emergency bypass (logs the bypass)
    if (process.env.ADMIN_SECURITY_ENFORCED === 'false') {
      console.warn('⚠️ ADMIN SECURITY BYPASSED - MFA CHECK SKIPPED');
      return next();
    }

    const role = req.user?.app_metadata?.role;

    // Only enforce MFA for admin users
    if (role !== 'admin') {
      return next();
    }

    // Check if MFA is enrolled in app_metadata
    const mfaEnrolled = req.user?.app_metadata?.mfa_enrolled === true;

    if (!mfaEnrolled) {
      // Verify against Supabase MFA factors as fallback
      const userId = req.user?.id || req.user?.supabase_id;

      if (userId) {
        try {
          const { data: factors, error } = await supabaseAdmin.auth.mfa.listFactors({
            userId: userId
          });

          if (error) {
            console.error('Error checking MFA factors:', error);
          }

          // If they have verified factors in Supabase, allow through
          const hasVerifiedFactor = factors?.totp?.some(f => f.status === 'verified') ||
                                   factors?.phone?.some(f => f.status === 'verified');

          if (hasVerifiedFactor) {
            return next();
          }
        } catch (mfaCheckError) {
          console.error('MFA check failed:', mfaCheckError);
        }
      }

      return res.status(403).json({
        error: 'MFA_REQUIRED',
        message: 'Multi-factor authentication is required for admin access. Please enroll in MFA before accessing admin features.',
        redirect: '/admin/mfa-setup'
      });
    }

    next();
  } catch (error) {
    console.error('MFA enforcement error:', error);
    return res.status(500).json({
      error: 'MFA_CHECK_FAILED',
      message: 'Failed to verify MFA status'
    });
  }
}

/**
 * Endpoint to check MFA status
 */
async function getMFAStatus(req, res) {
  try {
    const userId = req.user?.id || req.user?.supabase_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: factors, error } = await supabaseAdmin.auth.mfa.listFactors({
      userId: userId
    });

    if (error) {
      throw error;
    }

    const totpFactors = factors?.totp || [];
    const phoneFactors = factors?.phone || [];

    const hasVerifiedFactor =
      totpFactors.some(f => f.status === 'verified') ||
      phoneFactors.some(f => f.status === 'verified');

    return res.json({
      success: true,
      mfa_enrolled: hasVerifiedFactor,
      factors: {
        totp: totpFactors.length,
        phone: phoneFactors.length
      }
    });
  } catch (error) {
    console.error('Error getting MFA status:', error);
    return res.status(500).json({
      error: 'Failed to get MFA status'
    });
  }
}

module.exports = {
  requireMFA,
  getMFAStatus
};
