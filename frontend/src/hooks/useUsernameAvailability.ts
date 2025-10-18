/**
 * Username Availability Hook
 *
 * Provides live validation and availability checking for usernames.
 * Debounces API calls to avoid hammering the server.
 *
 * Usage:
 *   const { value, state } = useUsernameAvailability(inputValue);
 *   // state.status: 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error'
 */

import { useEffect, useMemo, useRef, useState } from 'react';

// Username format regex: 3-30 chars, a-z/0-9/.-_, start/end with alphanumeric
const RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

// Reserved handles - must match backend list
// If you expose shared/reservedHandles.js to frontend, import it instead
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

const normalize = (v: string) => (v ?? '').trim().toLowerCase();

export type UsernameState =
  | { status: 'idle'; msg?: string }
  | { status: 'invalid'; msg: string }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken'; msg: string }
  | { status: 'error'; msg: string };

/**
 * Hook to check username availability with debouncing
 *
 * @param raw - Raw username input
 * @param debounceMs - Debounce delay in milliseconds (default: 350)
 * @returns Object with normalized value and state
 */
export function useUsernameAvailability(raw: string, debounceMs = 350) {
  const value = normalize(raw);
  const [state, setState] = useState<UsernameState>({ status: 'idle' });
  const timer = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);

  // Local validation (fast, synchronous)
  const localError = useMemo(() => {
    if (!value) return 'Username required';
    if (value.length < 3) return 'Must be at least 3 characters';
    if (value.length > 30) return 'Must be at most 30 characters';
    if (!RE.test(value)) return 'Use a–z, 0–9, dot, underscore, hyphen (start/end with letter/number)';
    if (RESERVED_HANDLES.has(value)) return 'This name is reserved';
    return null;
  }, [value]);

  useEffect(() => {
    // Clear previous timer and abort previous request
    if (timer.current) window.clearTimeout(timer.current);
    if (controller.current) controller.current.abort();

    // If local validation fails, show error immediately
    if (localError) {
      setState({ status: 'invalid', msg: localError });
      return;
    }

    // Show "checking..." state
    setState({ status: 'checking' });

    // Create new abort controller for this request
    controller.current = new AbortController();

    // Debounce the API call
    timer.current = window.setTimeout(async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
        const res = await fetch(
          `${backendUrl}/public/usernames/availability?username=${encodeURIComponent(value)}`,
          {
            signal: controller.current?.signal,
            credentials: 'include'
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.message || data?.error || 'Server error';
          setState({ status: 'error', msg });
          return;
        }

        const data = await res.json();

        if (data.available) {
          setState({ status: 'available' });
        } else {
          const msg = data.message || data.reason || 'Already taken';
          setState({ status: 'taken', msg });
        }
      } catch (e: any) {
        // Ignore abort errors (from debounce cancellation)
        if (e?.name === 'AbortError') return;

        console.error('Username availability check failed:', e);
        setState({ status: 'error', msg: 'Network error' });
      }
    }, debounceMs) as unknown as number;

    // Cleanup on unmount or when value changes
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (controller.current) controller.current.abort();
    };
  }, [value, debounceMs, localError]);

  return { value, state };
}
