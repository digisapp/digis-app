import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const GiftInteractionSystem = ({ user, tokenBalance, onTokenUpdate }) => {
  const [availableGifts, setAvailableGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [giftHistory, setGiftHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('send');

  useEffect(() => {
    fetchAvailableGifts();
    fetchGiftHistory();
  }, []);

  const fetchAvailableGifts = () => {
    // Mock available gifts that users can purchase with tokens
    setAvailableGifts([
      {
        id: 'rose-bouquet',
        name: 'Rose Bouquet',
        emoji: '🌹',
        cost: 500,
        description: 'Beautiful red roses to show appreciation',
        rarity: 'common',
        category: 'romantic'
      },
      {
        id: 'golden-crown',
        name: 'Golden Crown',
        emoji: '👑',
        cost: 2000,
        description: 'Crown someone as your favorite creator',
        rarity: 'epic',
        category: 'special'
      },
      {
        id: 'diamond-ring',
        name: 'Diamond Ring',
        emoji: '💎',
        cost: 5000,
        description: 'The ultimate expression of support',
        rarity: 'legendary',
        category: 'luxury'
      },
      {
        id: 'heart-eyes',
        name: 'Heart Eyes',
        emoji: '😍',
        cost: 200,
        description: 'Show your love and admiration',
        rarity: 'common',
        category: 'emoji'
      },
      {
        id: 'fire-emoji',
        name: 'Fire',
        emoji: '🔥',
        cost: 300,
        description: 'This content is absolutely fire!',
        rarity: 'common',
        category: 'emoji'
      },
      {
        id: 'money-bag',
        name: 'Money Bag',
        emoji: '💰',
        cost: 1000,
        description: 'Big tip for amazing content',
        rarity: 'rare',
        category: 'tip'
      },
      {
        id: 'shooting-star',
        name: 'Shooting Star',
        emoji: '⭐',
        cost: 1500,
        description: 'You are a shining star!',
        rarity: 'rare',
        category: 'special'
      },
      {
        id: 'rainbow',
        name: 'Rainbow',
        emoji: '🌈',
        cost: 800,
        description: 'Spread positivity and joy',
        rarity: 'uncommon',
        category: 'special'
      }
    ]);
  };

  const fetchGiftHistory = () => {
    // Mock gift history
    setGiftHistory([
      {
        id: 1,
        gift: { name: 'Rose Bouquet', emoji: '🌹' },
        recipient: 'GamerGirl123',
        sender: 'You',
        timestamp: new Date(Date.now() - 3600000),
        message: 'Amazing stream tonight!',
        cost: 500
      },
      {
        id: 2,
        gift: { name: 'Golden Crown', emoji: '👑' },
        recipient: 'You',
        sender: 'SuperFan99',
        timestamp: new Date(Date.now() - 86400000),
        message: 'You deserve this crown!',
        cost: 2000
      },
      {
        id: 3,
        gift: { name: 'Fire', emoji: '🔥' },
        recipient: 'MusicMaster',
        sender: 'You',
        timestamp: new Date(Date.now() - 86400000 * 2),
        message: 'Your music is fire! 🎵',
        cost: 300
      }
    ]);
  };

  const handleSendGift = async () => {
    if (!selectedGift) {
      toast.error('Please select a gift to send');
      return;
    }

    if (!recipient.trim()) {
      toast.error('Please enter a recipient username');
      return;
    }

    if (tokenBalance < selectedGift.cost) {
      toast.error(`Insufficient tokens! You need ${selectedGift.cost - tokenBalance} more tokens.`);
      return;
    }

    try {
      setSending(true);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/gifts/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          giftId: selectedGift.id,
          recipient: recipient.trim(),
          message: message.trim(),
          cost: selectedGift.cost
        })
      });

      if (response.ok) {
        const result = await response.json();
        // toast.success(`🎁 ${selectedGift.name} sent to ${recipient}!`);
      } else {
        // Mock success for development
        // toast.success(`🎁 ${selectedGift.name} sent to ${recipient}!`);
        
        // Add to history
        const newGiftEntry = {
          id: Date.now(),
          gift: { name: selectedGift.name, emoji: selectedGift.emoji },
          recipient: recipient,
          sender: 'You',
          timestamp: new Date(),
          message: message || `Sent you a ${selectedGift.name}!`,
          cost: selectedGift.cost
        };
        setGiftHistory(prev => [newGiftEntry, ...prev]);
      }

      // Reset form
      setSelectedGift(null);
      setRecipient('');
      setMessage('');
      onTokenUpdate();
      
    } catch (error) {
      console.error('Gift send error:', error);
      toast.error('Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'bg-gradient-to-r from-yellow-400 to-orange-500';
      case 'epic': return 'bg-gradient-to-r from-purple-400 to-pink-500';
      case 'rare': return 'bg-gradient-to-r from-blue-400 to-indigo-500';
      case 'uncommon': return 'bg-gradient-to-r from-green-400 to-teal-500';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-600';
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const renderSendGifts = () => (
    <div className="space-y-6">
      {/* Gift Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Select a Gift</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {availableGifts.map(gift => (
            <div
              key={gift.id}
              onClick={() => setSelectedGift(gift)}
              className={`p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105 ${
                selectedGift?.id === gift.id
                  ? 'ring-2 ring-blue-500 shadow-lg'
                  : 'hover:shadow-md'
              } ${getRarityColor(gift.rarity)} text-white`}
            >
              <div className="text-center">
                <div className="text-3xl mb-2">{gift.emoji}</div>
                <h4 className="font-bold text-sm">{gift.name}</h4>
                <p className="text-xs opacity-90 mb-2">{gift.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide">{gift.rarity}</span>
                  <span className="text-xs font-bold">{gift.cost} tokens</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gift Form */}
      {selectedGift && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className={`p-3 rounded-lg ${getRarityColor(selectedGift.rarity)} text-white`}>
              <div className="text-2xl">{selectedGift.emoji}</div>
            </div>
            <div>
              <h3 className="font-bold">{selectedGift.name}</h3>
              <p className="text-sm text-gray-600">{selectedGift.description}</p>
              <p className="text-sm font-medium text-green-600">{selectedGift.cost} tokens</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Username
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Enter creator or user username..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal Message (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                maxLength={200}
              />
              <div className="text-xs text-gray-500 mt-1">{message.length}/200 characters</div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setSelectedGift(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendGift}
                disabled={sending || tokenBalance < selectedGift.cost}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  tokenBalance < selectedGift.cost
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : sending
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {sending ? 'Sending...' : `Send for ${selectedGift.cost} tokens`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderGiftHistory = () => (
    <div className="space-y-4">
      {giftHistory.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎁</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No gift history yet</h3>
          <p className="text-gray-600">Start sending gifts to build your history!</p>
        </div>
      ) : (
        giftHistory.map(entry => (
          <div key={entry.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-4">
              <div className="text-3xl">{entry.gift.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{entry.gift.name}</h3>
                  <span className="text-sm font-medium text-green-600">{entry.cost} tokens</span>
                </div>
                <p className="text-sm text-gray-600">
                  {entry.sender === 'You' 
                    ? `Sent to ${entry.recipient}` 
                    : `Received from ${entry.sender}`}
                </p>
                {entry.message && (
                  <p className="text-sm text-gray-700 italic mt-1">"{entry.message}"</p>
                )}
                <p className="text-xs text-gray-500 mt-2">{formatTimeAgo(entry.timestamp)}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🎁 Gift System</h2>
          <p className="text-gray-600">Send virtual gifts to creators and other users</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-blue-600">{tokenBalance.toLocaleString()} tokens</div>
          <div className="text-sm text-gray-500">Your balance</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          {[
            { id: 'send', label: 'Send Gifts', icon: '🎁' },
            { id: 'history', label: 'Gift History', icon: '📜' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'send' && renderSendGifts()}
      {activeTab === 'history' && renderGiftHistory()}

      {/* Info Panel */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">🎁 About Virtual Gifts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Express Yourself</h4>
            <p className="opacity-90">Send gifts to show appreciation, support, or just to make someone's day brighter.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Rarity Levels</h4>
            <p className="opacity-90">From common emojis to legendary diamonds - choose the perfect gift for the moment.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Instant Delivery</h4>
            <p className="opacity-90">Gifts are delivered instantly with optional personal messages for that extra touch.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftInteractionSystem;