import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ClockIcon, 
  CogIcon,
  CheckIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import api from '../services/api';
import toast from 'react-hot-toast';

const StreamAutoEndSettings = ({ creatorId, streamId = null }) => {
  const [settings, setSettings] = useState({
    autoEndEnabled: true,
    autoEndMinutes: 15,
    warningMinutes: 5
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [creatorId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/creators/${creatorId}/stream-settings`);
      if (response.data) {
        setSettings({
          autoEndEnabled: response.data.stream_auto_end_enabled ?? true,
          autoEndMinutes: response.data.stream_auto_end_minutes ?? 15,
          warningMinutes: response.data.stream_warning_minutes ?? 5
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Update creator preferences
      await api.put(`/creators/${creatorId}/stream-settings`, {
        stream_auto_end_enabled: settings.autoEndEnabled,
        stream_auto_end_minutes: settings.autoEndMinutes,
        stream_warning_minutes: settings.warningMinutes
      });

      // If currently streaming, update stream settings
      if (streamId) {
        await api.put(`/streaming/settings/${streamId}`, {
          autoEndEnabled: settings.autoEndEnabled,
          autoEndMinutes: settings.autoEndMinutes
        });
      }

      toast.success('Stream settings updated successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const presetOptions = [
    { value: 10, label: '10 minutes', description: 'Quick streams' },
    { value: 15, label: '15 minutes', description: 'Recommended' },
    { value: 30, label: '30 minutes', description: 'Extended grace' },
    { value: 60, label: '1 hour', description: 'Maximum patience' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <CogIcon className="h-6 w-6 text-purple-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Stream Auto-End Settings</h3>
      </div>

      {/* Auto-end toggle */}
      <div className="mb-6">
        <label className="flex items-center justify-between">
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-700">
              Auto-end inactive streams
            </span>
            <p className="text-xs text-gray-500 mt-1">
              Automatically end your stream when no viewers are present or no interaction occurs
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettings(prev => ({ ...prev, autoEndEnabled: !prev.autoEndEnabled }))}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${settings.autoEndEnabled ? 'bg-purple-600' : 'bg-gray-200'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${settings.autoEndEnabled ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </label>
      </div>

      {settings.autoEndEnabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-6"
        >
          {/* Timeout duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              Inactivity timeout
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              {presetOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSettings(prev => ({ ...prev, autoEndMinutes: option.value }))}
                  className={`
                    p-3 rounded-lg border-2 transition-all
                    ${settings.autoEndMinutes === option.value
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-gray-500">{option.description}</p>
                    </div>
                    {settings.autoEndMinutes === option.value && (
                      <CheckIcon className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="mt-3 flex items-center space-x-2">
              <span className="text-sm text-gray-600">Custom:</span>
              <input
                type="number"
                min="5"
                max="120"
                value={settings.autoEndMinutes}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  autoEndMinutes: Math.max(5, Math.min(120, parseInt(e.target.value) || 15))
                }))}
                className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-sm text-gray-600">minutes</span>
            </div>
          </div>

          {/* Warning time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warning time before auto-end
            </label>
            <select
              value={settings.warningMinutes}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                warningMinutes: parseInt(e.target.value)
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="2">2 minutes</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
            </select>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-900">How it works</h4>
                <ul className="mt-2 text-xs text-blue-700 space-y-1">
                  <li>• Streams with no viewers for {settings.autoEndMinutes} minutes will auto-end</li>
                  <li>• You'll receive a warning {settings.warningMinutes} minutes before auto-end</li>
                  <li>• Any viewer interaction resets the timer</li>
                  <li>• You can keep the stream alive by clicking "I'm Still Here" when warned</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Save button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <CheckIcon className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StreamAutoEndSettings;