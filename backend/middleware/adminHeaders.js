/**
 * Admin Security Headers Middleware (2025 Best Practice)
 *
 * Applies stricter security headers to admin routes:
 * - Content Security Policy (no inline scripts)
 * - X-Frame-Options (prevent clickjacking)
 * - X-Content-Type-Options (prevent MIME sniffing)
 * - Referrer-Policy (no referrer leakage)
 * - Permissions-Policy (disable sensors/cameras)
 */

/**
 * Admin-specific security headers
 * Stricter than regular user-facing pages
 */
function adminHeaders(req, res, next) {
  // Strict Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +                    // No inline scripts
    "style-src 'self' 'unsafe-inline'; " +     // Allow inline styles (Tailwind)
    "img-src 'self' data: https:; " +          // Self + data URIs + HTTPS images
    "font-src 'self' data:; " +                // Self + data URIs for fonts
    "connect-src 'self'; " +                   // API calls to same origin only
    "frame-ancestors 'none'; " +               // Prevent embedding in iframes
    "form-action 'self'; " +                   // Forms submit to same origin
    "base-uri 'self'; " +                      // Restrict base tag
    "object-src 'none'; " +                    // No Flash, Java, etc.
    "upgrade-insecure-requests"                // Auto-upgrade HTTP to HTTPS
  );

  // Prevent clickjacking (redundant with CSP frame-ancestors, but defense in depth)
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Don't leak referrer to external sites
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Disable browser features that admins don't need
  res.setHeader('Permissions-Policy',
    'geolocation=(), ' +        // No location access
    'microphone=(), ' +         // No microphone
    'camera=(), ' +             // No camera
    'payment=(), ' +            // No payment API
    'usb=(), ' +                // No USB access
    'magnetometer=(), ' +       // No sensors
    'accelerometer=(), ' +      // No sensors
    'gyroscope=()'              // No sensors
  );

  // Enforce HTTPS (if not in development)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  next();
}

/**
 * Security headers for sensitive admin actions
 * Even stricter - add cache control
 */
function sensitiveActionHeaders(req, res, next) {
  // Apply standard admin headers first
  adminHeaders(req, res, () => {
    // Additional headers for sensitive actions

    // Never cache sensitive responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Prevent browser from caching credentials
    res.setHeader('Clear-Site-Data', '"cache", "cookies"');

    next();
  });
}

module.exports = {
  adminHeaders,
  sensitiveActionHeaders
};
