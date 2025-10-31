/**
 * API Client - Single source of truth for all API calls
 *
 * Boring, simple, works every day.
 * No retry logic, no offline queue, no AbortController complexity.
 */

import { supabase } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

// Get auth headers with Supabase token
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// GET request
export async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return res.json();
}

// POST request
export async function post<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return res.json();
}

// PUT request
export async function put<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return res.json();
}

// DELETE request
export async function del<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Convenience object for API calls
export const api = {
  get,
  post,
  put,
  delete: del,
};

export default api;
