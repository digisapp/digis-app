import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import Tooltip from './ui/Tooltip';
import { apiClient } from '../services/api';

const DualBadgeDisplay = ({ 
  userId, 
  creatorId = null, 
  size = 'medium', 
  showTooltip = true,
  className = '',
  onBadgeClick = null
}) => {
  const [badges, setBadges] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBadges();
  }, [userId, creatorId]);

  const fetchBadges = async () => {
    try {
      const response = await apiClient.get(`/api/loyalty/badges/${userId}`, {
        params: { creatorId }
      });
      setBadges(response.data.badges);
    } catch (error) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSizeClasses = () => {
    const sizes = {
      small: 'text-xs px-1.5 py-0.5',
      medium: 'text-sm px-2 py-1',
      large: 'text-base px-3 py-1.5'
    };
    return sizes[size] || sizes.medium;
  };

  const getSubscriptionColor = (tier) => {
    if (!tier) return 'bg-gray-600';
    
    const tierLower = tier.toLowerCase();
    if (tierLower.includes('vip') || tierLower.includes('premium')) {
      return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
    }
    if (tierLower.includes('gold')) {
      return 'bg-gradient-to-r from-yellow-400 to-amber-500';
    }
    if (tierLower.includes('silver')) {
      return 'bg-gradient-to-r from-gray-400 to-gray-500';
    }
    if (tierLower.includes('bronze')) {
      return 'bg-gradient-to-r from-orange-600 to-orange-700';
    }
    return 'bg-purple-600';
  };

  const getLoyaltyColor = (level) => {
    const colors = {
      diamond: 'bg-gradient-to-r from-blue-500 to-purple-600',
      gold: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
      silver: 'bg-gradient-to-r from-gray-400 to-gray-500',
      bronze: 'bg-gradient-to-r from-orange-500 to-orange-600'
    };
    return colors[level] || 'bg-gray-600';
  };

  const renderSubscriptionBadge = () => {
    if (!badges?.subscription) return null;

    const badge = (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        className={`
          ${getSubscriptionColor(badges.subscription.tier)}
          ${getSizeClasses()}
          rounded-full text-white font-semibold
          shadow-lg cursor-pointer select-none
          flex items-center gap-1
        `}
        onClick={() => onBadgeClick?.('subscription', badges.subscription)}
      >
        <span>{badges.subscription.emoji || '⭐'}</span>
        <span>{badges.subscription.displayName || badges.subscription.tier}</span>
      </motion.div>
    );

    if (!showTooltip) return badge;

    return (
      <Tooltip
        content={
          <div className="text-xs">
            <p className="font-semibold mb-1">Subscription Benefits:</p>
            <ul className="space-y-0.5">
              <li>• Monthly subscription active</li>
              <li>• Exclusive content access</li>
              <li>• Priority support</li>
              <li>• Member since {new Date().toLocaleDateString()}</li>
            </ul>
          </div>
        }
      >
        {badge}
      </Tooltip>
    );
  };

  const renderLoyaltyBadge = () => {
    if (!badges?.loyalty || badges.loyalty.level === 'none') return null;

    const badge = (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        transition={{ delay: 0.1 }}
        className={`
          ${getLoyaltyColor(badges.loyalty.level)}
          ${getSizeClasses()}
          rounded-full text-white font-semibold
          shadow-lg cursor-pointer select-none
          flex items-center gap-1
        `}
        onClick={() => onBadgeClick?.('loyalty', badges.loyalty)}
      >
        <span className="text-lg">{badges.loyalty.emoji}</span>
        {size !== 'small' && (
          <span className="capitalize">{badges.loyalty.level}</span>
        )}
      </motion.div>
    );

    if (!showTooltip) return badge;

    return (
      <Tooltip
        content={
          <div className="text-xs">
            <p className="font-semibold mb-1">{badges.loyalty.level} Loyalty Status</p>
            <ul className="space-y-0.5">
              <li>• Total spent: ${badges.loyalty.totalSpend}</li>
              <li>• Supporting for {badges.loyalty.supportDays} days</li>
              {badges.loyalty.perks?.slice(0, 3).map((perk, i) => (
                <li key={i}>• {perk}</li>
              ))}
            </ul>
          </div>
        }
      >
        {badge}
      </Tooltip>
    );
  };

  const renderCombinedStats = () => {
    if (!badges || size === 'small') return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 ml-2"
      >
        {badges.subscription && badges.loyalty.level !== 'none' && (
          <span className="text-purple-500 font-medium">
            VIP Member
          </span>
        )}
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full h-6 w-16"></div>
        <div className="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full h-6 w-16"></div>
      </div>
    );
  }

  if (!badges) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <AnimatePresence>
        {renderSubscriptionBadge()}
        {renderLoyaltyBadge()}
        {renderCombinedStats()}
      </AnimatePresence>
    </div>
  );
};

DualBadgeDisplay.propTypes = {
  userId: PropTypes.string.isRequired,
  creatorId: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  showTooltip: PropTypes.bool,
  className: PropTypes.string,
  onBadgeClick: PropTypes.func
};

export default DualBadgeDisplay;