import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CurrencyDollarIcon,
  UsersIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  PencilIcon,
  LockClosedIcon,
  ChartBarIcon,
  BoltIcon,
  StarIcon,
  ArrowUpIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  GiftIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase-auth';
import { 
  SUBSCRIPTION_TIERS, 
  TIER_PRICING_RULES, 
  PRICING_TEMPLATES,
  validateTierPricing,
  getTierComparison 
} from '../config/subscriptionTiers';
import toast from 'react-hot-toast';

const CreatorSubscriptionTiersEnhanced = ({ user, isCreator }) => {
  const navigate = useNavigate();

  // Default tier prices in tokens
  const DEFAULT_TIER_PRICES = {
    bronze: 100,      // $5/month
    silver: 200,      // $10/month
    gold: 400,        // $20/month
    platinum: 1000    // $50/month
  };

  const [tierPrices, setTierPrices] = useState(DEFAULT_TIER_PRICES);
  const [originalPrices, setOriginalPrices] = useState({});
  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    monthlyRecurringRevenue: 0,
    tierDistribution: {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [hoveredTier, setHoveredTier] = useState(null);

  useEffect(() => {
    if (isCreator) {
      loadCreatorData();
    }
  }, [user, isCreator]);

  const loadCreatorData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      // Load creator's tier pricing
      const pricingResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/creator/${user.id}/tier-pricing`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (pricingResponse.ok) {
        const pricingData = await pricingResponse.json();
        if (pricingData.prices && Object.keys(pricingData.prices).length > 0) {
          setTierPrices(pricingData.prices);
          setOriginalPrices(pricingData.prices);
        } else {
          // Use default prices if none are set
          setTierPrices(DEFAULT_TIER_PRICES);
          setOriginalPrices(DEFAULT_TIER_PRICES);
        }
      } else {
        // Use default prices if fetch fails
        setTierPrices(DEFAULT_TIER_PRICES);
        setOriginalPrices(DEFAULT_TIER_PRICES);
      }

      // Load subscribers and stats
      const subscribersResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/my-subscribers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (subscribersResponse.ok) {
        const subscribersData = await subscribersResponse.json();
        setSubscribers(subscribersData.subscribers || []);
        
        // Calculate stats
        const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
        let totalRevenue = 0;
        
        subscribersData.subscribers?.forEach(sub => {
          if (tierCounts[sub.tier] !== undefined) {
            tierCounts[sub.tier]++;
            totalRevenue += tierPrices[sub.tier] || 0;
          }
        });
        
        setStats({
          totalSubscribers: subscribersData.subscribers?.length || 0,
          monthlyRecurringRevenue: totalRevenue,
          tierDistribution: tierCounts
        });
      }
    } catch (error) {
      console.error('Error loading creator data:', error);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (tier, value) => {
    const newPrices = { ...tierPrices, [tier]: parseInt(value) || 0 };
    setTierPrices(newPrices);
    
    // Validate pricing
    const errors = validateTierPricing(newPrices);
    setValidationErrors(errors);
  };

  const applyTemplate = (templateKey) => {
    const template = PRICING_TEMPLATES[templateKey];
    if (template) {
      setTierPrices(template.prices);
      setSelectedTemplate(templateKey);
      setValidationErrors({});
    }
  };

  const savePricing = async () => {
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please fix pricing errors before saving');
      return;
    }
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/creator/tier-pricing`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ prices: tierPrices })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to save pricing');
      }
      
      setOriginalPrices(tierPrices);
      setEditMode(false);
      toast.success('Pricing updated successfully!');
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast.error('Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setTierPrices(originalPrices);
    setEditMode(false);
    setValidationErrors({});
    setSelectedTemplate('');
  };

  const handleSubscribe = async (tierKey) => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        toast.error('Please sign in to subscribe');
        return;
      }

      // Show loading state
      toast.loading('Processing subscription...');

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/subscriptions/subscribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            creatorId: user.id,
            tier: tierKey,
            price: tierPrices[tierKey]
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to subscribe');
      }

      toast.dismiss();
      toast.success(`Successfully subscribed to ${SUBSCRIPTION_TIERS[tierKey].name} tier!`);
      
      // Reload data to show updated subscription
      loadCreatorData();
    } catch (error) {
      toast.dismiss();
      console.error('Subscription error:', error);
      toast.error(error.message || 'Failed to process subscription');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Subscription Tiers
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Set your pricing and manage subscriber benefits
            </p>
          </div>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <PencilIcon className="w-5 h-5" />
              Edit Pricing
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePricing}
                disabled={saving || Object.keys(validationErrors).length > 0}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  saving || Object.keys(validationErrors).length > 0
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <CheckIcon className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Pricing'}
              </button>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Total Subscribers</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.totalSubscribers}</p>
              </div>
              <UsersIcon className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Monthly Revenue</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {stats.monthlyRecurringRevenue} tokens
                </p>
                {isCreator && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ≈ ${(stats.monthlyRecurringRevenue * 0.05).toFixed(2)} USD
                  </p>
                )}
              </div>
              <CurrencyDollarIcon className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Most Popular</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {Object.entries(stats.tierDistribution)
                    .sort(([,a], [,b]) => b - a)[0]?.[0]?.charAt(0).toUpperCase() + 
                   Object.entries(stats.tierDistribution)
                    .sort(([,a], [,b]) => b - a)[0]?.[0]?.slice(1) || 'None'}
                </p>
              </div>
              <ArrowTrendingUpIcon className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Templates (only in edit mode) */}
      {editMode && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Quick Templates
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRICING_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => applyTemplate(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedTemplate === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tier Cards with Pricing and Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            onMouseEnter={() => setHoveredTier(key)}
            onMouseLeave={() => setHoveredTier(null)}
            className={`bg-white dark:bg-gray-800 rounded-xl border-2 ${
              tier.mostPopular 
                ? 'border-purple-500 shadow-xl' 
                : 'border-gray-200 dark:border-gray-700'
            } overflow-hidden flex flex-col relative transform transition-all duration-300`}
          >
            {tier.mostPopular && (
              <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
                MOST POPULAR
              </div>
            )}

            {/* Header */}
            <div className="p-6 text-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
              <motion.div 
                className="text-5xl mb-3"
                animate={{ 
                  scale: hoveredTier === key ? 1.1 : 1,
                  rotate: hoveredTier === key ? [0, -10, 10, 0] : 0
                }}
                transition={{ duration: 0.3 }}
              >
                {tier.emoji}
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {tier.name}
              </h3>
              {stats.tierDistribution[key] > 0 && (
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1 font-medium">
                  {stats.tierDistribution[key]} subscribers
                </p>
              )}
            </div>

            {/* Pricing */}
            <div className="px-6 py-4 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
              {editMode ? (
                <div>
                  <input
                    type="number"
                    value={tierPrices[key]}
                    onChange={(e) => handlePriceChange(key, e.target.value)}
                    min={TIER_PRICING_RULES[key].min}
                    max={TIER_PRICING_RULES[key].max}
                    className={`w-full px-4 py-3 text-center text-2xl font-bold border-2 rounded-lg focus:ring-2 focus:ring-purple-500 transition-all ${
                      validationErrors[key]
                        ? 'border-red-500 bg-red-50 text-red-600'
                        : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                    } dark:bg-gray-700`}
                  />
                  <p className="text-xs text-center mt-1 text-gray-500">tokens/month</p>
                  {validationErrors[key] && (
                    <p className="text-xs text-red-500 mt-2 text-center">{validationErrors[key]}</p>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {tierPrices[key]} tokens
                  </div>
                  {isCreator && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      ${(tierPrices[key] * 0.05).toFixed(2)}/month
                    </div>
                  )}
                  {!isCreator && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      per month
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Key Benefits */}
            <div className="flex-1 p-6 space-y-3 bg-white dark:bg-gray-800">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                What's Included
              </div>
              
              {/* Show first 4 benefits */}
              {tier.benefits.slice(0, 4).map((benefit, index) => (
                <motion.div 
                  key={index} 
                  className="flex items-start gap-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{benefit}</span>
                </motion.div>
              ))}
              
              {/* Show additional benefits count if any */}
              {tier.benefits.length > 4 && (
                <motion.p 
                  className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-3 flex items-center gap-1"
                  whileHover={{ scale: 1.05 }}
                >
                  <SparklesIcon className="w-3 h-3" />
                  +{tier.benefits.length - 4} more benefits
                </motion.p>
              )}

              {/* Special features icons */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {tier.features.messaging && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <BoltIcon className="w-4 h-4 text-yellow-500" />
                    <span>Free Chat</span>
                  </div>
                )}
                {tier.features.streams && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <StarIcon className="w-4 h-4 text-purple-500" />
                    <span>Free Streams</span>
                  </div>
                )}
                {tier.features.classes && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <GiftIcon className="w-4 h-4 text-pink-500" />
                    <span>Free Classes</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button - Show different content for creators vs fans */}
            {!editMode && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900">
                {isCreator ? (
                  // For creators - show subscriber count or pricing info
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stats.tierDistribution[key] > 0 ? (
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          {stats.tierDistribution[key]} active {stats.tierDistribution[key] === 1 ? 'subscriber' : 'subscribers'}
                        </span>
                      ) : (
                        <span>No subscribers yet</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Earning {tierPrices[key]} tokens/month per subscriber
                    </div>
                  </div>
                ) : (
                  // For fans/visitors - show subscribe button
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSubscribe(key)}
                    className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all ${
                      tier.mostPopular
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Subscribe to {tier.name}
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Pricing Rules Info - Only show in edit mode */}
      {editMode && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-800 dark:text-purple-200">
              <p className="font-medium mb-2">Pricing Guidelines:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Silver must be at least 1.5x Bronze price</li>
                <li>Gold must be at least 2.5x Bronze price</li>
                <li>Platinum must be at least 4x Bronze price</li>
                <li>Each tier must be priced higher than the previous</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Subscriber Summary with View All Button */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-purple-500" />
            Subscribers Summary
          </h3>
          <button
            onClick={() => navigate('/subscribers')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>View All Subscribers</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Subscriber Stats by Tier */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(SUBSCRIPTION_TIERS).map(([tier, tierData]) => {
            const tierCount = subscribers.filter(sub => sub.tier === tier).length;
            return (
              <div key={tier} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl">{tierData.emoji}</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {tierCount}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{tierData.name}</p>
              </div>
            );
          })}
        </div>

        {/* Total Subscribers */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Active Subscribers</span>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {subscribers.length}
            </span>
          </div>
          {subscribers.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              No subscribers yet. Share your profile to grow your fanbase!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorSubscriptionTiersEnhanced;