// Virtual Gift Catalog with updated gifts and prices
const GIFT_CATALOG = [
  {
    id: 'rose',
    name: 'Rose',
    emoji: '🌹',
    cost: 200,
    rarity: 'common',
    animation: 'floating-roses',
    description: 'Send a beautiful rose to show appreciation',
    soundEffect: 'gift_common'
  },
  {
    id: 'bouquet',
    name: 'Bouquet',
    emoji: '💐',
    cost: 500,
    rarity: 'common',
    animation: 'flower-burst',
    description: 'A beautiful bouquet of flowers',
    soundEffect: 'gift_common'
  },
  {
    id: 'cake',
    name: 'Birthday Cake',
    emoji: '🎂',
    cost: 1000,
    rarity: 'rare',
    animation: 'birthday-celebration',
    description: 'Celebrate with a delicious cake',
    soundEffect: 'gift_rare'
  },
  {
    id: 'shopping',
    name: 'Shopping Bag',
    emoji: '🛍️',
    cost: 1500,
    rarity: 'rare',
    animation: 'shopping-spree',
    description: 'Luxury shopping spree',
    soundEffect: 'gift_rare'
  },
  {
    id: 'gold',
    name: 'Gold Bar',
    emoji: '🪙',
    cost: 2000,
    rarity: 'epic',
    animation: 'gold-rain',
    description: 'Solid gold bar - pure luxury',
    soundEffect: 'gift_epic'
  },
  {
    id: 'purse',
    name: 'Designer Purse',
    emoji: '👛',
    cost: 3500,
    rarity: 'epic',
    animation: 'luxury-shine',
    description: 'Exclusive designer purse',
    soundEffect: 'gift_epic'
  },
  {
    id: 'diamond',
    name: 'Diamond',
    emoji: '💎',
    cost: 5000,
    rarity: 'legendary',
    animation: 'diamond-sparkle',
    description: 'A precious diamond that sparkles',
    soundEffect: 'gift_legendary'
  },
  {
    id: 'car',
    name: 'Sports Car',
    emoji: '🚗',
    cost: 7000,
    rarity: 'legendary',
    animation: 'car-drive',
    description: 'Luxury sports car drives across screen',
    soundEffect: 'gift_legendary'
  },
  {
    id: 'castle',
    name: 'Castle',
    emoji: '🏰',
    cost: 10000,
    rarity: 'mythic',
    animation: 'castle-build',
    description: 'Build an epic castle',
    soundEffect: 'gift_mythic'
  },
  {
    id: 'rocket',
    name: 'Rocket',
    emoji: '🚀',
    cost: 25000,
    rarity: 'mythic',
    animation: 'rocket-launch',
    description: 'Launch a rocket to the moon!',
    soundEffect: 'gift_mythic'
  }
];

// Get gift by ID
function getGiftById(giftId) {
  return GIFT_CATALOG.find(gift => gift.id === giftId);
}

// Get gifts by rarity
function getGiftsByRarity(rarity) {
  return GIFT_CATALOG.filter(gift => gift.rarity === rarity);
}

// Validate if user has enough tokens for gift
function canAffordGift(giftId, userTokens) {
  const gift = getGiftById(giftId);
  return gift && userTokens >= gift.cost;
}

// Calculate creator earnings from gift (after platform fee)
function calculateCreatorEarnings(giftCost, platformFeePercent = 20) {
  const platformFee = (giftCost * platformFeePercent) / 100;
  return giftCost - platformFee;
}

// Get gift leaderboard stats
function calculateGiftStats(giftTransactions) {
  const stats = {};
  
  giftTransactions.forEach(transaction => {
    const userId = transaction.sender_id;
    if (!stats[userId]) {
      stats[userId] = {
        userId,
        userName: transaction.sender_name,
        userAvatar: transaction.sender_avatar,
        totalSpent: 0,
        giftCount: 0,
        favoriteGift: null,
        giftTypes: {}
      };
    }
    
    stats[userId].totalSpent += transaction.amount;
    stats[userId].giftCount += 1;
    
    // Track gift types
    const giftType = transaction.gift_type;
    stats[userId].giftTypes[giftType] = (stats[userId].giftTypes[giftType] || 0) + 1;
  });
  
  // Calculate favorite gifts
  Object.values(stats).forEach(user => {
    const favoriteType = Object.entries(user.giftTypes)
      .sort((a, b) => b[1] - a[1])[0];
    if (favoriteType) {
      user.favoriteGift = getGiftById(favoriteType[0]);
    }
  });
  
  return Object.values(stats).sort((a, b) => b.totalSpent - a.totalSpent);
}

module.exports = {
  GIFT_CATALOG,
  getGiftById,
  getGiftsByRarity,
  canAffordGift,
  calculateCreatorEarnings,
  calculateGiftStats
};