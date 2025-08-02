import React, { useState } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const TokenTipping = ({ recipient, onClose, onSuccess, userTokenBalance = 0 }) => {
  const [selectedTier, setSelectedTier] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

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

    if (tipAmount > userTokenBalance) {
      toast.error('Insufficient token balance');
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
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Send Tip</h2>
              <p className="text-gray-600 text-sm mt-1">
                To {recipient.name || recipient.username}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Token Balance */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">Your Token Balance</span>
              <span className="text-lg font-bold text-blue-800">
                {userTokenBalance.toLocaleString()} tokens
              </span>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              ≈ ${(userTokenBalance * 0.05).toFixed(2)} USD
            </div>
          </div>

          {/* Tip Tiers */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Tip Amounts</h3>
            <div className="grid grid-cols-2 gap-3">
              {tipTiers.map(tier => (
                <button
                  key={tier.id}
                  onClick={() => handleTierSelect(tier)}
                  disabled={tier.tokens > userTokenBalance}
                  className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                    selectedTier?.id === tier.id
                      ? tier.color.replace('100', '200').replace('300', '500')
                      : tier.tokens > userTokenBalance
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
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

          {/* Custom Amount */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Custom Amount</h3>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="1"
                max={userTokenBalance}
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  handleCustomSelect();
                }}
                placeholder="Enter tokens"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="text-sm text-gray-500">
                tokens
              </div>
            </div>
            {customAmount && (
              <div className="text-xs text-gray-500 mt-1">
                ≈ ${getUsdAmount()} USD
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something nice..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              maxLength={200}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {message.length}/200 characters
            </div>
          </div>

          {/* Tip Summary */}
          {getTipAmount() > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Tip Amount</span>
                <span className="text-lg font-bold text-gray-900">
                  {getTipAmount().toLocaleString()} tokens
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>USD Equivalent</span>
                <span>${getUsdAmount()}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
                <span>Remaining Balance</span>
                <span>{(userTokenBalance - getTipAmount()).toLocaleString()} tokens</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendTip}
              disabled={loading || getTipAmount() <= 0 || getTipAmount() > userTokenBalance}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center font-medium"
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
    </div>
  );
};

export default TokenTipping;