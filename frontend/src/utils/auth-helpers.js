/**
 * Stub for auth-helpers - deprecated, use AuthContext instead
 * Kept for backwards compatibility only
 */

import { supabase } from '../contexts/AuthContext';

export async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

export function subscribeToAuthChanges() {
  // Stub - use AuthContext instead
  return { data: { subscription: { unsubscribe: () => {} } } };
}

export function clearAuthCache() {
  // Stub - no-op
}
