import { supabase } from '../contexts/AuthContext';

const API = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, ''); // no trailing slash

async function authHeaders() {
  console.log('🔐 authHeaders: Getting session...');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  console.log('🔐 authHeaders: Session data:', {
    hasSession: !!data.session,
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'NO TOKEN',
    userId: data.session?.user?.id,
    email: data.session?.user?.email
  });

  // Validate token format before using it
  if (token) {
    // JWT tokens must have 3 parts: header.payload.signature
    if (token.split('.').length !== 3) {
      console.error('❌ Malformed JWT token detected in authHeaders');
      // Try to refresh session
      const { data: refreshData } = await supabase.auth.refreshSession();
      const refreshedToken = refreshData.session?.access_token;
      if (refreshedToken && refreshedToken.split('.').length === 3) {
        console.log('✅ Token refreshed successfully');
        return { Authorization: `Bearer ${refreshedToken}` };
      }
      // If still invalid, return empty headers (will trigger 401 and force re-login)
      console.error('❌ Failed to refresh token, returning empty headers');
      return {};
    }
    console.log('✅ Valid token found, using it');
    return { Authorization: `Bearer ${token}` };
  }

  console.warn('⚠️ No token found, returning empty headers');
  return {};
}

export async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`, { headers: { ...(await authHeaders()) } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function apiPost(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function apiPut(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function apiDelete(path: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
