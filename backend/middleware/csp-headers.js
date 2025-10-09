const crypto = require('crypto');
const { logger } = require('../utils/secureLogger');

/**
 * Generate a nonce for inline scripts (if needed)
 */
const generateNonce = () => crypto.randomBytes(16).toString('base64');

/**
 * Strict Content Security Policy middleware
 * Prevents XSS attacks by restricting resource loading
 */
const strictCSP = (options = {}) => {
  const {
    reportOnly = false,
    reportUri = '/api/csp-report',
    allowInlineScripts = false,
    allowInlineStyles = false,
    customDirectives = {}
  } = options;

  return (req, res, next) => {
    // Generate nonce for this request
    const nonce = generateNonce();
    res.locals.nonce = nonce;

    // Build CSP directives
    const directives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        allowInlineScripts ? `'nonce-${nonce}'` : null,
        "'strict-dynamic'", // Allow scripts loaded by trusted scripts
        "https:", // Allow HTTPS scripts (remove in production for stricter policy)
        "'unsafe-inline'" // Fallback for older browsers (ignored when strict-dynamic is present)
      ].filter(Boolean),
      'style-src': [
        "'self'",
        allowInlineStyles ? "'unsafe-inline'" : `'nonce-${nonce}'`,
        "https://fonts.googleapis.com", // Google Fonts
        "https://cdn.jsdelivr.net" // CDN styles if needed
      ].filter(Boolean),
      'img-src': [
        "'self'",
        "data:", // Allow data URLs for images
        "https:", // Allow HTTPS images
        "blob:", // Allow blob URLs for dynamic images
        process.env.SUPABASE_URL // Supabase storage
      ].filter(Boolean),
      'font-src': [
        "'self'",
        "https://fonts.gstatic.com", // Google Fonts
        "data:" // Allow data URLs for fonts
      ],
      'connect-src': [
        "'self'",
        process.env.SUPABASE_URL,
        process.env.BACKEND_URL || "http://localhost:3001",
        "https://api.stripe.com",
        "https://*.agora.io",
        "wss://*.agora.io",
        "https://*.sentry.io",
        "ws://localhost:*", // Development WebSocket
        "wss://localhost:*" // Development secure WebSocket
      ].filter(Boolean),
      'media-src': [
        "'self'",
        "blob:",
        "https:",
        process.env.SUPABASE_URL
      ].filter(Boolean),
      'object-src': ["'none'"], // Disable plugins like Flash
      'base-uri': ["'self'"], // Restrict base tag
      'form-action': ["'self'"], // Restrict form submissions
      'frame-ancestors': ["'none'"], // Prevent framing (clickjacking)
      'frame-src': [
        "'self'",
        "https://js.stripe.com", // Stripe iframe
        "https://hooks.stripe.com"
      ],
      'worker-src': [
        "'self'",
        "blob:" // Allow Web Workers from blob URLs
      ],
      'manifest-src': ["'self'"],
      'upgrade-insecure-requests': [], // Force HTTPS
      'block-all-mixed-content': [], // Block HTTP on HTTPS pages
      'report-uri': [reportUri],
      ...customDirectives
    };

    // Build CSP header string
    const cspString = Object.entries(directives)
      .map(([key, values]) => {
        if (values.length === 0) return key;
        return `${key} ${values.join(' ')}`;
      })
      .join('; ');

    // Set CSP header
    const headerName = reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    res.setHeader(headerName, cspString);

    // Add other security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Disabled in favor of CSP
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy',
      'accelerometer=(), camera=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), payment=*, usb=()'
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    // Removed Cross-Origin-Resource-Policy to allow CORS
    // res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    next();
  };
};

/**
 * CSP violation report handler
 */
const cspReportHandler = async (req, res) => {
  const report = req.body;

  if (report && report['csp-report']) {
    const violation = report['csp-report'];

    logger.warn('CSP Violation', {
      documentUri: violation['document-uri'],
      violatedDirective: violation['violated-directive'],
      blockedUri: violation['blocked-uri'],
      lineNumber: violation['line-number'],
      columnNumber: violation['column-number'],
      sourceFile: violation['source-file'],
      referrer: violation['referrer'],
      userAgent: req.headers['user-agent']
    });

    // You could also store these in a database for analysis
    // await storeCSPViolation(violation);
  }

  res.status(204).end();
};

/**
 * Trusted Types policy for DOM XSS prevention (experimental)
 */
const trustedTypesPolicy = () => {
  return (req, res, next) => {
    res.setHeader('Content-Security-Policy',
      "require-trusted-types-for 'script'; trusted-types default"
    );
    next();
  };
};

/**
 * Development-friendly CSP (less strict)
 */
const developmentCSP = () => {
  return (req, res, next) => {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https:",
      "connect-src 'self' ws: wss: https:",
      "media-src 'self' blob: https:",
      "object-src 'none'",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "form-action 'self'"
    ].join('; ');

    res.setHeader('Content-Security-Policy', csp);
    next();
  };
};

/**
 * Apply CSP based on environment
 */
const applyCSP = (app, options = {}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const express = require('express');

  if (isDevelopment && !options.forceStrict) {
    app.use(developmentCSP());
    logger.info('Using development CSP (less strict)');
  } else {
    app.use(strictCSP(options));
    logger.info('Using production CSP (strict)');
  }

  // Add CSP violation report endpoint
  app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), cspReportHandler);
};

module.exports = {
  strictCSP,
  developmentCSP,
  trustedTypesPolicy,
  cspReportHandler,
  applyCSP,
  generateNonce
};