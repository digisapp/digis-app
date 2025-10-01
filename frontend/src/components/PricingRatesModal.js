import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  MicrophoneIcon,
  FilmIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import { customToast } from './ui/EnhancedToaster';
import { supabase } from '../utils/supabase-auth';

const PricingRatesModal = ({ isOpen, onClose, isCreator }) => {
  // Default token rates for all services
  const [rates, setRates] = useState({
    videoCall: 150,     // 150 tokens per minute
    voiceCall: 50,      // 50 tokens per minute
    textMessage: 50,    // 50 tokens per message
    imageMessage: 100,  // 100 tokens per image
    audioMessage: 150,  // 150 tokens per audio message
    videoMessage: 200   // 200 tokens per video message
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
    if (isOpen && isCreator) {
      fetchRates();
    }
  }, [isOpen, isCreator]);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/creators/rates`, {
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/creators/rates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rates })
      });

      if (response.ok) {
        customToast.success('Rates updated successfully', { icon: '💰' });
        
        // Also update the profile endpoint to ensure consistency
        const profileResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/profile`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            video_price: rates.videoCall,
            voice_price: rates.voiceCall,
            message_price: rates.textMessage
          })
        });
        
        setTimeout(() => onClose(), 500);
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
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Modal - No backdrop needed, just the modal itself */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-0 flex items-start justify-center z-[10000] p-4 pt-24"
            onClick={onClose}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pricing Rates</h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 max-h-[50vh] overflow-y-auto">
                <div className="space-y-3">
                  {services.map((service) => {
                    const Icon = service.icon;
                    return (
                      <div 
                        key={service.id} 
                        className="flex items-center gap-4 p-3.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-md">
                          <Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="w-36">
                          <p className="font-medium text-base text-gray-900 dark:text-white">{service.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{service.unit}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <input
                            type="number"
                            min="0"
                            max="999"
                            value={rates[service.id]}
                            onChange={(e) => handleRateChange(service.id, e.target.value)}
                            className="w-24 px-3 py-2 text-center text-base border border-gray-300 dark:border-gray-600 rounded-md 
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                     focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="0"
                            disabled={loading}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">tokens</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={saveRates}
                  loading={saving}
                  disabled={loading}
                  icon={<CheckIcon className="w-5 h-5" />}
                >
                  Save Rates
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PricingRatesModal;