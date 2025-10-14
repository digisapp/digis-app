/**
 * Unit tests for Sentry helpers
 *
 * Tests PII scrubbing, rate limiting, and environment gating
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables
const mockEnv = (overrides = {}) => {
  vi.stubGlobal('import.meta', {
    env: {
      PROD: false,
      VERCEL_ENV: '',
      ...overrides
    }
  });
};

// Mock Sentry on window
const mockSentry = () => {
  const addBreadcrumbMock = vi.fn();
  const setTagMock = vi.fn();

  global.window = {
    Sentry: {
      addBreadcrumb: addBreadcrumbMock,
      setTag: setTagMock
    }
  };

  return { addBreadcrumbMock, setTagMock };
};

describe('Sentry Client Helpers', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('PII Scrubbing', () => {

    it('should remove email from breadcrumb data', () => {
      // This test would import the actual scrubPII function
      // For now, documenting expected behavior

      const input = {
        email: 'user@example.com',
        uid: 'abc123',
        role: 'creator'
      };

      const expected = {
        // email removed
        uid: 'abc123',
        role: 'creator'
      };

      // const result = scrubPII(input);
      // expect(result).toEqual(expected);
      // expect(result.email).toBeUndefined();
    });

    it('should mask long UIDs (>16 chars) to first 8 chars', () => {
      const input = {
        uid: 'abc123def456ghi789jkl012mno345'
      };

      const expected = {
        uid: 'abc123de...' // First 8 chars + ...
      };

      // const result = scrubPII(input);
      // expect(result.uid).toEqual('abc123de...');
    });

    it('should keep short UIDs unchanged', () => {
      const input = {
        uid: 'short123'
      };

      const expected = {
        uid: 'short123'
      };

      // const result = scrubPII(input);
      // expect(result.uid).toEqual('short123');
    });
  });

  describe('Rate Limiting', () => {

    it('should allow first breadcrumb immediately', () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'production' });
      const { addBreadcrumbMock } = mockSentry();

      // const { addBreadcrumb } = require('../sentry.client');
      // addBreadcrumb('test_event', { action: 'click' });

      // expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
    });

    it('should block duplicate breadcrumb within 2s window', async () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'production' });
      const { addBreadcrumbMock } = mockSentry();

      // const { addBreadcrumb } = require('../sentry.client');

      // First call - should send
      // addBreadcrumb('test_event', { action: 'click' });
      // expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);

      // Second call within 2s - should be blocked
      // addBreadcrumb('test_event', { action: 'click' });
      // expect(addBreadcrumbMock).toHaveBeenCalledTimes(1); // Still 1

      // After 2s - should send again
      // await new Promise(resolve => setTimeout(resolve, 2100));
      // addBreadcrumb('test_event', { action: 'click' });
      // expect(addBreadcrumbMock).toHaveBeenCalledTimes(2);
    });

    it('should allow different events immediately', () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'production' });
      const { addBreadcrumbMock } = mockSentry();

      // const { addBreadcrumb } = require('../sentry.client');

      // addBreadcrumb('event_one', { action: 'click' });
      // addBreadcrumb('event_two', { action: 'hover' });

      // expect(addBreadcrumbMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Environment Gating', () => {

    it('should not send breadcrumbs in development', () => {
      mockEnv({ PROD: false });
      const { addBreadcrumbMock } = mockSentry();

      // const { addBreadcrumb } = require('../sentry.client');
      // addBreadcrumb('test_event', { action: 'click' });

      // expect(addBreadcrumbMock).not.toHaveBeenCalled();
    });

    it('should not send breadcrumbs in Vercel preview', () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'preview' });
      const { addBreadcrumbMock } = mockSentry();

      // const { addBreadcrumb } = require('../sentry.client');
      // addBreadcrumb('test_event', { action: 'click' });

      // expect(addBreadcrumbMock).not.toHaveBeenCalled();
    });

    it('should send breadcrumbs in production Vercel environment', () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'production' });
      const { addBreadcrumbMock } = mockSentry();

      // const { addBreadcrumb } = require('../sentry.client');
      // addBreadcrumb('test_event', { action: 'click' });

      // expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
    });

    it('should send breadcrumbs when VERCEL_ENV is not set (default production)', () => {
      mockEnv({ PROD: true, VERCEL_ENV: '' });
      const { addBreadcrumbMock } = mockSentry();

      // const { addBreadcrumb } = require('../sentry.client');
      // addBreadcrumb('test_event', { action: 'click' });

      // When VERCEL_ENV is empty, it should send (backwards compat)
      // expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
    });

    it('should not send tags in Vercel preview', () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'preview' });
      const { setTagMock } = mockSentry();

      // const { setTag } = require('../sentry.client');
      // setTag('role', 'creator');

      // expect(setTagMock).not.toHaveBeenCalled();
    });

    it('should send tags in production Vercel environment', () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'production' });
      const { setTagMock } = mockSentry();

      // const { setTag } = require('../sentry.client');
      // setTag('role', 'creator');

      // expect(setTagMock).toHaveBeenCalledWith('role', 'creator');
    });
  });

  describe('Graceful Failures', () => {

    it('should not throw if window.Sentry is undefined', () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'production' });
      global.window = {}; // No Sentry

      // const { addBreadcrumb } = require('../sentry.client');

      // Should not throw
      // expect(() => {
      //   addBreadcrumb('test_event', { action: 'click' });
      // }).not.toThrow();
    });

    it('should not throw if Sentry.addBreadcrumb throws', () => {
      mockEnv({ PROD: true, VERCEL_ENV: 'production' });
      global.window = {
        Sentry: {
          addBreadcrumb: () => { throw new Error('Sentry error'); }
        }
      };

      // const { addBreadcrumb } = require('../sentry.client');

      // Should not throw
      // expect(() => {
      //   addBreadcrumb('test_event', { action: 'click' });
      // }).not.toThrow();
    });
  });
});

/**
 * To run these tests:
 * 1. Ensure vitest is installed: npm install -D vitest
 * 2. Add to package.json scripts: "test:unit": "vitest"
 * 3. Run: npm run test:unit
 *
 * Note: Tests are currently scaffolded with expected behavior.
 * Uncomment assertions after extracting testable functions from sentry.client.js
 * (e.g., export scrubPII as a separate function)
 */
