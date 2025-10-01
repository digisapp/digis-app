/**
 * Gifter Tiers Utility
 * Medieval nobility tier system based on lifetime token spending
 */

// Tier definitions with thresholds and colors
const GIFTER_TIERS = [
  { 
    name: 'Crown', 
    displayName: 'Crown Gifter',
    minTokens: 1000000, 
    color: '#FF4500',
    order: 7,
    description: 'Fiery orange-red, marking the ultimate loyalty akin to a royal patron'
  },
  { 
    name: 'Duke', 
    displayName: 'Duke Gifter',
    minTokens: 100000, 
    color: '#9B59B6',
    order: 6,
    description: 'Regal purple, reserved for the elite loyalty of a duke, close to royalty'
  },
  { 
    name: 'Count', 
    displayName: 'Count Gifter',
    minTokens: 50000, 
    color: '#4169E1',
    order: 5,
    description: 'Deep blue, denoting the noble authority of a count in the royal court'
  },
  { 
    name: 'Baron', 
    displayName: 'Baron Gifter',
    minTokens: 20000, 
    color: '#FFD700',
    order: 4,
    description: 'Rich gold, signifying the rising status of a landed baron'
  },
  { 
    name: 'Knight', 
    displayName: 'Knight Gifter',
    minTokens: 10000, 
    color: '#B22222',
    order: 3,
    description: 'Bold red, reflecting the valor and sworn fealty of a knight'
  },
  { 
    name: 'Squire', 
    displayName: 'Squire Gifter',
    minTokens: 2500, 
    color: '#008080',
    order: 2,
    description: 'Vibrant teal, symbolizing the aspiring loyalty of a squire serving a knight'
  },
  { 
    name: 'Supporter', 
    displayName: 'Supporter',
    minTokens: 0, 
    color: '#5C4033',
    order: 1,
    description: 'Earthy brown for common supporters, evoking the humble loyalty of medieval villagers'
  }
];

/**
 * Calculate user's gifter tier based on lifetime tokens spent
 * @param {number} lifetimeTokensSpent - Total tokens spent by user
 * @returns {object} Tier object with name, displayName, color, etc.
 */
function calculateGifterTier(lifetimeTokensSpent) {
  const tokensSpent = lifetimeTokensSpent || 0;
  
  // Find the highest tier the user qualifies for
  for (const tier of GIFTER_TIERS) {
    if (tokensSpent >= tier.minTokens) {
      return tier;
    }
  }
  
  // Default to Supporter tier
  return GIFTER_TIERS[GIFTER_TIERS.length - 1];
}

/**
 * Get tier by name
 * @param {string} tierName - Name of the tier
 * @returns {object|null} Tier object or null if not found
 */
function getTierByName(tierName) {
  return GIFTER_TIERS.find(tier => tier.name === tierName) || null;
}

/**
 * Get next tier information
 * @param {number} lifetimeTokensSpent - Current tokens spent
 * @returns {object|null} Next tier info with tokens needed
 */
function getNextTier(lifetimeTokensSpent) {
  const currentTier = calculateGifterTier(lifetimeTokensSpent);
  
  // Find the next tier above current
  const nextTierIndex = GIFTER_TIERS.findIndex(tier => tier.name === currentTier.name) - 1;
  
  if (nextTierIndex >= 0) {
    const nextTier = GIFTER_TIERS[nextTierIndex];
    return {
      ...nextTier,
      tokensNeeded: nextTier.minTokens - lifetimeTokensSpent
    };
  }
  
  return null; // Already at highest tier
}

/**
 * Get all tiers sorted by order
 * @returns {array} Array of all tier definitions
 */
function getAllTiers() {
  return [...GIFTER_TIERS].sort((a, b) => a.order - b.order);
}

/**
 * Format tier info for API response
 * @param {object} user - User object with lifetime_tokens_spent
 * @returns {object} Formatted tier information
 */
function formatUserTierInfo(user) {
  const lifetimeTokensSpent = user.lifetime_tokens_spent || 0;
  const currentTier = calculateGifterTier(lifetimeTokensSpent);
  const nextTier = getNextTier(lifetimeTokensSpent);
  
  return {
    current: {
      name: currentTier.name,
      displayName: currentTier.displayName,
      color: currentTier.color,
      description: currentTier.description
    },
    next: nextTier ? {
      name: nextTier.name,
      displayName: nextTier.displayName,
      color: nextTier.color,
      tokensNeeded: nextTier.tokensNeeded,
      description: nextTier.description
    } : null,
    lifetimeTokensSpent,
    progress: nextTier ? {
      current: lifetimeTokensSpent,
      needed: nextTier.minTokens,
      percentage: Math.min(100, (lifetimeTokensSpent / nextTier.minTokens) * 100)
    } : null
  };
}

