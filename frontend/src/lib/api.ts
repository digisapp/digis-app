import { supabase } from '../contexts/AuthContext';

const API = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, ''); // no trailing slash

async function getAccessToken(): Promise<string | null> {
  // 1) Try current session
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token ?? null;

  // 2) If missing, try refresh once (Supabase auto-refreshes in background)
  if (!token) {
    console.log('🔄 No token in session, attempting refresh...');
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token ?? null;
  }

  return token;
}

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAccessToken();

  console.log('🔐 authHeaders:', {
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'NO TOKEN',
    isValid: token ? token.split('.').length === 3 : false
  });

  if (!token || token === 'null' || token === 'undefined') {
    // Don't fire backend calls that will 401; throw to let caller decide
    console.error('❌ NO_SESSION_TOKEN - cannot make authenticated request');
    throw new Error('NO_SESSION_TOKEN');
  }

  // Validate JWT format
  if (token.split('.').length !== 3) {
    console.error('❌ Malformed JWT token detected');
    throw new Error('MALFORMED_TOKEN');
  }

  console.log('✅ Valid token, sending to backend');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...extra
  };
}

export async function apiGet(path: string) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API}${path}`, { headers, credentials: 'omit' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.message === 'NO_SESSION_TOKEN') {
      // Optionally redirect to login or show toast
      console.error('Session expired, user needs to re-authenticate');
    }
    throw err;
  }
}

export async function apiPost(path: string, body?: unknown) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit'
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.message === 'NO_SESSION_TOKEN') {
      console.error('Session expired, user needs to re-authenticate');
    }
    throw err;
  }
}

export async function apiPut(path: string, body?: unknown) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API}${path}`, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit'
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.message === 'NO_SESSION_TOKEN') {
      console.error('Session expired, user needs to re-authenticate');
    }
    throw err;
  }
}

export async function apiDelete(path: string) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API}${path}`, {
      method: 'DELETE',
      headers,
      credentials: 'omit'
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.message === 'NO_SESSION_TOKEN') {
      console.error('Session expired, user needs to re-authenticate');
    }
    throw err;
  }
}
