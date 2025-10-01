import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  StarIcon,
  UserGroupIcon,
  GiftIcon,
  SparklesIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { supabase } from '../utils/supabase-auth.js';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const TipCreatorPopup = ({ isOpen, onClose, userTokenBalance, onTipSent }) => {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [tipAmount, setTipAmount] = useState('');
  const [tipMessage, setTipMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('all'); // all, favorites, recent

  // Quick tip amounts
  const quickTipAmounts = [10, 25, 50, 100, 250, 500];

  useEffect(() => {
    if (isOpen) {
      fetchCreatorDirectory();
    }
  }, [isOpen]);

  const fetchCreatorDirectory = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/creators/directory`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCreators(data);
      } else {
        // Mock data for demonstration
        setCreators([
          {
            id: 'creator1',
            username: 'SarahGaming',
            fullName: 'Sarah Johnson',
            profilePic: null,
            category: 'Gaming',
            isOnline: true,
            totalTipsReceived: 15420,
            followersCount: 2341,
            bio: 'Professional gamer and content creator',
            isFavorite: true,
            lastInteraction: '2 days ago'
          },
          {
            id: 'creator2',
            username: 'AlexMusic',
            fullName: 'Alex Rivera',
            profilePic: null,
            category: 'Music',
            isOnline: true,
            totalTipsReceived: 23560,
            followersCount: 3892,
            bio: 'Music producer and vocal coach',
            isFavorite: true,
            lastInteraction: '1 week ago'
          },
          {
            id: 'creator3',
            username: 'EmmaFitness',
            fullName: 'Emma Chen',
            profilePic: null,
            category: 'Fitness',
            isOnline: false,
            totalTipsReceived: 8930,
            followersCount: 1567,
            bio: 'Certified personal trainer and nutritionist',
            isFavorite: false,
            lastInteraction: 'Never'
          },
          {
            id: 'creator4',
            username: 'TechMike',
            fullName: 'Mike Anderson',
            profilePic: null,
            category: 'Tech',
            isOnline: true,
            totalTipsReceived: 12340,
            followersCount: 987,
            bio: 'Software engineer and tech educator',
            isFavorite: false,
            lastInteraction: '3 weeks ago'
          },
          {
            id: 'creator5',
            username: 'ChefMaria',
            fullName: 'Maria Rodriguez',
            profilePic: null,
            category: 'Cooking',
            isOnline: true,
            totalTipsReceived: 18750,
            followersCount: 2156,
            bio: 'Professional chef and culinary instructor',
            isFavorite: false,
            lastInteraction: 'Never'
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching creators:', error);
      toast.error('Failed to load creator directory');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTip = async () => {
    if (!selectedCreator) {
      toast.error('Please select a creator');
      return;
    }

    const amount = parseInt(tipAmount);
    if (!amount || amount < 1) {
      toast.error('Please enter a valid tip amount');
      return;
    }

    if (amount > userTokenBalance) {
      toast.error('Insufficient token balance');
      return;
    }

    setSending(true);

    try {
      const token = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tips/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          creatorId: selectedCreator.id,
          amount: amount,
          message: tipMessage.trim(),
          creatorUsername: selectedCreator.username
        })
      });

      if (response.ok) {
        const data = await response.json();
        // toast.success(`Successfully sent ${amount} tokens to ${selectedCreator.username}! 🎉`);
        
        // Call parent callback
        onTipSent(selectedCreator, amount, data);
        
        // Reset form
        setSelectedCreator(null);
        setTipAmount('');
        setTipMessage('');
        onClose();
      } else {
        throw new Error('Failed to send tip');
      }
    } catch (error) {
      console.error('Error sending tip:', error);
      toast.error('Failed to send tip. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const filteredCreators = creators.filter(creator => {
    const matchesSearch = creator.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         creator.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         creator.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'favorites') return matchesSearch && creator.isFavorite;
    if (filter === 'recent') return matchesSearch && creator.lastInteraction !== 'Never';
    return matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GiftIcon className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">Send a Tip</h2>
                  <p className="text-purple-100">
                    Show appreciation to your favorite creators
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Your Balance */}
            <div className="mt-4 bg-white/20 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm">Your Balance:</span>
              <span className="text-lg font-semibold">{userTokenBalance?.toLocaleString() || 0} tokens</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col md:flex-row h-full" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            {/* Creator Selection */}
            <div className="flex-1 border-r border-gray-200 p-6 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Select Creator</h3>
                
                {/* Search */}
                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search creators..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-4">
                  {[
                    { id: 'all', label: 'All', icon: UserGroupIcon },
                    { id: 'favorites', label: 'Favorites', icon: StarIcon },
                    { id: 'recent', label: 'Recent', icon: SparklesIcon }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setFilter(tab.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        filter === tab.id
                          ? 'bg-purple-100 text-purple-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Creator List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : filteredCreators.length === 0 ? (
                <div className="text-center py-8">
                  <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No creators found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCreators.map(creator => (
                    <motion.div
                      key={creator.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedCreator?.id === creator.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedCreator(creator)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                            {creator.username[0].toUpperCase()}
                          </div>
                          {creator.isOnline && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{creator.username}</h4>
                            {creator.isFavorite && (
                              <StarIcon className="w-4 h-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{creator.category}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <CurrencyDollarIcon className="w-4 h-4" />
                            <span>{creator.totalTipsReceived.toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-gray-400">{creator.followersCount} followers</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Tip Amount and Message */}
            <div className="flex-1 p-6">
              {selectedCreator ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Tip Amount</h3>
                    
                    {/* Quick amounts */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {quickTipAmounts.map(amount => (
                        <button
                          key={amount}
                          onClick={() => setTipAmount(amount.toString())}
                          className={`py-2 px-3 rounded-lg font-medium transition-all ${
                            tipAmount === amount.toString()
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {amount} tokens
                        </button>
                      ))}
                    </div>

                    {/* Custom amount */}
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Enter custom amount..."
                        value={tipAmount}
                        onChange={(e) => setTipAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">🪙</span>
                    </div>
                    
                    {tipAmount && (
                      <p className="text-sm text-gray-600 mt-1">
                        ≈ ${(parseInt(tipAmount) * 0.05).toFixed(2)} USD
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Message (Optional)</h3>
                    <textarea
                      placeholder="Add a message with your tip..."
                      value={tipMessage}
                      onChange={(e) => setTipMessage(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows="4"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {tipMessage.length}/200 characters
                    </p>
                  </div>

                  {/* Selected Creator Info */}
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {selectedCreator.username[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{selectedCreator.username}</h4>
                        <p className="text-sm text-gray-600">{selectedCreator.bio}</p>
                      </div>
                    </div>
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={handleSendTip}
                    disabled={!tipAmount || parseInt(tipAmount) < 1 || sending}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <GiftIcon className="w-5 h-5" />
                        <span>Send {tipAmount ? `${tipAmount} Tokens` : 'Tip'}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-lg font-medium">Select a creator to tip</p>
                    <p className="text-sm mt-2">Browse the directory and pick someone to support</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TipCreatorPopup;