/**
 * Update user tier in database
 * @param {object} db - Database connection
 * @param {string} userId - User's supabase_id
 * @param {number} tokensSpent - Amount of tokens spent in transaction
 * @returns {object} Updated tier info
 */
async function updateUserTier(db, userId, tokensSpent = 0) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Update lifetime tokens spent
    const updateResult = await client.query(
      `UPDATE users 
       SET lifetime_tokens_spent = COALESCE(lifetime_tokens_spent, 0) + $1
       WHERE supabase_id = $2
       RETURNING lifetime_tokens_spent`,
      [tokensSpent, userId]
    );
    
    if (updateResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const lifetimeTokensSpent = updateResult.rows[0].lifetime_tokens_spent;
    
    // Calculate new tier
    const newTier = calculateGifterTier(lifetimeTokensSpent);
    
    // Update user's tier if changed
    const tierUpdateResult = await client.query(
      `UPDATE users 
       SET gifter_tier = $1, 
           gifter_tier_color = $2,
           gifter_tier_achieved_at = CASE 
             WHEN gifter_tier != $1 THEN CURRENT_TIMESTAMP 
             ELSE gifter_tier_achieved_at 
           END
       WHERE supabase_id = $3
       RETURNING gifter_tier, gifter_tier_color`,
      [newTier.name, newTier.color, userId]
    );
    
    // Record tier achievement if it's a new tier
    await client.query(
      `INSERT INTO gifter_tier_history (user_id, tier_name, tokens_spent)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, tier_name) DO NOTHING`,
      [userId, newTier.name, lifetimeTokensSpent]
    );
    
    await client.query('COMMIT');
    
    return {
      tier: newTier.name,
      displayName: newTier.displayName,
      color: newTier.color,
      lifetimeTokensSpent
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get tier statistics for analytics
 * @param {object} db - Database connection
 * @returns {object} Tier distribution statistics
 */
async function getTierStatistics(db) {
  const query = `
    SELECT 
      gifter_tier as tier,
      COUNT(*) as user_count,
      SUM(lifetime_tokens_spent) as total_tokens,
      AVG(lifetime_tokens_spent) as avg_tokens
    FROM users
    WHERE lifetime_tokens_spent > 0
    GROUP BY gifter_tier
    ORDER BY AVG(lifetime_tokens_spent) DESC
  `;
  
  const result = await db.query(query);
  
  return {
    distribution: result.rows,
    totalUsers: result.rows.reduce((sum, row) => sum + parseInt(row.user_count), 0),
    totalTokensSpent: result.rows.reduce((sum, row) => sum + parseInt(row.total_tokens), 0)
  };
}

/**
 * Get top gifters leaderboard
 * @param {object} db - Database connection
 * @param {number} limit - Number of users to return
 * @param {string} creatorId - Optional creator ID to filter by
 * @returns {array} Top gifters with tier info
 */
async function getTopGifters(db, limit = 10, creatorId = null) {
  let query;
  let params;
  
  if (creatorId) {
    // Top gifters for specific creator
    query = `
      SELECT 
        u.supabase_id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.lifetime_tokens_spent,
        u.gifter_tier,
        u.gifter_tier_color,
        COALESCE(SUM(tt.amount), 0) as creator_tokens_spent
      FROM users u
      LEFT JOIN token_transactions tt ON tt.user_id = u.supabase_id
        AND tt.recipient_id = $1
        AND tt.transaction_type IN ('tip', 'gift', 'session', 'message', 'content')
      WHERE u.lifetime_tokens_spent > 0
      GROUP BY u.supabase_id
      ORDER BY creator_tokens_spent DESC, u.lifetime_tokens_spent DESC
      LIMIT $2
    `;
    params = [creatorId, limit];
  } else {
    // Global top gifters
    query = `
      SELECT 
        supabase_id,
        username,
        display_name,
        avatar_url,
        lifetime_tokens_spent,
        gifter_tier,
        gifter_tier_color
      FROM users
      WHERE lifetime_tokens_spent > 0
      ORDER BY lifetime_tokens_spent DESC
      LIMIT $1
    `;
    params = [limit];
  }
  
  const result = await db.query(query, params);
  
  return result.rows.map((user, index) => ({
    rank: index + 1,
    ...user,
    tierInfo: getTierByName(user.gifter_tier)
  }));
}

module.exports = {
  GIFTER_TIERS,
  calculateGifterTier,
  getTierByName,
  getNextTier,
  getAllTiers,
  formatUserTierInfo,
  updateUserTier,
  getTierStatistics,
  getTopGifters
};