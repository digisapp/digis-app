import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase-auth.js';
import { getAuthToken } from '../utils/auth-helpers';
import toast from 'react-hot-toast';

const CollectibleCardsMarketplace = ({ user, tokenBalance, onTokenUpdate }) => {
  const [cards, setCards] = useState([]);
  const [creators, setCreators] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState('all');
  const [sortBy, setSortBy] = useState('creator');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    fetchAvailableCards();
    fetchCreators();
  }, []);

  const fetchCreators = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/creators`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCreators(data.creators || []);
      } else {
        // Mock creators data
        setCreators([
          { id: 1, username: 'GamerGirl123', displayName: 'Sarah Gaming', category: 'Gaming', followers: 15420 },
          { id: 2, username: 'MusicMaster', displayName: 'Alex Melody', category: 'Music', followers: 8930 },
          { id: 3, username: 'ArtistVibe', displayName: 'Emma Creates', category: 'Art', followers: 12500 },
          { id: 4, username: 'TechGuru2024', displayName: 'Alex Tech', category: 'Tech', followers: 25000 },
          { id: 5, username: 'FitnessQueen', displayName: 'Sarah Fit', category: 'Fitness', followers: 18500 }
        ]);
      }
    } catch (error) {
      console.error('Error fetching creators:', error);
    }
  };

  const fetchAvailableCards = async () => {
    try {
      setLoading(true);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/cards/available`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCards(data.cards || []);
      } else {
        // Mock cards data - available cards for purchase
        const mockCards = [];
        const mockCreators = [
          { id: 1, username: 'GamerGirl123', displayName: 'Sarah Gaming', category: 'Gaming' },
          { id: 2, username: 'MusicMaster', displayName: 'Alex Melody', category: 'Music' },
          { id: 3, username: 'ArtistVibe', displayName: 'Emma Creates', category: 'Art' },
          { id: 4, username: 'TechGuru2024', displayName: 'Alex Tech', category: 'Tech' },
          { id: 5, username: 'FitnessQueen', displayName: 'Sarah Fit', category: 'Fitness' }
        ];

        mockCreators.forEach(creator => {
          // Generate random available cards for each creator (simulate some being sold)
          const availableNumbers = [];
          for (let i = 1; i <= 1000; i++) {
            if (Math.random() > 0.1) { // 90% chance card is still available
              availableNumbers.push(i);
            }
          }

          // Take first 50 available cards for display
          availableNumbers.slice(0, 50).forEach(cardNumber => {
            mockCards.push({
              id: `${creator.username}-${cardNumber}`,
              creatorId: creator.id,
              creatorUsername: creator.username,
              creatorName: creator.displayName,
              category: creator.category,
              cardNumber: cardNumber,
              totalSupply: 1000,
              price: 10000, // 10,000 tokens
              rarity: cardNumber <= 10 ? 'legendary' : 
                      cardNumber <= 50 ? 'epic' : 
                      cardNumber <= 200 ? 'rare' : 'common',
              imageUrl: null, // Would be actual image URL
              mintedAt: new Date(Date.now() - Math.random() * 86400000 * 30), // Random date within last 30 days
              isAvailable: true
            });
          });
        });

        setCards(mockCards);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast.error('Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCard = async (card) => {
    if (tokenBalance < card.price) {
      toast.error(`Insufficient tokens! You need ${card.price - tokenBalance} more tokens.`);
      return;
    }

    try {
      setPurchasing(card.id);
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/cards/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          cardId: card.id,
          price: card.price
        })
      });

      if (response.ok) {
        const result = await response.json();
        // toast.success(`🎉 Successfully purchased ${card.creatorName} #${card.cardNumber}!`);
        
        // Remove card from available cards
        setCards(prev => prev.filter(c => c.id !== card.id));
        
        // Update token balance
        onTokenUpdate();
        
        // Show card details
        setSelectedCard(card);
      } else {
        // Mock success for development
        // toast.success(`🎉 Successfully purchased ${card.creatorName} #${card.cardNumber}!`);
        setCards(prev => prev.filter(c => c.id !== card.id));
        onTokenUpdate();
        setSelectedCard(card);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to purchase card');
    } finally {
      setPurchasing(null);
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-orange-500';
      case 'epic': return 'from-purple-400 to-pink-500';
      case 'rare': return 'from-blue-400 to-indigo-500';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getRarityBorder = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'border-yellow-400 shadow-yellow-400/50 shadow-lg';
      case 'epic': return 'border-purple-400 shadow-purple-400/50 shadow-lg';
      case 'rare': return 'border-blue-400 shadow-blue-400/50 shadow-lg';
      default: return 'border-gray-400 shadow-gray-400/50';
    }
  };

  const getRarityGlow = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'hover:shadow-yellow-400/30 hover:shadow-2xl';
      case 'epic': return 'hover:shadow-purple-400/30 hover:shadow-2xl';
      case 'rare': return 'hover:shadow-blue-400/30 hover:shadow-2xl';
      default: return 'hover:shadow-gray-400/20';
    }
  };

  const getCardImage = (creator) => {
    // In production, these would be actual card images from Supabase Storage
    const cardImages = {
      'GamerGirl123': 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=300&h=300&fit=crop&crop=center',
      'MusicMaster': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center',
      'ArtistVibe': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=300&h=300&fit=crop&crop=center',
      'TechGuru2024': 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=300&h=300&fit=crop&crop=center',
      'FitnessQueen': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop&crop=center'
    };
    return cardImages[creator] || 'https://via.placeholder.com/300x300?text=Card';
  };

  const filteredCards = cards.filter(card => {
    const matchesCreator = selectedCreator === 'all' || card.creatorUsername === selectedCreator;
    const matchesSearch = searchQuery === '' || 
      card.creatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCreator && matchesSearch;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'creator':
        return a.creatorName.localeCompare(b.creatorName);
      case 'number':
        return a.cardNumber - b.cardNumber;
      case 'rarity':
        const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return rarityOrder[b.rarity] - rarityOrder[a.rarity];
      case 'newest':
        return new Date(b.mintedAt) - new Date(a.mintedAt);
      default:
        return 0;
    }
  });

  const CardModal = ({ card, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Card Purchased!</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          
          <div className={`relative bg-gradient-to-br ${getRarityColor(card.rarity)} rounded-xl p-6 text-white text-center mb-4`}>
            <div className="text-4xl mb-2">{card.creatorName.charAt(0)}</div>
            <h4 className="text-lg font-bold">{card.creatorName}</h4>
            <p className="text-sm opacity-90">#{card.cardNumber} / {card.totalSupply}</p>
            <p className="text-xs mt-2 uppercase tracking-wide">{card.rarity}</p>
          </div>
          
          <div className="text-center">
            <p className="text-gray-600 mb-4">This card has been added to your wallet!</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              View in Wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading cards...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🎴 Creator Cards Gallery</h2>
          <p className="text-gray-600">Collect limited edition creator cards • 10,000 tokens each</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-blue-600">{tokenBalance.toLocaleString()} tokens</div>
          <div className="text-sm text-gray-500">Your balance</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search creators..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Creator</label>
            <select
              value={selectedCreator}
              onChange={(e) => setSelectedCreator(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Creators</option>
              {creators.map(creator => (
                <option key={creator.username} value={creator.username}>
                  {creator.displayName}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="creator">Creator Name</option>
              <option value="number">Card Number</option>
              <option value="rarity">Rarity</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCreator('all');
                setSortBy('creator');
              }}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎴</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No cards available</h3>
          <p className="text-gray-600">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCards.map(card => (
            <div
              key={card.id}
              className={`bg-white border-2 ${getRarityBorder(card.rarity)} ${getRarityGlow(card.rarity)} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden hover:scale-105 transform cursor-pointer group`}
            >
              {/* Card Image */}
              <div className="relative">
                <img 
                  src={getCardImage(card.creatorUsername)} 
                  alt={`${card.creatorName} Card`}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/300x200?text=Creator+Card';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                
                {/* Rarity Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 rounded-full text-xs uppercase tracking-wide font-bold ${
                    card.rarity === 'legendary' ? 'bg-yellow-400 text-yellow-900' :
                    card.rarity === 'epic' ? 'bg-purple-400 text-purple-900' :
                    card.rarity === 'rare' ? 'bg-blue-400 text-blue-900' :
                    'bg-gray-400 text-gray-900'
                  }`}>
                    {card.rarity}
                  </span>
                </div>

                {/* Card Number Badge */}
                <div className="absolute top-2 left-2">
                  <span className="bg-black bg-opacity-75 text-white px-2 py-1 rounded-full text-xs font-bold">
                    #{card.cardNumber}
                  </span>
                </div>

                {/* Creator Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="text-lg font-bold">{card.creatorName}</h3>
                  <p className="text-sm opacity-90">{card.category}</p>
                </div>

                {/* Hover Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>

              {/* Card Details */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Card Number</span>
                  <span className="text-lg font-bold text-gray-900">#{card.cardNumber}</span>
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Edition</span>
                  <span className="text-sm text-gray-900">{card.cardNumber} / {card.totalSupply}</span>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-600">Price</span>
                  <span className="text-lg font-bold text-green-600">{card.price.toLocaleString()} tokens</span>
                </div>

                <button
                  onClick={() => handlePurchaseCard(card)}
                  disabled={purchasing === card.id || tokenBalance < card.price}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    tokenBalance < card.price
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : purchasing === card.id
                      ? 'bg-blue-400 text-white cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {purchasing === card.id ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Purchasing...
                    </div>
                  ) : tokenBalance < card.price ? (
                    'Insufficient Tokens'
                  ) : (
                    'Buy Now'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Purchase Success Modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* Info Panel */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">🎴 About Creator Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Limited Edition</h4>
            <p className="opacity-90">Each creator has exactly 1,000 unique cards. Once sold out, no more will be minted.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Tradeable</h4>
            <p className="opacity-90">Buy, sell, and trade cards with other users. Set your own prices for trades.</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Collectible</h4>
            <p className="opacity-90">Lower numbered cards are rarer. Build your collection and show off your favorite creators.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectibleCardsMarketplace;