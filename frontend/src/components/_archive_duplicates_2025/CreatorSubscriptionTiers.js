import React, { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  UsersIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  PencilIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
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

const CreatorSubscriptionTiers = ({ user, isCreator }) => {
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
        `${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/creator/${user.id}/tier-pricing`,
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
        `${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/my-subscribers`,
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
        `${import.meta.env.VITE_BACKEND_URL}/api/subscriptions/creator/tier-pricing`,
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
            className={`bg-white dark:bg-gray-800 rounded-xl border-2 ${
              tier.mostPopular 
                ? 'border-purple-500 shadow-xl relative' 
                : 'border-gray-200 dark:border-gray-700'
            } overflow-hidden flex flex-col`}
          >
            {tier.mostPopular && (
              <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                MOST POPULAR
              </div>
            )}

            {/* Header */}
            <div className="p-6 text-center border-b border-gray-100 dark:border-gray-700">
              <div className="text-4xl mb-2">{tier.emoji}</div>
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
            <div className="p-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
              {editMode ? (
                <div>
                  <input
                    type="number"
                    value={tierPrices[key]}
                    onChange={(e) => handlePriceChange(key, e.target.value)}
                    min={TIER_PRICING_RULES[key].min}
                    max={TIER_PRICING_RULES[key].max}
                    className={`w-full px-4 py-3 text-center text-2xl font-bold border-2 rounded-lg focus:ring-2 focus:ring-purple-500 ${
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
            <div className="flex-1 p-6 space-y-3">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Includes
              </div>
              {tier.benefits.slice(0, 4).map((benefit, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{benefit}</span>
                </div>
              ))}
              {tier.benefits.length > 4 && (
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-2">
                  +{tier.benefits.length - 4} more benefits
                </p>
              )}
            </div>
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

      {/* Recent Subscribers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-purple-500" />
          Recent Subscribers
        </h3>
        {subscribers.length > 0 ? (
          <div className="space-y-3">
            {subscribers.slice(0, 5).map((subscriber) => (
              <div
                key={subscriber.id}
                className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                    {subscriber.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {subscriber.username}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Since {new Date(subscriber.subscribedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {SUBSCRIPTION_TIERS[subscriber.tier]?.emoji}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {SUBSCRIPTION_TIERS[subscriber.tier]?.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No subscribers yet. Share your profile to grow your fanbase!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorSubscriptionTiers;