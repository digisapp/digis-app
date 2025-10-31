/**
 * Username Field Component
 *
 * Input field for setting/changing username with live validation.
 * Shows availability status and prevents saving invalid usernames.
 *
 * Usage:
 *   <UsernameField initial="current_username" onSaved={(username, url) => {...}} />
 */

import React, { useState } from 'react';
import { useUsernameAvailability } from '../../hooks/useUsernameAvailability';
import { supabase } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

type Props = {
  initial?: string;
  onSaved?: (username: string, url: string) => void;
  className?: string;
};

export default function UsernameField({ initial = '', onSaved, className = '' }: Props) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const { state, value } = useUsernameAvailability(draft);

  const canSave = state.status === 'available' && value !== initial.toLowerCase() && !saving;

  async function save() {
    if (!canSave) return;

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

      const res = await fetch(`${backendUrl}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        credentials: 'include',
        body: JSON.stringify({ username: value })
      });

      const data = await res.json();

      if (res.status === 409) {
        toast.error(data.error || 'That username was just claimed. Try another.');
        setSaving(false);
        return;
      }

      if (res.status === 429) {
        toast.error(data.error || 'You can only change your username once every 30 days.');
        setSaving(false);
        return;
      }

      if (!res.ok) {
        toast.error(data.error || 'Failed to update username.');
        setSaving(false);
        return;
      }

      // Success!
      toast.success(`Username updated! Your URL is now ${data.url}`);
      onSaved?.(data.username, data.url);

      // Update initial value so "Save" button disables
      setDraft(data.username);

    } catch (error: any) {
      console.error('Username save error:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Status color
  const statusColor =
    state.status === 'invalid' ? 'text-red-600' :
    state.status === 'checking' ? 'text-gray-500' :
    state.status === 'available' ? 'text-green-600' :
    state.status === 'taken' ? 'text-red-600' :
    state.status === 'error' ? 'text-red-600' :
    'text-gray-500';

  // Status message
  const statusMessage =
    state.status === 'idle' ? '' :
    state.status === 'invalid' ? state.msg :
    state.status === 'checking' ? 'Checking...' :
    state.status === 'available' ? 'Available ✓' :
    state.status === 'taken' ? state.msg :
    state.status === 'error' ? state.msg :
    '';

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Username
        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
          (Your URL will be digis.cc/{value || 'username'})
        </span>
      </label>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">digis.cc/</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2
                     focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="yourname"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={saving}
        />
        <button
          disabled={!canSave}
          onClick={save}
          className="px-4 py-2 rounded-md bg-purple-600 text-white font-medium
                     hover:bg-purple-700 active:bg-purple-800
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Status line */}
      {statusMessage && (
        <p className={`text-xs ${statusColor}`}>
          {statusMessage}
        </p>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        3–30 characters. Use lowercase letters, numbers, dots, underscores, and hyphens.
        {initial && (
          <>
            <br />
            <span className="text-amber-600 dark:text-amber-400">
              ⚠️ You can only change your username once every 30 days.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
