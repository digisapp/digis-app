import { useState, useEffect } from 'react';
import { authedFetch } from '../../utils/requireAuth';
import toast from 'react-hot-toast';

export default function FanPrivacySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [shareLink, setShareLink] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await authedFetch('/api/fans/me');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.shareToken) {
          setShareLink(`${window.location.origin}/c/${data.shareToken}`);
        }
      } else {
        toast.error('Failed to load privacy settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates) => {
    setSaving(true);
    try {
      const res = await authedFetch('/api/fans/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
        toast.success('Privacy settings updated');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const enableShareLink = async () => {
    try {
      const res = await authedFetch('/api/fans/share/enable', {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        setShareLink(`${window.location.origin}/c/${data.token}`);
        toast.success('Share link enabled');
      } else {
        toast.error('Failed to enable share link');
      }
    } catch (error) {
      console.error('Error enabling share link:', error);
      toast.error('Failed to enable share link');
    }
  };

  const disableShareLink = async () => {
    try {
      const res = await authedFetch('/api/fans/share/disable', {
        method: 'POST'
      });

      if (res.ok) {
        setShareLink(null);
        toast.success('Share link disabled');
      } else {
        toast.error('Failed to disable share link');
      }
    } catch (error) {
      console.error('Error disabling share link:', error);
      toast.error('Failed to disable share link');
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-700 rounded-xl"></div>
          <div className="h-24 bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 text-center text-gray-400">
        Failed to load privacy settings
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Privacy Settings</h2>
        <p className="text-gray-400">Control who can see your profile and contact you</p>
      </div>

      {/* Profile Visibility */}
      <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h3 className="font-semibold text-lg text-white mb-4">Profile Visibility</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="visibility"
              value="private"
              checked={settings.visibility === 'private'}
              onChange={() => updateSettings({ visibility: 'private' })}
              disabled={saving}
              className="w-4 h-4 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
            />
            <div className="flex-1">
              <div className="font-medium text-white group-hover:text-purple-400 transition-colors">
                Private
              </div>
              <div className="text-sm text-gray-400">Only you can see your profile</div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="visibility"
              value="creators"
              checked={settings.visibility === 'creators'}
              onChange={() => updateSettings({ visibility: 'creators' })}
              disabled={saving}
              className="w-4 h-4 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
            />
            <div className="flex-1">
              <div className="font-medium text-white group-hover:text-purple-400 transition-colors">
                Creators
              </div>
              <div className="text-sm text-gray-400">
                Creators you've interacted with can see your profile
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="radio"
              name="visibility"
              value="link"
              checked={settings.visibility === 'link'}
              onChange={() => updateSettings({ visibility: 'link' })}
              disabled={saving}
              className="w-4 h-4 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
            />
            <div className="flex-1">
              <div className="font-medium text-white group-hover:text-purple-400 transition-colors">
                Anyone with link
              </div>
              <div className="text-sm text-gray-400">
                Anyone with your share link can view (not indexed)
              </div>
            </div>
          </label>
        </div>

        {settings.visibility === 'link' && (
          <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">Share Link</h4>
              {shareLink ? (
                <button
                  onClick={disableShareLink}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Disable
                </button>
              ) : (
                <button
                  onClick={enableShareLink}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Enable
                </button>
              )}
            </div>
            {shareLink ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none"
                />
                <button
                  onClick={copyShareLink}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Copy
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Generate a shareable link to your profile
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Not indexed by search engines. Expires in 30 days.
            </p>
          </div>
        )}
      </section>

      {/* Direct Messages */}
      <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h3 className="font-semibold text-lg text-white mb-4">Direct Messages</h3>
        <p className="text-sm text-gray-400 mb-4">Who can send you messages?</p>
        <select
          value={settings.allowDm || 'interacted'}
          onChange={(e) => updateSettings({ allowDm: e.target.value })}
          disabled={saving}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          <option value="interacted">Creators I've interacted with</option>
          <option value="following">Creators I follow</option>
          <option value="none">No one</option>
        </select>
      </section>

      {/* Voice & Video Calls */}
      <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h3 className="font-semibold text-lg text-white mb-4">Voice & Video Calls</h3>
        <p className="text-sm text-gray-400 mb-4">Who can call you?</p>
        <select
          value={settings.allowCalls || 'interacted'}
          onChange={(e) => updateSettings({ allowCalls: e.target.value })}
          disabled={saving}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          <option value="interacted">Creators I've interacted with</option>
          <option value="following">Creators I follow</option>
          <option value="none">No one</option>
        </select>
      </section>

      {/* Discoverability */}
      <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h3 className="font-semibold text-lg text-white mb-4">Discoverability</h3>
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex-1">
            <div className="font-medium text-white">Allow search by handle</div>
            <div className="text-sm text-gray-400">
              Let creators find you by searching your username
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.allowSearch || false}
            onChange={(e) => updateSettings({ allowSearch: e.target.checked })}
            disabled={saving}
            className="ml-4 w-5 h-5 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800 rounded"
          />
        </label>
      </section>

      {/* Info Box */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
        <div className="flex gap-3">
          <svg
            className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h4 className="font-medium text-blue-300 mb-1">Your privacy matters</h4>
            <p className="text-sm text-blue-200/80">
              Your profile is private by default. You control who can see your information,
              message you, or call you. Only creators you've interacted with can see your basic
              info unless you change these settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
