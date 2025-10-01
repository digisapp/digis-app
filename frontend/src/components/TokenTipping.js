import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const TokenTipping = ({ recipient: initialRecipient, onClose, onSuccess, userTokenBalance = 0 }) => {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [selectedTier, setSelectedTier] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Token tipping tiers
  const tipTiers = [
    {
      id: 'small',
      tokens: 10,
      usd: 0.50,
      emoji: '👍',
      label: 'Nice!',
      color: 'bg-green-100 border-green-300 text-green-700',
      popular: false
    },
    {
      id: 'medium',
      tokens: 25,
      usd: 1.25,
      emoji: '💖',
      label: 'Love it!',
      color: 'bg-pink-100 border-pink-300 text-pink-700',
      popular: true
    },
    {
      id: 'large',
      tokens: 50,
      usd: 2.50,
      emoji: '🔥',
      label: 'Amazing!',
      color: 'bg-orange-100 border-orange-300 text-orange-700',
      popular: false
    },
    {
      id: 'huge',
      tokens: 100,
      usd: 5.00,
      emoji: '🎉',
      label: 'Incredible!',
      color: 'bg-purple-100 border-purple-300 text-purple-700',
      popular: false
    },
    {
      id: 'mega',
      tokens: 250,
      usd: 12.50,
      emoji: '💎',
      label: 'Super Fan!',
      color: 'bg-blue-100 border-blue-300 text-blue-700',
      popular: false
    },
    {
      id: 'legendary',
      tokens: 500,
      usd: 25.00,
      emoji: '👑',
      label: 'Legendary!',
      color: 'bg-yellow-100 border-yellow-300 text-yellow-700',
      popular: false
    }
  ];

  // Search for creators
  useEffect(() => {
    if (searchQuery.length > 1) {
      const searchCreators = async () => {
        setSearching(true);
        try {
          const authToken = await getAuthToken();
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/search?q=${searchQuery}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setSearchResults(data.creators || []);
          }
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setSearching(false);
        }
      };
      
      const debounceTimer = setTimeout(searchCreators, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
    setCustomAmount('');
  };

  const handleCustomSelect = () => {
    setSelectedTier(null);
  };

  const getTipAmount = () => {
    if (selectedTier) {
      return selectedTier.tokens;
    }
    return parseInt(customAmount) || 0;
  };

  const getUsdAmount = () => {
    const tokens = getTipAmount();
    return (tokens * 0.05).toFixed(2); // $0.05 per token
  };

  const handleSendTip = async () => {
    const tipAmount = getTipAmount();
    
    if (tipAmount <= 0) {
      toast.error('Please select a tip amount');
      return;
    }

    if (!recipient) {
      toast.error('Please select a recipient');
      return;
    }

    setLoading(true);

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tips/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          recipientId: recipient.id,
          tokens: tipAmount,
          message: message.trim(),
          tierType: selectedTier?.id || 'custom'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send tip');
      }

      const result = await response.json();
      
      // toast.success(`🎉 Sent ${tipAmount} tokens to ${recipient.name || recipient.username}!`);
      onSuccess(result);
      onClose();
      
    } catch (error) {
      console.error('Tip error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Send Tip</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Recipient Section */}
          {recipient ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {recipient.profile_pic_url ? (
                <img 
                  src={recipient.profile_pic_url} 
                  alt={recipient.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                  {(recipient.username || 'U')[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {recipient.displayName || recipient.username}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  @{recipient.username}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search for Creator
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {searchResults.map(creator => (
                    <button
                      key={creator.id}
                      onClick={() => {
                        setRecipient(creator);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {creator.profile_pic_url ? (
                        <img 
                          src={creator.profile_pic_url} 
                          alt={creator.username}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                          {(creator.username || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {creator.username}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Amount
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  handleCustomSelect();
                }}
                placeholder="Enter amount"
                className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">tokens</span>
            </div>
            {customAmount && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ≈ ${getUsdAmount()} USD
              </p>
            )}
          </div>

          {/* Quick Tip Amounts */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Tip Amounts</h3>
            <div className="grid grid-cols-2 gap-3">
              {tipTiers.map(tier => (
                <button
                  key={tier.id}
                  onClick={() => handleTierSelect(tier)}
                  className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                    selectedTier?.id === tier.id
                      ? tier.color.replace('100', '200').replace('300', '500')
                      : `${tier.color} hover:shadow-md cursor-pointer`
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                      Popular
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">{tier.emoji}</div>
                    <div className="text-right">
                      <div className="font-bold">{tier.tokens} tokens</div>
                      <div className="text-xs opacity-75">${tier.usd}</div>
                    </div>
                  </div>
                  <div className="text-sm font-medium mt-1">{tier.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Message (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something nice..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              maxLength={200}
            />
            <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
              {message.length}/200 characters
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSendTip}
            disabled={loading || getTipAmount() <= 0 || !recipient}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center font-medium transition-all"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Sending...
              </>
            ) : (
              `Send ${getTipAmount()} Tokens`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokenTipping;