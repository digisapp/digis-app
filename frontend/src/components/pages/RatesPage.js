import React, { useState, useEffect } from 'react';
import {
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  MicrophoneIcon,
  FilmIcon,
  CurrencyDollarIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import Button from '../ui/Button';
import { customToast } from '../ui/EnhancedToaster';
import { supabase } from '../../utils/supabase-auth';

const RatesPage = ({ user, isCreator }) => {
  const [rates, setRates] = useState({
    videoCall: 10,
    voiceCall: 5,
    textMessage: 1,
    imageMessage: 2,
    audioMessage: 3,
    videoMessage: 5
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const services = [
    {
      id: 'videoCall',
      name: 'Video Calls',
      icon: VideoCameraIcon,
      unit: 'per minute'
    },
    {
      id: 'voiceCall',
      name: 'Voice Calls',
      icon: PhoneIcon,
      unit: 'per minute'
    },
    {
      id: 'textMessage',
      name: 'Text Messages',
      icon: ChatBubbleLeftRightIcon,
      unit: 'per message'
    },
    {
      id: 'imageMessage',
      name: 'Image Messages',
      icon: PhotoIcon,
      unit: 'per image'
    },
    {
      id: 'audioMessage',
      name: 'Audio Messages',
      icon: MicrophoneIcon,
      unit: 'per message'
    },
    {
      id: 'videoMessage',
      name: 'Video Messages',
      icon: FilmIcon,
      unit: 'per video'
    }
  ];

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creators/rates`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRates(data.rates || rates);
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateChange = (serviceId, value) => {
    const numValue = parseInt(value) || 0;
    if (numValue >= 0) {
      setRates(prev => ({
        ...prev,
        [serviceId]: numValue
      }));
    }
  };

  const saveRates = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creators/rates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rates })
      });

      if (response.ok) {
        customToast.success('Rates updated successfully', { icon: '💰' });
      } else {
        customToast.error('Failed to update rates');
      }
    } catch (error) {
      console.error('Error saving rates:', error);
      customToast.error('Error saving rates');
    } finally {
      setSaving(false);
    }
  };

  if (!isCreator) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <CurrencyDollarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Creator Only</h2>
          <p className="text-gray-600 dark:text-gray-400">This page is only available for creators</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Services Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Pricing Rates</h2>
        
        <div className="space-y-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div 
                key={service.id} 
                className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="p-1.5 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-md">
                  <Icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="w-36">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{service.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{service.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={rates[service.id]}
                    onChange={(e) => handleRateChange(service.id, e.target.value)}
                    className="w-20 px-2 py-1.5 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">tokens</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end mt-4">
        <Button
          variant="primary"
          size="md"
          onClick={saveRates}
          loading={saving}
          disabled={loading}
          icon={<CheckIcon className="w-4 h-4" />}
        >
          Save Rates
        </Button>
      </div>
    </div>
  );
};

export default RatesPage;