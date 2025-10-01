/**
 * Sentry Test Endpoints
 * FOR DEVELOPMENT/TESTING ONLY - Remove in production
 */

const express = require('express');
const router = express.Router();
const {
  captureMessage,
  captureException,
  addBreadcrumb,
  monitorAsync
} = require('../lib/sentry');

// Test error capture
router.get('/test-error', (req, res, next) => {
  try {
    // Add breadcrumb for context
    addBreadcrumb('Testing Sentry error capture', 'test', 'info', {
      endpoint: '/test-error',
      timestamp: new Date().toISOString()
    });

    // Throw a test error
    throw new Error('This is a test error for Sentry!');
  } catch (error) {
    // This will be caught by Sentry error handler
    error.critical = true; // Mark as critical to ensure capture
    next(error);
  }
});

// Test message capture
router.get('/test-message', (req, res) => {
  captureMessage('Test message from Digis backend', 'info', {
    test: {
      endpoint: '/test-message',
      timestamp: new Date().toISOString(),
      user: req.user?.id || 'anonymous'
    }
  });

  res.json({
    success: true,
    message: 'Test message sent to Sentry'
  });
});

// Test async error
router.get('/test-async-error', async (req, res, next) => {
  try {
    await monitorAsync('test-async-operation', async () => {
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 100));

      // Throw async error
      throw new Error('This is an async test error!');
    });
  } catch (error) {
    error.critical = true;
    next(error);
  }
});

// Test unhandled rejection
router.get('/test-unhandled', (req, res) => {
  // This will trigger an unhandled promise rejection
  Promise.reject(new Error('Test unhandled promise rejection'));

  res.json({
    success: true,
    message: 'Triggered unhandled promise rejection'
  });
});

// Test performance monitoring
router.get('/test-performance', async (req, res) => {
  const result = await monitorAsync('heavy-computation', async () => {
    // Simulate heavy computation
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += Math.sqrt(i);
    }
    return sum;
  });

  res.json({
    success: true,
    message: 'Performance test completed',
    result
  });
});

// Test custom context
router.get('/test-context', (req, res, next) => {
  try {
    const testError = new Error('Error with custom context');

    captureException(testError, {
      user: {
        id: req.user?.id || 'test-user',
        role: 'tester'
      },
      request: {
        endpoint: '/test-context',
        method: req.method,
        query: req.query
      },
      custom: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: 'Error with context sent to Sentry'
    });
  } catch (error) {
    next(error);
  }
});

// Test breadcrumbs
router.get('/test-breadcrumbs', (req, res) => {
  // Add multiple breadcrumbs
  addBreadcrumb('User navigated to test', 'navigation');
  addBreadcrumb('Clicked test button', 'ui.click', 'info', { button: 'test' });
  addBreadcrumb('API call started', 'http', 'info', { url: '/test' });
  addBreadcrumb('Database query executed', 'database', 'info', { query: 'SELECT * FROM test' });

  // Now trigger an error with breadcrumb trail
  try {
    throw new Error('Error with breadcrumb trail');
  } catch (error) {
    captureException(error);
  }

  res.json({
    success: true,
    message: 'Breadcrumbs and error sent to Sentry'
  });
});

// Health check that doesn't trigger Sentry
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Sentry test endpoints are working',
    endpoints: [
      '/api/sentry-test/test-error',
      '/api/sentry-test/test-message',
      '/api/sentry-test/test-async-error',
      '/api/sentry-test/test-unhandled',
      '/api/sentry-test/test-performance',
      '/api/sentry-test/test-context',
      '/api/sentry-test/test-breadcrumbs'
    ]
  });
});

module.exports = router;