/**
 * Stub for supabase-auth-enhanced - deprecated, use AuthContext instead
 */

import { supabase } from '../contexts/AuthContext';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user, error };
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { user: data?.user, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  return { error };
}

export async function signInWithTwitter() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'twitter' });
  return { error };
}

export { supabase };
