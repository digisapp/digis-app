/**
 * Vanity URL Route Component
 *
 * Handles vanity URLs like digis.cc/miriam
 * - Guards against reserved words (app routes, system files)
 * - Validates username format
 * - Renders creator profile if valid
 *
 * This MUST be registered as the LAST route in your router to avoid
 * shadowing real app routes like /explore, /login, etc.
 */

import React from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';

// Reserved handles - must match backend list
// If you expose shared/reservedHandles.js, import it here
const RESERVED_HANDLES = new Set([
  '', 'home', 'explore', 'search', 'discover', 'trending', 'live',
  'login', 'logout', 'signup', 'register', 'signin', 'signout', 'auth',
  'verify', 'confirm', 'reset', 'forgot', 'password',
  'settings', 'profile', 'edit', 'account', 'dashboard', 'wallet', 'balance',
  'tokens', 'purchases', 'creator', 'creators', 'become-creator', 'apply',
  'studio', 'analytics', 'earnings', 'payouts', 'schedule', 'availability',
  'messages', 'inbox', 'chat', 'notifications', 'alerts', 'calls', 'video', 'voice',
  'offers', 'deals', 'shop', 'store', 'cart', 'checkout', 'payment', 'billing',
  'subscribe', 'subscription', 'subscriptions', 'membership', 'tiers',
  'posts', 'feed', 'stream', 'streams', 'photo', 'photos', 'gallery', 'media', 'content',
  'privacy', 'terms', 'tos', 'legal', 'dmca', 'copyright', 'help', 'support',
  'faq', 'about', 'contact', 'press', 'blog', 'news',
  'admin', 'staff', 'moderator', 'mod', 'internal', 'system', 'api',
  'webhook', 'webhooks', 'cron', 'uploads', 'static', 'assets', 'public',
  'cdn', 'img', 'images', 'js', 'css', 'fonts', 'favicon.ico', 'robots.txt',
  'sitemap.xml', 'manifest.json', '.well-known', 'tv', 'premium', 'vip',
  'exclusive', 'special', 'featured', 'verified', 'official', 'digis',
  'test', 'demo', 'example', 'sample', 'placeholder', 'null', 'undefined',
  'none', 'root', 'user', 'guest'
]);

// Username format regex (must match backend validation)
const RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

/**
 * Vanity Route Guard
 *
 * - If handle is reserved: pass through to normal route handler
 * - If handle is invalid format: redirect to 404
 * - Otherwise: render creator profile (via Outlet)
 */
export default function VanityRoute() {
  const { handle = '' } = useParams();
  const normalized = handle.trim().toLowerCase();

  console.log('[VanityRoute] Handle:', normalized);

  // Reserved words should pass through to their normal routes
  // React Router will prioritize static routes over this dynamic one,
  // but this is a safety net
  if (RESERVED_HANDLES.has(normalized)) {
    console.log('[VanityRoute] Reserved word, passing through');
    // Don't navigate - let the router find the actual route
    return null;
  }

  // Validate username format (keep in sync with backend)
  if (normalized.length < 3 || normalized.length > 30 || !RE.test(normalized)) {
    console.log('[VanityRoute] Invalid format, redirecting to 404');
    return <Navigate to="/404" replace />;
  }

  // Valid username format - render creator profile
  console.log('[VanityRoute] Valid username, rendering profile');
  return <Outlet />;
}
