const { getClientIp } = require('./adminAudit');

/**
 * IP Allowlist Middleware (2025 Best Practice - Optional)
 *
 * Restricts admin access to specific IP addresses/ranges.
 * Useful for high-security environments or compliance requirements.
 *
 * Configuration via environment variable:
 * ADMIN_ALLOWED_IPS=203.0.113.1,203.0.113.2,192.168.1.0/24
 *
 * Supports:
 * - Individual IPs: 203.0.113.1
 * - CIDR ranges: 192.168.1.0/24
 * - IPv6: 2001:db8::1
 */

// Parse allowed IPs from environment variable
const ADMIN_ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS
  ? process.env.ADMIN_ALLOWED_IPS.split(',').map(ip => ip.trim())
  : [];

const ALLOWLIST_ENABLED = ADMIN_ALLOWED_IPS.length > 0;

/**
 * Check if IP is in allowlist
 * Supports both individual IPs and CIDR ranges
 */
function isIpAllowed(clientIp) {
  if (!ALLOWLIST_ENABLED) {
    return true; // Allowlist disabled, allow all
  }

  // Check exact match first
  if (ADMIN_ALLOWED_IPS.includes(clientIp)) {
    return true;
  }

  // Check CIDR ranges (if any)
  for (const allowedIp of ADMIN_ALLOWED_IPS) {
    if (allowedIp.includes('/')) {
      // CIDR range - use ip-range-check library if available
      try {
        const ipRangeCheck = require('ip-range-check');
        if (ipRangeCheck(clientIp, allowedIp)) {
          return true;
        }
      } catch (err) {
        console.warn('⚠️ ip-range-check not installed, skipping CIDR check. Install with: npm install ip-range-check');
      }
    }
  }

  return false;
}

/**
 * IP Allowlist middleware
 * Blocks access if client IP is not in the allowlist
 */
function ipAllowlist(req, res, next) {
  // Skip if allowlist is disabled
  if (!ALLOWLIST_ENABLED) {
    return next();
  }

  const clientIp = getClientIp(req);

  if (!isIpAllowed(clientIp)) {
    console.error(`🚨 Blocked admin access from non-whitelisted IP: ${clientIp} - User: ${req.user?.email || 'unknown'}`);

    // Log to security monitoring
    // TODO: Send alert to security team

    return res.status(403).json({
      error: 'IP_NOT_ALLOWED',
      message: 'Admin access is restricted to authorized IP addresses.',
      blocked_ip: clientIp // Include for debugging (remove in production if sensitive)
    });
  }

  console.log(`✅ Admin access from whitelisted IP: ${clientIp} - User: ${req.user?.email || 'unknown'}`);
  next();
}

/**
 * Get allowlist status (for debugging/admin UI)
 */
function getAllowlistStatus(req, res) {
  const clientIp = getClientIp(req);

  return res.json({
    allowlist_enabled: ALLOWLIST_ENABLED,
    allowed_ips_count: ADMIN_ALLOWED_IPS.length,
    client_ip: clientIp,
    is_allowed: isIpAllowed(clientIp),
    // Only show IPs to super admins
    allowed_ips: req.user?.app_metadata?.is_super_admin ? ADMIN_ALLOWED_IPS : undefined
  });
}

/**
 * Temporarily allow an IP (emergency access)
 * This should be called manually by a super admin
 * Note: This only works in memory and will reset on server restart
 */
const temporaryAllowedIps = new Set();

function temporaryAllowIp(ip, durationMinutes = 60) {
  temporaryAllowedIps.add(ip);

  console.log(`⚠️ Temporarily allowing IP: ${ip} for ${durationMinutes} minutes`);

  // Auto-remove after duration
  setTimeout(() => {
    temporaryAllowedIps.delete(ip);
    console.log(`⏱️ Temporary IP allowance expired: ${ip}`);
  }, durationMinutes * 60 * 1000);
}

/**
 * Enhanced IP check that includes temporary allowances
 */
function isIpAllowedEnhanced(clientIp) {
  if (temporaryAllowedIps.has(clientIp)) {
    return true;
  }

  return isIpAllowed(clientIp);
}

module.exports = {
  ipAllowlist,
  isIpAllowed,
  isIpAllowedEnhanced,
  getAllowlistStatus,
  temporaryAllowIp,
  ALLOWLIST_ENABLED
};
